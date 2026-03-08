import React, { useState, useEffect } from 'react';

export interface FlashlightCursorProps {
  outerSize?: number;      // Outer glow size (px)
  innerSize?: number;      // Inner glow size (px)
  outerOpacity?: number;   // Outer opacity
  innerOpacity?: number;   // Inner opacity
  color?: string;          // RGB color "255,255,255"
  zIndex?: number;
  // Callback with mouse position for other components
  onMouseMove?: (pos: { x: number; y: number } | null) => void;
}

const FlashlightCursor: React.FC<FlashlightCursorProps> = ({
  outerSize = 240,
  innerSize = 80,
  outerOpacity = 0.03,
  innerOpacity = 0.06,
  color = '255,255,255',
  zIndex = 50,
  onMouseMove,
}) => {
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let hideTimeout: ReturnType<typeof setTimeout>;

    const handleMouseMove = (e: MouseEvent) => {
      const pos = { x: e.clientX, y: e.clientY };
      setMousePos(pos);
      setIsVisible(true);
      onMouseMove?.(pos);

      // Hide system cursor when flashlight is visible
      document.body.style.cursor = 'none';

      // Hide after 3 seconds of no movement
      clearTimeout(hideTimeout);
      hideTimeout = setTimeout(() => {
        setIsVisible(false);
        document.body.style.cursor = '';
      }, 3000);
    };

    const handleMouseLeave = () => {
      setIsVisible(false);
      document.body.style.cursor = '';
      onMouseMove?.(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.body.style.cursor = '';
      clearTimeout(hideTimeout);
    };
  }, [onMouseMove]);

  if (!mousePos || !isVisible) return null;

  return (
    <div
      className="fixed pointer-events-none transition-opacity duration-500"
      style={{
        left: mousePos.x,
        top: mousePos.y,
        transform: 'translate(-50%, -50%)',
        zIndex,
        opacity: isVisible ? 1 : 0,
      }}
    >
      {/* Outer soft glow */}
      <div
        className="absolute rounded-full"
        style={{
          width: `${outerSize}px`,
          height: `${outerSize}px`,
          left: `${-outerSize / 2}px`,
          top: `${-outerSize / 2}px`,
          background: `radial-gradient(circle, rgba(${color},${outerOpacity}) 0%, rgba(${color},${outerOpacity * 0.33}) 40%, transparent 70%)`,
        }}
      />
      {/* Inner glow */}
      <div
        className="absolute rounded-full"
        style={{
          width: `${innerSize}px`,
          height: `${innerSize}px`,
          left: `${-innerSize / 2}px`,
          top: `${-innerSize / 2}px`,
          background: `radial-gradient(circle, rgba(${color},${innerOpacity}) 0%, transparent 70%)`,
        }}
      />
    </div>
  );
};

export default FlashlightCursor;
