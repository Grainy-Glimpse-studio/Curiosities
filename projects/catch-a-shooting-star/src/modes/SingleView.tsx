import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ContentItem } from '../types';
import type { ExtendedContentItem } from '../utils/quotesLoader';
import { isChinese, getRandomFont, getRandomFontForText, type FontConfig } from '../utils/fonts';
import ScrambleText from '../components/ScrambleText';
import VerticalText from '../components/VerticalText';
import type { VerticalLayoutType } from '../utils/quotesLoader';

// Helper to check if an item is a guestbook message
const isGuestbookMessage = (id: string | number): boolean =>
  typeof id === 'string' && id.startsWith('guestbook-');

// Random vertical layout for guestbook messages (not poetry, since they're not poems)
const getRandomGuestbookLayout = (): VerticalLayoutType => {
  return Math.random() < 0.5 ? 'prose-staggered' : 'prose-mixed';
};

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

// Blow away animation - gentle sway and dissolve
const BlowAwayText: React.FC<{
  text: string;
  style?: React.CSSProperties;
  className?: string;
  onComplete?: () => void;
  initialOpacity?: number; // Match the floating text opacity
}> = ({ text, style, className, onComplete, initialOpacity = 0.7 }) => {
  const chars = text.split('');
  const [isAnimating, setIsAnimating] = React.useState(true);

  // Animation timing constants
  const CHAR_DELAY = 0.04; // seconds per character
  const ANIM_DURATION = 3; // seconds for each character's animation

  // Calculate total duration based on character count
  const lastCharDelay = chars.length * CHAR_DELAY;
  const totalDuration = (lastCharDelay + ANIM_DURATION + 0.5) * 1000; // +0.5s buffer

  // Generate random sway values once on mount
  const swayValues = React.useMemo(() =>
    chars.map(() => ({
      // Initial Y offset to match FloatingText's floating position (0 to -2px)
      initY: -Math.random() * 2,
      sway1: (Math.random() - 0.5) * 3,
      sway2: (Math.random() - 0.5) * 4,
      sway3: (Math.random() - 0.5) * 5,
      sway4: (Math.random() - 0.5) * 6,
    })), [chars.length]
  );

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsAnimating(false);
      onComplete?.();
    }, totalDuration);
    return () => clearTimeout(timer);
  }, [onComplete, totalDuration]);

  if (!isAnimating) return null;

  return (
    <span className={className} style={style}>
      {chars.map((char, i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            willChange: 'transform, opacity',
            animation: `swayDissolve ${ANIM_DURATION}s ease-in-out ${i * CHAR_DELAY}s forwards`,
            opacity: initialOpacity, // Start at same opacity as floating text
            '--init-y': `${swayValues[i].initY}px`,
            '--sway1': `${swayValues[i].sway1}px`,
            '--sway2': `${swayValues[i].sway2}px`,
            '--sway3': `${swayValues[i].sway3}px`,
            '--sway4': `${swayValues[i].sway4}px`,
          } as React.CSSProperties}
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
      <style>{`
        @keyframes swayDissolve {
          0% {
            transform: translateX(0) translateY(var(--init-y));
            opacity: ${initialOpacity};
          }
          15% {
            transform: translateX(var(--sway1)) translateY(-1px);
            opacity: ${initialOpacity * 0.95};
          }
          35% {
            transform: translateX(var(--sway2)) translateY(0);
            opacity: ${initialOpacity * 0.8};
          }
          55% {
            transform: translateX(var(--sway3)) translateY(-2px);
            opacity: ${initialOpacity * 0.55};
          }
          75% {
            transform: translateX(var(--sway3)) translateY(-4px);
            opacity: ${initialOpacity * 0.3};
          }
          100% {
            transform: translateX(var(--sway4)) translateY(-8px);
            opacity: 0;
            filter: blur(1px);
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
  isFlipped?: boolean; // Translation flip state
  onFlip?: () => void; // Callback when flipped via keyboard
  palmPosition?: { x: number; y: number } | null; // Palm position for glow effect
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
  isFlipped = false,
  onFlip,
  palmPosition,
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

  // Track detected language and selected font for input
  const [detectedLanguage, setDetectedLanguage] = useState<'chinese' | 'english' | null>(null);
  const [inputFont, setInputFont] = useState<FontConfig | null>(null);

  // Generate random font for back side (translation or same content with different font)
  const translationFont = useMemo(() => {
    // If there's a translation, use its language for font selection
    if (item?._translation) {
      const lang = isChinese(item._translation) ? 'chinese' : 'english';
      return getRandomFont(lang);
    }
    // If no translation, still generate a random font for the original content
    // This allows Tab to change font even when user language = quote language
    if (item?.content) {
      const lang = isChinese(item.content) ? 'chinese' : 'english';
      return getRandomFont(lang);
    }
    return null;
  }, [item?.id, item?._translation, item?.content]);

  // Generate random font and layout for guestbook messages
  const guestbookConfig = useMemo(() => {
    if (!item?.id || !isGuestbookMessage(item.id) || !item.content) {
      return null;
    }
    const font = getRandomFontForText(item.content);
    const isChineseContent = isChinese(item.content);
    return {
      font,
      fontFamily: `'${font.name}', sans-serif`,
      isChineseContent,
      verticalLayout: isChineseContent ? getRandomGuestbookLayout() : null,
    };
  }, [item?.id, item?.content]);

  // Format font name to CSS font-family (consistent with item._fontFamily format)
  const formatFontFamily = (fontName: string): string => {
    return `'${fontName}', sans-serif`;
  };

  // Pre-computed CSS font-family for translation
  const translationFontCSS = translationFont
    ? formatFontFamily(translationFont.name)
    : undefined;

  useEffect(() => {
    if (item?.type === 'input' && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 500);
    }
    setShowSent(false);
    setInputValue('');
    setDetectedLanguage(null);
    setInputFont(null);
  }, [item]);

  // Keyboard shortcuts: Tab to flip, Escape to close
  const lastTabRef = useRef(0);

  useEffect(() => {
    if (!item || blowAway) return;

    const TAB_COOLDOWN = 2500; // ms - match animation duration

    const handleKeyDown = (e: KeyboardEvent) => {
      // Tab to flip translation (text content only)
      if (e.key === 'Tab' && item.type === 'text') {
        e.preventDefault();
        const now = Date.now();
        if (now - lastTabRef.current < TAB_COOLDOWN) return;
        lastTabRef.current = now;
        onFlip?.();
      }
      // Escape to close any content
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [item, blowAway, onFlip, onClose]);

  // Mouse swipe detection for translation flip (keyboard mode)
  const swipeRef = useRef<{
    startX: number | null;
    startTime: number | null;
    lastTrigger: number;
  }>({ startX: null, startTime: null, lastTrigger: 0 });

  useEffect(() => {
    if (!item || item.type !== 'text' || blowAway || isFlipped === undefined) return;

    const SWIPE_DISTANCE = 100; // pixels
    const SWIPE_TIMEOUT = 500; // ms
    const COOLDOWN = 2500; // ms - wait for animation to complete before allowing another swipe

    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      const swipe = swipeRef.current;

      // Cooldown after triggering
      if (now - swipe.lastTrigger < COOLDOWN) return;

      if (swipe.startX === null) {
        swipe.startX = e.clientX;
        swipe.startTime = now;
        return;
      }

      // Reset if too much time passed
      if (swipe.startTime && now - swipe.startTime > SWIPE_TIMEOUT) {
        swipe.startX = e.clientX;
        swipe.startTime = now;
        return;
      }

      // Check swipe distance
      const distance = Math.abs(e.clientX - swipe.startX);
      if (distance >= SWIPE_DISTANCE && swipe.startTime) {
        onFlip?.();
        // Reset and set cooldown
        swipe.startX = null;
        swipe.startTime = null;
        swipe.lastTrigger = now;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      swipeRef.current = { startX: null, startTime: null, lastTrigger: 0 };
    };
  }, [item, blowAway, isFlipped, onFlip]);

  // Detect language and set font when input changes
  const handleInputChange = (value: string) => {
    setInputValue(value);

    // If empty, reset
    if (!value.trim()) {
      setDetectedLanguage(null);
      setInputFont(null);
      return;
    }

    // Detect language from content
    const hasChinese = isChinese(value);
    const newLanguage = hasChinese ? 'chinese' : 'english';

    // Only change font if language changed or no font set yet
    if (newLanguage !== detectedLanguage) {
      setDetectedLanguage(newLanguage);
      setInputFont(getRandomFont(newLanguage));
    }
  };

  // Check if content has meaningful characters (not just punctuation/spaces)
  const hasMeaningfulContent = (text: string): boolean => {
    // Remove all whitespace and common punctuation
    const cleaned = text.replace(/[\s.,。，、！!?？…·\-_—–''""\"\'`~～@#$%^&*()（）\[\]【】{}｛｝<>《》/\\|｜:：;；+=]+/g, '');
    return cleaned.length > 0;
  };

  const handleSubmit = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || !hasMeaningfulContent(trimmed) || isSubmitting) return;
    setIsSubmitting(true);
    onInputSubmit?.(trimmed);
    setShowSent(true);
    setInputValue('');
    setIsSubmitting(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
    // Note: Escape is handled by the global keyboard handler
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
                {(() => {
                  // Check if this is a guestbook message
                  const isGuestbook = isGuestbookMessage(item.id);

                  // Cast to ExtendedContentItem to access vertical layout properties
                  const extItem = item as ExtendedContentItem;
                  const hasVerticalLayout = extItem._verticalLayout && extItem._verticalLayout !== 'none';

                  // Determine what to show based on flip state
                  const showTranslation = isFlipped && extItem._translation;
                  const displayText = showTranslation ? extItem._translation! : (item.content || '');
                  // Only switch to translation metadata if we actually have a translation
                  const displayMeta = (showTranslation && extItem._translationMeta)
                    ? extItem._translationMeta
                    : item.title;
                  const displaySegments = showTranslation ? extItem._translationSegments : extItem._segments;

                  // Check if current display should be vertical (translation might be in different language)
                  const shouldShowVertical = hasVerticalLayout && !showTranslation;
                  // For translation, check if it has segments (meaning it's also CJK)
                  const translationIsVertical = showTranslation && extItem._translationSegments;

                  // For guestbook messages, use guestbookConfig for font and layout
                  const guestbookFontFamily = guestbookConfig?.fontFamily;
                  const guestbookFontSize = guestbookConfig?.font.size;
                  const guestbookVerticalLayout = guestbookConfig?.verticalLayout;

                  if (blowAway) {
                    return (
                      <p
                        className="leading-relaxed italic text-center"
                        style={{
                          fontFamily: guestbookFontFamily || item._fontFamily || fontFamily || 'inherit',
                          color: `rgba(255, 255, 255, ${fontOpacity})`,
                          fontSize: `${guestbookFontSize || item._fontSize || fontSize}px`,
                          textShadow: '0 0 20px rgba(0,0,0,0.5)',
                          minHeight: '1.5em',
                        }}
                      >
                        <BlowAwayText text={`"${item.content || ''}"`} onComplete={onBlowAwayComplete} initialOpacity={fontOpacity * 0.7} />
                      </p>
                    );
                  }

                  // Guestbook messages with Chinese content: use VerticalText
                  if (isGuestbook && guestbookVerticalLayout) {
                    return (
                      <motion.div
                        initial={{ opacity: 0, filter: 'blur(10px)' }}
                        animate={{ opacity: 1, filter: 'blur(0px)' }}
                        transition={{ duration: 0.8 }}
                      >
                        <VerticalText
                          text={displayText}
                          meta={displayMeta}
                          layout={guestbookVerticalLayout}
                          fontSize={guestbookFontSize || fontSize || 24}
                          fontFamily={guestbookFontFamily || fontFamily}
                          className="flex justify-center"
                        />
                      </motion.div>
                    );
                  }

                  // Guestbook messages with English content: use ScrambleText
                  if (isGuestbook) {
                    return (
                      <div className="flex flex-col items-center">
                        <ScrambleText
                          frontText={`"${item.content || ''}"`}
                          fontFamily={guestbookFontFamily || fontFamily || 'inherit'}
                          fontSize={guestbookFontSize || fontSize}
                          fontOpacity={fontOpacity}
                          decodeOnMount={true}
                          scrambleDuration={1500}
                          className="leading-relaxed text-center"
                          style={{
                            textShadow: '0 0 20px rgba(0,0,0,0.5)',
                            minHeight: '1.5em',
                          }}
                        />
                        {/* Metadata display */}
                        {displayMeta && (
                          <div
                            className="mt-6 text-white/50 text-sm tracking-wider text-center"
                            style={{ fontFamily: guestbookFontFamily || fontFamily || 'inherit' }}
                          >
                            {displayMeta}
                          </div>
                        )}
                      </div>
                    );
                  }

                  // Use VerticalText for CJK content with vertical layout
                  if (shouldShowVertical || translationIsVertical) {
                    return (
                      <motion.div
                        key={isFlipped ? 'back' : 'front'}
                        initial={{ opacity: 0, filter: 'blur(10px)' }}
                        animate={{ opacity: 1, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, filter: 'blur(10px)' }}
                        transition={{ duration: 0.8 }}
                      >
                        <VerticalText
                          text={displayText}
                          segments={displaySegments}
                          meta={displayMeta}
                          layout={extItem._verticalLayout!}
                          fontSize={item._fontSize || fontSize || 24}
                          fontFamily={item._fontFamily || fontFamily}
                          className="flex justify-center"
                        />
                      </motion.div>
                    );
                  }

                  // For vertical CJK original with horizontal translation, use ScrambleText decode
                  if (hasVerticalLayout && showTranslation) {
                    return (
                      <div
                        key="translation-horizontal"
                        className="flex flex-col items-center"
                      >
                        <ScrambleText
                          frontText={`"${displayText}"`}
                          fontFamily={translationFontCSS || item._fontFamily || fontFamily || 'inherit'}
                          fontSize={translationFont?.size || item._fontSize || fontSize}
                          fontOpacity={fontOpacity}
                          decodeOnMount={true}
                          scrambleDuration={2500}
                          className="leading-relaxed text-center"
                          style={{
                            textShadow: '0 0 20px rgba(0,0,0,0.5)',
                            minHeight: '1.5em',
                          }}
                        />
                        {displayMeta && (
                          <div
                            className="mt-6 text-white/50 text-sm tracking-wider text-center"
                            style={{ fontFamily: translationFontCSS || item._fontFamily || fontFamily || 'inherit' }}
                          >
                            {displayMeta}
                          </div>
                        )}
                      </div>
                    );
                  }

                  // Use ScrambleText for horizontal text (English, etc.)
                  return (
                    <div className="flex flex-col items-center">
                      <ScrambleText
                        frontText={`"${item.content || ''}"`}
                        backText={item._translation ? `"${item._translation}"` : `"${item.content || ''}"`}
                        fontFamily={item._fontFamily || fontFamily || 'inherit'}
                        fontSize={item._fontSize || fontSize}
                        backFontFamily={translationFontCSS}
                        backFontSize={translationFont?.size}
                        fontOpacity={fontOpacity}
                        isFlipped={isFlipped}
                        onFlip={onFlip}
                        glowEnabled={!!palmPosition}
                        glowPosition={palmPosition}
                        glowRadius={200}
                        scrambleDuration={1500}
                        className="leading-relaxed text-center"
                        style={{
                          textShadow: '0 0 20px rgba(0,0,0,0.5)',
                          minHeight: '1.5em',
                        }}
                      />
                      {/* Metadata display */}
                      {displayMeta && (
                        <div
                          className="mt-6 text-white/50 text-sm tracking-wider text-center"
                          style={{
                            fontFamily: isFlipped
                              ? (translationFontCSS || item._fontFamily || fontFamily || 'inherit')
                              : (item._fontFamily || fontFamily || 'inherit')
                          }}
                        >
                          {displayMeta}
                        </div>
                      )}
                    </div>
                  );
                })()}
                {/* Reply button - use visibility to prevent layout shift */}
                {canReply && onReply && (
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: blowAway ? 0 : 0.5 }}
                    whileHover={{ opacity: blowAway ? 0 : 0.9 }}
                    onClick={(e) => {
                      if (blowAway) return;
                      e.stopPropagation();
                      onReply(item);
                    }}
                    className="mt-8 text-white transition-colors block mx-auto"
                    style={{
                      fontFamily: "'Tango', sans-serif",
                      fontSize: '16px',
                      pointerEvents: blowAway ? 'none' : 'auto',
                    }}
                  >
                    reply
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
                      className="text-white/60 text-2xl mb-4"
                      style={{ fontFamily: "'Tango', sans-serif" }}
                    >
                      <FloatingText text="released" />
                    </p>
                    <p
                      className="text-white/40 text-lg"
                      style={{ fontFamily: "'Tango', sans-serif" }}
                    >
                      <FloatingText text="your words drift among the stars" />
                    </p>
                  </motion.div>
                ) : (
                  <>
                    {item.quotedContent && (
                      <div className="mb-6 pb-4">
                        <blockquote
                          className="text-white/40 text-base italic pl-4"
                          style={{
                            fontFamily: "'Tango', sans-serif",
                            borderLeft: '2px solid rgba(255,255,255,0.15)',
                          }}
                        >
                          "{truncateQuote(item.quotedContent)}"
                        </blockquote>
                      </div>
                    )}
                    <textarea
                      ref={textareaRef}
                      value={inputValue}
                      onChange={(e) => handleInputChange(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={item.quotedContent ? 'your reply...' : (item.placeholder || 'write something...')}
                      className="w-full bg-transparent border-none outline-none resize-none leading-relaxed placeholder:text-white/25 text-center"
                      style={{
                        fontFamily: inputFont ? `'${inputFont.name}', sans-serif` : "'Tango', sans-serif",
                        color: `rgba(255, 255, 255, ${fontOpacity})`,
                        fontSize: inputFont ? `${inputFont.size}px` : '24px',
                        minHeight: item.quotedContent ? '80px' : '120px',
                        caretColor: 'rgba(255, 255, 255, 0.7)',
                      }}
                      maxLength={500}
                      disabled={isSubmitting}
                    />
                    <div
                      className="flex items-center justify-center gap-8 mt-8"
                      style={{ fontFamily: "'Tango', sans-serif", fontSize: '16px' }}
                    >
                      {onClose && (
                        <motion.button
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 0.4 }}
                          whileHover={{ opacity: 0.9 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                          }}
                          className="text-white transition-colors"
                        >
                          back
                        </motion.button>
                      )}
                      <div className="text-white/30">
                        <span className={inputValue.length > 450 ? 'text-yellow-500/50' : ''}>
                          {inputValue.length}
                        </span>
                        /500
                      </div>
                      {inputValue.trim() && hasMeaningfulContent(inputValue) && (
                        <motion.button
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 0.5 }}
                          whileHover={{ opacity: 0.9 }}
                          onClick={handleSubmit}
                          disabled={isSubmitting}
                          className="text-white transition-colors"
                        >
                          {isSubmitting ? '...' : 'send'}
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
