import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { AnimatePresence, motion } from 'framer-motion';
import RecorderUI from '../components/RecorderUI';
import TapeDrawer from '../components/TapeDrawer';
import FloatingWords from '../components/FloatingWords';
import FocusMode from '../components/FocusMode';
import FloatingTranscript from '../components/FloatingTranscript';
import ShootingStar from '../components/ShootingStar';
import ApiSettings, { loadApiKey } from '../components/ApiSettings';
import { Memo, RecorderState } from '../types';
import { getTranscriber, SpeechTranscriber } from '../services/speechService';
import { DeepgramTranscriber } from '../services/deepgramService';

// Detect if text is primarily Chinese
const isChinese = (text: string): boolean => {
  if (!text) return false;
  const chineseChars = text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || [];
  const totalChars = text.replace(/\s/g, '').length;
  return totalChars > 0 && chineseChars.length / totalChars > 0.3;
};

// Default Twin Peaks tape - April 8, 1990 (TV premiere date)
const DEFAULT_MEMO: Memo = {
  id: 'twin-peaks-pilot',
  audioUrl: '/sound/twin-peaks.mp3',
  transcription: `Testing, one, two, testing. Diane, it's 8 a.m. Seattle, Washington. As you have no doubt surmised by the clarity of this tape, I purchased a new Micromac pocket tape recorder, the big little recorder at Wally's Rent to Own, 1145 North Hilltop, where, as the sign says, a bargain is a bargain no matter what the cost.

For $21 and 89 cents cash. I decided to pass on the Rent to Own option, Diane. Leasing may be the fast track to an appearance of affluence, but equity will keep you warm at night.

I have no doubt that this new model will prove to be an extremely useful tool in the investigatory process, where the most fleeting insight can be lost if your hardware isn't as solid as you're thinking.

I have two stops to make, Diane. Woe's House of Cloth, where I'm picking up a new black suit, upping my total to five, one for each day of the week, presuming I don't have to work weekends. Frequently not a safe assumption. $199.99, including alterations.

Second stop, the Regional Bureau Office, to pick up some files. Although I have wrapped up the fiber sample procedures seminar I came here to conduct, it looks like I'll be heading east on a new case instead of back to Philadelphia. We'll fill you in on the details after I've been briefed.`,
  tags: ['Diane', 'Seattle'],
  createdAt: new Date('1990-04-08T08:00:00').getTime(),
  isPermanent: true,
  duration: 60
};

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // --- Custom Cursor State ---
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const trailRef = useRef<{ x: number; y: number }[]>(Array(6).fill({ x: 0, y: 0 }));
  const [, setTrailRender] = useState(0);

  // --- State ---
  const [recorderState, setRecorderState] = useState<RecorderState>(RecorderState.IDLE);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [memos, setMemos] = useState<Memo[]>([DEFAULT_MEMO]);
  const [currentMemoId, setCurrentMemoId] = useState<string | null>('twin-peaks-pilot');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [titleFont, setTitleFont] = useState("'Consulate', monospace");
  const [contentFont, setContentFont] = useState("'Consulate', monospace");
  const [, setPinnedWords] = useState<string[]>([]);
  const [floatingWordsEnabled, setFloatingWordsEnabled] = useState(true);
  const [focusModeOpen, setFocusModeOpen] = useState(false);
  const [, setCapturedWords] = useState<string[]>([]);
  const [speechLang, setSpeechLang] = useState<'auto' | 'zh' | 'en'>('auto');
  const [openTranscripts, setOpenTranscripts] = useState<Memo[]>([]);
  const [starVisible, setStarVisible] = useState(false);
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);

  // --- Check if returning from About page with archive open ---
  useEffect(() => {
    const state = location.state as { openArchive?: boolean } | null;
    if (state?.openArchive) {
      setIsDrawerOpen(true);
      // Clear the state so refresh doesn't reopen
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // --- Load API key on mount ---
  useEffect(() => {
    const storedKey = loadApiKey();
    if (storedKey) {
      setApiKey(storedKey);
    }
  }, []);

  // --- Refs ---
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const mimeTypeRef = useRef<string>('');
  const transcriberRef = useRef<SpeechTranscriber | DeepgramTranscriber | null>(null);
  const pinnedWordsRef = useRef<string[]>([]);
  const recorderContainerRef = useRef<HTMLDivElement | null>(null);
  const [recorderBounds, setRecorderBounds] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // --- Custom Cursor Effect ---
  useEffect(() => {
    let animationId: number;
    let mouseX = 0;
    let mouseY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      setCursorPos({ x: mouseX, y: mouseY });
    };

    const animate = () => {
      const trail = trailRef.current;
      for (let i = trail.length - 1; i > 0; i--) {
        trail[i] = {
          x: trail[i].x + (trail[i - 1].x - trail[i].x) * 0.35,
          y: trail[i].y + (trail[i - 1].y - trail[i].y) * 0.35,
        };
      }
      trail[0] = {
        x: trail[0].x + (mouseX - trail[0].x) * 0.5,
        y: trail[0].y + (mouseY - trail[0].y) * 0.5,
      };

      setTrailRender(prev => prev + 1);
      animationId = requestAnimationFrame(animate);
    };

    window.addEventListener('mousemove', handleMouseMove);
    animationId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationId);
    };
  }, []);

  // --- Initialization ---
  useEffect(() => {
    const audio = new Audio();
    (audio as any).playsInline = true;
    audioPlayerRef.current = audio;

    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
    };
  }, []);

  // --- Measure recorder bounds ---
  useEffect(() => {
    const measureBounds = () => {
      if (recorderContainerRef.current) {
        const rect = recorderContainerRef.current.getBoundingClientRect();
        setRecorderBounds({
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height
        });
      }
    };

    measureBounds();
    window.addEventListener('resize', measureBounds);
    return () => window.removeEventListener('resize', measureBounds);
  }, []);

  // --- Helpers ---
  const getCurrentMemoIndex = useCallback(() => {
    if (!currentMemoId) return -1;
    return memos.findIndex(m => m.id === currentMemoId);
  }, [currentMemoId, memos]);

  // --- Recorder Logic ---
  const getSupportedMimeType = () => {
    const types = [
      'audio/mp4',
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg'
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return '';
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
        stream.getTracks().forEach(track => track.stop());

        const transcriber = transcriberRef.current;
        const result = transcriber ? transcriber.stop() : { text: '', tags: ['Memo'] };

        const type = mimeTypeRef.current || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type });
        const audioUrl = URL.createObjectURL(audioBlob);

        const newMemo: Memo = {
          id: uuidv4(),
          audioUrl,
          blob: audioBlob,
          transcription: result.text || '(No speech detected / 未检测到语音)',
          tags: result.tags,
          createdAt: Date.now(),
          isPermanent: false,
          duration: elapsedTime,
          highlightedWords: pinnedWordsRef.current.length > 0 ? [...pinnedWordsRef.current] : undefined
        };

        setMemos(prev => [newMemo, ...prev]);
        setCurrentMemoId(newMemo.id);
        setRecorderState(RecorderState.IDLE);
        setElapsedTime(0);
      };

      mediaRecorder.start();

      // Start transcription - use Deepgram if API key available, otherwise Web Speech
      if (apiKey) {
        console.log('Using Deepgram HD mode');
        const deepgramTranscriber = new DeepgramTranscriber(apiKey);
        // 根据当前语言设置
        const langMap: Record<string, string> = { 'auto': 'en', 'zh': 'zh', 'en': 'en' };
        deepgramTranscriber.setLanguage(langMap[speechLang] || 'en');
        transcriberRef.current = deepgramTranscriber;
      } else {
        console.log('Using Web Speech API (standard mode)');
        transcriberRef.current = getTranscriber();
      }

      transcriberRef.current.onNewText((text: string, isFinal: boolean) => {
        // Auto-detect language and switch font
        if (isFinal && text.trim()) {
          if (isChinese(text)) {
            setTitleFont("'HuiWen', serif");
            setContentFont("'HuiWen', serif");
          } else {
            setTitleFont("'Consulate', monospace");
            setContentFont("'Consulate', monospace");
          }
        }

        // For floating words: extract keywords in real-time
        if ((window as any).__floatingWordsAddWord && text.trim()) {
          const trimmed = text.trim();
          const hasSpaces = /\s/.test(trimmed);

          let keywords: string;
          if (hasSpaces) {
            const words = trimmed.split(/\s+/);
            const keywordCount = Math.min(3, Math.max(1, words.length));
            keywords = words.slice(-keywordCount).join(' ');
          } else {
            const charCount = Math.min(6, Math.max(2, trimmed.length));
            keywords = trimmed.slice(-charCount);
          }

          if (keywords.length > 0 && keywords.length < 30) {
            (window as any).__floatingWordsAddWord(keywords, isFinal);
          }
        }

        // For focus mode: send real-time text
        if ((window as any).__focusModeAddWord) {
          (window as any).__focusModeAddWord(text, isFinal);
        }
      });

      // Clear previous pinned words
      setPinnedWords([]);
      pinnedWordsRef.current = [];

      transcriberRef.current.start();

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
    if (recorderState === RecorderState.PLAYING) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.currentTime = 0;
      }
      setRecorderState(RecorderState.IDLE);
      setElapsedTime(0);
      return;
    }

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
      player.pause();
      setIsDrawerOpen(false);
      setCurrentMemoId(memo.id);
      setRecorderState(RecorderState.PLAYING);

      player.src = memo.audioUrl;
      player.load();
      player.currentTime = 0;

      await player.play();
    } catch (error) {
      console.error("Playback failed:", error);
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

  // --- Tab Key for Manual Paragraph Break ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && recorderState === RecorderState.RECORDING && transcriberRef.current) {
        e.preventDefault();
        transcriberRef.current.insertParagraphBreak();
        console.log('Manual paragraph break triggered by Tab key');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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

  // Pin word callback
  const handlePinWord = useCallback((word: string) => {
    setPinnedWords(prev => {
      const updated = [...prev, word];
      pinnedWordsRef.current = updated;
      return updated;
    });
    console.log('Pinned word:', word);
  }, []);

  // Navigate to About page
  const goToAbout = useCallback((from: 'homepage' | 'archive' | 'transcript') => {
    navigate('/about', { state: { from } });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-hidden relative font-sans select-none cursor-none">

      {/* Shooting Star */}
      <ShootingStar
        onCatch={() => goToAbout('homepage')}
        disabled={isDrawerOpen || recorderState === RecorderState.RECORDING}
        onVisibilityChange={setStarVisible}
      />

      {/* Star catch hint - below recorder, glows when star appears */}
      {recorderState !== RecorderState.RECORDING && !isDrawerOpen && recorderBounds && (
        <motion.div
          animate={{
            opacity: starVisible ? [0.7, 1, 0.7] : 0.2
          }}
          transition={{
            duration: starVisible ? 3 : 2,
            ease: 'easeInOut',
            repeat: starVisible ? Infinity : 0
          }}
          className="fixed z-50 pointer-events-none"
          style={{
            left: recorderBounds.x + recorderBounds.width / 2,
            top: recorderBounds.y + recorderBounds.height + 24,
            transform: 'translateX(-50%)'
          }}
        >
          <motion.p
            animate={{
              textShadow: starVisible
                ? [
                    '0 0 6px rgba(255,255,255,0.6), 0 0 12px rgba(255,255,255,0.4), 0 0 18px rgba(255,255,255,0.2)',
                    '0 0 12px rgba(255,255,255,0.9), 0 0 24px rgba(255,255,255,0.6), 0 0 36px rgba(255,255,255,0.4)',
                    '0 0 6px rgba(255,255,255,0.6), 0 0 12px rgba(255,255,255,0.4), 0 0 18px rgba(255,255,255,0.2)'
                  ]
                : 'none'
            }}
            transition={{
              duration: 3,
              ease: 'easeInOut',
              repeat: starVisible ? Infinity : 0
            }}
            className="text-[14px] text-white tracking-[0.12em] whitespace-nowrap"
            style={{ fontFamily: "'Consulate', monospace" }}
          >
            press space to catch the shooting star
          </motion.p>
        </motion.div>
      )}

      {/* Floating Words (darkroom effect) - conditional */}
      {floatingWordsEnabled && (
        <FloatingWords
          isRecording={recorderState === RecorderState.RECORDING}
          onPinWord={handlePinWord}
          recorderBounds={recorderBounds}
          fontFamily={contentFont}
        />
      )}

      {/* Focus Mode Window */}
      <FocusMode
        isOpen={focusModeOpen}
        onClose={() => setFocusModeOpen(false)}
        onCapture={(text) => {
          setCapturedWords(prev => [...prev, text]);
          handlePinWord(text);
        }}
        fontFamily={contentFont}
      />

      {/* Floating Transcript Windows */}
      {openTranscripts.map((memo, index) => (
        <FloatingTranscript
          key={memo.id}
          memo={memo}
          isOpen={true}
          onClose={() => setOpenTranscripts(prev => prev.filter(m => m.id !== memo.id))}
          onPlay={playMemo}
          titleFont={titleFont}
          contentFont={contentFont}
          initialOffset={index * 30}
          onOpenAbout={() => goToAbout('transcript')}
          creatorEmail="diane@twinpeaks.fm"
        />
      ))}

      {/* API Settings Modal */}
      <ApiSettings
        isOpen={showApiSettings}
        onClose={() => setShowApiSettings(false)}
        onApiKeyChange={setApiKey}
        currentApiKey={apiKey}
      />

      {/* Top Left Controls */}
      {!isDrawerOpen && (
        <div className="fixed top-6 left-6 z-50 flex items-center gap-6">
          {/* API Button - always visible when not in drawer */}
          <span
            onClick={() => setShowApiSettings(true)}
            className={`cursor-pointer font-recorder text-[11px] tracking-[0.3em] uppercase transition-all duration-300 ${
              apiKey
                ? 'text-green-400/70 hover:text-green-400'
                : 'text-white/50 hover:text-white/70'
            }`}
          >
            {apiKey ? 'HD' : 'API'}
          </span>

          {/* Recording controls - only when recording */}
          {recorderState === RecorderState.RECORDING && (
            <>
              <span
                onClick={() => setFloatingWordsEnabled(prev => !prev)}
                className={`cursor-pointer font-recorder text-[11px] tracking-[0.3em] uppercase transition-all duration-300 ${
                  floatingWordsEnabled
                    ? 'text-white/50 hover:text-white/70'
                    : 'text-white/25 hover:text-white/40'
                }`}
              >
                {floatingWordsEnabled ? 'HIDE' : 'SHOW'}
              </span>

              <span
                onClick={() => setFocusModeOpen(prev => !prev)}
                className={`cursor-pointer font-recorder text-[11px] tracking-[0.3em] uppercase transition-all duration-300 ${
                  focusModeOpen
                    ? 'text-[#903e4f]/70 hover:text-[#903e4f]'
                    : 'text-white/50 hover:text-white/70'
                }`}
              >
                FOCUS MODE
              </span>

              <span
                onClick={() => {
                  setSpeechLang(prev => {
                    const next = prev === 'auto' ? 'zh' : prev === 'zh' ? 'en' : 'auto';
                    if (transcriberRef.current) {
                      const langMap = { 'auto': '', 'zh': 'zh-TW', 'en': 'en-US' };
                      transcriberRef.current.setLanguage(langMap[next]);
                    }
                    if (next === 'zh') {
                      setTitleFont("'HuiWen', serif");
                      setContentFont("'HuiWen', serif");
                    } else {
                      setTitleFont("'Consulate', monospace");
                      setContentFont("'Consulate', monospace");
                    }
                    return next;
                  });
                }}
                className="cursor-pointer font-recorder text-[11px] tracking-[0.3em] uppercase transition-all duration-300 text-white/50 hover:text-white/70"
              >
                {speechLang === 'auto' ? 'AUTO' : speechLang === 'zh' ? '中文' : 'EN'}
              </span>
            </>
          )}
        </div>
      )}

      {/* Starfield Background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-black">
        <style>{`
          @keyframes twinkle {
            0%, 100% { opacity: 0.15; transform: scale(0.8); }
            50% { opacity: 1; transform: scale(1.2); }
          }
          @keyframes twinkle-bright {
            0%, 100% { opacity: 0.3; box-shadow: 0 0 2px rgba(255,255,255,0.3); }
            50% { opacity: 1; box-shadow: 0 0 8px rgba(255,255,255,0.8), 0 0 15px rgba(255,255,255,0.4); }
          }
        `}</style>
        {React.useMemo(() => {
          const stars: React.ReactNode[] = [];
          const seed = 42;
          const pseudoRandom = (n: number) => {
            const x = Math.sin(seed + n) * 10000;
            return x - Math.floor(x);
          };

          for (let i = 0; i < 80; i++) {
            const x = pseudoRandom(i * 3) * 100;
            const y = pseudoRandom(i * 3 + 1) * 100;
            const size = 1 + pseudoRandom(i * 3 + 2) * 2.5;
            const duration = 2 + pseudoRandom(i * 7) * 5;
            const delay = pseudoRandom(i * 11) * -8;
            const isBright = pseudoRandom(i * 17) > 0.7;

            stars.push(
              <div
                key={i}
                className="absolute rounded-full"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  width: `${size}px`,
                  height: `${size}px`,
                  backgroundColor: isBright ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0.7)',
                  animation: `${isBright ? 'twinkle-bright' : 'twinkle'} ${duration}s ease-in-out infinite`,
                  animationDelay: `${delay}s`,
                }}
              />
            );
          }
          return stars;
        }, [])}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 0%, transparent 50%, rgba(0,0,0,0.3) 100%)',
          }}
        />
      </div>

      {/* Viewport Container */}
      <div className={`relative z-10 h-screen flex flex-col transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] ${isDrawerOpen ? 'scale-95 opacity-40 blur-md grayscale pointer-events-none' : 'scale-100 opacity-100'}`}>
        <header className="pt-12 pb-4 text-center shrink-0">
          <div className="inline-flex flex-col items-center">
            <h1 className="font-recorder italic text-4xl text-zinc-100 tracking-tighter mb-1">
              Diane
            </h1>
            <div className="h-px w-12 bg-[#903e4f]/50 mb-1"></div>
            <p className="font-recorder text-[10px] text-zinc-600 tracking-[0.5em] uppercase opacity-60">
              Personal Recorder
            </p>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-4 overflow-hidden">
          <div ref={recorderContainerRef}>
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
              clickSoundUrl="/sound/twin-peaks-clicksound.mp3"
            />
          </div>
        </main>

        {/* Recording hint - in normal flow */}
        <AnimatePresence>
          {recorderState === RecorderState.RECORDING && !focusModeOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center py-4"
            >
              <p className="text-[10px] text-white/30 font-mono tracking-[0.2em] uppercase">
                click words to capture · focus mode for productivity
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <footer className="pb-8 text-center shrink-0">
          <p className="text-[9px] text-zinc-700 font-mono tracking-[0.2em] uppercase">
            Designed for Agent Cooper &bull; Twin Peaks, WA
          </p>
        </footer>
      </div>

      <TapeDrawer
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setOpenTranscripts([]);
        }}
        memos={memos}
        onPlay={playMemo}
        onDelete={handleDelete}
        onTogglePermanent={handleTogglePermanent}
        titleFont={titleFont}
        contentFont={contentFont}
        onTitleFontChange={setTitleFont}
        onContentFontChange={setContentFont}
        onOpenTranscript={(memo) => {
          setOpenTranscripts(prev => {
            if (prev.some(m => m.id === memo.id)) return prev;
            return [...prev, memo];
          });
        }}
        onOpenAbout={() => goToAbout('archive')}
      />

      {/* Custom Glowing Cursor */}
      <div className="fixed inset-0 pointer-events-none z-[9999]">
        {!isDrawerOpen && trailRef.current.map((point, index) => {
          const progress = 1 - index / trailRef.current.length;
          const opacity = progress * 0.15;
          const size = 20 + progress * 30;
          return (
            <div
              key={index}
              className="absolute rounded-full"
              style={{
                left: point.x,
                top: point.y,
                width: `${size}px`,
                height: `${size}px`,
                transform: 'translate(-50%, -50%)',
                background: `radial-gradient(circle, rgba(255,255,255,${opacity}) 0%, rgba(255,255,255,${opacity * 0.3}) 40%, transparent 70%)`,
                filter: 'blur(2px)',
              }}
            />
          );
        })}

        <div
          className="absolute"
          style={{
            left: cursorPos.x,
            top: cursorPos.y,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div
            className="absolute rounded-full"
            style={{
              width: '60px',
              height: '60px',
              left: '-30px',
              top: '-30px',
              background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 50%, transparent 70%)',
              filter: 'blur(4px)',
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              width: '30px',
              height: '30px',
              left: '-15px',
              top: '-15px',
              background: 'radial-gradient(circle, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.08) 50%, transparent 80%)',
              filter: 'blur(2px)',
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              width: '12px',
              height: '12px',
              left: '-6px',
              top: '-6px',
              background: 'radial-gradient(circle, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
              filter: 'blur(1px)',
            }}
          />
        </div>
      </div>

    </div>
  );
};

export default HomePage;
