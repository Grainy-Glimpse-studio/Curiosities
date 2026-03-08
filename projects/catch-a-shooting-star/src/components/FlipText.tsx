import React, { useEffect, useRef, useCallback } from 'react';

interface FlipTextProps {
  frontText: string;
  backText?: string;
  fontFamily?: string;
  fontSize?: number;
  backFontFamily?: string;  // Font for back side (translation)
  backFontSize?: number;    // Font size for back side
  fontOpacity?: number;
  glowEnabled?: boolean;
  glowPosition?: { x: number; y: number } | null;
  glowRadius?: number;
  isFlipped?: boolean;
  onFlip?: () => void;
  transitionDuration?: number;
  className?: string;
  style?: React.CSSProperties;
}

const FlipText: React.FC<FlipTextProps> = ({
  frontText,
  backText,
  fontFamily = "'Tango', sans-serif",
  fontSize = 24,
  backFontFamily,  // Defaults to fontFamily if not provided
  backFontSize,    // Defaults to fontSize if not provided
  fontOpacity = 1,
  glowEnabled = false,
  glowPosition = null,
  glowRadius = 200,
  isFlipped = false,
  transitionDuration = 2000,
  className = '',
  style = {},
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);

  // Use refs to track state without causing re-renders
  const showBackRef = useRef(false);
  const isAnimatingRef = useRef(false);
  const animationRef = useRef<number | null>(null);
  const prevFlippedRef = useRef(isFlipped);

  // Set initial opacity on mount and when text changes
  useEffect(() => {
    const frontChars = frontRef.current?.querySelectorAll('.flip-char');
    const backChars = backRef.current?.querySelectorAll('.flip-char');

    frontChars?.forEach((span) => {
      const el = span as HTMLElement;
      el.style.opacity = showBackRef.current ? '0' : '1';
    });
    backChars?.forEach((span) => {
      const el = span as HTMLElement;
      el.style.opacity = showBackRef.current ? '1' : '0';
    });
  }, [frontText, backText]);

  const startAnimation = useCallback(() => {
    if (isAnimatingRef.current || !backText) return;

    isAnimatingRef.current = true;
    const startTime = Date.now();
    const duration = transitionDuration;
    const goingToBack = !showBackRef.current;
    const direction = goingToBack ? -1 : 1; // -1 = up, 1 = down

    // Set initial state for the layer that will appear
    const appearingChars = goingToBack
      ? backRef.current?.querySelectorAll('.flip-char')
      : frontRef.current?.querySelectorAll('.flip-char');
    appearingChars?.forEach((span) => {
      const el = span as HTMLElement;
      el.style.opacity = '0';
    });

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / duration);

      const frontChars = frontRef.current?.querySelectorAll('.flip-char');
      const backChars = backRef.current?.querySelectorAll('.flip-char');

      // Determine which layer is fading out and which is fading in
      const fadingOutChars = goingToBack ? frontChars : backChars;
      const fadingInChars = goingToBack ? backChars : frontChars;

      // Layer fading out: wave animation
      if (fadingOutChars) {
        const centerIndex = Math.floor(fadingOutChars.length / 2);
        fadingOutChars.forEach((span, i) => {
          const el = span as HTMLElement;
          const distFromCenter = Math.abs(i - centerIndex);
          const delay = distFromCenter * 0.04;
          const charProgress = Math.max(0, Math.min(1, (progress - delay) / 0.5));
          const eased = charProgress * charProgress;

          el.style.opacity = String(1 - eased);
          el.style.transform = `translateY(${eased * 18 * direction}px) scale(${1 - eased * 0.25})`;
          el.style.filter = `blur(${eased * 3}px)`;
        });
      }

      // Layer fading in: wave animation (delayed start)
      if (fadingInChars) {
        const centerIndex = Math.floor(fadingInChars.length / 2);
        fadingInChars.forEach((span, i) => {
          const el = span as HTMLElement;
          const distFromCenter = Math.abs(i - centerIndex);
          const delay = 0.25 + distFromCenter * 0.04;
          const charProgress = Math.max(0, Math.min(1, (progress - delay) / 0.5));
          const eased = 1 - Math.pow(1 - charProgress, 3);

          el.style.opacity = String(eased);
          el.style.transform = `translateY(${(1 - eased) * 18 * -direction}px) scale(${0.75 + eased * 0.25})`;
          el.style.filter = `blur(${(1 - eased) * 3}px)`;
        });
      }

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // Animation done - set final state
        fadingOutChars?.forEach((span) => {
          const el = span as HTMLElement;
          el.style.opacity = '0';
          el.style.transform = '';
          el.style.filter = '';
        });
        fadingInChars?.forEach((span) => {
          const el = span as HTMLElement;
          el.style.opacity = '1';
          el.style.transform = '';
          el.style.filter = '';
        });

        // Update the ref (no re-render needed)
        showBackRef.current = goingToBack;
        isAnimatingRef.current = false;
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  }, [backText, transitionDuration]);

  // Handle external flip trigger
  useEffect(() => {
    console.log('FlipText: isFlipped changed', {
      isFlipped,
      prev: prevFlippedRef.current,
      hasBackText: !!backText,
      isAnimating: isAnimatingRef.current,
      showBack: showBackRef.current
    });
    if (isFlipped !== prevFlippedRef.current) {
      prevFlippedRef.current = isFlipped;
      if (!isAnimatingRef.current && backText) {
        console.log('FlipText: Starting animation!', { goingToBack: !showBackRef.current });
        startAnimation();
      } else {
        console.log('FlipText: Animation blocked', { isAnimating: isAnimatingRef.current, hasBackText: !!backText });
      }
    } else {
      console.log('FlipText: No change needed (isFlipped === prev)');
    }
  }, [isFlipped, backText, startAnimation]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Glow effect
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

  useEffect(() => {
    if (!glowEnabled || !glowPosition || isAnimatingRef.current) return;

    const activeRef = showBackRef.current ? backRef : frontRef;
    if (!activeRef.current) return;

    const chars = activeRef.current.querySelectorAll('.flip-char');
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
  }, [glowEnabled, glowPosition, glowRadius, fontOpacity, getCharGlow]);

  const renderChars = (text: string) => {
    return text.split('').map((char, i) => (
      <span
        key={i}
        className="flip-char inline-block"
        style={{
          color: `rgba(255, 255, 255, ${fontOpacity * 0.7})`,
        }}
      >
        {char === ' ' ? '\u00A0' : char}
      </span>
    ));
  };

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      style={{
        fontFamily,
        fontSize: `${fontSize}px`,
        fontStyle: 'italic',
        ...style,
      }}
    >
      <div ref={frontRef} className="text-center">
        {renderChars(frontText)}
      </div>
      {backText && (
        <div
          ref={backRef}
          className="absolute inset-0 text-center"
          style={{
            fontFamily: backFontFamily || fontFamily,
            fontSize: `${backFontSize || fontSize}px`,
          }}
        >
          {renderChars(backText)}
        </div>
      )}
    </div>
  );
};

export default FlipText;
