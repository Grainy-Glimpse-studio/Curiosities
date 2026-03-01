import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import emailjs from '@emailjs/browser';
import { X, Minus, Maximize2, Minimize2, Play, Pause, Download, FileText, FileCode, File, Bold, Italic, Underline, List, ListOrdered, Quote, Heading1, Heading2, Undo, Redo, Music, Sparkles, Mail, Info } from 'lucide-react';
import { Memo } from '../types';
import MarkdownEditor, { MarkdownEditorRef } from './MarkdownEditor';

interface FloatingTranscriptProps {
  memo: Memo | null;
  isOpen: boolean;
  onClose: () => void;
  onPlay: (memo: Memo) => void;
  titleFont: string;
  contentFont: string;
  initialOffset?: number; // 多窗口时的偏移量
  onOpenAbout?: () => void; // 打开 About 页面
  creatorEmail?: string; // 创作者邮箱
}

// 卡拉OK式高亮文本组件
interface KaraokeTextProps {
  text: string;
  progress: number; // 0-1
  fontFamily: string;
}

const KaraokeText: React.FC<KaraokeTextProps> = ({ text, progress, fontFamily }) => {
  const totalChars = text.length;
  const highlightedChars = Math.floor(totalChars * progress);
  const playedPart = text.slice(0, highlightedChars);
  const unplayedPart = text.slice(highlightedChars);

  return (
    <div
      className="text-white text-base leading-relaxed whitespace-pre-wrap"
      style={{ fontFamily }}
    >
      <span
        style={{
          color: '#fff',
          textShadow: '0 0 8px rgba(255,255,255,0.8), 0 0 16px rgba(255,255,255,0.5), 0 0 24px rgba(255,255,255,0.3)',
        }}
      >
        {playedPart}
      </span>
      <span style={{ color: 'rgba(255,255,255,0.6)' }}>
        {unplayedPart}
      </span>
    </div>
  );
};

const FloatingTranscript: React.FC<FloatingTranscriptProps> = ({
  memo,
  isOpen,
  onClose,
  onPlay,
  titleFont,
  contentFont,
  initialOffset = 0,
  onOpenAbout,
  creatorEmail = 'diane@twinpeaks.fm', // 默认邮箱，之后可以改
}) => {
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [size, setSize] = useState({ width: 600, height: 500 });
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [prevState, setPrevState] = useState({ position: { x: 100, y: 100 }, size: { width: 600, height: 500 } });
  const [isPlayingInModal, setIsPlayingInModal] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showJoinMenu, setShowJoinMenu] = useState(false);
  const [customTitle, setCustomTitle] = useState('Transcript');
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [showProjectInfo, setShowProjectInfo] = useState(false); // 显示项目介绍

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
      setCustomTitle('Transcript');
      setShowExportMenu(false);
    }
  }, [isOpen, initialOffset]);

  // 播放控制
  const playInModal = () => {
    if (!memo) return;
    if (!modalAudioRef.current) {
      modalAudioRef.current = new Audio(memo.audioUrl);
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

  const stopModalPlayback = () => {
    if (modalAudioRef.current) {
      modalAudioRef.current.pause();
      modalAudioRef.current.currentTime = 0;
      modalAudioRef.current = null;
      setIsPlayingInModal(false);
      setPlaybackProgress(0);
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
    if (!memo || !memo.audioUrl) return;
    const element = document.createElement("a");
    element.href = memo.audioUrl;
    element.download = `recording-${formatDate(memo.createdAt)}.webm`;
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
            className="fixed z-[200] flex flex-col backdrop-blur-2xl rounded-2xl shadow-2xl overflow-hidden border border-white/60"
            style={{
              left: position.x,
              top: position.y,
              width: isMinimized ? 300 : size.width,
              height: isMinimized ? 48 : size.height,
              backgroundColor: 'rgba(255, 255, 255, 0)',
            }}
          >
            {/* 暂时去掉自定义selection样式，测试原生选择是否正常 */}

            {/* 标题栏 - 可拖拽 */}
            <div
              className="flex items-center justify-between px-6 py-4 bg-transparent border-b border-white/20 cursor-move select-none shrink-0"
              onMouseDown={handleDragStart}
            >
              <div className="flex flex-col">
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
                {/* Tags */}
                <div className="px-6 py-3 border-b border-white/20 flex flex-wrap gap-2 shrink-0">
                  {memo.tags.map((tag: string) => (
                    <span key={tag} className="px-3 py-1 bg-white/10 text-white/80 text-xs uppercase font-bold tracking-wider border border-white/20 rounded-full">
                      #{tag}
                    </span>
                  ))}
                </div>

                {/* 工具栏 */}
                {!isPlayingInModal && editorRef.current?.editor && (
                  <div className="px-6 py-2 border-b border-white/20 flex flex-wrap items-center gap-1 shrink-0">
                    <button
                      onClick={() => editorRef.current?.editor?.chain().focus().toggleBold().run()}
                      className={`p-2 rounded hover:bg-white/20 transition-colors ${editorRef.current?.editor?.isActive('bold') ? 'text-white bg-white/20' : 'text-white/70 hover:text-white'}`}
                      title="粗体"
                    >
                      <Bold size={16} />
                    </button>
                    <button
                      onClick={() => editorRef.current?.editor?.chain().focus().toggleItalic().run()}
                      className={`p-2 rounded hover:bg-white/20 transition-colors ${editorRef.current?.editor?.isActive('italic') ? 'text-white bg-white/20' : 'text-white/70 hover:text-white'}`}
                      title="斜体"
                    >
                      <Italic size={16} />
                    </button>
                    <button
                      onClick={() => editorRef.current?.editor?.chain().focus().toggleUnderline().run()}
                      className={`p-2 rounded hover:bg-white/20 transition-colors ${editorRef.current?.editor?.isActive('underline') ? 'text-white bg-white/20' : 'text-white/70 hover:text-white'}`}
                      title="下划线"
                    >
                      <Underline size={16} />
                    </button>

                    <div className="w-px h-5 bg-white/20 mx-1" />

                    <button
                      onClick={() => editorRef.current?.editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                      className={`p-2 rounded hover:bg-white/20 transition-colors ${editorRef.current?.editor?.isActive('heading', { level: 1 }) ? 'text-white bg-white/20' : 'text-white/70 hover:text-white'}`}
                      title="标题1"
                    >
                      <Heading1 size={16} />
                    </button>
                    <button
                      onClick={() => editorRef.current?.editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                      className={`p-2 rounded hover:bg-white/20 transition-colors ${editorRef.current?.editor?.isActive('heading', { level: 2 }) ? 'text-white bg-white/20' : 'text-white/70 hover:text-white'}`}
                      title="标题2"
                    >
                      <Heading2 size={16} />
                    </button>

                    <div className="w-px h-5 bg-white/20 mx-1" />

                    <button
                      onClick={() => editorRef.current?.editor?.chain().focus().toggleBulletList().run()}
                      className={`p-2 rounded hover:bg-white/20 transition-colors ${editorRef.current?.editor?.isActive('bulletList') ? 'text-white bg-white/20' : 'text-white/70 hover:text-white'}`}
                      title="无序列表"
                    >
                      <List size={16} />
                    </button>
                    <button
                      onClick={() => editorRef.current?.editor?.chain().focus().toggleOrderedList().run()}
                      className={`p-2 rounded hover:bg-white/20 transition-colors ${editorRef.current?.editor?.isActive('orderedList') ? 'text-white bg-white/20' : 'text-white/70 hover:text-white'}`}
                      title="有序列表"
                    >
                      <ListOrdered size={16} />
                    </button>
                    <button
                      onClick={() => editorRef.current?.editor?.chain().focus().toggleBlockquote().run()}
                      className={`p-2 rounded hover:bg-white/20 transition-colors ${editorRef.current?.editor?.isActive('blockquote') ? 'text-white bg-white/20' : 'text-white/70 hover:text-white'}`}
                      title="引用"
                    >
                      <Quote size={16} />
                    </button>

                    <div className="w-px h-5 bg-white/20 mx-1" />

                    <button
                      onClick={() => editorRef.current?.editor?.chain().focus().undo().run()}
                      className="p-2 rounded hover:bg-white/20 text-white/70 hover:text-white transition-colors"
                      title="撤销"
                    >
                      <Undo size={16} />
                    </button>
                    <button
                      onClick={() => editorRef.current?.editor?.chain().focus().redo().run()}
                      className="p-2 rounded hover:bg-white/20 text-white/70 hover:text-white transition-colors"
                      title="重做"
                    >
                      <Redo size={16} />
                    </button>
                  </div>
                )}

                {/* 播放进度条 */}
                {isPlayingInModal && (
                  <div className="px-6 py-2 shrink-0">
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
                    {isPlayingInModal ? (
                      <KaraokeText
                        text={memo.transcription}
                        progress={playbackProgress}
                        fontFamily={contentFont}
                      />
                    ) : (
                      <MarkdownEditor
                        ref={editorRef}
                        content={memo.transcription}
                        fontFamily={contentFont}
                        highlightedWords={memo.highlightedWords}
                      />
                    )}
                  </motion.div>
                </div>

                {/* 底部控制栏 */}
                <div className="px-6 pt-4 pb-4 bg-transparent flex justify-between items-center shrink-0">
                  <button
                    onClick={playInModal}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/15 text-white/60 hover:text-white border border-white/10 hover:border-white/20 transition-colors"
                    style={{ fontFamily: contentFont }}
                  >
                    {isPlayingInModal ? (
                      <Pause size={14} />
                    ) : (
                      <Play size={14} />
                    )}
                    <span className="text-sm">
                      {isPlayingInModal ? 'Pause' : 'Play'}
                    </span>
                  </button>

                  <div className="flex items-center gap-3">
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
                        <div className="absolute bottom-full right-0 mb-2 bg-black/90 backdrop-blur-md rounded-lg border border-white/20 overflow-hidden min-w-[160px]">
                          <button
                            onClick={() => { setShowJoinMenu(false); setShowProjectInfo(true); }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-white/80 hover:bg-white/10 hover:text-white transition-colors text-sm"
                          >
                            <Info size={16} />
                            What is this?
                          </button>
                          <button
                            onClick={sendToCreator}
                            className="w-full flex items-center gap-3 px-4 py-3 text-white/80 hover:bg-white/10 hover:text-white transition-colors text-sm border-t border-white/10"
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
                          <button
                            onClick={downloadAudio}
                            className="w-full flex items-center gap-3 px-4 py-3 text-white/80 hover:bg-white/10 hover:text-white transition-colors text-sm border-t border-white/10"
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
