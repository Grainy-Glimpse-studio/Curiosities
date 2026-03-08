import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, Minus, Maximize2, Minimize2, FileAudio, FileVideo, Loader2, Check, AlertCircle } from 'lucide-react';

interface UploadTapeProps {
  titleFont: string;
  contentFont: string;
  shouldAllowClick?: () => boolean;
  onTranscriptionComplete?: (result: {
    audioBlob: Blob;
    audioUrl: string;
    fileName: string;
    duration: number;
  }) => void;
}

type ProcessingStatus = 'idle' | 'converting' | 'ready' | 'error';

const UploadTape: React.FC<UploadTapeProps> = ({
  titleFont,
  contentFont,
  shouldAllowClick,
  onTranscriptionComplete,
}) => {
  const [isWindowOpen, setIsWindowOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [duration, setDuration] = useState<number>(0);

  // Window state
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [size, setSize] = useState({ width: 500, height: 420 });
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [prevState, setPrevState] = useState({ position: { x: 100, y: 100 }, size: { width: 500, height: 420 } });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });

  // Center window on open
  const openWindow = () => {
    if (typeof window !== 'undefined') {
      setPosition({
        x: (window.innerWidth - size.width) / 2,
        y: (window.innerHeight - size.height) / 2,
      });
    }
    setIsWindowOpen(true);
  };

  const closeWindow = () => {
    setIsWindowOpen(false);
    resetState();
  };

  const resetState = () => {
    setSelectedFile(null);
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
    setProcessingStatus('idle');
    setErrorMessage('');
    setDuration(0);
  };

  // File handling
  const handleFile = useCallback(async (file: File) => {
    const isAudio = file.type.startsWith('audio/');
    const isVideo = file.type.startsWith('video/');

    if (!isAudio && !isVideo) {
      setErrorMessage('Please upload an audio or video file');
      setProcessingStatus('error');
      return;
    }

    setSelectedFile(file);
    setErrorMessage('');

    if (isAudio) {
      // Audio file - use directly
      const url = URL.createObjectURL(file);
      setAudioBlob(file);
      setAudioUrl(url);
      setProcessingStatus('ready');

      // Get duration
      const audio = new Audio(url);
      audio.addEventListener('loadedmetadata', () => {
        setDuration(audio.duration);
      });
    } else if (isVideo) {
      // Video file - need to extract audio
      setProcessingStatus('converting');
      try {
        await extractAudioFromVideo(file);
      } catch (error) {
        console.error('Error extracting audio:', error);
        setErrorMessage('Failed to extract audio from video');
        setProcessingStatus('error');
      }
    }
  }, []);

  // Extract audio from video using Web Audio API
  const extractAudioFromVideo = async (videoFile: File) => {
    return new Promise<void>((resolve, reject) => {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(videoFile);
      video.muted = true;

      video.onloadedmetadata = async () => {
        try {
          const audioContext = new AudioContext();
          const response = await fetch(video.src);
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

          // Convert AudioBuffer to WAV
          const wavBlob = audioBufferToWav(audioBuffer);
          const url = URL.createObjectURL(wavBlob);

          setAudioBlob(wavBlob);
          setAudioUrl(url);
          setDuration(audioBuffer.duration);
          setProcessingStatus('ready');

          URL.revokeObjectURL(video.src);
          await audioContext.close();
          resolve();
        } catch (error) {
          reject(error);
        }
      };

      video.onerror = () => {
        reject(new Error('Failed to load video'));
      };
    });
  };

  // Convert AudioBuffer to WAV format
  const audioBufferToWav = (buffer: AudioBuffer): Blob => {
    const numChannels = 1; // Mono
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    // Mix down to mono
    const channelData = buffer.getChannelData(0);
    const samples = new Int16Array(channelData.length);
    for (let i = 0; i < channelData.length; i++) {
      const s = Math.max(-1, Math.min(1, channelData[i]));
      samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    const dataLength = samples.length * 2;
    const bufferLength = 44 + dataLength;
    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);

    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, bufferLength - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * bitDepth / 8, true);
    view.setUint16(32, numChannels * bitDepth / 8, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, dataLength, true);

    // Write audio data
    const offset = 44;
    for (let i = 0; i < samples.length; i++) {
      view.setInt16(offset + i * 2, samples[i], true);
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  // Window controls
  const toggleMaximize = () => {
    if (isMaximized) {
      setPosition(prevState.position);
      setSize(prevState.size);
      setIsMaximized(false);
    } else {
      setPrevState({ position, size });
      setPosition({ x: 20, y: 20 });
      setSize({ width: window.innerWidth - 40, height: window.innerHeight - 40 });
      setIsMaximized(true);
    }
  };

  const handleDragStart = (e: React.MouseEvent) => {
    if (isMaximized) return;
    e.preventDefault();
    dragStartPos.current = { x: e.clientX - position.x, y: e.clientY - position.y };

    const handleDrag = (e: MouseEvent) => {
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - size.width, e.clientX - dragStartPos.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - 50, e.clientY - dragStartPos.current.y)),
      });
    };

    const handleDragEnd = () => {
      window.removeEventListener('mousemove', handleDrag);
      window.removeEventListener('mouseup', handleDragEnd);
    };

    window.addEventListener('mousemove', handleDrag);
    window.addEventListener('mouseup', handleDragEnd);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle transcription start (placeholder - will be implemented with API)
  const handleStartTranscription = () => {
    if (audioBlob && audioUrl && selectedFile) {
      console.log('[UploadTape] Ready to transcribe:', {
        fileName: selectedFile.name,
        duration,
        audioBlob,
      });
      // TODO: Call transcription API here
      if (onTranscriptionComplete) {
        onTranscriptionComplete({
          audioBlob,
          audioUrl,
          fileName: selectedFile.name,
          duration,
        });
      }
    }
  };

  // Floating window content
  const windowContent = (
    <AnimatePresence>
      {isWindowOpen && (
        <motion.div
          ref={windowRef}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
          transition={{ duration: 0.3 }}
          className="fixed z-[200] flex flex-col backdrop-blur-2xl rounded-2xl shadow-2xl overflow-hidden border border-white/60"
          style={{
            left: position.x,
            top: position.y,
            width: isMinimized ? 300 : size.width,
            height: isMinimized ? 48 : size.height,
            backgroundColor: 'rgba(255, 255, 255, 0)',
          }}
        >
          {/* Title bar */}
          <div
            className="flex items-center justify-between px-6 py-4 bg-transparent border-b border-white/20 cursor-move select-none shrink-0"
            onMouseDown={handleDragStart}
          >
            <div className="flex flex-col">
              <span className="text-[10px] text-white/60 font-bold tracking-widest uppercase">
                UPLOAD
              </span>
              <span className="text-white text-lg" style={{ fontFamily: titleFont }}>
                Audio / Video
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1 text-white/40 hover:text-white transition-colors"
              >
                <Minus size={14} />
              </button>
              <button
                onClick={toggleMaximize}
                className="p-1 text-white/40 hover:text-white transition-colors"
              >
                {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
              <button
                onClick={closeWindow}
                className="p-1 text-white/40 hover:text-red-400 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Content */}
          {!isMinimized && (
            <div className="flex-1 flex flex-col p-6">
              {/* Drop zone */}
              <div
                className={`flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-xl transition-all ${
                  isDragging
                    ? 'border-violet-400 bg-violet-500/10'
                    : selectedFile
                    ? 'border-white/30 bg-white/5'
                    : 'border-white/20 hover:border-white/40 hover:bg-white/5'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*,video/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {processingStatus === 'idle' && !selectedFile && (
                  <div className="text-center">
                    <Upload size={40} className="mx-auto mb-4 text-white/40" />
                    <p className="text-white/80 text-sm mb-2" style={{ fontFamily: contentFont }}>
                      Drop audio or video file here
                    </p>
                    <p className="text-white/40 text-xs mb-4">
                      MP3, WAV, MP4, MOV, WebM...
                    </p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 rounded-full bg-white/5 hover:bg-white/15 text-white/60 hover:text-white border border-white/10 hover:border-white/20 transition-colors text-sm"
                    >
                      Browse Files
                    </button>
                  </div>
                )}

                {processingStatus === 'converting' && (
                  <div className="text-center">
                    <Loader2 size={40} className="mx-auto mb-4 text-violet-400 animate-spin" />
                    <p className="text-white/80 text-sm" style={{ fontFamily: contentFont }}>
                      Extracting audio from video...
                    </p>
                    <p className="text-white/40 text-xs mt-2">
                      {selectedFile?.name}
                    </p>
                  </div>
                )}

                {processingStatus === 'ready' && selectedFile && (
                  <div className="text-center w-full px-6">
                    <div className="flex items-center justify-center gap-3 mb-4">
                      {selectedFile.type.startsWith('video/') ? (
                        <FileVideo size={32} className="text-violet-400" />
                      ) : (
                        <FileAudio size={32} className="text-violet-400" />
                      )}
                      <Check size={20} className="text-green-400" />
                    </div>
                    <p className="text-white/80 text-sm truncate mb-1" style={{ fontFamily: contentFont }}>
                      {selectedFile.name}
                    </p>
                    <p className="text-white/40 text-xs mb-4">
                      Duration: {formatDuration(duration)}
                    </p>

                    {/* Audio preview */}
                    {audioUrl && (
                      <audio
                        src={audioUrl}
                        controls
                        className="w-full mb-4 h-10 opacity-70"
                        style={{ filter: 'invert(1)' }}
                      />
                    )}

                    <div className="flex gap-3 justify-center">
                      <button
                        onClick={resetState}
                        className="px-4 py-2 rounded-full bg-white/5 hover:bg-white/15 text-white/60 hover:text-white border border-white/10 hover:border-white/20 transition-colors text-sm"
                      >
                        Change File
                      </button>
                      <button
                        onClick={handleStartTranscription}
                        className="px-4 py-2 rounded-full bg-white/5 hover:bg-white/15 text-white/60 hover:text-white border border-white/10 hover:border-white/20 transition-colors text-sm"
                      >
                        Transcribe
                      </button>
                    </div>
                  </div>
                )}

                {processingStatus === 'error' && (
                  <div className="text-center">
                    <AlertCircle size={40} className="mx-auto mb-4 text-red-400" />
                    <p className="text-red-400 text-sm mb-2">
                      {errorMessage}
                    </p>
                    <button
                      onClick={resetState}
                      className="px-4 py-2 rounded-full bg-white/5 hover:bg-white/15 text-white/60 hover:text-white border border-white/10 hover:border-white/20 transition-colors text-sm"
                    >
                      Try Again
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {/* Upload Tape Card - Same style as CassetteTape */}
      <div className="relative group w-full mb-6 perspective-1000">
        {/* Tape Body - Glass 3D Effect (Heavy) */}
        <div
          className="bg-[#1a1a1a]/80 backdrop-blur-xl rounded-xl shadow-[12px_12px_30px_rgba(0,0,0,0.8),-6px_-6px_20px_rgba(50,50,50,0.1),0_20px_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-2px_8px_rgba(0,0,0,0.4)] border-t border-l border-white/10 border-r-[8px] border-b-[8px] border-r-black/50 border-b-black/50 p-3 transform transition-all duration-300 group-hover:-rotate-1 group-hover:scale-[1.02] group-hover:shadow-[15px_15px_35px_rgba(0,0,0,0.9),-8px_-8px_25px_rgba(60,60,60,0.15),0_25px_50px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.2)] relative overflow-hidden cursor-pointer"
          onClick={() => {
            if (shouldAllowClick && !shouldAllowClick()) return;
            openWindow();
          }}
        >
          {/* Plastic Texture */}
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/black-scales.png')] opacity-20 pointer-events-none"></div>

          {/* Label Area */}
          <div
            className="relative z-10 rounded-lg p-4 shadow-inner border border-zinc-300/30 flex flex-col gap-2 aspect-[3/2] overflow-hidden"
            style={{
              backgroundImage: 'url(/image/paper-texture.jpg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              opacity: 0.7,
            }}
          >
            {/* Label Header */}
            <div className="flex justify-between items-center border-b-2 border-black/30 pb-2">
              <div className="flex flex-col">
                <span className="text-[8px] text-zinc-400 font-bold tracking-widest uppercase">Upload</span>
                <span className="text-[#1a1a1a]/80 text-xl leading-none mt-1 group-hover:text-[#903e4f] transition-colors duration-500" style={{ fontFamily: titleFont }}>
                  Audio / Video
                </span>
              </div>
            </div>

            {/* Dashed Upload Area */}
            <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-zinc-400/40 rounded-lg group-hover:border-zinc-400/60 transition-colors">
              <Upload
                size={28}
                className="text-zinc-500/60 group-hover:text-zinc-600/80 transition-colors mb-2"
              />
              <span className="text-zinc-500/70 text-xs tracking-wider uppercase group-hover:text-zinc-600/90 transition-colors">
                Click to upload
              </span>
            </div>

            {/* Tape Info */}
            <div className="flex justify-between items-center mt-2 pt-2 border-t border-black/20">
              <span className="text-[8px] text-zinc-400 font-mono tracking-widest uppercase">MP3 / WAV / MP4</span>
              <span className="text-[8px] text-zinc-400 font-mono tracking-widest uppercase">TP-IMPORT</span>
            </div>
          </div>

          {/* Controls placeholder - matches CassetteTape */}
          <div className="mt-4 flex items-center justify-center px-2 relative z-10">
            <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-zinc-900 text-zinc-400 border border-zinc-800">
              <Upload size={14} />
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase">Import File</span>
            </div>
          </div>

          {/* Decorative Tape Spools */}
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-40 h-40 bg-zinc-800/10 rounded-full blur-3xl pointer-events-none"></div>
        </div>

        {/* Tape Spine Shadow */}
        <div className="absolute top-4 -right-2 w-4 h-[85%] bg-black/40 rounded-r-xl blur-sm -z-10"></div>
      </div>

      {/* Floating window - rendered via portal */}
      {typeof document !== 'undefined' && createPortal(windowContent, document.body)}
    </>
  );
};

export default UploadTape;
