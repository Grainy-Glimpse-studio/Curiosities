import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Minus, Maximize2, Minimize2, Upload, FileAudio, FileVideo, Copy, Download, Check, Loader2, FileText, FileCode, Subtitles, File } from 'lucide-react';
import { Memo } from '../types';

interface UploadConvertWindowProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateMemo?: (memo: Memo) => void; // 创建新的 memo
  titleFont: string;
  contentFont: string;
  initialOffset?: number;
}

type TabType = 'audio-to-text' | 'srt-to-tts';

interface TranscriptionResult {
  text: string;
  wordTimestamps?: Array<{ word: string; start: number; end: number }>;
  duration?: number;
}

const UploadConvertWindow: React.FC<UploadConvertWindowProps> = ({
  isOpen,
  onClose,
  onCreateMemo,
  titleFont,
  contentFont,
  initialOffset = 0,
}) => {
  // Window state
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [size, setSize] = useState({ width: 640, height: 520 });
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [prevState, setPrevState] = useState({ position: { x: 100, y: 100 }, size: { width: 640, height: 520 } });

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('audio-to-text');

  // Audio to Text state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [transcriptionResult, setTranscriptionResult] = useState<TranscriptionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Drag state
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Refs
  const windowRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const resizeStartPos = useRef({ x: 0, y: 0 });
  const resizeStartSize = useRef({ width: 0, height: 0 });

  // Center window on open
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      setPosition({
        x: (window.innerWidth - size.width) / 2 + initialOffset,
        y: (window.innerHeight - size.height) / 2 + initialOffset,
      });
      // Reset state
      setUploadedFile(null);
      setTranscriptionResult(null);
      setError(null);
      setProgress(0);
    }
  }, [isOpen, initialOffset]);

  // Drag handling
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

  // Resize handling
  const handleResizeStart = (e: React.MouseEvent, direction: string) => {
    if (isMaximized) return;
    e.preventDefault();
    e.stopPropagation();
    resizeStartPos.current = { x: e.clientX, y: e.clientY };
    resizeStartSize.current = { width: size.width, height: size.height };
    const startPosition = { ...position };

    const handleResize = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStartPos.current.x;
      const deltaY = e.clientY - resizeStartPos.current.y;

      let newWidth = resizeStartSize.current.width;
      let newHeight = resizeStartSize.current.height;
      let newX = startPosition.x;
      let newY = startPosition.y;

      if (direction.includes('e')) newWidth = Math.max(500, resizeStartSize.current.width + deltaX);
      if (direction.includes('w')) {
        newWidth = Math.max(500, resizeStartSize.current.width - deltaX);
        newX = startPosition.x + (resizeStartSize.current.width - newWidth);
      }
      if (direction.includes('s')) newHeight = Math.max(400, resizeStartSize.current.height + deltaY);
      if (direction.includes('n')) {
        newHeight = Math.max(400, resizeStartSize.current.height - deltaY);
        newY = startPosition.y + (resizeStartSize.current.height - newHeight);
      }

      setSize({ width: newWidth, height: newHeight });
      setPosition({ x: newX, y: newY });
    };

    const handleResizeEnd = () => {
      window.removeEventListener('mousemove', handleResize);
      window.removeEventListener('mouseup', handleResizeEnd);
    };

    window.addEventListener('mousemove', handleResize);
    window.addEventListener('mouseup', handleResizeEnd);
  };

  // Maximize/restore
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

  // File drop handling
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileSelect = (file: File) => {
    // Check file type
    const validAudioTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/webm', 'audio/ogg'];
    const validVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v'];

    if (!validAudioTypes.includes(file.type) && !validVideoTypes.includes(file.type)) {
      setError('Unsupported file type. Please upload MP3, MP4, WAV, M4A, or WebM files.');
      return;
    }

    setUploadedFile(file);
    setError(null);
    setTranscriptionResult(null);
  };

  // Process file with Deepgram
  const processFile = async () => {
    if (!uploadedFile) return;

    setIsProcessing(true);
    setProgress(0);
    setError(null);

    try {
      // Simulate progress for now (actual progress would come from API)
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      // Read file as ArrayBuffer and send to API
      const arrayBuffer = await uploadedFile.arrayBuffer();

      // Call backend API with raw audio data
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': uploadedFile.type || 'audio/mpeg',
        },
        body: arrayBuffer,
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Transcription failed. Please try again.');
      }

      const result = await response.json();
      setProgress(100);
      setTranscriptionResult({
        text: result.text || result.transcript,
        wordTimestamps: result.words,
        duration: result.duration,
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  // Copy text to clipboard
  const copyToClipboard = async () => {
    if (!transcriptionResult?.text) return;

    try {
      await navigator.clipboard.writeText(transcriptionResult.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Export functions
  const exportAsText = () => {
    if (!transcriptionResult?.text) return;
    const blob = new Blob([transcriptionResult.text], { type: 'text/plain' });
    downloadBlob(blob, `transcription-${Date.now()}.txt`);
    setShowExportMenu(false);
  };

  const exportAsMarkdown = () => {
    if (!transcriptionResult?.text) return;
    const content = `# Transcription\n\n${transcriptionResult.text}`;
    const blob = new Blob([content], { type: 'text/markdown' });
    downloadBlob(blob, `transcription-${Date.now()}.md`);
    setShowExportMenu(false);
  };

  const exportAsSRT = () => {
    if (!transcriptionResult?.wordTimestamps) {
      // No timestamps, create simple SRT
      if (!transcriptionResult?.text) return;
      const content = `1\n00:00:00,000 --> 00:00:10,000\n${transcriptionResult.text}\n`;
      const blob = new Blob([content], { type: 'text/plain' });
      downloadBlob(blob, `transcription-${Date.now()}.srt`);
      setShowExportMenu(false);
      return;
    }

    // Generate proper SRT from timestamps
    const formatTime = (seconds: number): string => {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      const ms = Math.round((seconds % 1) * 1000);
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
    };

    // Group words into subtitle chunks
    const chunks: Array<{ start: number; end: number; text: string }> = [];
    let currentChunk: string[] = [];
    let chunkStart = 0;
    let chunkEnd = 0;

    transcriptionResult.wordTimestamps.forEach((word, i) => {
      if (currentChunk.length === 0) {
        chunkStart = word.start;
      }
      currentChunk.push(word.word);
      chunkEnd = word.end;

      // Start new chunk after ~8 words or punctuation
      if (currentChunk.length >= 8 || /[.!?]$/.test(word.word)) {
        chunks.push({ start: chunkStart, end: chunkEnd, text: currentChunk.join(' ') });
        currentChunk = [];
      }
    });

    if (currentChunk.length > 0) {
      chunks.push({ start: chunkStart, end: chunkEnd, text: currentChunk.join(' ') });
    }

    const srtContent = chunks.map((chunk, i) =>
      `${i + 1}\n${formatTime(chunk.start)} --> ${formatTime(chunk.end)}\n${chunk.text}\n`
    ).join('\n');

    const blob = new Blob([srtContent], { type: 'text/plain' });
    downloadBlob(blob, `transcription-${Date.now()}.srt`);
    setShowExportMenu(false);
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Create new memo from transcription
  const saveAsMemo = () => {
    if (!transcriptionResult?.text || !onCreateMemo) return;

    const newMemo: Memo = {
      id: `upload-${Date.now()}`,
      audioUrls: uploadedFile ? [URL.createObjectURL(uploadedFile)] : [],
      transcription: transcriptionResult.text,
      tags: ['Uploaded'],
      createdAt: Date.now(),
      isPermanent: false,
      duration: transcriptionResult.duration || 0,
      wordTimestamps: transcriptionResult.wordTimestamps,
    };

    onCreateMemo(newMemo);
    onClose();
  };

  // Reset state
  const resetUpload = () => {
    setUploadedFile(null);
    setTranscriptionResult(null);
    setError(null);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const content = (
    <AnimatePresence>
      {isOpen && (
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
            className="flex items-center justify-between px-4 py-3 bg-transparent border-b border-white/20 cursor-move shrink-0"
            onMouseDown={handleDragStart}
          >
            <span className="text-white/90 text-sm font-medium" style={{ fontFamily: titleFont }}>
              Convert
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 text-white/60 hover:text-white transition-colors"
              >
                <Minus size={14} />
              </button>
              <button
                onClick={toggleMaximize}
                className="p-1.5 text-white/60 hover:text-white transition-colors"
              >
                {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
              <button
                onClick={onClose}
                className="p-1.5 text-white/60 hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Tabs */}
              <div className="flex border-b border-white/20 shrink-0">
                <button
                  onClick={() => setActiveTab('audio-to-text')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'audio-to-text'
                      ? 'text-white border-b-2 border-white'
                      : 'text-white/50 hover:text-white/80'
                  }`}
                  style={{ fontFamily: contentFont }}
                >
                  Audio/Video → Text
                </button>
                <button
                  onClick={() => setActiveTab('srt-to-tts')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'srt-to-tts'
                      ? 'text-white border-b-2 border-white'
                      : 'text-white/50 hover:text-white/80'
                  }`}
                  style={{ fontFamily: contentFont }}
                >
                  SRT → TTS
                </button>
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto thin-scrollbar p-4">
                {activeTab === 'audio-to-text' && (
                  <div className="h-full flex flex-col">
                    {/* Upload area */}
                    {!transcriptionResult && (
                      <div
                        className={`flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-xl transition-colors ${
                          isDraggingFile
                            ? 'border-white/60 bg-white/10'
                            : uploadedFile
                            ? 'border-white/40 bg-white/5'
                            : 'border-white/20 hover:border-white/40'
                        }`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => !uploadedFile && fileInputRef.current?.click()}
                        style={{ cursor: uploadedFile ? 'default' : 'pointer' }}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="audio/*,video/*"
                          onChange={handleFileInputChange}
                          className="hidden"
                        />

                        {isProcessing ? (
                          <div className="flex flex-col items-center gap-4">
                            <Loader2 size={40} className="text-white/60 animate-spin" />
                            <div className="text-white/80 text-sm">Processing... {progress}%</div>
                            <div className="w-48 h-1 bg-white/20 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-white/60 transition-all duration-300"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        ) : uploadedFile ? (
                          <div className="flex flex-col items-center gap-4">
                            {uploadedFile.type.startsWith('video/') ? (
                              <FileVideo size={40} className="text-white/60" />
                            ) : (
                              <FileAudio size={40} className="text-white/60" />
                            )}
                            <div className="text-white/80 text-sm text-center">
                              <div className="font-medium">{uploadedFile.name}</div>
                              <div className="text-white/50 text-xs mt-1">
                                {(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); processFile(); }}
                                className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-colors"
                              >
                                Convert to Text
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); resetUpload(); }}
                                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white/70 rounded-lg text-sm transition-colors"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-3">
                            <Upload size={40} className="text-white/40" />
                            <div className="text-white/60 text-sm text-center">
                              Drop audio/video file here<br />
                              <span className="text-white/40 text-xs">or click to select</span>
                            </div>
                            <div className="text-white/30 text-xs">
                              MP3, MP4, WAV, M4A, WebM
                            </div>
                          </div>
                        )}

                        {error && (
                          <div className="mt-4 px-4 py-2 bg-red-500/20 text-red-300 rounded-lg text-sm">
                            {error}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Result area */}
                    {transcriptionResult && (
                      <div className="flex-1 flex flex-col gap-4">
                        {/* Text preview */}
                        <div className="flex-1 p-4 bg-white/5 rounded-xl border border-white/10 overflow-y-auto thin-scrollbar">
                          <div className="text-white/90 text-sm whitespace-pre-wrap" style={{ fontFamily: contentFont }}>
                            {transcriptionResult.text}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between shrink-0">
                          <button
                            onClick={resetUpload}
                            className="px-3 py-2 text-white/50 hover:text-white text-sm transition-colors"
                          >
                            ← Upload another
                          </button>

                          <div className="flex items-center gap-2">
                            {/* Copy button */}
                            <button
                              onClick={copyToClipboard}
                              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-colors"
                            >
                              {copied ? <Check size={14} /> : <Copy size={14} />}
                              {copied ? 'Copied!' : 'Copy All'}
                            </button>

                            {/* Export dropdown */}
                            <div className="relative">
                              <button
                                onClick={() => setShowExportMenu(!showExportMenu)}
                                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-colors"
                              >
                                <Download size={14} />
                                Download
                              </button>
                              {showExportMenu && (
                                <div className="absolute bottom-full right-0 mb-2 backdrop-blur-3xl rounded-xl overflow-hidden min-w-[160px] shadow-2xl border border-white/20 z-50">
                                  <button
                                    onClick={exportAsText}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 transition-colors text-sm"
                                  >
                                    <FileText size={16} />
                                    Plain Text (.txt)
                                  </button>
                                  <button
                                    onClick={exportAsMarkdown}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 transition-colors text-sm"
                                  >
                                    <FileCode size={16} />
                                    Markdown (.md)
                                  </button>
                                  <button
                                    onClick={exportAsSRT}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 transition-colors text-sm"
                                  >
                                    <Subtitles size={16} />
                                    SRT Subtitles
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Save as memo */}
                            <button
                              onClick={saveAsMemo}
                              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                              Save as Tape
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'srt-to-tts' && (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center text-white/40">
                      <div className="text-lg mb-2">Coming Soon</div>
                      <div className="text-sm">SRT to TTS conversion will be available soon.</div>
                      <div className="text-xs mt-4 text-white/30">
                        Configure your TTS settings in Account Settings first.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Resize handles */}
          {!isMaximized && !isMinimized && (
            <>
              <div className="absolute top-0 left-0 w-2 h-full cursor-ew-resize" onMouseDown={(e) => handleResizeStart(e, 'w')} />
              <div className="absolute top-0 right-0 w-2 h-full cursor-ew-resize" onMouseDown={(e) => handleResizeStart(e, 'e')} />
              <div className="absolute top-0 left-0 w-full h-2 cursor-ns-resize" onMouseDown={(e) => handleResizeStart(e, 'n')} />
              <div className="absolute bottom-0 left-0 w-full h-2 cursor-ns-resize" onMouseDown={(e) => handleResizeStart(e, 's')} />
              <div className="absolute top-0 left-0 w-4 h-4 cursor-nwse-resize" onMouseDown={(e) => handleResizeStart(e, 'nw')} />
              <div className="absolute top-0 right-0 w-4 h-4 cursor-nesw-resize" onMouseDown={(e) => handleResizeStart(e, 'ne')} />
              <div className="absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize" onMouseDown={(e) => handleResizeStart(e, 'sw')} />
              <div className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize" onMouseDown={(e) => handleResizeStart(e, 'se')} />
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document !== 'undefined') {
    return createPortal(content, document.body);
  }
  return null;
};

export default UploadConvertWindow;
