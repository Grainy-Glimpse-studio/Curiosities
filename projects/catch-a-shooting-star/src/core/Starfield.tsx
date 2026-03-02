import { useMemo } from 'react';

interface StarfieldProps {
  // Rotation speed in degrees per second (default: very slow)
  rotationSpeed?: number;
  // Number of stars
  starCount?: number;
}

const Starfield: React.FC<StarfieldProps> = ({
  rotationSpeed = 0.5, // 0.5 degrees per second = 12 minutes for full rotation
  starCount = 200, // Doubled for better visibility
}) => {
  const stars = useMemo(() => {
    const result: React.ReactNode[] = [];
    const seed = 42;

    const pseudoRandom = (n: number) => {
      const x = Math.sin(seed + n) * 10000;
      return x - Math.floor(x);
    };

    for (let i = 0; i < starCount; i++) {
      // Use polar coordinates for even distribution
      const angle = pseudoRandom(i * 3) * Math.PI * 2;
      const distance = Math.sqrt(pseudoRandom(i * 3 + 1)) * 70; // sqrt for even distribution

      // Convert to percentage from center
      const x = 50 + Math.cos(angle) * distance;
      const y = 50 + Math.sin(angle) * distance;

      const size = 1 + pseudoRandom(i * 3 + 2) * 2.5;
      const duration = 2 + pseudoRandom(i * 7) * 5;
      const delay = pseudoRandom(i * 11) * -8;
      const isBright = pseudoRandom(i * 17) > 0.7;

      result.push(
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            width: `${size}px`,
            height: `${size}px`,
            backgroundColor: isBright ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0.7)',
            animation: `${isBright ? 'twinkle-bright' : 'twinkle'} ${duration}s ease-in-out infinite`,
            animationDelay: `${delay}s`,
          }}
        />
      );
    }
    return result;
  }, [starCount]);

  // Calculate animation duration for one full rotation
  const rotationDuration = 360 / rotationSpeed;

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-black">
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.15; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes twinkle-bright {
          0%, 100% { opacity: 0.3; box-shadow: 0 0 2px rgba(255,255,255,0.3); }
          50% { opacity: 1; box-shadow: 0 0 8px rgba(255,255,255,0.8), 0 0 15px rgba(255,255,255,0.4); }
        }
        @keyframes rotate-sky {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
      `}</style>

      {/* Rotating star container */}
      <div
        className="absolute"
        style={{
          width: '200%',
          height: '200%',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          animation: `rotate-sky ${rotationDuration}s linear infinite`,
        }}
      >
        {stars}
      </div>

      {/* Subtle vignette (doesn't rotate) */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, transparent 50%, rgba(0,0,0,0.3) 100%)',
        }}
      />
    </div>
  );
};

export default Starfield;
