import React from 'react';
import { motion } from 'framer-motion';
import type { InteractionMode } from '../types';

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
@keyframes buttonFloat {
  0%, 100% {
    transform: translateY(0px) rotate(0deg);
  }
  33% {
    transform: translateY(-3px) rotate(0.5deg);
  }
  66% {
    transform: translateY(-1px) rotate(-0.3deg);
  }
}
@keyframes iconFloat {
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

interface ModeSelectorProps {
  onSelect: (mode: InteractionMode) => void;
}

const ModeSelector: React.FC<ModeSelectorProps> = ({ onSelect }) => {
  return (
    <div
      className="fixed inset-0 bg-black flex items-center justify-center"
      style={{ fontFamily: "'Brainrot', sans-serif" }}
    >
      {/* Keyframes */}
      <style>{floatKeyframes}</style>

      {/* Background stars (subtle) */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(30)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white/30"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${1 + Math.random() * 2}px`,
              height: `${1 + Math.random() * 2}px`,
              animation: `twinkle ${2 + Math.random() * 3}s ease-in-out infinite`,
              animationDelay: `${Math.random() * -5}s`,
            }}
          />
        ))}
        <style>{`
          @keyframes twinkle {
            0%, 100% { opacity: 0.2; }
            50% { opacity: 0.8; }
          }
          @font-face {
            font-family: 'Brainrot';
            src: url('/fonts/BrainrotTMRegular.ttf') format('truetype');
            font-display: swap;
          }
        `}</style>
      </div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 text-center"
      >
        <h1
          className="text-white/90 text-7xl tracking-[0.1em] mb-6"
          style={{ fontFamily: "'Brainrot', sans-serif" }}
        >
          <FloatingText text="Catch A Shooting Star" />
        </h1>
        <p
          className="text-white/50 text-2xl tracking-widest mb-20"
          style={{ fontFamily: "'Tango', sans-serif" }}
        >
          <FloatingText text="How would you like to interact?" />
        </p>

        <div className="flex gap-16 justify-center">
          {/* Keyboard Option */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect('keyboard')}
            className="group relative w-48 h-48 flex flex-col items-center justify-center"
            style={{
              animation: 'buttonFloat 8s ease-in-out infinite',
              animationDelay: '0s',
            }}
          >
            {/* Floating border */}
            <div
              className="absolute inset-0 border border-white/20 rounded-full group-hover:border-white/40 transition-colors"
              style={{
                animation: 'buttonFloat 7s ease-in-out infinite',
                animationDelay: '0.5s',
              }}
            />
            <div className="text-white/70 group-hover:text-white transition-colors flex flex-col items-center">
              <svg
                className="w-14 h-14 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{
                  animation: 'iconFloat 5s ease-in-out infinite',
                  animationDelay: '0.2s',
                }}
              >
                <rect x="2" y="6" width="20" height="12" rx="2" strokeWidth="1" />
                <line x1="6" y1="10" x2="6" y2="10" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="10" y1="10" x2="10" y2="10" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="14" y1="10" x2="14" y2="10" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="18" y1="10" x2="18" y2="10" strokeWidth="1.5" strokeLinecap="round" />
                <rect x="6" y="13" width="12" height="2" rx="0.5" strokeWidth="0.75" />
              </svg>
              <span className="text-2xl tracking-[0.15em]">
                <FloatingText text="Keyboard" />
              </span>
            </div>
          </motion.button>

          {/* Gesture Option */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect('gesture')}
            className="group relative w-48 h-48 flex flex-col items-center justify-center"
            style={{
              animation: 'buttonFloat 8s ease-in-out infinite',
              animationDelay: '0.8s',
            }}
          >
            {/* Floating border */}
            <div
              className="absolute inset-0 border border-white/20 rounded-full group-hover:border-white/40 transition-colors"
              style={{
                animation: 'buttonFloat 7s ease-in-out infinite',
                animationDelay: '1.3s',
              }}
            />
            <div className="text-white/70 group-hover:text-white transition-colors flex flex-col items-center">
              <svg
                className="w-14 h-14 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{
                  animation: 'iconFloat 5s ease-in-out infinite',
                  animationDelay: '1s',
                }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
              </svg>
              <span className="text-2xl tracking-[0.15em]">
                <FloatingText text="Gesture" />
              </span>
            </div>
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};

export default ModeSelector;
