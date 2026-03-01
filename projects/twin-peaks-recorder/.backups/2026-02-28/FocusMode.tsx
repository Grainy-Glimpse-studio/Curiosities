import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

interface Sentence {
  id: string;
  text: string;
  isFinal: boolean;
  capturedAt: number; // 被捕获的时间，0表示未捕获
}

interface FocusModeProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (text: string) => void;
  fontFamily?: string;
}

const FocusMode: React.FC<FocusModeProps> = ({ isOpen, onClose, onCapture, fontFamily = "'Consulate', monospace" }) => {
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null); // 当前 hover 的句子
  // Default to ~75% of viewport, centered
  const [size, setSize] = useState(() => ({
    width: Math.min(900, window.innerWidth * 0.75),
    height: Math.min(600, window.innerHeight * 0.7)
  }));
  const [scrollTrigger, setScrollTrigger] = useState(0); // 触发滚动的计数器
  const currentSentenceId = useRef<string | null>(null); // 当前应该高亮的句子 ID
  const [position, setPosition] = useState(() => ({
    x: (window.innerWidth - Math.min(900, window.innerWidth * 0.75)) / 2,
    y: (window.innerHeight - Math.min(600, window.innerHeight * 0.7)) / 2
  }));
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [initialSize, setInitialSize] = useState({ width: 0, height: 0 });
  const [initialPos, setInitialPos] = useState({ x: 0, y: 0 });
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentenceRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const currentInterimId = useRef<string | null>(null);

  // Add or update sentence from speech recognition
  const addSentence = useCallback((text: string, isFinal: boolean) => {
    if (!text.trim()) return;

    let targetId: string | null = null;

    setSentences((prev: Sentence[]) => {
      let newSentences: Sentence[];

      // 如果是临时文字，更新当前临时句子
      if (!isFinal) {
        // 检查是否已有临时句子
        if (currentInterimId.current) {
          // 更新现有临时句子
          targetId = currentInterimId.current;
          newSentences = prev.map((s: Sentence) =>
            s.id === currentInterimId.current
              ? { ...s, text: text.trim() }
              : s
          );
        } else {
          // 创建新临时句子
          const newId = `interim-${Date.now()}`;
          currentInterimId.current = newId;
          targetId = newId;
          const newSentence: Sentence = {
            id: newId,
            text: text.trim(),
            isFinal: false,
            capturedAt: 0,
          };
          newSentences = [...prev, newSentence];
        }
      } else {
        // 最终文字 - 替换临时句子或添加新句子
        if (currentInterimId.current) {
          const finalId = `final-${Date.now()}`;
          targetId = finalId;
          newSentences = prev.map((s: Sentence) =>
            s.id === currentInterimId.current
              ? { ...s, id: finalId, text: text.trim(), isFinal: true, capturedAt: 0 }
              : s
          );
          currentInterimId.current = null;
        } else {
          // 没有临时句子，直接添加最终句子
          const newId = `final-${Date.now()}-${Math.random()}`;
          targetId = newId;
          const newSentence: Sentence = {
            id: newId,
            text: text.trim(),
            isFinal: true,
            capturedAt: 0,
          };
          newSentences = [...prev, newSentence];
        }
      }

      // 限制最多保留30句
      if (newSentences.length > 30) {
        newSentences = newSentences.slice(-30);
      }

      return newSentences;
    });

    // 更新当前句子 ID 并触发滚动
    if (targetId) {
      currentSentenceId.current = targetId;
      setScrollTrigger(n => n + 1);
    }
  }, []);

  // Capture a sentence - it will stay highlighted for 3 seconds
  const captureSentence = useCallback((sentenceId: string) => {
    setSentences((prev: Sentence[]) => {
      const sentence = prev.find((s: Sentence) => s.id === sentenceId);
      if (sentence && sentence.isFinal) {
        // 只有第一次捕获才记录到后台
        if (sentence.capturedAt === 0) {
          onCapture(sentence.text);
        }
        // 但每次点击都显示发光效果
        return prev.map((s: Sentence) =>
          s.id === sentenceId ? { ...s, capturedAt: Date.now() } : s
        );
      }
      return prev;
    });
  }, [onCapture]);

  // Force re-render for smooth capture glow animation
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const hasCaptured = sentences.some((s: Sentence) => s.capturedAt > 0 && Date.now() - s.capturedAt < 3000);
    if (hasCaptured) {
      const interval = setInterval(() => forceUpdate((n: number) => n + 1), 50);
      return () => clearInterval(interval);
    }
  }, [sentences]);

  // 当 scrollTrigger 变化时，滚动到当前句子
  useEffect(() => {
    if (!currentSentenceId.current) return;

    // 延迟一帧确保 DOM 已更新
    requestAnimationFrame(() => {
      const el = sentenceRefs.current.get(currentSentenceId.current!);
      if (el) {
        el.scrollIntoView({
          behavior: 'smooth',
          block: 'center', // 垂直居中
        });
      }
    });
  }, [scrollTrigger]); // 每次 scrollTrigger 变化时触发


  // Expose addSentence function
  useEffect(() => {
    if (isOpen) {
      (window as any).__focusModeAddWord = addSentence;
    }
    return () => {
      delete (window as any).__focusModeAddWord;
    };
  }, [isOpen, addSentence]);

  // Handle drag for moving window
  const handleMouseDown = useCallback((e: React.MouseEvent, type: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (type === 'drag') {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    } else {
      setIsResizing(type);
      setDragStart({ x: e.clientX, y: e.clientY });
      setInitialSize({ ...size });
      setInitialPos({ ...position });
    }
  }, [position, size]);

  // Handle mouse move for drag/resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      } else if (isResizing) {
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;

        let newWidth = initialSize.width;
        let newHeight = initialSize.height;
        let newX = initialPos.x;
        let newY = initialPos.y;

        if (isResizing.includes('e')) {
          newWidth = Math.max(300, initialSize.width + dx);
        }
        if (isResizing.includes('w')) {
          newWidth = Math.max(300, initialSize.width - dx);
          newX = initialPos.x + dx;
        }
        if (isResizing.includes('s')) {
          newHeight = Math.max(150, initialSize.height + dy);
        }
        if (isResizing.includes('n')) {
          newHeight = Math.max(150, initialSize.height - dy);
          newY = initialPos.y + dy;
        }

        setSize({ width: newWidth, height: newHeight });
        if (isResizing.includes('w') || isResizing.includes('n')) {
          setPosition({ x: newX, y: newY });
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(null);
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, dragStart, initialSize, initialPos]);

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed z-[100]"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
      }}
    >
      <div className="w-full h-full backdrop-blur-xl rounded-lg border border-white/10 overflow-hidden flex flex-col"
        style={{ background: 'rgba(0,0,0,0.5)' }}
      >
        {/* Header - draggable */}
        <div
          onMouseDown={(e) => handleMouseDown(e, 'drag')}
          className="flex items-center justify-between px-4 py-2 border-b border-white/10 cursor-grab active:cursor-grabbing shrink-0"
        >
          <span className="text-[10px] font-recorder tracking-[0.3em] text-white/30 uppercase">
            Focus Mode
          </span>
          <button
            onClick={onClose}
            onMouseDown={(e) => e.stopPropagation()}
            className="text-white/30 hover:text-white/60 transition-colors"
          >
            <X size={12} />
          </button>
        </div>

        {/* Scrollable lyrics-style content */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-5 py-6"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.2) transparent',
          }}
        >
          <style>{`
            .focus-scroll::-webkit-scrollbar { width: 4px; }
            .focus-scroll::-webkit-scrollbar-track { background: transparent; }
            .focus-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }
            .focus-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.4); }
          `}</style>

          {sentences.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <span className="text-white/20 text-sm font-recorder italic">Listening...</span>
            </div>
          ) : (
            <div className="focus-scroll">
              {/* 上方留白让第一句可以居中 */}
              <div style={{ height: '40%', pointerEvents: 'none' }} />

              <div className="space-y-5">
                {sentences.map((sentence: Sentence, index: number) => {
                  // 用 currentSentenceId 来判断哪个是当前句子
                  const isActive = sentence.id === currentSentenceId.current;
                  const activeIdx = sentences.findIndex(s => s.id === currentSentenceId.current);
                  const distance = activeIdx >= 0 ? Math.abs(index - activeIdx) : sentences.length - 1 - index;
                  const isNear = distance === 1;
                  const isInterim = !sentence.isFinal;
                  const isHovered = hoveredId === sentence.id;

                  // 计算捕获状态：捕获后3秒内保持高亮
                  const timeSinceCaptured = sentence.capturedAt > 0 ? Date.now() - sentence.capturedAt : 0;
                  const isCaptured = sentence.capturedAt > 0;
                  const isRecentlyCaptured = isCaptured && timeSinceCaptured < 3000;
                  // 捕获后的渐变：前2秒完全亮，第3秒慢慢淡出
                  const captureGlow = isRecentlyCaptured
                    ? timeSinceCaptured < 2000 ? 1 : 1 - (timeSinceCaptured - 2000) / 1000
                    : 0;

                  // 根据距离计算基础透明度
                  let baseOpacity = isActive ? 1 : isNear ? 0.35 : distance === 2 ? 0.15 : 0.08;

                  // Hover 时提高透明度（所有最终句子都可以 hover）
                  if (isHovered && sentence.isFinal) {
                    baseOpacity = Math.max(baseOpacity, 0.8);
                  }

                  // 如果最近被捕获，保持高亮
                  let opacity = isRecentlyCaptured ? Math.max(baseOpacity, 0.5 + captureGlow * 0.5) : baseOpacity;

                  // 计算发光效果 - 更亮
                  let textShadow = 'none';
                  if (isRecentlyCaptured) {
                    // 捕获时：非常强的发光
                    textShadow = `0 0 ${20 + captureGlow * 20}px #fff, 0 0 ${40 + captureGlow * 40}px rgba(255,255,255,${0.8 + captureGlow * 0.2}), 0 0 ${80 + captureGlow * 40}px rgba(255,255,255,${0.4 + captureGlow * 0.3})`;
                  } else if (isHovered && sentence.isFinal) {
                    // Hover：明显的发光（所有最终句子）
                    textShadow = '0 0 10px #fff, 0 0 30px rgba(255,255,255,0.8), 0 0 50px rgba(255,255,255,0.5)';
                  } else if (isActive) {
                    textShadow = '0 0 15px rgba(255,255,255,0.4)';
                  }

                  return (
                    <div
                      key={sentence.id}
                      ref={(el) => {
                        if (el) sentenceRefs.current.set(sentence.id, el);
                      }}
                      onClick={() => sentence.isFinal && captureSentence(sentence.id)}
                      onMouseEnter={() => setHoveredId(sentence.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      className={`transition-all duration-300 leading-relaxed ${
                        sentence.isFinal ? 'cursor-pointer' : 'cursor-default'
                      } ${isInterim ? 'italic' : ''}`}
                      style={{
                        fontFamily: fontFamily,
                        opacity,
                        fontSize: isActive || isRecentlyCaptured || isHovered ? '15px' : '14px',
                        color: 'rgba(255,255,255,1)',
                        textShadow,
                        transform: isRecentlyCaptured && timeSinceCaptured < 300 ? 'scale(1.03)' : isHovered ? 'scale(1.01)' : 'scale(1)',
                      }}
                    >
                      {sentence.text}
                      {isInterim && <span className="ml-2 animate-pulse">|</span>}
                    </div>
                  );
                })}
              </div>

              {/* 下方留白让最后一句可以居中 */}
              <div style={{ height: '40%', pointerEvents: 'none' }} />
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-1.5 border-t border-white/5 shrink-0">
          <span className="text-[9px] text-white/20 font-recorder">Scroll to view history • Click to capture</span>
        </div>

        {/* Resize handles */}
        <div onMouseDown={(e) => handleMouseDown(e, 'nw')} className="absolute top-0 left-0 w-3 h-3 cursor-nw-resize" />
        <div onMouseDown={(e) => handleMouseDown(e, 'ne')} className="absolute top-0 right-0 w-3 h-3 cursor-ne-resize" />
        <div onMouseDown={(e) => handleMouseDown(e, 'sw')} className="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize" />
        <div onMouseDown={(e) => handleMouseDown(e, 'se')} className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize" />
        <div onMouseDown={(e) => handleMouseDown(e, 'n')} className="absolute top-0 left-3 right-3 h-1 cursor-n-resize" />
        <div onMouseDown={(e) => handleMouseDown(e, 's')} className="absolute bottom-0 left-3 right-3 h-1 cursor-s-resize" />
        <div onMouseDown={(e) => handleMouseDown(e, 'w')} className="absolute left-0 top-3 bottom-3 w-1 cursor-w-resize" />
        <div onMouseDown={(e) => handleMouseDown(e, 'e')} className="absolute right-0 top-3 bottom-3 w-1 cursor-e-resize" />
      </div>
    </motion.div>
  );
};

export default FocusMode;
