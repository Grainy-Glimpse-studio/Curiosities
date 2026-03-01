import React, { useState, useRef } from 'react';
import { Memo } from '../types';
import { Play, Trash2, Download, X, FileText, File, FileCode, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Type, Palette } from 'lucide-react';
import { motion, AnimatePresence, Variants } from 'framer-motion';

interface CassetteTapeProps {
  memo: Memo;
  onPlay: (memo: Memo) => void;
  onDelete: (id: string) => void;
  onTogglePermanent: (id: string) => void;
  titleFont: string;
  contentFont: string;
  shouldAllowClick?: () => boolean;
  onOpenTranscript?: (memo: Memo) => void; // 打开独立浮动窗口
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

const CassetteTape: React.FC<CassetteTapeProps> = ({ memo, onPlay, onDelete, onTogglePermanent, titleFont, contentFont, shouldAllowClick, onOpenTranscript }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showFontSizeMenu, setShowFontSizeMenu] = useState(false);
  const [showColorMenu, setShowColorMenu] = useState(false);
  const [customTitle, setCustomTitle] = useState('Transcript');
  const editorRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  const hoverSoundRef = useRef<HTMLAudioElement | null>(null);

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

  return (
    <>
      {/* Cassette Tape Card - Black Design */}
      <div className="relative group w-full mb-6 perspective-1000">
        {/* Tape Body */}
        <div
          className="bg-[#1a1a1a] rounded-xl shadow-[0_20px_40px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.1)] border border-black p-3 transform transition-all duration-300 group-hover:-rotate-1 group-hover:scale-[1.02] relative overflow-hidden"
        >

          {/* Plastic Texture */}
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/black-scales.png')] opacity-20 pointer-events-none"></div>

          {/* Label Area - Clickable */}
          <div
            onClick={handleCardClick}
            className="relative z-10 rounded-lg p-4 shadow-inner border border-zinc-300 flex flex-col gap-2 min-h-[160px] cursor-pointer overflow-hidden"
            style={{
              backgroundImage: 'url(/image/paper-texture.jpg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            {/* Label Header */}
            <div className="flex justify-between items-center border-b-2 border-zinc-200 pb-2">
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
                <span key={tag} className="px-2 py-0.5 bg-zinc-100 text-zinc-600 text-[9px] uppercase font-bold tracking-wider border border-zinc-200 rounded-sm italic">
                  #{tag}
                </span>
              ))}
            </div>

            {/* Transcription Preview */}
            <div className="flex-1 relative">
               <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="w-full h-px bg-zinc-200"></div>
                  ))}
               </div>
               <p className="italic text-zinc-800 text-sm leading-[1.6rem] line-clamp-3 relative z-10 pt-0.5" style={{ fontFamily: contentFont }}>
                 {memo.transcription || "No transcription available..."}
               </p>
            </div>

            {/* Click hint */}
            <div className="text-[8px] text-zinc-400 text-center mt-1">Click to read full transcript</div>

            {/* Tape Info */}
            <div className="flex justify-between items-center mt-2 pt-2 border-t border-zinc-100">
               <span className="text-[8px] text-zinc-400 font-mono tracking-widest uppercase">Side A / 60 Min</span>
               <span className="text-[8px] text-zinc-400 font-mono tracking-widest uppercase">TP-PROFESSIONAL</span>
            </div>
          </div>

          {/* Controls */}
          <div className="mt-4 flex items-center justify-between px-2 relative z-10">
            <button
              onClick={(e) => { e.stopPropagation(); onPlay(memo); }}
              className="flex items-center gap-3 px-4 py-2 rounded-full bg-zinc-900 text-zinc-300 border border-zinc-800 hover:bg-zinc-800 hover:text-white active:scale-95 transition-all shadow-lg group/play"
            >
              <Play size={14} fill="currentColor" className="group-hover/play:text-amber-500 transition-colors" />
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase">Play Tape</span>
            </button>

            <div className="flex gap-3">
              <button
                onClick={(e) => { e.stopPropagation(); exportAsMarkdown(); }}
                className="p-2 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-all shadow-md"
                title="Export as Text"
              >
                <Download size={16} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(memo.id); }}
                className="p-2 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-[#903e4f] hover:border-[#903e4f]/50 transition-all shadow-md"
                title="Delete Tape"
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
              </motion.div>

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
              </div>

              {/* Modal Footer */}
              <motion.div
                className="sticky bottom-0 bg-transparent px-6 pt-6 pb-4 flex justify-between items-center"
                variants={textVariants}
              >
                <button
                  onClick={() => { onPlay(memo); handleClose(); }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors border border-white/30"
                >
                  <Play size={16} fill="currentColor" />
                  <span className="text-sm font-bold tracking-wider uppercase">Play</span>
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
