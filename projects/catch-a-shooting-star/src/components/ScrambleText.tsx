import React, { useEffect, useRef, useState, useCallback } from 'react';

interface ScrambleTextProps {
  frontText: string;
  backText?: string;
  fontFamily?: string;
  fontSize?: number;
  backFontFamily?: string;
  backFontSize?: number;
  fontOpacity?: number;
  glowEnabled?: boolean;
  glowPosition?: { x: number; y: number } | null;
  glowRadius?: number;
  isFlipped?: boolean;
  onFlip?: () => void;
  scrambleDuration?: number; // Total duration in ms
  className?: string;
  style?: React.CSSProperties;
}

// Characters to use for scrambling - mix of symbols and letters
const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&*~+=<>?/\\|';
const CHINESE_CHARS = '星月夜空光梦幻想风云雨雪花落叶飞舞影色彩虹霞辉闪烁璀璨银河宇宙天地山水';

const ScrambleText: React.FC<ScrambleTextProps> = ({
  frontText,
  backText,
  fontFamily = "'Tango', sans-serif",
  fontSize = 24,
  backFontFamily,
  backFontSize,
  fontOpacity = 1,
  glowEnabled = false,
  glowPosition = null,
  glowRadius = 200,
  isFlipped = false,
  scrambleDuration = 2000,
  className = '',
  style = {},
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [displayText, setDisplayText] = useState(frontText);
  const [currentFont, setCurrentFont] = useState(fontFamily);
  const [currentFontSize, setCurrentFontSize] = useState(fontSize);
  const isAnimatingRef = useRef(false);
  const prevFlippedRef = useRef(isFlipped);
  const animationRef = useRef<number | null>(null);

  // Detect if text contains Chinese characters
  const hasChinese = useCallback((text: string) => {
    return /[\u4e00-\u9fff]/.test(text);
  }, []);

  // Get scramble character based on target text
  const getScrambleChar = useCallback((targetChar: string) => {
    if (targetChar === ' ' || targetChar === '"' || targetChar === '"' || targetChar === '"') {
      return targetChar;
    }
    if (hasChinese(targetChar)) {
      return CHINESE_CHARS[Math.floor(Math.random() * CHINESE_CHARS.length)];
    }
    return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
  }, [hasChinese]);


  // Update display when texts change (without animation)
  useEffect(() => {
    if (!isAnimatingRef.current) {
      const showBack = prevFlippedRef.current && backText;
      setDisplayText(showBack ? backText : frontText);
      setCurrentFont(showBack ? (backFontFamily || fontFamily) : fontFamily);
      setCurrentFontSize(showBack ? (backFontSize || fontSize) : fontSize);
    }
  }, [frontText, backText, fontFamily, fontSize, backFontFamily, backFontSize]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Glow effect calculation
  const getCharGlow = useCallback((element: HTMLElement): number => {
    if (!glowEnabled || !glowPosition) return 0;
    const rect = element.getBoundingClientRect();
    const charCenterX = rect.left + rect.width / 2;
    const charCenterY = rect.top + rect.height / 2;
    const distance = Math.sqrt(
      Math.pow(glowPosition.x - charCenterX, 2) +
      Math.pow(glowPosition.y - charCenterY, 2)
    );
    if (distance > glowRadius) return 0;
    return 1 - (distance / glowRadius);
  }, [glowEnabled, glowPosition, glowRadius]);

  // Apply glow effect
  useEffect(() => {
    if (!glowEnabled || !glowPosition || !containerRef.current) return;

    const chars = containerRef.current.querySelectorAll('.scramble-char');
    chars.forEach((char) => {
      const el = char as HTMLElement;
      const glow = getCharGlow(el);
      const baseOpacity = fontOpacity * 0.7;
      const glowOpacity = baseOpacity + glow * 0.3;

      el.style.color = `rgba(255, 255, 255, ${glow > 0.1 ? glowOpacity : baseOpacity})`;
      el.style.textShadow = glow > 0.1
        ? `0 0 ${8 + glow * 35}px rgba(255, 255, 255, ${0.05 + glow * 0.5})`
        : 'none';
    });
  }, [glowEnabled, glowPosition, glowRadius, fontOpacity, getCharGlow, displayText]);

  const baseOpacity = fontOpacity * 0.7;

  // Animation progress for opacity/blur effect (0 = start/end, 1 = middle)
  const [animProgress, setAnimProgress] = useState(0);

  // Calculate opacity and blur based on progress
  // Progress 0 -> 0.5: fade out (1 -> 0.3), blur up (0 -> 6px)
  // Progress 0.5 -> 1: fade in (0.3 -> 1), blur down (6px -> 0)
  const getOpacityMultiplier = (progress: number) => {
    if (progress <= 0.5) {
      // Fade out: 1 -> 0.3
      return 1 - (progress * 2) * 0.7;
    } else {
      // Fade in: 0.3 -> 1
      return 0.3 + ((progress - 0.5) * 2) * 0.7;
    }
  };

  const getBlurAmount = (progress: number) => {
    if (progress <= 0.5) {
      // Blur up: 0 -> 5px
      return (progress * 2) * 5;
    } else {
      // Blur down: 5px -> 0
      return (1 - (progress - 0.5) * 2) * 5;
    }
  };

  const opacityMultiplier = getOpacityMultiplier(animProgress);
  const blurAmount = getBlurAmount(animProgress);

  // Update startScramble to also track animation progress
  const startScrambleWithEffects = useCallback((targetText: string, targetFont: string, targetFontSize: number) => {
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;

    const startTime = Date.now();
    const sourceText = displayText;
    const maxLen = Math.max(sourceText.length, targetText.length);

    // Transition font at midpoint
    let fontTransitioned = false;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / scrambleDuration);

      // Update animation progress for opacity/blur
      setAnimProgress(progress);

      // Transition font at midpoint
      if (!fontTransitioned && progress >= 0.5) {
        fontTransitioned = true;
        setCurrentFont(targetFont);
        setCurrentFontSize(targetFontSize);
      }

      // Each character reveals at different times
      const chars: string[] = [];

      for (let i = 0; i < maxLen; i++) {
        const targetChar = targetText[i] || '';
        const charRevealProgress = (progress - (i / maxLen) * 0.3) / 0.7;

        if (charRevealProgress >= 1) {
          chars.push(targetChar);
        } else if (charRevealProgress > 0) {
          if (Math.random() < charRevealProgress * 0.4) {
            chars.push(targetChar);
          } else {
            chars.push(getScrambleChar(targetChar));
          }
        } else {
          if (i < sourceText.length) {
            chars.push(getScrambleChar(sourceText[i]));
          } else {
            chars.push(getScrambleChar(targetChar));
          }
        }
      }

      setDisplayText(chars.join(''));

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayText(targetText);
        setAnimProgress(0); // Reset to full opacity
        isAnimatingRef.current = false;
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  }, [displayText, scrambleDuration, getScrambleChar]);

  // Handle flip trigger - use the new function
  useEffect(() => {
    if (isFlipped !== prevFlippedRef.current) {
      prevFlippedRef.current = isFlipped;

      if (!isAnimatingRef.current && backText) {
        const showBack = isFlipped;
        const targetText = showBack ? backText : frontText;
        const targetFont = showBack ? (backFontFamily || fontFamily) : fontFamily;
        const targetFontSize = showBack ? (backFontSize || fontSize) : fontSize;
        startScrambleWithEffects(targetText, targetFont, targetFontSize);
      }
    }
  }, [isFlipped, backText, frontText, fontFamily, fontSize, backFontFamily, backFontSize, startScrambleWithEffects]);

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      style={{
        fontFamily: currentFont,
        fontSize: `${currentFontSize}px`,
        fontStyle: 'italic',
        filter: blurAmount > 0 ? `blur(${blurAmount}px)` : 'none',
        transition: 'filter 0.1s ease-out',
        ...style,
      }}
    >
      <div className="text-center">
        {displayText.split('').map((char, i) => (
          <span
            key={i}
            className="scramble-char inline-block"
            style={{
              color: `rgba(255, 255, 255, ${baseOpacity * opacityMultiplier})`,
            }}
          >
            {char === ' ' ? '\u00A0' : char}
          </span>
        ))}
      </div>
    </div>
  );
};

export default ScrambleText;
