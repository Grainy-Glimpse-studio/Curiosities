import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { InteractionMode, KeyboardScheme } from '../types';

// Floating animation keyframes
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

// Component to render text with each character floating independently
const FloatingText: React.FC<{
  text: string;
  style?: React.CSSProperties;
  className?: string;
}> = ({ text, style, className }) => {
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

// Direction the star is heading towards
export type StarDirection = 'up' | 'down' | 'left' | 'right';

interface StarState {
  id: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  duration: number;
  angle: number;
  direction: StarDirection; // Which direction it's heading
  createdAt: number; // Timestamp for position calculation
}

interface ShootingStarProps {
  onCatch: (starId: number) => void;
  mode: InteractionMode;
  keyboardScheme?: KeyboardScheme;
  isGrabbing?: boolean;
  grabPosition?: { x: number; y: number }; // Normalized 0-1 (first hand)
  grabPositions?: { x: number; y: number }[]; // All grabbing hands
  maxConcurrent?: number;
  intervalRange?: [number, number];
  speedRange?: [number, number];
  isPaused?: boolean; // Pause star generation while content is showing
  // UI font styling for hint
  uiFontFamily?: string;
  uiFontSize?: number;
  uiFontOpacity?: number;
}

const ShootingStar: React.FC<ShootingStarProps> = ({
  onCatch,
  mode,
  keyboardScheme = 'space',
  isGrabbing = false,
  grabPosition: _grabPosition,
  grabPositions = [],
  maxConcurrent = 1,
  intervalRange = [8000, 15000],
  speedRange = [1.5, 2.5],
  isPaused = false,
  uiFontFamily: _uiFontFamily,
  uiFontSize: _uiFontSize = 16,
  uiFontOpacity: _uiFontOpacity = 1,
}) => {
  const [stars, setStars] = useState<StarState[]>([]);
  const [showHint, setShowHint] = useState(true);
  const [introComplete, setIntroComplete] = useState(false); // Hint animation done
  const prevGrabbingRef = useRef(false);
  const activeDirectionsRef = useRef<Set<StarDirection>>(new Set());
  const isPausedRef = useRef(isPaused);

  // Keep ref in sync with prop
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Intro animation: hint fades in, stays, fades out, then stars can appear
  useEffect(() => {
    // Hint stays for 3 seconds, then fades out
    const timer = setTimeout(() => {
      setShowHint(false);
      // After fade out animation (0.8s), mark intro complete
      setTimeout(() => {
        setIntroComplete(true);
      }, 800);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Generate a random shooting star
  const generateStar = useCallback(() => {
    const windowW = window.innerWidth;
    const windowH = window.innerHeight;

    // Try to find a direction that's not already in use
    const availableDirections: StarDirection[] = ['up', 'down', 'left', 'right'].filter(
      d => !activeDirectionsRef.current.has(d as StarDirection)
    ) as StarDirection[];

    if (availableDirections.length === 0) return null;

    // Pick a random available direction
    const targetDirection = availableDirections[Math.floor(Math.random() * availableDirections.length)];

    let startX: number, startY: number, endX: number, endY: number;

    // Generate trajectory based on target direction
    switch (targetDirection) {
      case 'right': // Heading right (exits on right side)
        startX = -20 + Math.random() * windowW * 0.3;
        startY = windowH * 0.1 + Math.random() * windowH * 0.8;
        endX = windowW + 20;
        endY = startY + (Math.random() - 0.5) * windowH * 0.3;
        break;
      case 'left': // Heading left (exits on left side)
        startX = windowW * 0.7 + Math.random() * windowW * 0.3 + 20;
        startY = windowH * 0.1 + Math.random() * windowH * 0.8;
        endX = -20;
        endY = startY + (Math.random() - 0.5) * windowH * 0.3;
        break;
      case 'down': // Heading down (exits on bottom)
        startX = windowW * 0.1 + Math.random() * windowW * 0.8;
        startY = -20 + Math.random() * windowH * 0.2;
        endX = startX + (Math.random() - 0.5) * windowW * 0.3;
        endY = windowH + 20;
        break;
      case 'up': // Heading up (exits on top)
        startX = windowW * 0.1 + Math.random() * windowW * 0.8;
        startY = windowH * 0.8 + Math.random() * windowH * 0.2 + 20;
        endX = startX + (Math.random() - 0.5) * windowW * 0.3;
        endY = -20;
        break;
    }

    const angle = Math.atan2(endY - startY, endX - startX) * (180 / Math.PI);
    const duration = speedRange[0] + Math.random() * (speedRange[1] - speedRange[0]);

    const star: StarState = {
      id: Date.now() + Math.random(),
      startX,
      startY,
      endX,
      endY,
      duration,
      angle,
      direction: targetDirection,
      createdAt: Date.now(),
    };

    return star;
  }, [speedRange]);

  // Add a new star
  const addStar = useCallback(() => {
    // Don't add stars while content is showing (paused)
    if (isPausedRef.current) return;
    if (stars.length >= maxConcurrent) return;

    const newStar = generateStar();
    if (!newStar) return;

    activeDirectionsRef.current.add(newStar.direction);
    setStars(prev => [...prev, newStar]);
    setShowHint(false);

    // Remove star after animation
    setTimeout(() => {
      setStars(prev => prev.filter(s => s.id !== newStar.id));
      activeDirectionsRef.current.delete(newStar.direction);
    }, newStar.duration * 1000 + 500);
  }, [stars.length, maxConcurrent, generateStar]);

  // Schedule shooting stars (only after intro is complete)
  useEffect(() => {
    if (!introComplete) return;

    const [minInterval, maxInterval] = intervalRange;
    const initialDelay = 500 + Math.random() * 1000; // Shorter delay after intro

    let timeoutId: ReturnType<typeof setTimeout>;

    const scheduleNext = () => {
      const interval = minInterval + Math.random() * (maxInterval - minInterval);
      timeoutId = setTimeout(() => {
        addStar();
        scheduleNext();
      }, interval);
    };

    const initialTimeout = setTimeout(() => {
      addStar();
      scheduleNext();
    }, initialDelay);

    return () => {
      clearTimeout(initialTimeout);
      clearTimeout(timeoutId);
    };
  }, [introComplete, addStar, intervalRange]);

  // Catch a star by ID
  const catchStar = useCallback((starId: number) => {
    const star = stars.find(s => s.id === starId);
    if (star) {
      activeDirectionsRef.current.delete(star.direction);
      setStars(prev => prev.filter(s => s.id !== starId));
      onCatch(starId);
    }
  }, [stars, onCatch]);

  // Keyboard controls
  useEffect(() => {
    if (mode !== 'keyboard') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (stars.length === 0) return;

      // Don't catch stars when typing in an input/textarea
      const activeEl = document.activeElement;
      const isTyping = activeEl instanceof HTMLInputElement ||
                       activeEl instanceof HTMLTextAreaElement ||
                       activeEl?.getAttribute('contenteditable') === 'true';
      if (isTyping) return;

      if (keyboardScheme === 'space') {
        // Simple space bar - catch the first star
        if (e.code === 'Space') {
          e.preventDefault();
          catchStar(stars[0].id);
        }
      } else if (keyboardScheme === 'directional') {
        // Directional keys - catch star heading in that direction
        let targetDirection: StarDirection | null = null;

        switch (e.code) {
          case 'KeyW':
          case 'ArrowUp':
            targetDirection = 'up';
            break;
          case 'KeyS':
          case 'ArrowDown':
            targetDirection = 'down';
            break;
          case 'KeyA':
          case 'ArrowLeft':
            targetDirection = 'left';
            break;
          case 'KeyD':
          case 'ArrowRight':
            targetDirection = 'right';
            break;
        }

        if (targetDirection) {
          e.preventDefault();
          const star = stars.find(s => s.direction === targetDirection);
          if (star) {
            catchStar(star.id);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, keyboardScheme, stars, catchStar]);

  // Calculate star's current position based on elapsed time
  const getStarCurrentPosition = useCallback((star: StarState) => {
    const elapsed = Date.now() - star.createdAt;
    const progress = Math.min(elapsed / (star.duration * 1000), 1);
    return {
      x: star.startX + (star.endX - star.startX) * progress,
      y: star.startY + (star.endY - star.startY) * progress,
    };
  }, []);

  // Gesture controls - only detect on grab START, check ALL hands
  useEffect(() => {
    if (mode !== 'gesture') return;

    // Only trigger on grab start (transition from not grabbing to grabbing)
    if (isGrabbing && !prevGrabbingRef.current && stars.length > 0 && grabPositions.length > 0) {
      const windowW = window.innerWidth;
      const windowH = window.innerHeight;

      // Distance threshold
      const CATCH_THRESHOLD = 300;

      // Check each grabbing hand
      for (const pos of grabPositions) {
        const grabX = pos.x * windowW;
        const grabY = pos.y * windowH;

        for (const star of stars) {
          const starPos = getStarCurrentPosition(star);
          const dist = Math.sqrt((grabX - starPos.x) ** 2 + (grabY - starPos.y) ** 2);

          if (dist < CATCH_THRESHOLD) {
            catchStar(star.id);
            prevGrabbingRef.current = isGrabbing;
            return; // Only catch one star per grab
          }
        }
      }
    }

    prevGrabbingRef.current = isGrabbing;
  }, [mode, isGrabbing, grabPositions, stars, catchStar, getStarCurrentPosition]);

  // Get direction indicator position
  const getDirectionIndicator = (direction: StarDirection) => {
    switch (direction) {
      case 'up': return { key: 'W', position: 'top-1/4 left-1/2 -translate-x-1/2' };
      case 'down': return { key: 'S', position: 'bottom-1/4 left-1/2 -translate-x-1/2' };
      case 'left': return { key: 'A', position: 'top-1/2 left-1/4 -translate-y-1/2' };
      case 'right': return { key: 'D', position: 'top-1/2 right-1/4 -translate-y-1/2' };
    }
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-10">
      <style>{floatKeyframes}</style>
      <AnimatePresence>
        {stars.map(star => (
          <motion.div
            key={star.id}
            className="absolute"
            initial={{ x: star.startX, y: star.startY, opacity: 0 }}
            animate={{ x: star.endX, y: star.endY, opacity: [0, 1, 1, 0] }}
            transition={{ duration: star.duration, ease: 'linear' }}
          >
            {/* Star body */}
            <div
              className="relative"
              style={{ transform: `rotate(${star.angle}deg)` }}
            >
              {/* Tail */}
              <div
                className="absolute"
                style={{
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '120px',
                  height: '3px',
                  background: 'linear-gradient(to left, rgba(255,255,255,1), rgba(255,220,180,0.5), transparent)',
                  filter: 'blur(1px)',
                }}
              />
              <div
                className="absolute"
                style={{
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '200px',
                  height: '6px',
                  background: 'linear-gradient(to left, rgba(255,255,255,0.5), rgba(255,200,150,0.2), transparent)',
                  filter: 'blur(4px)',
                }}
              />
              {/* Head */}
              <div
                className="relative rounded-full"
                style={{
                  width: '12px',
                  height: '12px',
                  background: 'radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.3) 40%, transparent 70%)',
                  filter: 'blur(1px)',
                  boxShadow: '0 0 10px rgba(255,255,255,0.6), 0 0 25px rgba(255,200,150,0.4)',
                }}
              />
            </div>
          </motion.div>
        ))}

        {/* Direction indicators for directional keyboard mode */}
        {mode === 'keyboard' && keyboardScheme === 'directional' && stars.map(star => {
          const indicator = getDirectionIndicator(star.direction);
          return (
            <motion.div
              key={`indicator-${star.id}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 0.6, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className={`fixed ${indicator.position} text-white/60 text-2xl font-mono`}
              style={{
                textShadow: '0 0 10px rgba(255,255,255,0.5)',
              }}
            >
              {indicator.key}
            </motion.div>
          );
        })}

        {/* Initial hint: fade in → stay → fade out (only for keyboard mode) */}
        {showHint && mode === 'keyboard' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white tracking-widest"
            style={{
              fontFamily: "'Tango', sans-serif",
              fontSize: '32px',
            }}
          >
            <FloatingText text="space to catch" />
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
};

export default ShootingStar;
