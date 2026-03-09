import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { AnimatePresence, motion } from 'framer-motion';
import RecorderUI from '../components/RecorderUI';
import TapeDrawer from '../components/TapeDrawerComponent';
import RecycleBin from '../components/RecycleBin';
import FloatingWords from '../components/FloatingWords';
import FocusMode from '../components/FocusMode';
import FloatingTranscript from '../components/FloatingTranscript';
import UploadConvertWindow from '../components/UploadConvertWindow';
import ShootingStar from '../components/ShootingStar';
import ApiSettings, { loadSpeechMode } from '../components/ApiSettings';
import BugReport from '../components/BugReport';
import { useAuth } from '../contexts/AuthContext';
import { Memo, RecorderState } from '../types';
import { getTranscriber, SpeechTranscriber } from '../services/speechService';
import { DeepgramTranscriber } from '../services/deepgramService';
import { getHDService, LanguageMode } from '../services/hdService';
import { saveMemoToCloud, deleteMemoFromCloud, getSyncedMemoIds } from '../services/memoSync';

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
  audioUrls: ['/sound/twin-peaks.mp3'],
  audioUrl: '/sound/twin-peaks.mp3', // 向后兼容
  transcription: `Testing, one, two, testing. Diane, it's 8 a.m. Seattle, Washington. As you have no doubt surmised by the clarity of this tape, I purchased a new Micromac pocket tape recorder, the big little recorder at Wally's Rent to Own, 1145 North Hilltop, where, as the sign says, a bargain is a bargain no matter what the cost.

For $21 and 89 cents cash. I decided to pass on the Rent to Own option, Diane. Leasing may be the fast track to an appearance of affluence, but equity will keep you warm at night.

I have no doubt that this new model will prove to be an extremely useful tool in the investigatory process, where the most fleeting insight can be lost if your hardware isn't as solid as you're thinking.

I have two stops to make, Diane. Woe's House of Cloth, where I'm picking up a new black suit, upping my total to five, one for each day of the week, presuming I don't have to work weekends. Frequently not a safe assumption. $199.99, including alterations.

Second stop, the Regional Bureau Office, to pick up some files. Although I have wrapped up the fiber sample procedures seminar I came here to conduct, it looks like I'll be heading east on a new case instead of back to Philadelphia. We'll fill you in on the details after I've been briefed.`,
  tags: ['Diane', 'Seattle'],
  createdAt: new Date('1990-04-08T08:00:00').getTime(),
  isPermanent: true,
  duration: 102, // 实际音频时长 101.7 秒
  segmentDurations: [102],
  audioOffset: 8, // 开头静音约 8 秒
};

// Storage keys for localStorage
const MEMOS_STORAGE_KEY = 'diane-recorder-memos';
const TRASH_STORAGE_KEY = 'diane-recorder-trash';

// Helper: Convert Blob to base64
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Helper: Convert base64 to Blob
const base64ToBlob = (base64: string): Blob => {
  const parts = base64.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'audio/webm';
  const bstr = atob(parts[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
};

// Serializable version of Memo for localStorage
interface SerializedMemo extends Omit<Memo, 'blob' | 'blobs' | 'audioUrl' | 'audioUrls'> {
  audioBase64?: string;           // 旧格式
  audioBase64Array?: string[];    // 新格式：多段音频
  audioUrl?: string;
  audioUrls: string[];
}

// Helper: Migrate old memo format to new multi-segment format
const migrateMemo = (memo: any): Memo => {
  // 如果已经是新格式，直接返回
  if (memo.audioUrls && memo.audioUrls.length > 0) {
    return {
      ...memo,
      segmentDurations: memo.segmentDurations || [memo.duration],
    };
  }

  // 迁移旧格式
  return {
    ...memo,
    audioUrls: memo.audioUrl ? [memo.audioUrl] : [],
    blobs: memo.blob ? [memo.blob] : [],
    segmentDurations: [memo.duration],
  };
};

// Load memos from localStorage
const loadMemosFromStorage = (): Memo[] => {
  try {
    const stored = localStorage.getItem(MEMOS_STORAGE_KEY);
    if (!stored) {
      console.log('[Storage] No stored memos, returning default memos');
      return [DEFAULT_MEMO];
    }

    const serialized: SerializedMemo[] = JSON.parse(stored);
    const memos = serialized
      // Remove any stored permanent memos (we'll add fresh ones)
      .filter(item => item.id !== 'twin-peaks-pilot')
      .map(item => {
        // 新格式：多段音频
        if (item.audioBase64Array && item.audioBase64Array.length > 0) {
          const blobs = item.audioBase64Array.map(base64 => base64ToBlob(base64));
          const audioUrls = blobs.map(blob => URL.createObjectURL(blob));
          const { audioBase64Array, audioBase64, ...rest } = item;
          return migrateMemo({ ...rest, audioUrls, blobs }) as Memo;
        }

        // 旧格式：单段音频 - 迁移到新格式
        if (item.audioBase64) {
          const blob = base64ToBlob(item.audioBase64);
          const audioUrl = URL.createObjectURL(blob);
          const { audioBase64, ...rest } = item;
          return migrateMemo({ ...rest, audioUrl, blob }) as Memo;
        }

        // User memo without blob (shouldn't happen, but handle gracefully)
        return migrateMemo(item) as Memo;
      });

    // Always add permanent memos at the end (they will appear last due to old dates)
    memos.push(DEFAULT_MEMO);

    console.log(`[Storage] Loaded ${memos.length} memos (including permanent memos)`);
    return memos;
  } catch (e) {
    console.error('Failed to load memos from localStorage:', e);
    return [DEFAULT_MEMO];
  }
};

// Save memos to localStorage
const saveMemosToStorage = async (memos: Memo[]): Promise<void> => {
  try {
    const serialized: SerializedMemo[] = await Promise.all(
      memos.map(async (memo) => {
        // Don't save static files' audio, just keep the URL
        if (memo.id === 'twin-peaks-pilot') {
          const { blob, blobs, ...rest } = memo;
          return rest as SerializedMemo;
        }

        // 新格式：多段音频
        if (memo.blobs && memo.blobs.length > 0) {
          const audioBase64Array = await Promise.all(
            memo.blobs.map(b => blobToBase64(b))
          );
          const { blob, blobs, audioUrl, audioUrls, ...rest } = memo;
          return { ...rest, audioUrls: [], audioBase64Array } as SerializedMemo;
        }

        // 旧格式兼容：单段音频
        if (memo.blob) {
          const audioBase64 = await blobToBase64(memo.blob);
          const { blob, blobs, audioUrl, audioUrls, ...rest } = memo;
          return { ...rest, audioUrls: [], audioBase64 } as SerializedMemo;
        }

        // No blob (shouldn't happen)
        const { blob, blobs, ...rest } = memo;
        return rest as SerializedMemo;
      })
    );
    localStorage.setItem(MEMOS_STORAGE_KEY, JSON.stringify(serialized));
  } catch (e) {
    console.error('Failed to save memos to localStorage:', e);
  }
};

// Load trash from localStorage
const loadTrashFromStorage = (): Memo[] => {
  try {
    const stored = localStorage.getItem(TRASH_STORAGE_KEY);
    if (!stored) return [];

    const serialized: SerializedMemo[] = JSON.parse(stored);
    return serialized.map(item => {
      // 新格式：多段音频
      if (item.audioBase64Array && item.audioBase64Array.length > 0) {
        const blobs = item.audioBase64Array.map(base64 => base64ToBlob(base64));
        const audioUrls = blobs.map(blob => URL.createObjectURL(blob));
        const { audioBase64Array, audioBase64, ...rest } = item;
        return migrateMemo({ ...rest, audioUrls, blobs }) as Memo;
      }

      // 旧格式：单段音频
      if (item.audioBase64) {
        const blob = base64ToBlob(item.audioBase64);
        const audioUrl = URL.createObjectURL(blob);
        const { audioBase64, ...rest } = item;
        return migrateMemo({ ...rest, audioUrl, blob }) as Memo;
      }

      return migrateMemo(item) as Memo;
    });
  } catch (e) {
    console.error('Failed to load trash from localStorage:', e);
    return [];
  }
};

// Save trash to localStorage
const saveTrashToStorage = async (memos: Memo[]): Promise<void> => {
  try {
    const serialized: SerializedMemo[] = await Promise.all(
      memos.map(async (memo) => {
        // 新格式：多段音频
        if (memo.blobs && memo.blobs.length > 0) {
          const audioBase64Array = await Promise.all(
            memo.blobs.map(b => blobToBase64(b))
          );
          const { blob, blobs, audioUrl, audioUrls, ...rest } = memo;
          return { ...rest, audioUrls: [], audioBase64Array } as SerializedMemo;
        }

        // 旧格式兼容
        if (memo.blob) {
          const audioBase64 = await blobToBase64(memo.blob);
          const { blob, blobs, audioUrl, audioUrls, ...rest } = memo;
          return { ...rest, audioUrls: [], audioBase64 } as SerializedMemo;
        }

        const { blob, blobs, ...rest } = memo;
        return rest as SerializedMemo;
      })
    );
    localStorage.setItem(TRASH_STORAGE_KEY, JSON.stringify(serialized));
  } catch (e) {
    console.error('Failed to save trash to localStorage:', e);
  }
};

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { apiKeys: userApiKeys, user } = useAuth();

  // --- Custom Cursor State ---
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const trailRef = useRef<{ x: number; y: number }[]>(Array(6).fill({ x: 0, y: 0 }));
  const [, setTrailRender] = useState(0);

  // --- State ---
  const [recorderState, setRecorderState] = useState<RecorderState>(RecorderState.IDLE);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [memos, setMemos] = useState<Memo[]>(() => loadMemosFromStorage());
  const [currentMemoId, setCurrentMemoId] = useState<string | null>('twin-peaks-pilot');
  const memosInitializedRef = useRef(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [titleFont, setTitleFont] = useState("'Consulate', monospace");
  const [contentFont, setContentFont] = useState("'Consulate', monospace");
  const [, setPinnedWords] = useState<string[]>([]);
  const [floatingWordsEnabled, setFloatingWordsEnabled] = useState(true);
  const [focusModeOpen, setFocusModeOpen] = useState(false);
  const [, setCapturedWords] = useState<string[]>([]);
  const [speechLang, setSpeechLang] = useState<'auto' | 'zh' | 'en'>('en'); // 默认英文，Auto 消耗双倍配额
  const [openTranscripts, setOpenTranscripts] = useState<Memo[]>([]);
  const [isUploadWindowOpen, setIsUploadWindowOpen] = useState(false); // Upload/Convert 窗口
  const [starVisible, setStarVisible] = useState(false);
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [showBugReport, setShowBugReport] = useState(false);
  const [speechMode, setSpeechMode] = useState<'standard' | 'hd'>('standard');
  const [activeService, setActiveService] = useState<string | null>(null); // Track which service is being used
  const [syncedMemoIds, setSyncedMemoIds] = useState<Set<string>>(new Set()); // Track which memos are synced to cloud
  const [trashedMemos, setTrashedMemos] = useState<Memo[]>(() => loadTrashFromStorage());
  const [isRecycleBinOpen, setIsRecycleBinOpen] = useState(false);
  const trashInitializedRef = useRef(false);

  // 全局播放状态（三个遥控器共享同一个播放器）
  const [globalPlayingMemoId, setGlobalPlayingMemoId] = useState<string | null>(null);
  const [isGlobalPlaying, setIsGlobalPlaying] = useState(false);
  const [globalPlaybackTime, setGlobalPlaybackTime] = useState(0);
  const [globalPlaybackProgress, setGlobalPlaybackProgress] = useState(0);
  // 多段音频播放状态
  const currentSegmentIndexRef = useRef(0);
  const segmentStartTimesRef = useRef<number[]>([]);
  const totalDurationRef = useRef(0);

  // Resume 录音状态
  const [resumingMemoId, setResumingMemoId] = useState<string | null>(null);
  const [resumingMemo, setResumingMemo] = useState<Memo | null>(null);
  // 使用 ref 存储 resume 状态，避免闭包问题
  const resumingMemoIdRef = useRef<string | null>(null);
  const resumingMemoRef = useRef<Memo | null>(null);
  // PAUSE 后应该 Resume 的标志（物理录音机逻辑：PAUSE 后按 REC = Resume）
  const shouldResumeAfterPauseRef = useRef<boolean>(false);

  // --- Check if returning from About page with archive open ---
  useEffect(() => {
    const state = location.state as { openArchive?: boolean } | null;
    if (state?.openArchive) {
      setIsDrawerOpen(true);
      // Clear the state so refresh doesn't reopen
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // --- Load speech mode on mount ---
  useEffect(() => {
    setSpeechMode(loadSpeechMode());
  }, []);

  // --- Persist memos to localStorage ---
  useEffect(() => {
    // Skip the first render (initial load from storage)
    if (!memosInitializedRef.current) {
      memosInitializedRef.current = true;
      return;
    }
    // Save memos whenever they change
    saveMemosToStorage(memos);
  }, [memos]);

  // --- Persist trash to localStorage ---
  useEffect(() => {
    if (!trashInitializedRef.current) {
      trashInitializedRef.current = true;
      return;
    }
    saveTrashToStorage(trashedMemos);
  }, [trashedMemos]);

  // --- Sync font with language selection ---
  useEffect(() => {
    if (speechLang === 'zh') {
      setContentFont("'HuiWen', serif");
    } else {
      setContentFont("'Consulate', monospace");
    }
  }, [speechLang]);

  // --- Load synced memo IDs when user logs in ---
  useEffect(() => {
    console.log('[CloudSync] User state:', user ? `Logged in as ${user.email}` : 'Not logged in');
    if (user) {
      getSyncedMemoIds(user.id)
        .then(ids => {
          console.log('[CloudSync] Synced memo IDs:', ids);
          setSyncedMemoIds(ids);
        })
        .catch(err => console.error('Failed to load synced memo IDs:', err));
    } else {
      setSyncedMemoIds(new Set());
    }
  }, [user]);

  // --- Cloud sync handlers ---
  const handleSyncToCloud = useCallback(async (memo: Memo) => {
    if (!user) {
      console.error('Must be logged in to sync');
      return;
    }
    await saveMemoToCloud(user.id, memo);
    setSyncedMemoIds(prev => new Set([...prev, memo.id]));
  }, [user]);

  // --- Save transcript handler ---
  const handleSaveTranscript = useCallback((memoId: string, newTranscription: string) => {
    setMemos(prev => prev.map(m =>
      m.id === memoId ? { ...m, transcription: newTranscription } : m
    ));
    // Also update the openTranscripts so the window reflects the saved content
    setOpenTranscripts(prev => prev.map(m =>
      m.id === memoId ? { ...m, transcription: newTranscription } : m
    ));
    console.log('[Save] Transcript saved for memo:', memoId);
  }, []);

  // --- Title change handler ---
  const handleTitleChange = useCallback((memoId: string, newTitle: string) => {
    setMemos(prev => prev.map(m =>
      m.id === memoId ? { ...m, title: newTitle } : m
    ));
    // Also update the openTranscripts
    setOpenTranscripts(prev => prev.map(m =>
      m.id === memoId ? { ...m, title: newTitle } : m
    ));
    console.log('[Save] Title changed for memo:', memoId, 'to:', newTitle);
  }, []);

  // --- Resume recording handler ---
  const handleResume = useCallback((memo: Memo) => {
    // 不允许对默认 memo 进行追加录音
    if (memo.id === 'twin-peaks-pilot') return;

    console.log('[Resume] handleResume called with memo:', memo.id);
    console.log('[Resume] memo.transcription length:', memo.transcription?.length);

    // 同时设置 state 和 ref（ref 用于 onstop 回调，避免闭包问题）
    setResumingMemoId(memo.id);
    setResumingMemo(memo);
    resumingMemoIdRef.current = memo.id;
    resumingMemoRef.current = memo;

    console.log('[Resume] Refs set - resumingMemoIdRef:', resumingMemoIdRef.current);

    // 关闭浮动窗口
    setOpenTranscripts(prev => prev.filter(m => m.id !== memo.id));
    // 开始录音 - 使用 ref 获取最新版本的 startRecording
    if (startRecordingRef.current) {
      startRecordingRef.current();
    }
  }, []);

  // --- Refs ---
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const mimeTypeRef = useRef<string>('');
  const transcriberRef = useRef<SpeechTranscriber | DeepgramTranscriber | ReturnType<typeof getHDService> | null>(null);
  const pinnedWordsRef = useRef<string[]>([]);
  const recorderContainerRef = useRef<HTMLDivElement | null>(null);
  const startRecordingRef = useRef<(() => void) | null>(null);
  const elapsedTimeRef = useRef<number>(0); // 避免闭包问题
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
      // 重置 PAUSE 标志（每次开始新的录音周期）
      shouldResumeAfterPauseRef.current = false;

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
        console.log('[Recording] onstop triggered');
        stream.getTracks().forEach(track => track.stop());

        const transcriber = transcriberRef.current;
        console.log('[Recording] transcriber:', transcriber ? 'exists' : 'null');
        const result = transcriber ? transcriber.stop() : { text: '', tags: ['Memo'] };
        console.log('[Recording] transcriber.stop() result:', result);

        const type = mimeTypeRef.current || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type });
        const newAudioUrl = URL.createObjectURL(audioBlob);
        const newText = result.text || '(No speech detected / 未检测到语音)';
        const newDuration = elapsedTimeRef.current; // 使用 ref 避免闭包问题
        const newTimestamps = result.wordTimestamps;

        // 如果是追加录音（Resume 功能）- 使用 ref 避免闭包问题
        const currentResumingId = resumingMemoIdRef.current;
        const currentResumingMemo = resumingMemoRef.current;

        console.log('[Resume Debug] ===== RESUME CHECK =====');
        console.log('[Resume Debug] currentResumingId:', currentResumingId);
        console.log('[Resume Debug] currentResumingMemo:', currentResumingMemo?.id);
        console.log('[Resume Debug] newText length:', newText?.length);
        console.log('[Resume Debug] newText:', newText?.substring(0, 100));
        console.log('[Resume Debug] result.text:', result.text?.substring(0, 100));
        console.log('[Resume Debug] newDuration:', newDuration);

        if (currentResumingId && currentResumingMemo) {
          console.log('[Resume Debug] ===== APPENDING TO EXISTING MEMO =====');
          console.log('[Resume Debug] Target memo ID:', currentResumingId);
          console.log('[Resume Debug] Existing transcription length:', currentResumingMemo.transcription?.length);
          console.log('[Resume Debug] New text to append:', newText?.substring(0, 100));

          // 偏移新的时间戳（加上之前所有段的总时长）
          console.log('[Resume Debug] currentResumingMemo.duration for offset:', currentResumingMemo.duration);
          console.log('[Resume Debug] newTimestamps count:', newTimestamps?.length);
          console.log('[Resume Debug] newTimestamps first few:', newTimestamps?.slice(0, 3));

          const offsetTimestamps = newTimestamps?.map(ts => ({
            ...ts,
            start: ts.start + currentResumingMemo.duration,
            end: ts.end + currentResumingMemo.duration,
          }));

          console.log('[Resume Debug] offsetTimestamps first few:', offsetTimestamps?.slice(0, 3));

          setMemos(prev => {
            console.log('[Resume Debug] setMemos callback - prev memos count:', prev.length);
            const targetMemo = prev.find(m => m.id === currentResumingId);
            console.log('[Resume Debug] Found target memo:', targetMemo ? 'yes' : 'no');

            return prev.map(m => {
              if (m.id === currentResumingId) {
                const existingUrls = m.audioUrls || (m.audioUrl ? [m.audioUrl] : []);
                const existingBlobs = m.blobs || (m.blob ? [m.blob] : []);
                const existingDurations = m.segmentDurations || [m.duration];
                const existingTimestamps = m.wordTimestamps || [];

                console.log('[Resume Debug] m.duration (current state):', m.duration);
                console.log('[Resume Debug] existingUrls count:', existingUrls.length);
                console.log('[Resume Debug] existingDurations:', existingDurations);
                console.log('[Resume Debug] existingTimestamps count:', existingTimestamps.length);

                const updatedMemo = {
                  ...m,
                  audioUrls: [...existingUrls, newAudioUrl],
                  blobs: [...existingBlobs, audioBlob],
                  transcription: m.transcription + '\n\n———\n\n' + newText,
                  duration: m.duration + newDuration,
                  segmentDurations: [...existingDurations, newDuration],
                  wordTimestamps: [...existingTimestamps, ...(offsetTimestamps || [])],
                  highlightedWords: [
                    ...(m.highlightedWords || []),
                    ...(pinnedWordsRef.current.length > 0 ? pinnedWordsRef.current : [])
                  ],
                };
                console.log('[Resume Debug] Updated memo:');
                console.log('[Resume Debug]   audioUrls count:', updatedMemo.audioUrls.length);
                console.log('[Resume Debug]   segmentDurations:', updatedMemo.segmentDurations);
                console.log('[Resume Debug]   total duration:', updatedMemo.duration);
                console.log('[Resume Debug]   wordTimestamps count:', updatedMemo.wordTimestamps?.length);
                return updatedMemo;
              }
              return m;
            });
          });

          // 更新 openTranscripts 中的对应 memo
          setOpenTranscripts(prev => prev.map(m => {
            if (m.id === currentResumingId) {
              const existingUrls = m.audioUrls || (m.audioUrl ? [m.audioUrl] : []);
              const existingBlobs = m.blobs || (m.blob ? [m.blob] : []);
              const existingDurations = m.segmentDurations || [m.duration];
              const existingTimestamps = m.wordTimestamps || [];

              return {
                ...m,
                audioUrls: [...existingUrls, newAudioUrl],
                blobs: [...existingBlobs, audioBlob],
                transcription: m.transcription + '\n\n———\n\n' + newText,
                duration: m.duration + newDuration,
                segmentDurations: [...existingDurations, newDuration],
                wordTimestamps: [...existingTimestamps, ...(offsetTimestamps || [])],
              };
            }
            return m;
          }));

          setCurrentMemoId(currentResumingId);

          // 如果是 PAUSE 触发的，保持 resume 状态（下次 REC 继续追加）
          if (shouldResumeAfterPauseRef.current) {
            console.log('[Pause→Resume] Appended, keeping resume state for memo:', currentResumingId);
            // 更新 refs 到最新的 memo 状态（包含刚追加的内容）
            // 需要从 memos 状态里获取更新后的版本
            // 但因为 setMemos 是异步的，我们需要手动计算更新后的 memo
            const updatedMemo: Memo = {
              ...currentResumingMemo,
              audioUrls: [...(currentResumingMemo.audioUrls || (currentResumingMemo.audioUrl ? [currentResumingMemo.audioUrl] : [])), newAudioUrl],
              blobs: [...(currentResumingMemo.blobs || (currentResumingMemo.blob ? [currentResumingMemo.blob] : [])), audioBlob],
              transcription: currentResumingMemo.transcription + '\n\n———\n\n' + newText,
              duration: currentResumingMemo.duration + newDuration,
              segmentDurations: [...(currentResumingMemo.segmentDurations || [currentResumingMemo.duration]), newDuration],
              wordTimestamps: [...(currentResumingMemo.wordTimestamps || []), ...(offsetTimestamps || [])],
            };
            setResumingMemo(updatedMemo);
            resumingMemoRef.current = updatedMemo;
            // 设为 PAUSED 状态，不重置时间
            setRecorderState(RecorderState.PAUSED);
            return; // 提前返回
          }

          // STOP 触发的：清除 resume 状态
          console.log('[Stop] Clearing resume state');
          setResumingMemoId(null);
          setResumingMemo(null);
          resumingMemoIdRef.current = null;
          resumingMemoRef.current = null;
        } else {
          // 创建新 memo（正常逻辑）
          const newMemo: Memo = {
            id: uuidv4(),
            audioUrls: [newAudioUrl],
            blobs: [audioBlob],
            audioUrl: newAudioUrl, // 向后兼容
            blob: audioBlob,       // 向后兼容
            transcription: newText,
            tags: result.tags,
            createdAt: Date.now(),
            isPermanent: false,
            duration: newDuration,
            segmentDurations: [newDuration],
            highlightedWords: pinnedWordsRef.current.length > 0 ? [...pinnedWordsRef.current] : undefined,
            wordTimestamps: newTimestamps,
          };

          setMemos(prev => [newMemo, ...prev]);
          setCurrentMemoId(newMemo.id);

          // 如果是 PAUSE 触发的停止，设置 Resume 状态
          // 下次按 REC 会继续追加到这个 memo
          if (shouldResumeAfterPauseRef.current) {
            console.log('[Pause→Resume] Setting up for resume, memo ID:', newMemo.id);
            setResumingMemoId(newMemo.id);
            setResumingMemo(newMemo);
            resumingMemoIdRef.current = newMemo.id;
            resumingMemoRef.current = newMemo;
            // 设为 PAUSED 状态（按钮保持按下），不重置标志直到下一次录音开始
            setRecorderState(RecorderState.PAUSED);
            // 不重置 elapsedTime，保留显示当前录音时长
            return; // 提前返回，不执行下面的 IDLE 逻辑
          }
        }

        // 正常停止：设为 IDLE
        setRecorderState(RecorderState.IDLE);
        setElapsedTime(0);
        elapsedTimeRef.current = 0;
      };

      mediaRecorder.start();

      // Start transcription based on speech mode
      if (speechMode === 'hd') {
        console.log('Using HD mode');
        const hdService = getHDService();

        // Configure with user's API keys if available
        const hasDeepgramKey = userApiKeys?.deepgram;
        const hasDashScopeKey = userApiKeys?.dashscope;

        if (hasDeepgramKey || hasDashScopeKey) {
          hdService.setConfig({
            deepgram: hasDeepgramKey ? {
              apiKey: userApiKeys.deepgram!,
            } : undefined,
            dashscope: hasDashScopeKey ? {
              apiKey: userApiKeys.dashscope!,
            } : undefined,
            primarySpeechApi: userApiKeys?.primarySpeechApi,
          });
        } else {
          // Visitor mode - clear any previous config
          hdService.clearConfig();
        }

        // Set language mode
        console.log(`[HomePage] Starting HD with speechLang: ${speechLang}`);
        hdService.setLanguageMode(speechLang as LanguageMode);
        transcriberRef.current = hdService;
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

      // Start the transcriber（传入已有的 stream 避免重复请求麦克风）
      if (speechMode === 'hd') {
        const hdService = transcriberRef.current as ReturnType<typeof getHDService>;
        const result = await hdService.start(stream);
        if (!result.success) {
          if (result.quotaExceeded) {
            alert(`Your weekly free HD minutes have been used up.\n\nClick "Through the curtain" (top left, purple text) to login and add your own API keys for unlimited access.`);
          } else {
            const errorMsg = (result as any).error || 'Unknown error';
            alert(`Failed to start ${result.service}: ${errorMsg}`);
          }
          // Stop the media recorder since we can't transcribe
          mediaRecorder.stop();
          return;
        }
        setActiveService(result.service);
        console.log(`HD mode started with ${result.service}`);
      } else {
        transcriberRef.current.start();
        setActiveService('web-speech');
      }

      setRecorderState(RecorderState.RECORDING);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Microphone access denied or not supported. Check settings.");
    }
  };

  // Keep startRecordingRef updated so handleResume can access the latest version
  useEffect(() => {
    startRecordingRef.current = startRecording;
  });

  const pauseRecording = () => {
    // 暂停 = 保存当前进度，但标记为可 Resume（物理录音机逻辑）
    // PAUSE 后按 REC = Resume，按 STOP = 彻底结束
    if (recorderState === RecorderState.RECORDING) {
      shouldResumeAfterPauseRef.current = true; // 标记：下次 REC 应该 Resume
      stopRecording();
    }
  };

  const stopRecording = () => {
    if (recorderState === RecorderState.PLAYING) {
      // 使用统一的停止播放逻辑
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.currentTime = 0;
      }
      setIsGlobalPlaying(false);
      setGlobalPlaybackTime(0);
      setGlobalPlaybackProgress(0);
      setGlobalPlayingMemoId(null);
      setRecorderState(RecorderState.IDLE);
      setElapsedTime(0);
      elapsedTimeRef.current = 0;
      currentSegmentIndexRef.current = 0;
      return;
    }

    if (recorderState === RecorderState.RECORDING || recorderState === RecorderState.PAUSED) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      } else {
        setRecorderState(RecorderState.IDLE);
        setElapsedTime(0);
        elapsedTimeRef.current = 0;
      }
    }
  };

  // STOP 按钮：彻底结束录音，清除所有 Resume 状态
  const finalStopRecording = () => {
    console.log('[FinalStop] Clearing pause flag, keeping resume refs for onstop');
    // 只清除 PAUSE 标志，让 onstop 知道这是 STOP 而不是 PAUSE
    // 不清除 resumingMemoIdRef，onstop 需要它来决定是追加还是创建
    shouldResumeAfterPauseRef.current = false;

    // 如果当前是 PAUSED 状态，需要清除 resume 状态并设为 IDLE
    // 因为 PAUSED 时 mediaRecorder 已经停了，不会再触发 onstop
    if (recorderState === RecorderState.PAUSED) {
      console.log('[FinalStop] Was PAUSED, clearing all resume state');
      setResumingMemoId(null);
      setResumingMemo(null);
      resumingMemoIdRef.current = null;
      resumingMemoRef.current = null;
      setRecorderState(RecorderState.IDLE);
      setElapsedTime(0);
      elapsedTimeRef.current = 0;
      return;
    }

    // 如果正在录音，调用 stopRecording 停止 MediaRecorder
    // onstop 会处理追加逻辑和清除 refs
    stopRecording();
  };

  // --- Playback Logic (统一播放器，支持多段音频) ---

  // 从指定段和位置开始播放
  const playFromSegment = useCallback((
    memo: Memo,
    segmentIndex: number,
    startOffset: number = 0
  ) => {
    const player = audioPlayerRef.current;
    if (!player) return;

    const urls = memo.audioUrls || (memo.audioUrl ? [memo.audioUrl] : []);
    const durations = memo.segmentDurations || [memo.duration];

    if (segmentIndex >= urls.length) {
      // 所有段播放完毕
      setIsGlobalPlaying(false);
      setGlobalPlaybackTime(0);
      setGlobalPlaybackProgress(0);
      setGlobalPlayingMemoId(null);
      setRecorderState(RecorderState.IDLE);
      currentSegmentIndexRef.current = 0;
      return;
    }

    currentSegmentIndexRef.current = segmentIndex;
    player.src = urls[segmentIndex];
    player.load();

    const handleLoadedMetadata = () => {
      if (startOffset > 0) {
        player.currentTime = startOffset;
      }
      player.play().catch(() => {
        setIsGlobalPlaying(false);
        setRecorderState(RecorderState.IDLE);
      });
      player.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };

    const handleTimeUpdate = () => {
      const startTimes = segmentStartTimesRef.current;
      const totalDuration = totalDurationRef.current;
      const globalTime = startTimes[currentSegmentIndexRef.current] + player.currentTime;
      setGlobalPlaybackTime(globalTime);
      setGlobalPlaybackProgress(totalDuration > 0 ? globalTime / totalDuration : 0);
      setElapsedTime(globalTime);
    };

    const handleEnded = () => {
      // 播放下一段
      player.removeEventListener('timeupdate', handleTimeUpdate);
      player.removeEventListener('ended', handleEnded);
      playFromSegment(memo, segmentIndex + 1, 0);
    };

    // 清除旧的事件监听器
    player.onloadedmetadata = null;
    player.ontimeupdate = null;
    player.onended = null;

    player.addEventListener('loadedmetadata', handleLoadedMetadata);
    player.addEventListener('timeupdate', handleTimeUpdate);
    player.addEventListener('ended', handleEnded);
  }, []);

  // 开始播放 memo（从头开始）
  // closeDrawer: 是否关闭抽屉（从磁带卡片点击时关闭，从浮动窗口点击时不关闭）
  const playMemo = useCallback(async (memo: Memo, closeDrawer: boolean = true) => {
    if (recorderState === RecorderState.RECORDING || recorderState === RecorderState.PROCESSING) return;
    if (!audioPlayerRef.current) return;

    const urls = memo.audioUrls || (memo.audioUrl ? [memo.audioUrl] : []);
    const durations = memo.segmentDurations || [memo.duration];

    if (urls.length === 0) return;

    // 计算每段的起始时间
    const startTimes: number[] = [];
    let cumulative = 0;
    for (const d of durations) {
      startTimes.push(cumulative);
      cumulative += d;
    }
    segmentStartTimesRef.current = startTimes;
    totalDurationRef.current = cumulative;

    // 停止当前播放
    audioPlayerRef.current.pause();

    // 只有从磁带卡片点击时才关闭抽屉
    if (closeDrawer) {
      setIsDrawerOpen(false);
    }
    setCurrentMemoId(memo.id);
    setGlobalPlayingMemoId(memo.id);
    setIsGlobalPlaying(true);
    setRecorderState(RecorderState.PLAYING);

    // 从第一段开始播放
    playFromSegment(memo, 0, 0);
  }, [recorderState, playFromSegment]);

  // 切换播放/暂停（从磁带卡片调用 - 会关闭抽屉跳到主页）
  const handleTogglePlay = useCallback((memo: Memo) => {
    const player = audioPlayerRef.current;
    if (!player) return;

    // 如果是同一个 memo
    if (globalPlayingMemoId === memo.id) {
      if (isGlobalPlaying) {
        // 暂停
        player.pause();
        setIsGlobalPlaying(false);
      } else {
        // 继续播放
        player.play();
        setIsGlobalPlaying(true);
        setRecorderState(RecorderState.PLAYING);
      }
    } else {
      // 播放新的 memo（关闭抽屉）
      playMemo(memo, true);
    }
  }, [globalPlayingMemoId, isGlobalPlaying, playMemo]);

  // 切换播放/暂停（从浮动窗口调用 - 不关闭抽屉）
  const handleTogglePlayInWindow = useCallback((memo: Memo) => {
    const player = audioPlayerRef.current;
    if (!player) return;

    // 如果是同一个 memo
    if (globalPlayingMemoId === memo.id) {
      if (isGlobalPlaying) {
        player.pause();
        setIsGlobalPlaying(false);
      } else {
        player.play();
        setIsGlobalPlaying(true);
        setRecorderState(RecorderState.PLAYING);
      }
    } else {
      // 播放新的 memo（不关闭抽屉）
      playMemo(memo, false);
    }
  }, [globalPlayingMemoId, isGlobalPlaying, playMemo]);

  // 停止播放
  const handleStopPlay = useCallback(() => {
    const player = audioPlayerRef.current;
    if (player) {
      player.pause();
      player.currentTime = 0;
    }
    setIsGlobalPlaying(false);
    setGlobalPlaybackTime(0);
    setGlobalPlaybackProgress(0);
    setGlobalPlayingMemoId(null);
    setRecorderState(RecorderState.IDLE);
    setElapsedTime(0);
    currentSegmentIndexRef.current = 0;
  }, []);

  // 跳转到指定时间
  const handleSeek = useCallback((targetTime: number) => {
    const playingMemo = memos.find(m => m.id === globalPlayingMemoId);
    if (!playingMemo || !audioPlayerRef.current) return;

    const urls = playingMemo.audioUrls || (playingMemo.audioUrl ? [playingMemo.audioUrl] : []);
    const durations = playingMemo.segmentDurations || [playingMemo.duration];
    const startTimes = segmentStartTimesRef.current;
    const totalDuration = totalDurationRef.current;

    // 限制在有效范围内
    targetTime = Math.max(0, Math.min(targetTime, totalDuration));

    // 找到目标时间所在的段
    let targetSegment = 0;
    let offsetInSegment = targetTime;
    for (let i = 0; i < startTimes.length; i++) {
      if (i === startTimes.length - 1 || targetTime < startTimes[i + 1]) {
        targetSegment = i;
        offsetInSegment = targetTime - startTimes[i];
        break;
      }
    }

    // 更新进度显示
    setGlobalPlaybackTime(targetTime);
    setGlobalPlaybackProgress(targetTime / totalDuration);

    // 如果在当前段内，直接跳转
    if (targetSegment === currentSegmentIndexRef.current) {
      audioPlayerRef.current.currentTime = offsetInSegment;
    } else {
      // 需要切换段
      if (isGlobalPlaying) {
        audioPlayerRef.current.pause();
        playFromSegment(playingMemo, targetSegment, offsetInSegment);
      }
    }
  }, [globalPlayingMemoId, memos, isGlobalPlaying, playFromSegment]);

  const playCurrentMemo = () => {
    const idx = getCurrentMemoIndex();
    if (idx !== -1) {
      playMemo(memos[idx]);
    }
  };

  // --- Audio Event Listeners (基本错误处理) ---
  useEffect(() => {
    const player = audioPlayerRef.current;
    if (!player) return;

    const onError = (e: any) => {
      console.error("Audio Player Error", e);
      setIsGlobalPlaying(false);
      setRecorderState(RecorderState.IDLE);
    };

    player.addEventListener('error', onError);

    return () => {
      player.removeEventListener('error', onError);
    };
  }, []);

  // --- Timer Effect (Visual Counter) ---
  useEffect(() => {
    if (recorderState === RecorderState.RECORDING) {
      timerRef.current = window.setInterval(() => {
        setElapsedTime(prev => {
          const newTime = prev + 1;
          elapsedTimeRef.current = newTime; // 同步更新 ref
          return newTime;
        });
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

  const handleDelete = async (id: string) => {
    // Find the memo to move to trash
    const memoToTrash = memos.find(m => m.id === id);
    if (memoToTrash) {
      setTrashedMemos(prev => [memoToTrash, ...prev]);
    }

    // Delete from cloud if synced
    if (user && syncedMemoIds.has(id)) {
      try {
        await deleteMemoFromCloud(user.id, id);
        setSyncedMemoIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      } catch (err) {
        console.error('Failed to delete from cloud:', err);
      }
    }

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

  // Recover memos from trash
  const handleRecover = useCallback((ids: string[]) => {
    const memosToRecover = trashedMemos.filter(m => ids.includes(m.id));
    setMemos(prev => [...memosToRecover, ...prev]);
    setTrashedMemos(prev => prev.filter(m => !ids.includes(m.id)));
    console.log('[Trash] Recovered:', ids);
  }, [trashedMemos]);

  // Permanently delete memos from trash
  const handleDeleteForever = useCallback((ids: string[]) => {
    setTrashedMemos(prev => prev.filter(m => !ids.includes(m.id)));
    console.log('[Trash] Permanently deleted:', ids);
  }, []);

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
    <div className="min-h-screen text-white overflow-hidden relative font-sans select-none cursor-none">

      {/* Shooting Star */}
      <ShootingStar
        onCatch={() => goToAbout('homepage')}
        disabled={isDrawerOpen || recorderState === RecorderState.RECORDING}
        onVisibilityChange={setStarVisible}
      />


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
          onSave={handleSaveTranscript}
          onTitleChange={handleTitleChange}
          onResume={handleResume}
          titleFont={titleFont}
          contentFont={contentFont}
          initialOffset={index * 30}
          onOpenAbout={() => goToAbout('transcript')}
          creatorEmail="diane@twinpeaks.fm"
          onSyncToCloud={handleSyncToCloud}
          isSynced={syncedMemoIds.has(memo.id)}
          isLoggedIn={!!user}
          globalPlayingMemoId={globalPlayingMemoId}
          isGlobalPlaying={isGlobalPlaying}
          globalPlaybackTime={globalPlaybackTime}
          globalPlaybackProgress={globalPlaybackProgress}
          onTogglePlay={handleTogglePlayInWindow}
          onStopPlay={handleStopPlay}
          onSeek={handleSeek}
        />
      ))}

      {/* Settings Modal */}
      <ApiSettings
        isOpen={showApiSettings}
        onClose={() => setShowApiSettings(false)}
        onSpeechModeChange={setSpeechMode}
        currentSpeechMode={speechMode}
      />

      <BugReport
        isOpen={showBugReport}
        onClose={() => setShowBugReport(false)}
      />

      {/* Upload/Convert Window */}
      <UploadConvertWindow
        isOpen={isUploadWindowOpen}
        onClose={() => setIsUploadWindowOpen(false)}
        onCreateMemo={(newMemo) => {
          setMemos(prev => [newMemo, ...prev]);
        }}
        titleFont={titleFont}
        contentFont={contentFont}
      />

      {/* Top Left Controls */}
      {!isDrawerOpen && (
        <div className="fixed top-6 left-6 z-50 flex items-center gap-6">
          {/* Through the curtain (Login) + Mode indicator */}
          <span
            onClick={() => setShowApiSettings(true)}
            className="cursor-pointer font-recorder text-[11px] tracking-[0.3em] uppercase transition-all duration-300 hover:opacity-80"
            style={{ color: '#b69fbb' }}
          >
            Through the curtain · {speechMode === 'hd' ? 'HD' : 'STD'}
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
                    ? 'text-[#b69fbb] hover:text-[#d4c4d9]'
                    : 'text-white/50 hover:text-white/70'
                }`}
              >
                THE LODGE
              </span>

              <span
                onClick={() => {
                  // 顺序: EN → 中文 → AUTO (Auto 消耗双倍配额，放最后)
                  const next = speechLang === 'en' ? 'zh' : speechLang === 'zh' ? 'auto' : 'en';
                  console.log(`[HomePage] Language toggle: ${speechLang} → ${next}`);

                  // 先更新状态
                  setSpeechLang(next);

                  // 如果正在录音，重启连接用新语言
                  if (recorderState === RecorderState.RECORDING && transcriberRef.current) {
                    if ('switchLanguage' in transcriberRef.current) {
                      // HD service - 切换语言并重启连接
                      (transcriberRef.current as ReturnType<typeof getHDService>).switchLanguage(next as LanguageMode);
                    } else if ('setLanguage' in transcriberRef.current) {
                      // Regular transcriber (Web Speech) - 只更新语言
                      const langMap = { 'auto': '', 'zh': 'zh-TW', 'en': 'en-US' };
                      (transcriberRef.current as SpeechTranscriber | DeepgramTranscriber).setLanguage(langMap[next]);
                    }
                  }

                  // 更新字体
                  if (next === 'zh') {
                    setTitleFont("'HuiWen', serif");
                    setContentFont("'HuiWen', serif");
                  } else {
                    setTitleFont("'Consulate', monospace");
                    setContentFont("'Consulate', monospace");
                  }
                }}
                className="cursor-pointer font-recorder text-[11px] tracking-[0.3em] uppercase transition-all duration-300 text-white/50 hover:text-white/70"
              >
                {speechLang === 'auto' ? 'AUTO' : speechLang === 'zh' ? '中文' : 'EN'}
              </span>
            </>
          )}
        </div>
      )}

      {/* Top Right - Report Bug */}
      {!isDrawerOpen && (
        <div className="fixed top-6 right-6 z-50 flex items-center">
          <span
            onClick={() => setShowBugReport(true)}
            className="cursor-pointer font-recorder text-[11px] tracking-[0.3em] uppercase transition-all duration-300 hover:opacity-80"
            style={{ color: '#b69fbb' }}
          >
            Something's wrong
          </span>
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

        <main className="flex-1 flex flex-col items-center justify-center p-4 overflow-hidden min-h-0">
          <div ref={recorderContainerRef} className="flex-1 flex items-center justify-center overflow-hidden min-h-0">
            <RecorderUI
              state={recorderState}
              elapsedTime={elapsedTime}
              currentMemo={memos.find(m => m.id === currentMemoId) || null}
              onRecord={startRecording}
              onPause={pauseRecording}
              onStop={finalStopRecording}
              onPlay={playCurrentMemo}
              onRewind={handleRewind}
              onFastForward={handleFastForward}
              onErase={handleErase}
              clickSoundUrl="/sound/twin-peaks-clicksound.mp3"
            />
          </div>

          {/* The Case Files - right below recorder */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="shrink-0 mt-3 group flex flex-col items-center gap-3 transition-all duration-500 hover:-translate-y-1"
          >
            <div className="relative">
              <div className="w-32 h-2.5 bg-[#1a1a1a] rounded-full border border-zinc-800 shadow-2xl group-hover:w-40 transition-all duration-500 overflow-hidden">
                 <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              </div>
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#b69fbb] rounded-full animate-pulse shadow-[0_0_8px_rgba(182,159,187,0.6)]"></div>
            </div>
            <div className="text-[#b69fbb]/60 font-recorder text-[11px] tracking-[0.3em] uppercase group-hover:text-[#b69fbb] transition-colors">
              The Case Files
            </div>
          </button>

        </main>

        {/* Footer with rotating hints */}
        <div className="shrink-0 pb-6 flex flex-col items-center gap-4">
          {/* Rotating hints area - fixed height to prevent jumping */}
          <div className="h-6 flex items-center justify-center">
            <AnimatePresence mode="wait">
              {starVisible ? (
                // Star is visible - show catch hint with glow
                <motion.div
                  key="star-hint"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="text-center"
                >
                  <motion.p
                    animate={{
                      opacity: [0.7, 1, 0.7],
                      textShadow: [
                        '0 0 6px rgba(255,255,255,0.6), 0 0 12px rgba(255,255,255,0.4), 0 0 18px rgba(255,255,255,0.2)',
                        '0 0 12px rgba(255,255,255,0.9), 0 0 24px rgba(255,255,255,0.6), 0 0 36px rgba(255,255,255,0.4)',
                        '0 0 6px rgba(255,255,255,0.6), 0 0 12px rgba(255,255,255,0.4), 0 0 18px rgba(255,255,255,0.2)'
                      ]
                    }}
                    transition={{
                      duration: 3,
                      ease: 'easeInOut',
                      repeat: Infinity
                    }}
                    className="text-[14px] text-white tracking-[0.12em] whitespace-nowrap"
                    style={{ fontFamily: "'Consulate', monospace" }}
                  >
                    press space to catch the shooting star
                  </motion.p>
                </motion.div>
              ) : recorderState === RecorderState.RECORDING ? (
                // Recording - show recording hints
                <motion.div
                  key="recording-hint"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="text-center"
                >
                  <p className="text-[10px] text-white/30 font-mono tracking-[0.2em] uppercase">
                    click words to capture · focus mode for productivity
                  </p>
                </motion.div>
              ) : (
                // Idle - show star hint (dim)
                <motion.div
                  key="idle-hint"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.2 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="text-center"
                >
                  <p
                    className="text-[14px] text-white tracking-[0.12em] whitespace-nowrap"
                    style={{ fontFamily: "'Consulate', monospace" }}
                  >
                    press space to catch the shooting star
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <p className="text-[9px] text-zinc-700 font-mono tracking-[0.2em] uppercase">
            Designed for Agent Cooper &bull; Twin Peaks, WA
          </p>
        </div>
      </div>

      <TapeDrawer
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          // 不清除浮动窗口，让它们保持打开状态
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
          // 打开浮动窗口
          setOpenTranscripts(prev => {
            if (prev.some(m => m.id === memo.id)) return prev;
            return [...prev, memo];
          });
        }}
        onOpenAbout={() => goToAbout('archive')}
        onOpenRecycleBin={() => setIsRecycleBinOpen(true)}
        onOpenUploadWindow={() => setIsUploadWindowOpen(true)}
        trashedCount={trashedMemos.length}
        onStop={handleStopPlay}
        globalPlayingMemoId={globalPlayingMemoId}
      />

      <RecycleBin
        isOpen={isRecycleBinOpen}
        onClose={() => setIsRecycleBinOpen(false)}
        trashedMemos={trashedMemos}
        onRecover={handleRecover}
        onDeleteForever={handleDeleteForever}
        contentFont={contentFont}
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
