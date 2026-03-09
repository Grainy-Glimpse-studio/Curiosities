import React, { useState, useRef } from 'react';
import { Memo } from '../types';
import { Play, Pause, Square, Trash2, Download, X, FileText, File, FileCode, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Type, Palette, Sparkles } from 'lucide-react';
import { motion, AnimatePresence, Variants } from 'framer-motion';

interface CassetteTapeProps {
  memo: Memo;
  onPlay: (memo: Memo) => void;
  onStop?: () => void; // 停止全局播放
  onDelete: (id: string) => void;
  onTogglePermanent: (id: string) => void;
  titleFont: string;
  contentFont: string;
  shouldAllowClick?: () => boolean;
  onOpenTranscript?: (memo: Memo) => void; // 打开独立浮动窗口
  isPlaying?: boolean; // 当前是否正在播放这个 memo
}

// Animation variants for coordinated parent-child animations
const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0, transition: { duration: 0.3 } }
};

const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.9, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.3, when: "beforeChildren", staggerChildren: 0.05 }
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    filter: 'blur(10px)',
    transition: { duration: 0.3, when: "afterChildren", staggerChildren: 0.02 }
  }
};

const textVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
  exit: {
    opacity: 0,
    filter: 'blur(8px)',
    y: -10,
    transition: { duration: 0.25 }
  }
};

// 高亮文本中的指定词 (返回 HTML 字符串，用于 contentEditable)
const highlightTextToHtml = (text: string, highlightedWords: string[] | undefined): string => {
  if (!highlightedWords || highlightedWords.length === 0) {
    return text;
  }

  const pattern = highlightedWords
    .map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const regex = new RegExp(`(${pattern})`, 'gi');

  return text.replace(regex, '<u style="text-decoration-color: rgba(255,255,255,0.5)">$1</u>');
};

// 卡拉OK式高亮文本组件
interface KaraokeTextProps {
  text: string;
  progress: number; // 0-1
  fontFamily: string;
}

const KaraokeText: React.FC<KaraokeTextProps> = ({ text, progress, fontFamily }) => {
  // 计算高亮到哪个字符
  const totalChars = text.length;
  const highlightedChars = Math.floor(totalChars * progress);

  // 分割文本为已播放和未播放部分
  const playedPart = text.slice(0, highlightedChars);
  const unplayedPart = text.slice(highlightedChars);

  return (
    <div
      className="text-white text-base leading-relaxed whitespace-pre-wrap"
      style={{ fontFamily }}
    >
      {/* 已播放部分 - 带发光效果 */}
      <span
        style={{
          color: '#fff',
          textShadow: '0 0 8px rgba(255,255,255,0.8), 0 0 16px rgba(255,255,255,0.5), 0 0 24px rgba(255,255,255,0.3)',
        }}
      >
        {playedPart}
      </span>
      {/* 未播放部分 - 普通白色 */}
      <span style={{ color: 'rgba(255,255,255,0.6)' }}>
        {unplayedPart}
      </span>
    </div>
  );
};

const CassetteTape: React.FC<CassetteTapeProps> = ({ memo, onPlay, onStop, onDelete, onTogglePermanent, titleFont, contentFont, shouldAllowClick, onOpenTranscript, isPlaying }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showFontSizeMenu, setShowFontSizeMenu] = useState(false);
  const [showColorMenu, setShowColorMenu] = useState(false);

  // AI Processing Panel
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [selectedAIFeatures, setSelectedAIFeatures] = useState<Set<string>>(new Set());
  const [customPrompt, setCustomPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const toggleAIFeature = (feature: string) => {
    setSelectedAIFeatures(prev => {
      const newSet = new Set(prev);
      if (newSet.has(feature)) {
        newSet.delete(feature);
      } else {
        newSet.add(feature);
      }
      return newSet;
    });
  };

  const handleAIApply = async () => {
    if (selectedAIFeatures.size === 0) return;
    setIsProcessing(true);
    // TODO: Implement AI processing
    console.log('AI Features:', Array.from(selectedAIFeatures));
    console.log('Custom Prompt:', customPrompt);
    setTimeout(() => setIsProcessing(false), 1000);
  };
  const [customTitle, setCustomTitle] = useState('Transcript');
  const [isPlayingInModal, setIsPlayingInModal] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0); // 0-1 播放进度
  const editorRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  const hoverSoundRef = useRef<HTMLAudioElement | null>(null);
  const modalAudioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize click sound (NOT hover sound)
  React.useEffect(() => {
    hoverSoundRef.current = new Audio('/sound/twin-peaks-clicksound.mp3');
    hoverSoundRef.current.volume = 0.3;
  }, []);

  const playClickSound = () => {
    if (hoverSoundRef.current) {
      hoverSoundRef.current.currentTime = 0;
      hoverSoundRef.current.play().catch(() => {});
    }
  };

  // Modal 内播放音频（简化版，只播放第一段）
  const playInModal = () => {
    const urls = memo.audioUrls || (memo.audioUrl ? [memo.audioUrl] : []);
    if (urls.length === 0) return;

    if (!modalAudioRef.current) {
      modalAudioRef.current = new Audio(urls[0]);
      modalAudioRef.current.addEventListener('timeupdate', () => {
        if (modalAudioRef.current && modalAudioRef.current.duration) {
          setPlaybackProgress(modalAudioRef.current.currentTime / modalAudioRef.current.duration);
        }
      });
      modalAudioRef.current.addEventListener('ended', () => {
        setIsPlayingInModal(false);
        setPlaybackProgress(0);
      });
    }

    if (isPlayingInModal) {
      modalAudioRef.current.pause();
      setIsPlayingInModal(false);
    } else {
      modalAudioRef.current.play().catch(() => {});
      setIsPlayingInModal(true);
    }
  };

  // 停止 modal 内的播放
  const stopModalPlayback = () => {
    if (modalAudioRef.current) {
      modalAudioRef.current.pause();
      modalAudioRef.current.currentTime = 0;
      setIsPlayingInModal(false);
      setPlaybackProgress(0);
    }
  };

  // 格式化命令
  const execFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const colors = ['#ffffff', '#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#9b59b6', '#ff8c42'];
  const fontSizes = [
    { label: 'Small', value: '2' },
    { label: 'Normal', value: '3' },
    { label: 'Large', value: '4' },
    { label: 'X-Large', value: '5' },
  ];

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute:'2-digit', hour12: false });
  };

  const exportAsMarkdown = () => {
    const content = `# Transcript\n\n**Date:** ${new Date(memo.createdAt).toLocaleString()}\n\n**Tags:** ${memo.tags.map((t: string) => `#${t}`).join(' ')}\n\n---\n\n${memo.transcription}`;
    const element = document.createElement("a");
    const file = new Blob([content], {type: 'text/markdown'});
    element.href = URL.createObjectURL(file);
    element.download = `transcript-${formatDate(memo.createdAt)}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const exportAsPDF = () => {
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
  };

  const exportAsWord = () => {
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
  };

  const handleClose = () => {
    stopModalPlayback(); // 关闭时停止播放
    setIsModalOpen(false);
    setShowExportMenu(false);
    setShowFontSizeMenu(false);
    setShowColorMenu(false);
  };

  const handleCardClick = () => {
    if (shouldAllowClick && !shouldAllowClick()) {
      return;
    }
    // Play sound on click
    playClickSound();
    // 如果提供了 onOpenTranscript，使用独立浮动窗口；否则使用内置 modal
    if (onOpenTranscript) {
      onOpenTranscript(memo);
    } else {
      setIsModalOpen(true);
    }
  };

  // 上传工具卡带 - 特殊样式
  if (memo.isUploadTape) {
    return (
      <div className="relative group w-full mb-6 perspective-1000">
        {/* Tape Body - Glass 3D Effect */}
        <div
          className="bg-[#1a1a1a]/80 backdrop-blur-xl rounded-xl shadow-[12px_12px_30px_rgba(0,0,0,0.8),-6px_-6px_20px_rgba(50,50,50,0.1),0_20px_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-2px_8px_rgba(0,0,0,0.4)] border-t border-l border-white/10 border-r-[8px] border-b-[8px] border-r-black/50 border-b-black/50 p-3 transform transition-all duration-300 group-hover:-rotate-1 group-hover:scale-[1.02] group-hover:shadow-[15px_15px_35px_rgba(0,0,0,0.9),-8px_-8px_25px_rgba(60,60,60,0.15),0_25px_50px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.2)] relative overflow-hidden"
        >
          {/* Plastic Texture */}
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/black-scales.png')] opacity-20 pointer-events-none"></div>

          {/* Upload Label Area - 虚线边框 */}
          <div
            onClick={handleCardClick}
            className="relative z-10 rounded-lg p-4 border-2 border-dashed border-white/30 flex flex-col items-center justify-center aspect-[3/2] cursor-pointer overflow-hidden hover:border-white/50 hover:bg-white/5 transition-all duration-300"
          >
            {/* Upload Icon */}
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/60">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>

            {/* Title */}
            <span className="text-white/80 text-lg font-medium mb-1" style={{ fontFamily: titleFont }}>
              Convert
            </span>

            {/* Subtitle */}
            <span className="text-white/40 text-xs text-center">
              Audio/Video → Text<br />
              SRT → TTS
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Cassette Tape Card - Black Design */}
      <div className="relative group w-full mb-6 perspective-1000">
        {/* Tape Body - Glass 3D Effect (Heavy) */}
        <div
          className="bg-[#1a1a1a]/80 backdrop-blur-xl rounded-xl shadow-[12px_12px_30px_rgba(0,0,0,0.8),-6px_-6px_20px_rgba(50,50,50,0.1),0_20px_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-2px_8px_rgba(0,0,0,0.4)] border-t border-l border-white/10 border-r-[8px] border-b-[8px] border-r-black/50 border-b-black/50 p-3 transform transition-all duration-300 group-hover:-rotate-1 group-hover:scale-[1.02] group-hover:shadow-[15px_15px_35px_rgba(0,0,0,0.9),-8px_-8px_25px_rgba(60,60,60,0.15),0_25px_50px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.2)] relative overflow-hidden"
        >

          {/* Plastic Texture */}
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/black-scales.png')] opacity-20 pointer-events-none"></div>

          {/* Label Area - Clickable */}
          <div
            onClick={handleCardClick}
            className="relative z-10 rounded-lg p-4 shadow-inner border border-zinc-300/30 flex flex-col gap-2 aspect-[3/2] cursor-pointer overflow-hidden"
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
                  <span className="text-[8px] text-zinc-400 font-bold tracking-widest uppercase">Date / Time</span>
                  <span className="text-[#1a1a1a]/80 text-xl leading-none mt-1 group-hover:text-[#903e4f] transition-colors duration-500" style={{ fontFamily: titleFont }}>
                    {formatDate(memo.createdAt)} <span className="text-sm opacity-70">{formatTime(memo.createdAt)}</span>
                  </span>
               </div>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5 py-1">
              {memo.tags.map((tag: string) => (
                <span key={tag} className="px-2 py-0.5 bg-[#1a1a1a]/15 text-[#1a1a1a]/70 text-[9px] uppercase font-bold tracking-wider border border-[#1a1a1a]/20 rounded-sm italic">
                  #{tag}
                </span>
              ))}
            </div>

            {/* Transcription Preview */}
            <div className="flex-1 relative">
               <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="w-full h-px bg-black/30"></div>
                  ))}
               </div>
               <p className="italic text-zinc-800 text-sm leading-[1.6rem] line-clamp-3 relative z-10 pt-0.5" style={{ fontFamily: contentFont }}>
                 {memo.transcription || "No transcription available..."}
               </p>
            </div>

            {/* Click hint */}
            <div className="text-[8px] text-zinc-400 text-center mt-1">Click to read full transcript</div>

            {/* Tape Info */}
            <div className="flex justify-between items-center mt-2 pt-2 border-t border-black/20">
               <span className="text-[8px] text-zinc-400 font-mono tracking-widest uppercase">Side A / 60 Min</span>
               <span className="text-[8px] text-zinc-400 font-mono tracking-widest uppercase">TP-PROFESSIONAL</span>
            </div>
          </div>

          {/* Controls */}
          <div className="mt-4 flex items-center justify-between px-2 relative z-10">
            <div className="flex gap-2">
              {/* Play/Pause Button */}
              <button
                onClick={(e) => { e.stopPropagation(); onPlay(memo); }}
                className={`flex items-center gap-3 px-4 py-2 rounded-full border transition-all shadow-lg group/play ${
                  isPlaying
                    ? 'bg-[#903e4f]/20 text-white border-[#903e4f]/50'
                    : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800 hover:text-white active:scale-95'
                }`}
              >
                {isPlaying ? (
                  <Pause size={14} fill="currentColor" className="text-[#903e4f]" />
                ) : (
                  <Play size={14} fill="currentColor" className="group-hover/play:text-[#903e4f] transition-colors" />
                )}
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase">
                  {isPlaying ? 'Pause' : 'Play'}
                </span>
              </button>

              {/* Stop Button - only show when playing */}
              {isPlaying && onStop && (
                <button
                  onClick={(e) => { e.stopPropagation(); onStop(); }}
                  className="flex items-center gap-2 px-3 py-2 rounded-full bg-zinc-900 text-zinc-300 border border-zinc-800 hover:bg-zinc-800 hover:text-[#903e4f] active:scale-95 transition-all shadow-lg"
                >
                  <Square size={12} fill="currentColor" />
                  <span className="text-[10px] font-bold tracking-[0.2em] uppercase">Stop</span>
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); exportAsMarkdown(); }}
                className="p-2 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-all shadow-md"
                title="Export"
              >
                <Download size={16} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(memo.id); }}
                className="p-2 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-[#903e4f] hover:border-[#903e4f]/50 transition-all shadow-md"
                title="Delete"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {/* Decorative Tape Spools (Visible through shell) */}
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-40 h-40 bg-zinc-800/10 rounded-full blur-3xl pointer-events-none"></div>
        </div>

        {/* Tape Spine Shadow */}
        <div className="absolute top-4 -right-2 w-4 h-[85%] bg-black/40 rounded-r-xl blur-sm -z-10"></div>
      </div>

      {/* Modal / Floating Window with Framer Motion using Variants */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            key="modal-backdrop"
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={handleClose}
          >
            {/* Modal Content */}
            <motion.div
              key="modal-content"
              className="relative w-full max-w-2xl max-h-[80vh] backdrop-blur-2xl rounded-2xl shadow-2xl overflow-hidden border border-white/60"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0)' }}
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-transparent border-b border-white/20 px-6 py-4 flex justify-between items-center">
                <motion.div className="flex flex-col" variants={textVariants}>
                  <span
                    ref={titleRef}
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => setCustomTitle(e.currentTarget.textContent || 'Transcript')}
                    className="text-[10px] text-white/60 font-bold tracking-widest uppercase outline-none cursor-text hover:text-white/80 focus:text-white transition-colors"
                  >
                    {customTitle}
                  </span>
                  <span className="text-white text-lg" style={{ fontFamily: titleFont }}>
                    {formatDate(memo.createdAt)} · {formatTime(memo.createdAt)}
                  </span>
                </motion.div>
                <button
                  onClick={handleClose}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Tags */}
              <motion.div
                className="px-6 py-3 border-b border-white/20 flex flex-wrap gap-2"
                variants={textVariants}
              >
                {memo.tags.map((tag: string) => (
                  <span key={tag} className="px-3 py-1 bg-white/10 text-white/80 text-xs uppercase font-bold tracking-wider border border-white/20 rounded-full">
                    #{tag}
                  </span>
                ))}
              </motion.div>

              {/* Formatting Toolbar */}
              <motion.div
                className="px-6 py-2 border-b border-white/20 flex flex-wrap items-center gap-1"
                variants={textVariants}
              >
                {/* Bold */}
                <button
                  onClick={() => execFormat('bold')}
                  className="p-2 rounded hover:bg-white/20 text-white/70 hover:text-white transition-colors"
                  title="Bold"
                >
                  <Bold size={16} />
                </button>
                {/* Italic */}
                <button
                  onClick={() => execFormat('italic')}
                  className="p-2 rounded hover:bg-white/20 text-white/70 hover:text-white transition-colors"
                  title="Italic"
                >
                  <Italic size={16} />
                </button>
                {/* Underline */}
                <button
                  onClick={() => execFormat('underline')}
                  className="p-2 rounded hover:bg-white/20 text-white/70 hover:text-white transition-colors"
                  title="Underline"
                >
                  <Underline size={16} />
                </button>

                <div className="w-px h-5 bg-white/20 mx-1" />

                {/* Align Left */}
                <button
                  onClick={() => execFormat('justifyLeft')}
                  className="p-2 rounded hover:bg-white/20 text-white/70 hover:text-white transition-colors"
                  title="Align Left"
                >
                  <AlignLeft size={16} />
                </button>
                {/* Align Center */}
                <button
                  onClick={() => execFormat('justifyCenter')}
                  className="p-2 rounded hover:bg-white/20 text-white/70 hover:text-white transition-colors"
                  title="Align Center"
                >
                  <AlignCenter size={16} />
                </button>
                {/* Align Right */}
                <button
                  onClick={() => execFormat('justifyRight')}
                  className="p-2 rounded hover:bg-white/20 text-white/70 hover:text-white transition-colors"
                  title="Align Right"
                >
                  <AlignRight size={16} />
                </button>

                <div className="w-px h-5 bg-white/20 mx-1" />

                {/* Font Size */}
                <div className="relative">
                  <button
                    onClick={() => { setShowFontSizeMenu(!showFontSizeMenu); setShowColorMenu(false); }}
                    className="p-2 rounded hover:bg-white/20 text-white/70 hover:text-white transition-colors"
                    title="Font Size"
                  >
                    <Type size={16} />
                  </button>
                  {showFontSizeMenu && (
                    <div className="absolute top-full left-0 mt-1 bg-black/90 backdrop-blur-md rounded-lg border border-white/20 overflow-hidden z-10">
                      {fontSizes.map((size) => (
                        <button
                          key={size.value}
                          onClick={() => { execFormat('fontSize', size.value); setShowFontSizeMenu(false); }}
                          className="block w-full px-4 py-2 text-left text-white/80 hover:bg-white/10 hover:text-white text-sm"
                        >
                          {size.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Color */}
                <div className="relative">
                  <button
                    onClick={() => { setShowColorMenu(!showColorMenu); setShowFontSizeMenu(false); }}
                    className="p-2 rounded hover:bg-white/20 text-white/70 hover:text-white transition-colors"
                    title="Text Color"
                  >
                    <Palette size={16} />
                  </button>
                  {showColorMenu && (
                    <div className="absolute top-full left-0 mt-1 bg-black/90 backdrop-blur-md rounded-lg border border-white/20 p-2 z-10">
                      <div className="flex gap-1">
                        {colors.map((color) => (
                          <button
                            key={color}
                            onClick={() => { execFormat('foreColor', color); setShowColorMenu(false); }}
                            className="w-6 h-6 rounded border border-white/30 hover:scale-110 transition-transform"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="w-px h-5 bg-white/20 mx-1" />

                {/* AI Processing */}
                <div className="relative">
                  <button
                    onClick={() => { setShowAIPanel(!showAIPanel); setShowFontSizeMenu(false); setShowColorMenu(false); }}
                    className={`p-2 rounded transition-colors ${showAIPanel ? 'bg-[#b69fbb]/30 text-[#b69fbb]' : 'hover:bg-white/20 text-white/70 hover:text-white'}`}
                    title="AI Processing"
                  >
                    <Sparkles size={16} />
                  </button>
                  {showAIPanel && (
                    <div className="absolute top-full right-0 mt-1 bg-black/95 backdrop-blur-md rounded-lg border border-white/20 p-4 z-10 w-64" style={{ fontFamily: "'Consulate', monospace" }}>
                      <div className="text-white/50 text-xs uppercase tracking-wider mb-3">AI Processing</div>

                      {/* AI Feature Options */}
                      <div className="space-y-2 mb-4">
                        <button
                          onClick={() => toggleAIFeature('cleanup')}
                          className={`block w-full text-left text-sm transition-colors ${selectedAIFeatures.has('cleanup') ? 'text-[#b69fbb]' : 'text-white/60 hover:text-white/80'}`}
                        >
                          {selectedAIFeatures.has('cleanup') && '✦ '}Cleanup
                        </button>
                        <button
                          onClick={() => toggleAIFeature('summary')}
                          className={`block w-full text-left text-sm transition-colors ${selectedAIFeatures.has('summary') ? 'text-[#b69fbb]' : 'text-white/60 hover:text-white/80'}`}
                        >
                          {selectedAIFeatures.has('summary') && '✦ '}Summary
                        </button>
                        <button
                          onClick={() => toggleAIFeature('headings')}
                          className={`block w-full text-left text-sm transition-colors ${selectedAIFeatures.has('headings') ? 'text-[#b69fbb]' : 'text-white/60 hover:text-white/80'}`}
                        >
                          {selectedAIFeatures.has('headings') && '✦ '}Underline → Headings
                        </button>
                        <button
                          onClick={() => toggleAIFeature('custom')}
                          className={`block w-full text-left text-sm transition-colors ${selectedAIFeatures.has('custom') ? 'text-[#b69fbb]' : 'text-white/60 hover:text-white/80'}`}
                        >
                          {selectedAIFeatures.has('custom') && '✦ '}Custom Cleanup
                        </button>

                        {/* Custom Prompt Input */}
                        {selectedAIFeatures.has('custom') && (
                          <textarea
                            value={customPrompt}
                            onChange={(e) => setCustomPrompt(e.target.value)}
                            placeholder="Enter your custom prompt..."
                            className="w-full mt-2 px-3 py-2 bg-white/5 border border-white/20 rounded text-white/80 text-xs placeholder:text-white/30 focus:outline-none focus:border-[#b69fbb]/50 resize-none"
                            rows={3}
                          />
                        )}
                      </div>

                      <div className="border-t border-white/10 pt-3 mb-3">
                        <button
                          onClick={() => toggleAIFeature('retranscribe')}
                          className={`block w-full text-left text-sm transition-colors ${selectedAIFeatures.has('retranscribe') ? 'text-[#b69fbb]' : 'text-white/60 hover:text-white/80'}`}
                        >
                          {selectedAIFeatures.has('retranscribe') && '✦ '}Re-transcribe
                        </button>
                      </div>

                      {/* Apply Button */}
                      <button
                        onClick={handleAIApply}
                        disabled={selectedAIFeatures.size === 0 || isProcessing}
                        className="w-full py-2 rounded bg-[#b69fbb]/20 text-[#b69fbb] text-sm hover:bg-[#b69fbb]/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isProcessing ? (
                          <>Processing...</>
                        ) : (
                          <>
                            <Sparkles size={14} />
                            Apply
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Playback Progress Bar */}
              {isPlayingInModal && (
                <div className="px-6 py-2">
                  <div className="relative h-1 bg-white/20 rounded-full overflow-hidden">
                    <motion.div
                      className="absolute left-0 top-0 h-full bg-white/80 rounded-full"
                      style={{ width: `${playbackProgress * 100}%` }}
                      initial={{ width: 0 }}
                      animate={{ width: `${playbackProgress * 100}%` }}
                      transition={{ duration: 0.1, ease: 'linear' }}
                    />
                    <div
                      className="absolute top-0 h-full bg-gradient-to-r from-transparent via-white/50 to-transparent"
                      style={{
                        left: `${Math.max(0, playbackProgress * 100 - 5)}%`,
                        width: '10%',
                        filter: 'blur(2px)',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Editable Transcription Content */}
              <style>{`
                .transcript-editor::selection,
                .transcript-editor *::selection {
                  background-color: transparent;
                  color: #fff;
                  text-shadow: 0 0 8px rgba(255,255,255,0.8), 0 0 16px rgba(255,255,255,0.5);
                }
              `}</style>
              <div className="p-6 overflow-y-auto max-h-[50vh]">
                {isPlayingInModal ? (
                  /* 播放时显示卡拉OK高亮效果 */
                  <KaraokeText
                    text={memo.transcription}
                    progress={playbackProgress}
                    fontFamily={contentFont}
                  />
                ) : (
                  /* 非播放时显示可编辑内容 */
                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    className="transcript-editor prose prose-zinc max-w-none text-white text-base leading-relaxed outline-none min-h-[200px]"
                    style={{ fontFamily: contentFont }}
                    dangerouslySetInnerHTML={{
                      __html: memo.transcription
                        .split('\n\n')
                        .map((p: string) => `<p class="mb-4">${highlightTextToHtml(p, memo.highlightedWords)}</p>`)
                        .join('')
                    }}
                  />
                )}
              </div>

              {/* Modal Footer */}
              <motion.div
                className="sticky bottom-0 bg-transparent px-6 pt-6 pb-4 flex justify-between items-center"
                variants={textVariants}
              >
                <button
                  onClick={playInModal}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full transition-colors border ${
                    isPlayingInModal
                      ? 'bg-white/30 text-white border-white/50'
                      : 'bg-white/20 text-white hover:bg-white/30 border-white/30'
                  }`}
                >
                  {isPlayingInModal ? (
                    <Pause size={16} fill="currentColor" />
                  ) : (
                    <Play size={16} fill="currentColor" />
                  )}
                  <span className="text-sm font-bold tracking-wider uppercase">
                    {isPlayingInModal ? 'Pause' : 'Play'}
                  </span>
                </button>
                <div className="relative">
                  <button
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors border border-white/30"
                  >
                    <Download size={16} />
                    <span className="text-sm font-bold tracking-wider uppercase">Export</span>
                  </button>
                  {showExportMenu && (
                    <div className="absolute bottom-full right-0 mb-2 bg-black/90 backdrop-blur-md rounded-lg border border-white/20 overflow-hidden min-w-[140px]">
                      <button
                        onClick={exportAsMarkdown}
                        className="w-full flex items-center gap-3 px-4 py-3 text-white/80 hover:bg-white/10 hover:text-white transition-colors text-sm"
                      >
                        <FileCode size={16} />
                        Markdown
                      </button>
                      <button
                        onClick={exportAsPDF}
                        className="w-full flex items-center gap-3 px-4 py-3 text-white/80 hover:bg-white/10 hover:text-white transition-colors text-sm border-t border-white/10"
                      >
                        <FileText size={16} />
                        PDF
                      </button>
                      <button
                        onClick={exportAsWord}
                        className="w-full flex items-center gap-3 px-4 py-3 text-white/80 hover:bg-white/10 hover:text-white transition-colors text-sm border-t border-white/10"
                      >
                        <File size={16} />
                        Word
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default CassetteTape;
