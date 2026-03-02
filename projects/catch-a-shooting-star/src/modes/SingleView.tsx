import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ContentItem } from '../types';

// Floating animation for individual characters - more noticeable
const floatKeyframes = `
@keyframes charFloat {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-2px);
  }
}
`;

// Blow away animation - simple fade out for now (TODO: improve later)
const BlowAwayText: React.FC<{
  text: string;
  style?: React.CSSProperties;
  className?: string;
  onComplete?: () => void;
}> = ({ text, style, className, onComplete }) => {
  const [isAnimating, setIsAnimating] = React.useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsAnimating(false);
      onComplete?.();
    }, 1500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!isAnimating) return null;

  return (
    <span
      className={className}
      style={{
        ...style,
        animation: 'simpleFadeOut 1.2s ease-out forwards',
      }}
    >
      {text}
      <style>{`
        @keyframes simpleFadeOut {
          0% {
            opacity: 1;
            filter: blur(0px);
          }
          100% {
            opacity: 0;
            filter: blur(3px);
          }
        }
      `}</style>
    </span>
  );
};

// Component to render text with each character floating independently
const FloatingText: React.FC<{
  text: string;
  style?: React.CSSProperties;
  className?: string;
}> = ({ text, style, className }) => {
  // Split into characters, preserve spaces
  const chars = text.split('');

  return (
    <span className={className} style={style}>
      {chars.map((char, i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            animation: char === ' ' ? 'none' : `charFloat ${6 + (i % 3)}s ease-in-out infinite`,
            animationDelay: `${(i * 0.15) % 2}s`,
          }}
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </span>
  );
};

// Quote character limit for replies
const QUOTE_MAX_LENGTH = 80;

// Truncate text with ellipsis
const truncateQuote = (text: string, maxLength: number = QUOTE_MAX_LENGTH): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
};

interface SingleViewProps {
  item: ContentItem | null;
  transitionDuration?: number;
  fontFamily?: string;
  fontOpacity?: number;
  fontSize?: number;
  canReply?: boolean;
  blowAway?: boolean; // Trigger blow away animation
  onItemClick?: (item: ContentItem) => void;
  onItemDoubleClick?: (item: ContentItem) => void;
  onInputSubmit?: (content: string) => void;
  onReply?: (item: ContentItem) => void;
  onClose?: () => void;
  onBlowAwayComplete?: () => void;
}

const SingleView: React.FC<SingleViewProps> = ({
  item,
  transitionDuration = 1200,
  fontFamily,
  fontOpacity = 1,
  fontSize = 18,
  canReply = false,
  blowAway = false,
  onItemClick,
  onItemDoubleClick,
  onInputSubmit,
  onReply,
  onClose,
  onBlowAwayComplete,
}) => {
  const durationSec = transitionDuration / 1000;
  const [inputValue, setInputValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSent, setShowSent] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (item?.type === 'input' && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 500);
    }
    setShowSent(false);
    setInputValue('');
  }, [item]);

  const handleSubmit = async () => {
    if (!inputValue.trim() || isSubmitting) return;
    setIsSubmitting(true);
    onInputSubmit?.(inputValue.trim());
    setShowSent(true);
    setInputValue('');
    setIsSubmitting(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-20 pointer-events-none">
      <style>{floatKeyframes}</style>
      <AnimatePresence mode="sync">
        {item && (
          <motion.div
            key={item.id}
            className="absolute pointer-events-auto cursor-pointer"
            initial={{ opacity: 0, scale: 0.9, filter: 'blur(20px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.95, filter: 'blur(15px)' }}
            transition={{ duration: durationSec, ease: [0.25, 0.46, 0.45, 0.94] }}
            onClick={() => onItemClick?.(item)}
            onDoubleClick={() => onItemDoubleClick?.(item)}
          >
            {/* Text content - floating directly on starfield, no card */}
            {item.type === 'text' && (
              <div className="w-[60vw] max-w-lg p-8">
                <p
                  className="leading-relaxed italic text-center"
                  style={{
                    fontFamily: item._fontFamily || fontFamily || 'inherit',
                    color: `rgba(255, 255, 255, ${fontOpacity})`,
                    fontSize: `${item._fontSize || fontSize}px`,
                    textShadow: '0 0 20px rgba(0,0,0,0.5)',
                  }}
                >
                  {blowAway ? (
                    <BlowAwayText text={`"${item.content || ''}"`} onComplete={onBlowAwayComplete} />
                  ) : (
                    <>
                      "<FloatingText text={item.content || ''} />"
                    </>
                  )}
                </p>
                {!blowAway && canReply && onReply && (
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.4 }}
                    whileHover={{ opacity: 0.8 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onReply(item);
                    }}
                    className="mt-6 text-white/40 text-sm tracking-widest hover:text-white/70 transition-colors block mx-auto"
                    style={{ fontFamily: "'Tango', sans-serif" }}
                  >
                    reply ↩
                  </motion.button>
                )}
              </div>
            )}

            {/* Image content - with card wrapper */}
            {item.type === 'image' && (
              <div
                className="relative overflow-hidden rounded-lg"
                style={{ boxShadow: '0 0 60px rgba(255,255,255,0.08), 0 30px 80px rgba(0,0,0,0.5)' }}
              >
                <img
                  src={item.src}
                  alt={item.alt || item.title || 'Image'}
                  className="max-w-[80vw] max-h-[70vh] object-contain"
                  draggable={false}
                />
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ boxShadow: 'inset 0 0 40px rgba(255,255,255,0.05)' }}
                />
              </div>
            )}

            {/* Input content - transparent, floating on starfield */}
            {item.type === 'input' && (
              <div className="w-[70vw] max-w-xl p-8">
                {showSent ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-8"
                  >
                    <p
                      className="text-white/70 text-2xl tracking-widest mb-3"
                      style={{ fontFamily: "'Tango', sans-serif" }}
                    >
                      <FloatingText text="released" /> ✧
                    </p>
                    <p
                      className="text-white/40 text-base"
                      style={{ fontFamily: "'Tango', sans-serif" }}
                    >
                      <FloatingText text="your words drift among the stars" />
                    </p>
                  </motion.div>
                ) : (
                  <>
                    {item.quotedContent && (
                      <div className="mb-6 pb-4">
                        <div
                          className="text-white/40 text-sm mb-2 tracking-wider"
                          style={{ fontFamily: "'Tango', sans-serif" }}
                        >
                          replying to:
                        </div>
                        <blockquote
                          className="text-white/50 text-base italic pl-4"
                          style={{
                            fontFamily: "'Tango', sans-serif",
                            borderLeft: '2px solid rgba(255,255,255,0.2)',
                          }}
                        >
                          "{truncateQuote(item.quotedContent)}"
                        </blockquote>
                      </div>
                    )}
                    <textarea
                      ref={textareaRef}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={item.quotedContent ? 'your reply...' : (item.placeholder || 'write something...')}
                      className="w-full bg-transparent border-none outline-none resize-none leading-relaxed placeholder:text-white/25 text-center"
                      style={{
                        fontFamily: "'Tango', sans-serif",
                        color: `rgba(255, 255, 255, ${fontOpacity})`,
                        fontSize: '24px',
                        minHeight: item.quotedContent ? '80px' : '120px',
                        caretColor: 'rgba(255, 255, 255, 0.7)',
                      }}
                      maxLength={500}
                      disabled={isSubmitting}
                    />
                    <div
                      className="flex items-center justify-center gap-6 mt-6"
                      style={{ fontFamily: "'Tango', sans-serif" }}
                    >
                      {onClose && (
                        <motion.button
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 0.3 }}
                          whileHover={{ opacity: 0.7 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                          }}
                          className="text-white/30 text-sm tracking-widest hover:text-white/60 transition-colors"
                        >
                          ← back
                        </motion.button>
                      )}
                      <div className="text-white/30 text-sm">
                        <span className={inputValue.length > 450 ? 'text-yellow-500/60' : ''}>
                          {inputValue.length}
                        </span>
                        /500
                      </div>
                      {inputValue.trim() && (
                        <motion.button
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 0.5 }}
                          whileHover={{ opacity: 0.9 }}
                          onClick={handleSubmit}
                          disabled={isSubmitting}
                          className="text-white/50 text-sm tracking-widest hover:text-white transition-colors"
                        >
                          {isSubmitting ? '...' : '⌘↵ release'}
                        </motion.button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Custom render */}
            {item.type === 'custom' && item.render && item.render()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SingleView;
