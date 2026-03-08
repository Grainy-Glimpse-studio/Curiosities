import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import emailjs from '@emailjs/browser';
import { X, Minus, Maximize2, Minimize2, Play, Pause, Square, Download, FileText, FileCode, File, Bold, Italic, Underline, List, ListOrdered, Quote, Heading1, Heading2, Undo, Redo, Music, Sparkles, Mail, Info, Upload, Cloud, CloudOff, Loader2, Save, Mic, Subtitles } from 'lucide-react';
import { Memo } from '../types';
import MarkdownEditor, { MarkdownEditorRef } from './MarkdownEditor';

interface FloatingTranscriptProps {
  memo: Memo | null;
  isOpen: boolean;
  onClose: () => void;
  onPlay: (memo: Memo) => void;
  onSave?: (memoId: string, newTranscription: string) => void; // 保存编辑
  onTitleChange?: (memoId: string, newTitle: string) => void; // 修改标题
  onResume?: (memo: Memo) => void; // 继续录音
  titleFont: string;
  contentFont: string;
  initialOffset?: number; // 多窗口时的偏移量
  onOpenAbout?: () => void; // 打开 About 页面
  creatorEmail?: string; // 创作者邮箱
  // Cloud sync props
  onSyncToCloud?: (memo: Memo) => Promise<void>;
  isSynced?: boolean;
  isLoggedIn?: boolean;
}

// SRT 时间格式转换：秒 -> HH:MM:SS,mmm
const formatSRTTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
};

// 生成 SRT 内容
const generateSRT = (wordTimestamps: Array<{ word: string; start: number; end: number }>): string => {
  if (!wordTimestamps || wordTimestamps.length === 0) {
    return '';
  }

  // 把词组合成句子（每 8-12 个词一行，或遇到标点断句）
  const subtitles: Array<{ start: number; end: number; text: string }> = [];
  let currentWords: string[] = [];
  let currentStart = wordTimestamps[0].start;
  let currentEnd = wordTimestamps[0].end;

  for (let i = 0; i < wordTimestamps.length; i++) {
    const { word, start, end } = wordTimestamps[i];
    currentWords.push(word);
    currentEnd = end;

    // 判断是否应该断句
    const isPunctuation = /[.!?。！？]$/.test(word);
    const isLongEnough = currentWords.length >= 8;
    const isVeryLong = currentWords.length >= 12;
    const isLast = i === wordTimestamps.length - 1;

    if (isPunctuation || isVeryLong || isLast || (isLongEnough && i < wordTimestamps.length - 1 && wordTimestamps[i + 1].start - end > 0.5)) {
      subtitles.push({
        start: currentStart,
        end: currentEnd,
        text: currentWords.join(' '),
      });
      currentWords = [];
      if (i < wordTimestamps.length - 1) {
        currentStart = wordTimestamps[i + 1].start;
      }
    }
  }

  // 生成 SRT 格式
  return subtitles.map((sub, index) => {
    return `${index + 1}\n${formatSRTTime(sub.start)} --> ${formatSRTTime(sub.end)}\n${sub.text}\n`;
  }).join('\n');
};

// 从文本生成默认标题（取前几个词）
const generateDefaultTitle = (text: string): string => {
  if (!text) return 'Untitled';
  // 去掉分隔符和多余空白
  const cleaned = text.replace(/———/g, '').trim();
  // 取前30个字符或到第一个换行
  const firstLine = cleaned.split('\n')[0];
  if (firstLine.length <= 30) return firstLine;
  // 截取并加省略号
  return firstLine.substring(0, 30).trim() + '...';
};

// 卡拉OK式高亮文本组件
interface KaraokeTextProps {
  text: string;
  currentTime: number; // 当前播放时间（秒）
  fontFamily: string;
  wordTimestamps?: Array<{ word: string; start: number; end: number }>;
  audioDuration?: number; // 音频总时长（秒），用于没有时间戳时估算
  audioOffset?: number; // 音频开头的静音时长（秒）
}

const KaraokeText: React.FC<KaraokeTextProps> = ({ text, currentTime, fontFamily, wordTimestamps, audioDuration, audioOffset = 0 }) => {
  // 计算词的发光强度（0-1），基于当前时间在词时间范围内的位置
  const getGlowIntensity = (timestamp: { start: number; end: number } | undefined): number => {
    if (!timestamp) return 1; // 没有时间戳的词默认全亮

    // 还没到这个词
    if (currentTime < timestamp.start) return 0;

    // 已经播完这个词
    if (currentTime >= timestamp.end) return 1;

    // 正在播这个词，渐变效果
    const progress = (currentTime - timestamp.start) / (timestamp.end - timestamp.start);
    return Math.min(1, progress * 1.5); // 稍微加速，让效果更明显
  };

  // 根据强度生成样式
  const getWordStyle = (intensity: number): React.CSSProperties => {
    if (intensity === 0) {
      return {
        color: 'rgba(255,255,255,0.5)',
        textShadow: 'none',
        transition: 'color 0.15s ease-out, text-shadow 0.15s ease-out',
      };
    }

    const alpha = 0.5 + intensity * 0.5; // 0.5 -> 1.0
    const glowAlpha1 = intensity * 0.8;
    const glowAlpha2 = intensity * 0.5;
    const glowAlpha3 = intensity * 0.3;

    return {
      color: `rgba(255,255,255,${alpha})`,
      textShadow: `0 0 ${8 * intensity}px rgba(255,255,255,${glowAlpha1}), 0 0 ${16 * intensity}px rgba(255,255,255,${glowAlpha2}), 0 0 ${24 * intensity}px rgba(255,255,255,${glowAlpha3})`,
      transition: 'color 0.15s ease-out, text-shadow 0.15s ease-out',
    };
  };

  // 检测是否包含中文字符
  const hasChinese = (str: string) => /[\u4e00-\u9fa5]/.test(str);

  // 清理词（去除标点）用于匹配
  const cleanWord = (w: string) => w.replace(/[.,!?;:'"，。！？；：、""'']/g, '').toLowerCase();

  // 如果有词级时间戳，用原文结构 + 时间戳做发光
  if (wordTimestamps && wordTimestamps.length > 0) {
    // 按段落分割原文（保留 ——— 分隔符和换行）
    const sections = text.split(/(\n\n+|———)/);
    let timestampIndex = 0;

    return (
      <div
        className="text-white text-base leading-relaxed"
        style={{ fontFamily }}
      >
        {sections.map((section, sIdx) => {
          // 如果是分隔符，渲染分隔符
          if (section === '———') {
            return (
              <p key={sIdx} className="my-4 text-center text-white/30">
                ———
              </p>
            );
          }

          // 如果是空白，跳过
          if (/^\s*$/.test(section)) {
            return null;
          }

          // 渲染段落内容
          // 对于中文，按字符分割；对于英文，按空格分割
          const isMostlyChinese = (section.match(/[\u4e00-\u9fa5]/g) || []).length > section.length * 0.3;

          if (isMostlyChinese) {
            // 中文：每个字符单独渲染
            const chars = section.split('');
            return (
              <p key={sIdx} className="mb-4">
                {chars.map((char, cIdx) => {
                  // 跳过空白字符
                  if (/\s/.test(char)) {
                    return <span key={cIdx}>{char}</span>;
                  }

                  // 尝试匹配时间戳
                  let timestamp: { start: number; end: number } | undefined;
                  if (timestampIndex < wordTimestamps.length) {
                    const ts = wordTimestamps[timestampIndex];
                    // 检查这个字符是否在当前时间戳的词里
                    if (ts.word.includes(char)) {
                      timestamp = ts;
                      // 如果是这个词的最后一个字符，移动到下一个时间戳
                      const wordChars = ts.word.split('');
                      const charPosInWord = wordChars.indexOf(char);
                      if (charPosInWord === wordChars.length - 1 || !ts.word.slice(charPosInWord + 1).includes(char)) {
                        timestampIndex++;
                      }
                    }
                  }

                  const intensity = getGlowIntensity(timestamp);
                  return (
                    <span key={cIdx} style={getWordStyle(intensity)}>
                      {char}
                    </span>
                  );
                })}
              </p>
            );
          } else {
            // 英文：按空格分词
            const words = section.split(/(\s+)/);
            return (
              <p key={sIdx} className="mb-4">
                {words.map((word, wIdx) => {
                  // 空白字符直接渲染
                  if (/^\s+$/.test(word)) {
                    return <span key={wIdx}>{word}</span>;
                  }

                  // 尝试匹配时间戳
                  let timestamp: { start: number; end: number } | undefined;
                  if (timestampIndex < wordTimestamps.length) {
                    const ts = wordTimestamps[timestampIndex];
                    // 简单匹配：清理后比较
                    if (cleanWord(ts.word) === cleanWord(word) || ts.word.includes(cleanWord(word)) || cleanWord(word).includes(cleanWord(ts.word))) {
                      timestamp = ts;
                      timestampIndex++;
                    }
                  }

                  const intensity = getGlowIntensity(timestamp);
                  return (
                    <span key={wIdx} style={getWordStyle(intensity)}>
                      {word}
                    </span>
                  );
                })}
              </p>
            );
          }
        })}
      </div>
    );
  }

  // 没有时间戳时，根据音频时长估算时间戳
  if (audioDuration && audioDuration > 0) {
    // 统计总词数（用于估算每个词的时间）
    const allWords = text.split(/\s+/).filter(w => w.length > 0);
    const totalWords = allWords.length;
    // 实际说话时长 = 总时长 - 开头静音
    const speakingDuration = audioDuration - audioOffset;
    const timePerWord = speakingDuration / totalWords;

    // 按段落分割
    const paragraphs = text.split(/\n\n+/);
    let globalWordIndex = 0;

    return (
      <div
        className="text-white text-base leading-relaxed"
        style={{ fontFamily }}
      >
        {paragraphs.map((para, pIdx) => {
          const words = para.split(/(\s+)/);

          return (
            <p key={pIdx} className="mb-4">
              {words.map((word, wIdx) => {
                // 空白字符直接渲染
                if (/^\s+$/.test(word)) {
                  return <span key={wIdx}>{word}</span>;
                }

                // 估算这个词的时间戳（从 audioOffset 开始）
                const estimatedStart = audioOffset + globalWordIndex * timePerWord;
                const estimatedEnd = audioOffset + (globalWordIndex + 1) * timePerWord;
                globalWordIndex++;

                const intensity = getGlowIntensity({ start: estimatedStart, end: estimatedEnd });
                return (
                  <span key={wIdx} style={getWordStyle(intensity)}>
                    {word}
                  </span>
                );
              })}
            </p>
          );
        })}
      </div>
    );
  }

  // 完全没有时间信息时，全部暗色显示
  const dimStyle: React.CSSProperties = {
    color: 'rgba(255,255,255,0.5)',
  };

  return (
    <div
      className="text-white text-base leading-relaxed"
      style={{ fontFamily }}
    >
      {text.split(/\n\n+/).map((para, idx) => (
        <p key={idx} className="mb-4" style={dimStyle}>
          {para}
        </p>
      ))}
    </div>
  );
};

const FloatingTranscript: React.FC<FloatingTranscriptProps> = ({
  memo,
  isOpen,
  onClose,
  onPlay,
  onSave,
  onTitleChange,
  onResume,
  titleFont,
  contentFont,
  initialOffset = 0,
  onOpenAbout,
  creatorEmail = 'diane@twinpeaks.fm', // 默认邮箱，之后可以改
  onSyncToCloud,
  isSynced = false,
  isLoggedIn = false,
}) => {
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [size, setSize] = useState({ width: 720, height: 580 });
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [prevState, setPrevState] = useState({ position: { x: 100, y: 100 }, size: { width: 720, height: 580 } });
  const [isPlayingInModal, setIsPlayingInModal] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0); // 当前播放时间（秒）
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showJoinMenu, setShowJoinMenu] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [editableTitle, setEditableTitle] = useState('');
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [showProjectInfo, setShowProjectInfo] = useState(false); // 显示项目介绍
  const [isSyncing, setIsSyncing] = useState(false); // 云同步中
  const [flowEnabled, setFlowEnabled] = useState(true); // 播放时文字发光效果

  // 多段音频播放状态
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const segmentStartTimesRef = useRef<number[]>([]); // 每段的起始时间
  const totalDurationRef = useRef<number>(0); // 总时长
  const progressBarRef = useRef<HTMLDivElement>(null); // 进度条 ref
  const isDraggingRef = useRef(false); // 是否正在拖动进度条

  // AI 侧边栏状态
  const [showAISidebar, setShowAISidebar] = useState(false);
  const [showCustomPanel, setShowCustomPanel] = useState(false); // 第三个面板
  const [selectedAIFeatures, setSelectedAIFeatures] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 侧边栏宽度
  const AI_SIDEBAR_WIDTH = 220;
  const CUSTOM_PANEL_WIDTH = 280;

  const windowRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  const modalAudioRef = useRef<HTMLAudioElement | null>(null);
  const editorRef = useRef<MarkdownEditorRef>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const resizeStartPos = useRef({ x: 0, y: 0 });
  const resizeStartSize = useRef({ width: 0, height: 0 });

  // 居中窗口（带偏移）
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      setPosition({
        x: (window.innerWidth - size.width) / 2 + initialOffset,
        y: (window.innerHeight - size.height) / 2 + initialOffset,
      });
      // 重置状态
      setShowExportMenu(false);
      // 设置标题（使用 memo.title 或自动生成）
      if (memo) {
        setEditableTitle(memo.title || generateDefaultTitle(memo.transcription));
      }
    }
  }, [isOpen, initialOffset, memo]);

  // 初始化音频时长信息
  useEffect(() => {
    if (memo) {
      const durations = memo.segmentDurations || [memo.duration];
      const startTimes: number[] = [];
      let cumulative = 0;
      for (const d of durations) {
        startTimes.push(cumulative);
        cumulative += d;
      }
      segmentStartTimesRef.current = startTimes;
      totalDurationRef.current = cumulative;
    }
  }, [memo]);

  // 播放控制 - 支持多段音频
  const playInModal = () => {
    if (!memo) return;

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

    // 如果正在播放，暂停
    if (isPlayingInModal) {
      modalAudioRef.current?.pause();
      setIsPlayingInModal(false);
      return;
    }

    // 开始播放
    playFromSegment(0, 0, urls, durations, startTimes, cumulative);
  };

  // 从指定段和位置开始播放
  const playFromSegment = (
    segmentIndex: number,
    startOffset: number,
    urls: string[],
    durations: number[],
    startTimes: number[],
    totalDuration: number
  ) => {
    const playSegment = (index: number, offset: number = 0) => {
      if (index >= urls.length) {
        // 所有段播放完毕
        setIsPlayingInModal(false);
        setPlaybackProgress(0);
        setCurrentPlaybackTime(0);
        setCurrentSegmentIndex(0);
        return;
      }

      setCurrentSegmentIndex(index);
      const audio = new Audio(urls[index]);
      modalAudioRef.current = audio;

      audio.addEventListener('loadedmetadata', () => {
        if (offset > 0) {
          audio.currentTime = offset;
        }
      });

      audio.addEventListener('timeupdate', () => {
        if (audio && !isDraggingRef.current) {
          // 计算全局播放时间和进度
          const globalTime = startTimes[index] + audio.currentTime;
          setCurrentPlaybackTime(globalTime);
          setPlaybackProgress(globalTime / totalDuration);
        }
      });

      audio.addEventListener('ended', () => {
        // 播放下一段
        playSegment(index + 1, 0);
      });

      audio.addEventListener('error', () => {
        console.error('Audio playback error at segment', index);
        setIsPlayingInModal(false);
      });

      audio.play().catch(() => {
        setIsPlayingInModal(false);
      });
    };

    setIsPlayingInModal(true);
    playSegment(segmentIndex, startOffset);
  };

  // 跳转到指定时间（秒）
  const seekToTime = (targetTime: number) => {
    if (!memo) return;

    const urls = memo.audioUrls || (memo.audioUrl ? [memo.audioUrl] : []);
    const durations = memo.segmentDurations || [memo.duration];
    if (urls.length === 0) return;

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
    setCurrentPlaybackTime(targetTime);
    setPlaybackProgress(targetTime / totalDuration);

    // 如果正在播放，跳转到新位置
    if (isPlayingInModal) {
      modalAudioRef.current?.pause();
      playFromSegment(targetSegment, offsetInSegment, urls, durations, startTimes, totalDuration);
    }
  };

  // 进度条点击/拖动处理
  const handleProgressBarInteraction = (e: React.MouseEvent | MouseEvent) => {
    if (!progressBarRef.current || !memo) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const progress = x / rect.width;
    const targetTime = progress * totalDurationRef.current;

    seekToTime(targetTime);
  };

  const handleProgressBarMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    handleProgressBarInteraction(e);

    const handleMouseMove = (e: MouseEvent) => {
      handleProgressBarInteraction(e);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const stopModalPlayback = () => {
    if (modalAudioRef.current) {
      modalAudioRef.current.pause();
      modalAudioRef.current.currentTime = 0;
      modalAudioRef.current = null;
      setIsPlayingInModal(false);
      setPlaybackProgress(0);
      setCurrentPlaybackTime(0);
      setCurrentSegmentIndex(0);
    }
  };

  // 关闭时清理
  const handleClose = () => {
    stopModalPlayback();
    onClose();
  };

  // 最大化/还原
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

  // 最小化
  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  // 拖拽处理
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

  // 缩放处理
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

      if (direction.includes('e')) newWidth = Math.max(400, resizeStartSize.current.width + deltaX);
      if (direction.includes('w')) {
        newWidth = Math.max(400, resizeStartSize.current.width - deltaX);
        newX = startPosition.x + (resizeStartSize.current.width - newWidth);
      }
      if (direction.includes('s')) newHeight = Math.max(300, resizeStartSize.current.height + deltaY);
      if (direction.includes('n')) {
        newHeight = Math.max(300, resizeStartSize.current.height - deltaY);
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

  const formatDate = (ts: number) => new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // AI 功能选择切换
  const toggleAIFeature = (feature: string) => {
    setSelectedAIFeatures(prev =>
      prev.includes(feature)
        ? prev.filter(f => f !== feature)
        : [...prev, feature]
    );
  };

  // 文件上传处理
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      // Auto-select custom feature when file is uploaded
      if (!selectedAIFeatures.includes('custom')) {
        setSelectedAIFeatures(prev => [...prev, 'custom']);
      }
    }
  };

  const clearUploadedFile = () => {
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 应用 AI 处理（暂时只是占位，后续接入 API）
  const handleApplyAI = async () => {
    if (selectedAIFeatures.length === 0) return;
    setIsProcessingAI(true);
    // TODO: 接入实际的 AI API
    console.log('[AI Processing] Selected features:', selectedAIFeatures);
    if (selectedAIFeatures.includes('custom')) {
      if (customPrompt) {
        console.log('[AI Processing] Custom prompt:', customPrompt);
      }
      if (uploadedFile) {
        console.log('[AI Processing] Uploaded file:', uploadedFile.name);
      }
    }
    // 模拟处理
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsProcessingAI(false);
    setShowAISidebar(false);
  };


  // 导出功能
  const exportAsMarkdown = () => {
    if (!memo) return;
    const content = `# Transcript\n\n**Date:** ${new Date(memo.createdAt).toLocaleString()}\n\n**Tags:** ${memo.tags.map((t: string) => `#${t}`).join(' ')}\n\n---\n\n${memo.transcription}`;
    const element = document.createElement("a");
    const file = new Blob([content], {type: 'text/markdown'});
    element.href = URL.createObjectURL(file);
    element.download = `transcript-${formatDate(memo.createdAt)}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    setShowExportMenu(false);
  };

  const exportAsPDF = () => {
    if (!memo) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Transcript - ${formatDate(memo.createdAt)}</title>
            <style>
              body { font-family: Georgia, serif; padding: 40px; line-height: 1.8; }
              .meta { color: #666; font-size: 14px; margin-bottom: 10px; }
              .tags { margin-bottom: 20px; }
              .tag { background: #eee; padding: 2px 8px; border-radius: 4px; margin-right: 5px; font-size: 12px; }
              .content { white-space: pre-wrap; }
            </style>
          </head>
          <body>
            <h1>Transcript</h1>
            <div class="meta">Date: ${new Date(memo.createdAt).toLocaleString()}</div>
            <div class="tags">${memo.tags.map((t: string) => `<span class="tag">#${t}</span>`).join('')}</div>
            <div class="content">${memo.transcription}</div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
    setShowExportMenu(false);
  };

  const exportAsWord = () => {
    if (!memo) return;
    const content = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
        <head><meta charset='utf-8'><title>Transcript</title></head>
        <body style="font-family: Georgia, serif; line-height: 1.8;">
          <h1>Transcript</h1>
          <p><strong>Date:</strong> ${new Date(memo.createdAt).toLocaleString()}</p>
          <p><strong>Tags:</strong> ${memo.tags.map((t: string) => `#${t}`).join(' ')}</p>
          <hr/>
          <p>${memo.transcription.replace(/\n/g, '<br/>')}</p>
        </body>
      </html>
    `;
    const blob = new Blob([content], { type: 'application/msword' });
    const element = document.createElement("a");
    element.href = URL.createObjectURL(blob);
    element.download = `transcript-${formatDate(memo.createdAt)}.doc`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    setShowExportMenu(false);
  };

  const downloadAudio = () => {
    if (!memo) return;
    const urls = memo.audioUrls || (memo.audioUrl ? [memo.audioUrl] : []);
    if (urls.length === 0) return;

    // 下载所有段
    urls.forEach((url, index) => {
      const element = document.createElement("a");
      element.href = url;
      const suffix = urls.length > 1 ? `-part${index + 1}` : '';
      element.download = `recording-${formatDate(memo.createdAt)}${suffix}.webm`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    });
    setShowExportMenu(false);
  };

  // 导出 SRT 字幕文件
  const exportAsSRT = () => {
    if (!memo) return;

    if (!memo.wordTimestamps || memo.wordTimestamps.length === 0) {
      alert('No timestamp data available. SRT export requires HD mode recording with word-level timestamps.');
      return;
    }

    const srtContent = generateSRT(memo.wordTimestamps);
    if (!srtContent) {
      alert('Failed to generate SRT content.');
      return;
    }

    const element = document.createElement("a");
    const file = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = `${editableTitle || formatDate(memo.createdAt)}.srt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    setShowExportMenu(false);
  };

  // 从编辑器中提取所有下划线文本
  const extractUnderlinedText = (): string[] => {
    const editor = editorRef.current?.editor;
    if (!editor) return [];

    const underlinedTexts: string[] = [];
    const json = editor.getJSON();

    // 递归遍历文档结构
    const traverse = (node: any) => {
      if (node.type === 'text' && node.marks) {
        const hasUnderline = node.marks.some((mark: any) => mark.type === 'underline');
        if (hasUnderline && node.text) {
          underlinedTexts.push(node.text.trim());
        }
      }
      if (node.content) {
        node.content.forEach(traverse);
      }
    };

    traverse(json);
    return underlinedTexts.filter(t => t.length > 0);
  };

  // 发送邮件给创作者 (EmailJS + mailto fallback)
  const sendToCreator = async () => {
    if (!memo) return;

    // 从编辑器中提取下划线文本
    const underlinedTexts = extractUnderlinedText();
    const highlights = underlinedTexts.length > 0 ? underlinedTexts.join(' · ') : '(none)';
    const dateStr = new Date(memo.createdAt).toLocaleString();

    setSendStatus('sending');
    setShowJoinMenu(false);

    try {
      // 尝试用 EmailJS 发送
      await emailjs.send(
        'service_dianerecorder',
        'template_Ephemera',
        {
          date: dateStr,
          highlights: highlights,
        },
        'PNhUQVNGCo0nuEF1k'
      );

      setSendStatus('sent');
      // 3秒后重置状态
      setTimeout(() => setSendStatus('idle'), 3000);
    } catch (error) {
      console.error('EmailJS failed, falling back to mailto:', error);
      setSendStatus('error');

      // Fallback 到 mailto
      const subject = encodeURIComponent(`[Ephemera] ${dateStr}`);
      const body = encodeURIComponent(
`[Ephemera] ${dateStr}

───
${highlights}
───

Sent from Diane`
      );
      window.open(`mailto:${creatorEmail}?subject=${subject}&body=${body}`, '_blank');

      // 3秒后重置状态
      setTimeout(() => setSendStatus('idle'), 3000);
    }
  };

  if (!memo) return null;

  const content = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 浮动窗口 - 无背景遮罩，允许多窗口同时打开 */}
          <motion.div
            ref={windowRef}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
            transition={{ duration: 0.3 }}
            className="fixed z-[200] flex flex-row backdrop-blur-2xl rounded-2xl shadow-2xl overflow-hidden border border-white/60"
            style={{
              left: position.x - (showAISidebar ? (AI_SIDEBAR_WIDTH + (selectedAIFeatures.includes('custom') ? CUSTOM_PANEL_WIDTH : 0)) / 2 : 0),
              top: position.y,
              width: isMinimized ? 300 : (size.width + (showAISidebar ? AI_SIDEBAR_WIDTH : 0) + (showAISidebar && selectedAIFeatures.includes('custom') ? CUSTOM_PANEL_WIDTH : 0)),
              height: isMinimized ? 48 : size.height,
              backgroundColor: 'rgba(255, 255, 255, 0)',
              transition: 'left 0.3s ease, width 0.3s ease',
            }}
          >
            {/* 主内容区 */}
            <div className="flex flex-col flex-1 min-w-0">
            {/* 暂时去掉自定义selection样式，测试原生选择是否正常 */}

            {/* 标题栏 - 可拖拽 */}
            <div
              className="flex items-center justify-between px-6 py-4 bg-transparent border-b border-white/20 cursor-move select-none shrink-0"
              onMouseDown={handleDragStart}
            >
              <div className="flex flex-col">
                {/* 可编辑标题 */}
                <span
                  ref={titleRef}
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => {
                    const newTitle = e.currentTarget.textContent || generateDefaultTitle(memo.transcription);
                    setEditableTitle(newTitle);
                    if (onTitleChange && memo.id !== 'twin-peaks-pilot') {
                      onTitleChange(memo.id, newTitle);
                    }
                  }}
                  onKeyDown={(e) => {
                    // Enter 键确认编辑
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      (e.target as HTMLElement).blur();
                    }
                  }}
                  className="text-white text-lg outline-none cursor-text hover:bg-white/10 focus:bg-white/10 rounded px-1 -mx-1 transition-colors"
                  style={{ fontFamily: titleFont }}
                >
                  {editableTitle}
                </span>
                {/* 日期时间 */}
                <span className="text-[10px] text-white/50 tracking-wider mt-0.5">
                  {formatDate(memo.createdAt)} · {formatTime(memo.createdAt)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); toggleMinimize(); }}
                  className="p-1 text-white/40 hover:text-white transition-colors"
                >
                  <Minus size={14} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleMaximize(); }}
                  className="p-1 text-white/40 hover:text-white transition-colors"
                >
                  {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleClose(); }}
                  className="p-1 text-white/40 hover:text-red-400 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* 内容区域 - 可最小化隐藏 */}
            {!isMinimized && (
              <>
                {/* Tags + 播放控制 */}
                <div className="px-6 py-3 border-b border-white/20 flex items-center justify-between shrink-0">
                  {/* 左侧：标签 */}
                  <div className="flex flex-wrap gap-2">
                    {memo.tags.map((tag: string) => (
                      <span key={tag} className="px-3 py-1 bg-white/10 text-white/80 text-xs uppercase font-bold tracking-wider border border-white/20 rounded-full">
                        #{tag}
                      </span>
                    ))}
                  </div>
                  {/* 右侧：播放控制 */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={playInModal}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${isPlayingInModal ? 'text-white bg-white/20' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
                      title={isPlayingInModal ? 'Pause' : 'Play'}
                    >
                      {isPlayingInModal ? <Pause size={14} /> : <Play size={14} />}
                      <span>{isPlayingInModal ? 'Pause' : 'Play'}</span>
                    </button>
                    <button
                      onClick={stopModalPlayback}
                      disabled={!isPlayingInModal && playbackProgress === 0}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
                        isPlayingInModal || playbackProgress > 0 ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-white/30'
                      }`}
                      title="Stop"
                    >
                      <Square size={12} fill="currentColor" />
                      <span>Stop</span>
                    </button>
                    <button
                      onClick={() => setFlowEnabled(!flowEnabled)}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
                        flowEnabled ? 'text-white' : 'text-white/50 hover:text-white/70 hover:bg-white/10'
                      }`}
                      style={flowEnabled ? { textShadow: '0 0 8px rgba(255,255,255,0.8), 0 0 16px rgba(255,255,255,0.5)' } : {}}
                      title="Toggle text flow effect during playback"
                    >
                      Flow
                    </button>
                  </div>
                </div>

                {/* 工具栏 - 格式化按钮 */}
                {!isPlayingInModal && editorRef.current?.editor && (
                <div className="px-6 py-2 border-b border-white/20 flex flex-wrap items-center gap-1 shrink-0">
                    <button
                      onClick={() => editorRef.current?.editor?.chain().focus().toggleBold().run()}
                      className={`p-2 rounded hover:bg-white/20 transition-colors ${editorRef.current?.editor?.isActive('bold') ? 'text-white bg-white/20' : 'text-white/70 hover:text-white'}`}
                      title="Bold"
                    >
                      <Bold size={16} />
                    </button>
                    <button
                      onClick={() => editorRef.current?.editor?.chain().focus().toggleItalic().run()}
                      className={`p-2 rounded hover:bg-white/20 transition-colors ${editorRef.current?.editor?.isActive('italic') ? 'text-white bg-white/20' : 'text-white/70 hover:text-white'}`}
                      title="Italic"
                    >
                      <Italic size={16} />
                    </button>
                    <button
                      onClick={() => editorRef.current?.editor?.chain().focus().toggleUnderline().run()}
                      className={`p-2 rounded hover:bg-white/20 transition-colors ${editorRef.current?.editor?.isActive('underline') ? 'text-white bg-white/20' : 'text-white/70 hover:text-white'}`}
                      title="Underline"
                    >
                      <Underline size={16} />
                    </button>

                    <div className="w-px h-5 bg-white/20 mx-1" />

                    <button
                      onClick={() => editorRef.current?.editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                      className={`p-2 rounded hover:bg-white/20 transition-colors ${editorRef.current?.editor?.isActive('heading', { level: 1 }) ? 'text-white bg-white/20' : 'text-white/70 hover:text-white'}`}
                      title="Heading 1"
                    >
                      <Heading1 size={16} />
                    </button>
                    <button
                      onClick={() => editorRef.current?.editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                      className={`p-2 rounded hover:bg-white/20 transition-colors ${editorRef.current?.editor?.isActive('heading', { level: 2 }) ? 'text-white bg-white/20' : 'text-white/70 hover:text-white'}`}
                      title="Heading 2"
                    >
                      <Heading2 size={16} />
                    </button>

                    <div className="w-px h-5 bg-white/20 mx-1" />

                    <button
                      onClick={() => editorRef.current?.editor?.chain().focus().toggleBulletList().run()}
                      className={`p-2 rounded hover:bg-white/20 transition-colors ${editorRef.current?.editor?.isActive('bulletList') ? 'text-white bg-white/20' : 'text-white/70 hover:text-white'}`}
                      title="Bullet List"
                    >
                      <List size={16} />
                    </button>
                    <button
                      onClick={() => editorRef.current?.editor?.chain().focus().toggleOrderedList().run()}
                      className={`p-2 rounded hover:bg-white/20 transition-colors ${editorRef.current?.editor?.isActive('orderedList') ? 'text-white bg-white/20' : 'text-white/70 hover:text-white'}`}
                      title="Numbered List"
                    >
                      <ListOrdered size={16} />
                    </button>
                    <button
                      onClick={() => editorRef.current?.editor?.chain().focus().toggleBlockquote().run()}
                      className={`p-2 rounded hover:bg-white/20 transition-colors ${editorRef.current?.editor?.isActive('blockquote') ? 'text-white bg-white/20' : 'text-white/70 hover:text-white'}`}
                      title="Quote"
                    >
                      <Quote size={16} />
                    </button>

                    <div className="w-px h-5 bg-white/20 mx-1" />

                    <button
                      onClick={() => editorRef.current?.editor?.chain().focus().undo().run()}
                      className="p-2 rounded hover:bg-white/20 text-white/70 hover:text-white transition-colors"
                      title="Undo"
                    >
                      <Undo size={16} />
                    </button>
                    <button
                      onClick={() => editorRef.current?.editor?.chain().focus().redo().run()}
                      className="p-2 rounded hover:bg-white/20 text-white/70 hover:text-white transition-colors"
                      title="Redo"
                    >
                      <Redo size={16} />
                    </button>

                    <div className="w-px h-5 bg-white/20 mx-1" />

                    {/* Distill 按钮 - 只保留发光标记的文字 */}
                    <button
                      onClick={() => {
                        const editor = editorRef.current?.editor;
                        if (!editor) return;

                        // 提取所有发光标记的文字 (Cmd+D 标记的)
                        const glowingTexts: string[] = [];
                        const json = editor.getJSON();

                        // 递归遍历文档，提取所有发光文字
                        const extractGlowing = (node: any): void => {
                          if (node.type === 'text' && node.marks) {
                            const hasHighlight = node.marks.some((mark: any) => mark.type === 'highlight');
                            if (hasHighlight && node.text) {
                              glowingTexts.push(node.text);
                            }
                          }
                          if (node.content) {
                            node.content.forEach(extractGlowing);
                          }
                        };
                        extractGlowing(json);

                        if (glowingTexts.length === 0) {
                          alert('No glowing text found. Use Cmd+D to mark text first.');
                          return;
                        }

                        // 用发光内容替换文档
                        const combinedText = glowingTexts.join('\n\n');
                        editor.commands.setContent(`<p>${combinedText.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`);
                      }}
                      className="px-3 py-1.5 rounded text-sm font-medium text-white/70 hover:text-white hover:bg-white/20 transition-colors"
                      title="Keep only glowing text (Cmd+D marked)"
                    >
                      Distill
                    </button>

                    {/* Clear 按钮 - 清除所有发光标记 */}
                    <button
                      onClick={() => {
                        const editor = editorRef.current?.editor;
                        if (!editor) return;
                        // 选中全部并移除发光标记
                        editor.chain().focus().selectAll().unsetHighlight().run();
                      }}
                      className="px-2 py-1.5 rounded text-xs font-medium text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors"
                      title="Clear all glow marks"
                    >
                      Clear
                    </button>

                    <div className="w-px h-5 bg-white/20 mx-1" />

                    {/* AI 按钮 - 切换侧边栏 */}
                    <button
                      onClick={() => setShowAISidebar(!showAISidebar)}
                      className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                        showAISidebar
                          ? 'text-[#b69fbb] bg-white/20'
                          : 'text-white/70 hover:text-white hover:bg-white/20'
                      }`}
                      title="AI Text Processing"
                    >
                      AI
                    </button>
                </div>
                )}

                {/* 播放进度条 - 可点击拖动 */}
                {memo && (memo.audioUrls?.length || memo.audioUrl) && (
                  <div className="px-6 py-2 shrink-0">
                    <div
                      ref={progressBarRef}
                      className="relative h-2 bg-white/20 rounded-full overflow-visible cursor-pointer group"
                      onMouseDown={handleProgressBarMouseDown}
                    >
                      {/* 进度填充 */}
                      <motion.div
                        className="absolute left-0 top-0 h-full bg-white/60 rounded-full"
                        style={{ width: `${playbackProgress * 100}%` }}
                        initial={{ width: 0 }}
                        animate={{ width: `${playbackProgress * 100}%` }}
                        transition={{ duration: 0.1, ease: 'linear' }}
                      />
                      {/* 播放位置指示器（小圆点） */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{
                          left: `calc(${playbackProgress * 100}% - 6px)`,
                        }}
                      />
                      {/* 发光效果 */}
                      {isPlayingInModal && (
                        <div
                          className="absolute top-0 h-full bg-gradient-to-r from-transparent via-white/50 to-transparent"
                          style={{
                            left: `${Math.max(0, playbackProgress * 100 - 5)}%`,
                            width: '10%',
                            filter: 'blur(2px)',
                          }}
                        />
                      )}
                    </div>
                    {/* 时间显示 */}
                    <div className="flex justify-between mt-1 text-[10px] text-white/40">
                      <span>{formatDuration(currentPlaybackTime)}</span>
                      <span>{formatDuration(memo.duration)}</span>
                    </div>
                  </div>
                )}

                {/* 文本内容 */}
                <div className="flex-1 overflow-y-auto p-6 relative">
                  {/* 项目介绍 - 暗房显影效果 */}
                  <AnimatePresence>
                    {showProjectInfo && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1.5, ease: 'easeInOut' }}
                        className="absolute inset-0 p-6 flex flex-col justify-center items-center text-center z-10"
                        onClick={() => setShowProjectInfo(false)}
                      >
                        {/* 标题 - 暗房显影 */}
                        <motion.h3
                          initial={{ opacity: 0, filter: 'blur(12px)', scale: 0.95 }}
                          animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
                          exit={{ opacity: 0, filter: 'blur(8px)' }}
                          transition={{ duration: 2, delay: 0.3, ease: 'easeOut' }}
                          className="text-xl text-white/90 mb-6 tracking-wide"
                          style={{ fontFamily: titleFont }}
                        >
                          Invitation
                        </motion.h3>

                        {/* 介绍文字 - 暗房显影 */}
                        <motion.div
                          initial={{ opacity: 0, filter: 'blur(12px)', scale: 0.95 }}
                          animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
                          exit={{ opacity: 0, filter: 'blur(8px)' }}
                          transition={{ duration: 2, delay: 0.8, ease: 'easeOut' }}
                          className="text-white/70 text-sm leading-relaxed mb-8 max-w-md space-y-4"
                          style={{ fontFamily: contentFont }}
                        >
                          <p>You're invited to talk to Diane.</p>
                          <p>Come as you are. Speak into the dark — ramble, whisper, say the thing you almost said today. Watch your words appear and disappear like stars.</p>
                          <p>Touch the ones that feel like yours.</p>
                          <p className="text-white/50 text-xs italic">No one generates this kind of voice. No one thinks it's worth keeping. That's exactly why it is.</p>
                        </motion.div>

                        {/* 链接 - 暗房显影 */}
                        <motion.div
                          initial={{ opacity: 0, filter: 'blur(8px)' }}
                          animate={{ opacity: 1, filter: 'blur(0px)' }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 1.5, delay: 1.5, ease: 'easeOut' }}
                          className="flex flex-col items-center gap-4"
                        >
                          {onOpenAbout && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowProjectInfo(false);
                                onOpenAbout();
                              }}
                              className="text-white/50 hover:text-white text-xs tracking-widest uppercase transition-colors"
                              style={{ fontFamily: contentFont }}
                            >
                              Learn more →
                            </button>
                          )}
                          <span
                            className="text-white/30 text-xs"
                            style={{ fontFamily: contentFont }}
                          >
                            click anywhere to return
                          </span>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* 原始文本内容 - 当显示项目介绍时淡出消散 */}
                  <motion.div
                    animate={{
                      opacity: showProjectInfo ? 0 : 1,
                      filter: showProjectInfo ? 'blur(12px)' : 'blur(0px)',
                      scale: showProjectInfo ? 0.98 : 1,
                    }}
                    transition={{ duration: 1.5, ease: 'easeInOut' }}
                  >
                    {isPlayingInModal && flowEnabled ? (
                      <KaraokeText
                        text={memo.transcription}
                        currentTime={currentPlaybackTime}
                        fontFamily={contentFont}
                        wordTimestamps={memo.wordTimestamps}
                        audioDuration={memo.duration}
                        audioOffset={memo.audioOffset}
                      />
                    ) : (
                      <MarkdownEditor
                        ref={editorRef}
                        content={memo.transcription}
                        fontFamily={contentFont}
                        highlightedWords={memo.highlightedWords}
                        onChange={() => setHasUnsavedChanges(true)}
                      />
                    )}
                  </motion.div>
                </div>

                {/* 底部控制栏 */}
                <div className="px-6 pt-4 pb-4 bg-transparent flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-3">
                    {/* Save 按钮 */}
                    <button
                      onClick={() => {
                        if (!memo || !onSave || !editorRef.current?.editor) return;
                        // 从编辑器获取纯文本内容
                        const editor = editorRef.current.editor;
                        const text = editor.getText();
                        onSave(memo.id, text);
                        setHasUnsavedChanges(false);
                      }}
                      disabled={!hasUnsavedChanges}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-colors ${
                        hasUnsavedChanges
                          ? 'bg-white/10 text-white border-white/30 hover:bg-white/20'
                          : 'bg-white/5 text-white/30 border-white/10 cursor-default'
                      }`}
                      style={{ fontFamily: contentFont }}
                      title={hasUnsavedChanges ? 'Save changes' : 'No changes to save'}
                    >
                      <Save size={14} />
                      <span className="text-sm">Save</span>
                    </button>

                    {/* Resume 按钮 - 追加录音 */}
                    {onResume && memo.id !== 'twin-peaks-pilot' && (
                      <button
                        onClick={() => onResume(memo)}
                        className="flex items-center gap-2 px-4 py-2 rounded-full border bg-white/5 hover:bg-white/15 text-white/60 hover:text-white border-white/10 hover:border-white/20 transition-colors"
                        style={{ fontFamily: contentFont }}
                        title="Continue recording to this tape"
                      >
                        <Mic size={14} />
                        <span className="text-sm">Resume</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Cloud Sync 按钮 - 只对登录用户显示 */}
                    {isLoggedIn && memo.id !== 'twin-peaks-pilot' && (
                      <button
                        onClick={async () => {
                          if (!onSyncToCloud || isSyncing || isSynced) return;
                          setIsSyncing(true);
                          try {
                            await onSyncToCloud(memo);
                          } catch (error) {
                            console.error('Failed to sync to cloud:', error);
                          } finally {
                            setIsSyncing(false);
                          }
                        }}
                        disabled={isSyncing || isSynced}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-colors ${
                          isSynced
                            ? 'bg-white/10 text-white/60 border-white/20'
                            : isSyncing
                            ? 'bg-white/10 text-white/60 border-white/20'
                            : 'bg-white/5 hover:bg-white/15 text-white/60 hover:text-white border-white/10 hover:border-white/20'
                        }`}
                        style={{ fontFamily: contentFont }}
                        title={isSynced ? 'Synced to Cloud' : 'Sync to Cloud'}
                      >
                        {isSyncing ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : isSynced ? (
                          <Cloud size={14} />
                        ) : (
                          <CloudOff size={14} />
                        )}
                        <span className="text-sm">
                          {isSyncing ? 'Syncing...' : isSynced ? 'Synced' : 'Sync'}
                        </span>
                      </button>
                    )}

                    {/* Join Project 按钮 */}
                    <div className="relative">
                      <button
                        onClick={() => { setShowJoinMenu(!showJoinMenu); setShowExportMenu(false); }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-colors ${
                          sendStatus === 'sent'
                            ? 'bg-green-500/20 text-green-400 border-green-500/30'
                            : sendStatus === 'sending'
                            ? 'bg-white/10 text-white/80 border-white/20'
                            : 'bg-white/5 hover:bg-white/15 text-white/60 hover:text-white border-white/10 hover:border-white/20'
                        }`}
                        style={{ fontFamily: contentFont }}
                        disabled={sendStatus === 'sending'}
                      >
                        <Sparkles size={14} />
                        <span className="text-sm">
                          {sendStatus === 'sending' ? 'Sending...' : sendStatus === 'sent' ? 'Sent ✓' : 'Join'}
                        </span>
                      </button>
                      {showJoinMenu && (
                        <div className="absolute bottom-full right-0 mb-2 backdrop-blur-3xl rounded-2xl overflow-hidden min-w-[160px] shadow-2xl">
                          <button
                            onClick={() => { setShowJoinMenu(false); setShowProjectInfo(true); }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-white hover:text-white/70 transition-colors text-sm"
                          >
                            <Info size={16} />
                            What is this?
                          </button>
                          <div className="mx-3 border-t border-white/20" />
                          <button
                            onClick={sendToCreator}
                            className="w-full flex items-center gap-3 px-4 py-3 text-white hover:text-white/70 transition-colors text-sm"
                          >
                            <Mail size={16} />
                            Send your Ephemera
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Export 按钮 */}
                    <div className="relative">
                      <button
                        onClick={() => { setShowExportMenu(!showExportMenu); setShowJoinMenu(false); }}
                        className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/15 text-white/60 hover:text-white border border-white/10 hover:border-white/20 transition-colors"
                        style={{ fontFamily: contentFont }}
                      >
                        <Download size={14} />
                        <span className="text-sm">Export</span>
                      </button>
                      {showExportMenu && (
                        <div className="absolute bottom-full right-0 mb-2 backdrop-blur-3xl rounded-2xl overflow-hidden min-w-[140px] shadow-2xl">
                          <button
                            onClick={exportAsMarkdown}
                            className="w-full flex items-center gap-3 px-4 py-3 text-white hover:text-white/70 transition-colors text-sm"
                          >
                            <FileCode size={16} />
                            Markdown
                          </button>
                          <div className="mx-3 border-t border-white/20" />
                          <button
                            onClick={exportAsPDF}
                            className="w-full flex items-center gap-3 px-4 py-3 text-white hover:text-white/70 transition-colors text-sm"
                          >
                            <FileText size={16} />
                            PDF
                          </button>
                          <div className="mx-3 border-t border-white/20" />
                          <button
                            onClick={exportAsWord}
                            className="w-full flex items-center gap-3 px-4 py-3 text-white hover:text-white/70 transition-colors text-sm"
                          >
                            <File size={16} />
                            Word
                          </button>
                          <div className="mx-3 border-t border-white/20" />
                          <button
                            onClick={exportAsSRT}
                            className="w-full flex items-center gap-3 px-4 py-3 text-white hover:text-white/70 transition-colors text-sm"
                          >
                            <Subtitles size={16} />
                            SRT Subtitles
                          </button>
                          <div className="mx-3 border-t border-white/20" />
                          <button
                            onClick={downloadAudio}
                            className="w-full flex items-center gap-3 px-4 py-3 text-white hover:text-white/70 transition-colors text-sm"
                          >
                            <Music size={16} />
                            Audio
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
            </div>
            {/* 主内容区结束 */}

            {/* AI 侧边栏 */}
            <AnimatePresence>
              {showAISidebar && !isMinimized && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: AI_SIDEBAR_WIDTH, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="flex flex-col border-l border-white/20 overflow-hidden"
                  style={{ minWidth: AI_SIDEBAR_WIDTH }}
                >
                  {/* 侧边栏标题 */}
                  <div className="px-4 py-3 border-b border-white/20 flex items-center justify-between shrink-0">
                    <span className="text-white/80 text-sm font-medium">AI Processing</span>
                    <button
                      onClick={() => { setShowAISidebar(false); setShowCustomPanel(false); }}
                      className="p-1 text-white/40 hover:text-white transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* 选项列表 */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-1">
                    {/* Cleanup */}
                    <button
                      onClick={() => toggleAIFeature('cleanup')}
                      className={`w-full text-left px-3 py-2.5 rounded transition-colors text-sm ${
                        selectedAIFeatures.includes('cleanup')
                          ? 'text-[#b69fbb]'
                          : 'text-white/80 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {selectedAIFeatures.includes('cleanup') && <span className="mr-2">✦</span>}
                      Cleanup
                    </button>

                    {/* Summary */}
                    <button
                      onClick={() => toggleAIFeature('summary')}
                      className={`w-full text-left px-3 py-2.5 rounded transition-colors text-sm ${
                        selectedAIFeatures.includes('summary')
                          ? 'text-[#b69fbb]'
                          : 'text-white/80 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {selectedAIFeatures.includes('summary') && <span className="mr-2">✦</span>}
                      Summary
                    </button>

                    {/* Underline to Headings */}
                    <button
                      onClick={() => toggleAIFeature('underline-to-headings')}
                      className={`w-full text-left px-3 py-2.5 rounded transition-colors text-sm ${
                        selectedAIFeatures.includes('underline-to-headings')
                          ? 'text-[#b69fbb]'
                          : 'text-white/80 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {selectedAIFeatures.includes('underline-to-headings') && <span className="mr-2">✦</span>}
                      Underline → Headings
                    </button>

                    <div className="border-t border-white/10 my-3" />

                    {/* Custom Cleanup - 选中时打开第三面板 */}
                    <button
                      onClick={() => toggleAIFeature('custom')}
                      className={`w-full text-left px-3 py-2.5 rounded transition-colors text-sm ${
                        selectedAIFeatures.includes('custom')
                          ? 'text-[#b69fbb]'
                          : 'text-white/80 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {selectedAIFeatures.includes('custom') && <span className="mr-2">✦</span>}
                      Custom Cleanup
                      <span className="ml-1 text-white/40">→</span>
                    </button>

                    <div className="border-t border-white/10 my-3" />

                    {/* Re-transcribe */}
                    <button
                      onClick={() => toggleAIFeature('retranscribe')}
                      className={`w-full text-left px-3 py-2.5 rounded transition-colors text-sm ${
                        selectedAIFeatures.includes('retranscribe')
                          ? 'text-[#b69fbb]'
                          : 'text-white/80 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {selectedAIFeatures.includes('retranscribe') && <span className="mr-2">✦</span>}
                      Re-transcribe
                    </button>
                  </div>

                  {/* Apply 按钮 */}
                  <div className="p-3 border-t border-white/20 shrink-0">
                    <button
                      onClick={handleApplyAI}
                      disabled={selectedAIFeatures.length === 0 || isProcessingAI}
                      className={`w-full py-2.5 rounded-full text-sm transition-colors border ${
                        selectedAIFeatures.length === 0
                          ? 'bg-white/5 text-white/30 border-white/10 cursor-not-allowed'
                          : isProcessingAI
                          ? 'bg-white/10 text-white/60 border-white/20 cursor-wait'
                          : 'bg-white/5 hover:bg-white/15 text-white/60 hover:text-white border-white/10 hover:border-white/20'
                      }`}
                    >
                      {isProcessingAI ? 'Processing...' : 'Apply'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Custom Cleanup 第三面板 - 当 custom 被选中时显示 */}
            <AnimatePresence>
              {selectedAIFeatures.includes('custom') && showAISidebar && !isMinimized && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: CUSTOM_PANEL_WIDTH, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="flex flex-col border-l border-white/20 overflow-hidden"
                  style={{ minWidth: CUSTOM_PANEL_WIDTH }}
                >
                  {/* 面板标题 */}
                  <div className="px-4 py-3 border-b border-white/20 flex items-center justify-between shrink-0">
                    <span className="text-white/80 text-sm font-medium">Custom Cleanup</span>
                    <button
                      onClick={() => toggleAIFeature('custom')}
                      className="p-1 text-white/40 hover:text-white transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* 内容区 */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* 文本输入 */}
                    <div>
                      <label className="block text-white/60 text-xs mb-2 uppercase tracking-wider">Prompt</label>
                      <textarea
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        placeholder="Enter your custom prompt..."
                        className="w-full px-3 py-3 bg-white/5 border border-white/20 rounded-lg text-white/90 text-sm placeholder-white/40 resize-none focus:outline-none focus:border-[#b69fbb]/50 transition-colors"
                        rows={6}
                      />
                    </div>

                    {/* 或者分隔 */}
                    <div className="flex items-center gap-3 text-white/40 text-xs">
                      <div className="flex-1 h-px bg-white/20" />
                      <span>or</span>
                      <div className="flex-1 h-px bg-white/20" />
                    </div>

                    {/* 文件上传 */}
                    <div>
                      <label className="block text-white/60 text-xs mb-2 uppercase tracking-wider">Template File</label>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".md,.txt,.json"
                        onChange={handleFileUpload}
                        className="hidden"
                      />

                      {uploadedFile ? (
                        <div className="flex items-center gap-2 px-3 py-3 bg-[#b69fbb]/10 border border-[#b69fbb]/30 rounded-lg text-sm">
                          <FileText size={16} className="text-[#b69fbb] shrink-0" />
                          <span className="text-[#b69fbb] truncate flex-1">{uploadedFile.name}</span>
                          <button
                            onClick={clearUploadedFile}
                            className="p-1 text-white/40 hover:text-white transition-colors shrink-0"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full flex flex-col items-center justify-center gap-2 px-4 py-6 border border-dashed border-white/30 rounded-lg text-white/60 hover:text-white hover:border-white/50 hover:bg-white/5 transition-colors text-sm"
                        >
                          <Upload size={20} />
                          <span>Upload template</span>
                          <span className="text-white/40 text-xs">.md, .txt, .json</span>
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 缩放把手 */}
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
        </>
      )}
    </AnimatePresence>
  );

  // 使用 Portal 渲染到 body
  if (typeof document !== 'undefined') {
    return createPortal(content, document.body);
  }
  return null;
};

export default FloatingTranscript;
