import React, { useState, useRef, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import RecorderUI from './components/RecorderUI';
import FocusRecorderUI from './components/FocusRecorderUI';
import TapeDrawer from './components/TapeDrawer';
import { Memo, RecorderState } from './types';
import { transcribeAndTagAudio } from './services/geminiService';
import { Maximize, Minimize } from 'lucide-react';

const App: React.FC = () => {
  // --- State ---
  const [recorderState, setRecorderState] = useState<RecorderState>(RecorderState.IDLE);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [currentMemoId, setCurrentMemoId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [titleFont, setTitleFont] = useState("'Permanent Marker', 'Kawaiitegakimoji', cursive");
  const [contentFont, setContentFont] = useState("'Courier Prime', monospace");
  const [uiMode, setUiMode] = useState<'classic' | 'focus'>('classic');

  // --- Refs ---
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const mimeTypeRef = useRef<string>(''); // Store the detected mime type

  // --- Initialization ---
  useEffect(() => {
    // Initialize Audio object once
    const audio = new Audio();
    // Important for iOS: allow audio to play even if silent initially
    (audio as any).playsInline = true; 
    audioPlayerRef.current = audio;
    
    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
    };
  }, []);

  // --- Helpers ---
  const getCurrentMemoIndex = useCallback(() => {
    if (!currentMemoId) return -1;
    return memos.findIndex(m => m.id === currentMemoId);
  }, [currentMemoId, memos]);

  // --- Recorder Logic ---

  const getSupportedMimeType = () => {
    const types = [
      'audio/mp4', // Best for iOS
      'audio/webm;codecs=opus', // Chrome/Android
      'audio/webm',
      'audio/ogg'
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return ''; // Browser default
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mimeType = getSupportedMimeType();
      mimeTypeRef.current = mimeType;
      
      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop the stream tracks immediately
        stream.getTracks().forEach(track => track.stop());

        // Create blob with the CORRECT detected mime type
        const type = mimeTypeRef.current || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // 1. Create temporary memo
        const newMemo: Memo = {
          id: uuidv4(),
          audioUrl,
          blob: audioBlob,
          transcription: "Processing / 处理中...",
          tags: ["New"],
          createdAt: Date.now(),
          isPermanent: false,
          duration: elapsedTime
        };

        setMemos(prev => [newMemo, ...prev]);
        setCurrentMemoId(newMemo.id);
        setRecorderState(RecorderState.PROCESSING);

        // 2. Call Gemini
        const result = await transcribeAndTagAudio(audioBlob);

        // 3. Update memo with result
        setMemos(prev => prev.map(m => {
          if (m.id === newMemo.id) {
            return {
              ...m,
              transcription: result.text,
              tags: result.tags
            };
          }
          return m;
        }));

        setRecorderState(RecorderState.IDLE);
        setElapsedTime(0);
      };

      mediaRecorder.start();
      setRecorderState(RecorderState.RECORDING);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Microphone access denied or not supported. Check settings.");
    }
  };

  const pauseRecording = () => {
    if (recorderState === RecorderState.RECORDING) {
       if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
         mediaRecorderRef.current.pause();
       }
       setRecorderState(RecorderState.PAUSED);
    } else if (recorderState === RecorderState.PAUSED) {
       if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
         mediaRecorderRef.current.resume();
       }
       setRecorderState(RecorderState.RECORDING);
    }
  };

  const stopRecording = () => {
    // 1. Handle Playback Stop
    if (recorderState === RecorderState.PLAYING) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.currentTime = 0;
      }
      setRecorderState(RecorderState.IDLE);
      setElapsedTime(0);
      return;
    } 
    
    // 2. Handle Recording Stop
    if (recorderState === RecorderState.RECORDING || recorderState === RecorderState.PAUSED) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      } else {
        setRecorderState(RecorderState.IDLE);
        setElapsedTime(0);
      }
    }
  };

  // --- Playback Logic ---

  const playMemo = async (memo: Memo) => {
    if (recorderState === RecorderState.RECORDING || recorderState === RecorderState.PROCESSING) return;
    if (!audioPlayerRef.current) return;

    const player = audioPlayerRef.current;

    try {
      // 1. Reset & Setup
      player.pause();
      setIsDrawerOpen(false);
      setCurrentMemoId(memo.id);
      setRecorderState(RecorderState.PLAYING);
      
      // 2. Load Source
      player.src = memo.audioUrl;
      player.load(); // CRITICAL for mobile to recognize new blob
      player.currentTime = 0;

      // 3. Play
      await player.play();
    } catch (error) {
      console.error("Playback failed:", error);
      // If playback fails, revert state immediately so user knows
      setRecorderState(RecorderState.IDLE);
      alert("Playback failed. Format may not be supported on this device.");
    }
  };

  const playCurrentMemo = () => {
    const idx = getCurrentMemoIndex();
    if (idx !== -1) {
      playMemo(memos[idx]);
    }
  };

  // --- Audio Event Listeners ---
  useEffect(() => {
    const player = audioPlayerRef.current;
    if (!player) return;

    const updateTime = () => {
      if (!player.paused) {
        setElapsedTime(player.currentTime);
      }
    };

    const onEnd = () => {
      setRecorderState(RecorderState.IDLE);
      setElapsedTime(0);
    };

    const onError = (e: any) => {
        console.error("Audio Player Error", e);
        setRecorderState(RecorderState.IDLE);
    };

    player.addEventListener('timeupdate', updateTime);
    player.addEventListener('ended', onEnd);
    player.addEventListener('error', onError);

    return () => {
      player.removeEventListener('timeupdate', updateTime);
      player.removeEventListener('ended', onEnd);
      player.removeEventListener('error', onError);
    };
  }, []); 


  // --- Timer Effect (Visual Counter) ---
  useEffect(() => {
    if (recorderState === RecorderState.RECORDING) {
      timerRef.current = window.setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else if (recorderState !== RecorderState.PLAYING && recorderState !== RecorderState.PAUSED) {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [recorderState]);


  // --- Navigation & Management ---
  const handleRewind = () => {
    const idx = getCurrentMemoIndex();
    if (idx < memos.length - 1 && idx !== -1) {
      setCurrentMemoId(memos[idx + 1].id); 
    } else if (memos.length > 0) {
        setCurrentMemoId(memos[0].id);
    }
  };

  const handleFastForward = () => {
    const idx = getCurrentMemoIndex();
    if (idx > 0) {
      setCurrentMemoId(memos[idx - 1].id); 
    }
  };

  const handleErase = () => {
    if (currentMemoId) {
      handleDelete(currentMemoId);
    }
  };

  const handleDelete = (id: string) => {
    setMemos(prev => prev.filter(m => m.id !== id));
    if (currentMemoId === id) {
        setCurrentMemoId(null);
        setRecorderState(RecorderState.IDLE);
        if (audioPlayerRef.current) {
          audioPlayerRef.current.pause();
          audioPlayerRef.current.currentTime = 0;
        }
    }
  };

  const handleTogglePermanent = (id: string) => {
    setMemos(prev => prev.map(m => 
       m.id === id ? { ...m, isPermanent: !m.isPermanent } : m
    ));
  };

  // --- Auto Cleanup (1 Week) ---
  useEffect(() => {
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const expiredMemos = memos.filter(m => !m.isPermanent && m.createdAt < oneWeekAgo);
    
    if (expiredMemos.length > 0) {
        setMemos(prev => prev.filter(m => m.isPermanent || m.createdAt >= oneWeekAgo));
    }
  }, [memos]);


  return (
    <div className={`min-h-screen text-white overflow-hidden relative font-sans select-none transition-colors duration-1000 ${uiMode === 'focus' ? 'bg-black' : 'bg-[#0a0a0a]'}`}>
      
      {/* Atmospheric Background (Only in Classic Mode) */}
      <div className={`fixed inset-0 pointer-events-none z-0 overflow-hidden transition-opacity duration-1000 ${uiMode === 'focus' ? 'opacity-0' : 'opacity-100'}`}>
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-900/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-zinc-800/10 blur-[150px] rounded-full"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03]"></div>
      </div>

      {/* Mode Toggle Button */}
      <button 
        onClick={() => setUiMode(prev => prev === 'classic' ? 'focus' : 'classic')}
        className={`absolute top-6 right-6 z-50 p-3 rounded-full border transition-all duration-500 flex items-center justify-center ${
          uiMode === 'focus' 
            ? 'border-white/20 text-white/50 hover:text-white hover:border-white/50 bg-black' 
            : 'border-white/5 text-white/30 hover:text-white/80 hover:bg-white/5 bg-black/20 backdrop-blur-md'
        }`}
        title={uiMode === 'classic' ? "Switch to Focus Mode" : "Switch to Classic Mode"}
      >
        {uiMode === 'classic' ? <Maximize size={16} /> : <Minimize size={16} />}
      </button>

      {/* Viewport Container */}
      <div className={`relative z-10 h-screen flex flex-col transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] ${isDrawerOpen ? 'scale-95 opacity-40 blur-md grayscale pointer-events-none' : 'scale-100 opacity-100'}`}>
        
        {/* Header (Only in Classic Mode) */}
        {uiMode === 'classic' && (
          <header className="pt-12 pb-4 text-center shrink-0 transition-opacity duration-500">
            <div className="inline-flex flex-col items-center">
              <h1 className="font-serif italic text-4xl text-zinc-100 tracking-tighter mb-1">
                Diane
              </h1>
              <div className="h-px w-12 bg-red-900/50 mb-1"></div>
              <p className="font-mono-retro text-[10px] text-zinc-600 tracking-[0.5em] uppercase opacity-60">
                Personal Recorder
              </p>
            </div>
          </header>
        )}

        <main className="flex-1 flex items-center justify-center p-4 overflow-hidden">
          {uiMode === 'classic' ? (
            <RecorderUI 
              state={recorderState}
              elapsedTime={elapsedTime}
              currentMemo={memos.find(m => m.id === currentMemoId) || null}
              onRecord={startRecording}
              onPause={pauseRecording}
              onStop={stopRecording}
              onPlay={playCurrentMemo}
              onRewind={handleRewind}
              onFastForward={handleFastForward}
              onErase={handleErase}
              onToggleDrawer={() => setIsDrawerOpen(true)}
              clickSoundUrl="/click.mp3"
            />
          ) : (
            <FocusRecorderUI 
              state={recorderState}
              elapsedTime={elapsedTime}
              currentMemo={memos.find(m => m.id === currentMemoId) || null}
              onRecord={startRecording}
              onPause={pauseRecording}
              onStop={stopRecording}
              onPlay={playCurrentMemo}
              onRewind={handleRewind}
              onFastForward={handleFastForward}
              onErase={handleErase}
              onToggleDrawer={() => setIsDrawerOpen(true)}
              clickSoundUrl="/click.mp3"
            />
          )}
        </main>

        {/* Footer (Only in Classic Mode) */}
        {uiMode === 'classic' && (
          <footer className="pb-8 text-center shrink-0 transition-opacity duration-500">
            <p className="text-[9px] text-zinc-700 font-mono tracking-[0.2em] uppercase">
              Designed for Agent Cooper &bull; Twin Peaks, WA
            </p>
          </footer>
        )}
      </div>

      <TapeDrawer 
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        memos={memos}
        onPlay={playMemo}
        onDelete={handleDelete}
        onTogglePermanent={handleTogglePermanent}
        titleFont={titleFont}
        contentFont={contentFont}
        onTitleFontChange={setTitleFont}
        onContentFontChange={setContentFont}
      />

    </div>
  );
};

export default App;