import { useEffect, useRef, useState } from 'react';

interface HandTrackerProps {
  onGrabChange: (isGrabbing: boolean, positions: { x: number; y: number }[]) => void;
  // New: open palm position for glow effect
  onPalmMove?: (position: { x: number; y: number } | null, isOpen: boolean) => void;
  // New: vertical swipe gesture detection (up = flip to back, down = flip to front)
  onSwipeGesture?: (direction: 'up' | 'down') => void;
}

// Load script from CDN
const loadScript = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
};

// Wait for global object to be available
const waitForGlobal = (name: string, timeout = 5000): Promise<any> => {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if ((window as any)[name]) {
        resolve((window as any)[name]);
      } else if (Date.now() - start > timeout) {
        reject(new Error(`Timeout waiting for ${name}`));
      } else {
        setTimeout(check, 50);
      }
    };
    check();
  });
};

const HandTracker: React.FC<HandTrackerProps> = ({
  onGrabChange,
  onPalmMove,
  onSwipeGesture,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const handsRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);

  // Swipe gesture tracking (vertical: up/down)
  const swipeStateRef = useRef<{
    startY: number | null;
    startTime: number | null;
    lastTrigger: number;
    lastDirection: 'up' | 'down' | null;
  }>({ startY: null, startTime: null, lastTrigger: 0, lastDirection: null });

  // Store callbacks in refs to avoid re-init
  const onPalmMoveRef = useRef(onPalmMove);
  const onSwipeGestureRef = useRef(onSwipeGesture);
  const lastDebugLogRef = useRef<number | null>(null);

  useEffect(() => {
    onPalmMoveRef.current = onPalmMove;
    onSwipeGestureRef.current = onSwipeGesture;
  }, [onPalmMove, onSwipeGesture]);

  useEffect(() => {
    let mounted = true;

    const initMediaPipe = async () => {
      try {
        // Load MediaPipe scripts from CDN
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js');
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');

        if (!mounted) return;

        // Wait for global objects to be available
        const Hands = await waitForGlobal('Hands');
        const Camera = await waitForGlobal('Camera');

        if (!mounted) return;

        const hands = new Hands({
          locateFile: (file: string) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
          },
        });

        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 0,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        hands.onResults((results: any) => {
          if (!mounted) return;

          const canvas = canvasRef.current;
          const ctx = canvas?.getContext('2d');
          if (!canvas || !ctx) return;

          ctx.clearRect(0, 0, canvas.width, canvas.height);

          let anyHandGrabbing = false;
          const grabPositions: { x: number; y: number }[] = [];

          if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            for (let h = 0; h < results.multiHandLandmarks.length; h++) {
              const landmarks = results.multiHandLandmarks[h];

              // Hand outline - bright dots with glow
              const handColor = h === 0 ? 'rgba(255, 255, 255, 0.85)' : 'rgba(200, 200, 255, 0.7)';
              ctx.fillStyle = handColor;
              ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
              ctx.shadowBlur = 8;

              for (const landmark of landmarks) {
                const x = landmark.x * canvas.width;
                const y = landmark.y * canvas.height;
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, 2 * Math.PI);
                ctx.fill();
              }
              ctx.shadowBlur = 0;

              const palm = landmarks[0];
              const indexTip = landmarks[8];
              const middleTip = landmarks[12];
              const ringTip = landmarks[16];
              const pinkyTip = landmarks[20];

              const indexKnuckle = landmarks[5];
              const middleKnuckle = landmarks[9];
              const ringKnuckle = landmarks[13];
              const pinkyKnuckle = landmarks[17];

              const fingersCurled =
                indexTip.y > indexKnuckle.y &&
                middleTip.y > middleKnuckle.y &&
                ringTip.y > ringKnuckle.y &&
                pinkyTip.y > pinkyKnuckle.y;

              // Check if fingers are extended (open palm)
              const fingersExtended =
                indexTip.y < indexKnuckle.y &&
                middleTip.y < middleKnuckle.y &&
                ringTip.y < ringKnuckle.y;

              const isGrabbing = fingersCurled;
              const isPalmOpen = fingersExtended;

              if (isGrabbing) {
                anyHandGrabbing = true;
                // Collect ALL grabbing hand positions
                grabPositions.push({ x: 1 - palm.x, y: palm.y });

                // Grab indicator circle
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(palm.x * canvas.width, palm.y * canvas.height, 25, 0, 2 * Math.PI);
                ctx.stroke();
              }

              // Track open palm for glow effect and swipe gesture (use first hand only)
              if (h === 0 && isPalmOpen) {
                const palmScreenX = (1 - palm.x) * window.innerWidth;
                const palmScreenY = palm.y * window.innerHeight;

                // Debug: log palm position every 500ms
                const now = Date.now();
                if (!lastDebugLogRef.current || now - lastDebugLogRef.current > 500) {
                  console.log('🖐️ Palm:', {
                    x: Math.round(palmScreenX),
                    y: Math.round(palmScreenY),
                    fingersExtended: { index: indexTip.y < indexKnuckle.y, middle: middleTip.y < middleKnuckle.y, ring: ringTip.y < ringKnuckle.y },
                  });
                  lastDebugLogRef.current = now;
                }

                // Report palm position for glow
                onPalmMoveRef.current?.({ x: palmScreenX, y: palmScreenY }, true);

                // Draw open palm indicator
                ctx.strokeStyle = 'rgba(255, 220, 180, 0.4)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(palm.x * canvas.width, palm.y * canvas.height, 35, 0, 2 * Math.PI);
                ctx.stroke();

                // Swipe detection (vertical: up = flip to back, down = flip to front)
                const swipeState = swipeStateRef.current;
                // Reuse 'now' from above
                const SWIPE_DISTANCE = 100; // px - made easier
                const SWIPE_TIMEOUT = 1500; // ms
                const COOLDOWN = 2000; // ms after trigger

                // Skip if in cooldown
                if (now - swipeState.lastTrigger < COOLDOWN) {
                  // In cooldown, don't track
                } else if (swipeState.startY === null) {
                  // Start tracking
                  swipeState.startY = palmScreenY;
                  swipeState.startTime = now;
                  console.log('📍 Swipe tracking started at Y:', Math.round(palmScreenY));
                } else {
                  // Check if timed out
                  if (swipeState.startTime && now - swipeState.startTime > SWIPE_TIMEOUT) {
                    console.log('⏱️ Swipe timeout, resetting');
                    swipeState.startY = palmScreenY;
                    swipeState.startTime = now;
                  } else {
                    // Check swipe distance (vertical)
                    const deltaY = palmScreenY - swipeState.startY;
                    const distance = Math.abs(deltaY);

                    // Log progress every 200ms
                    if (distance > 30) {
                      console.log('📊 Swipe progress:', { deltaY: Math.round(deltaY), distance: Math.round(distance), needed: SWIPE_DISTANCE });
                    }

                    if (distance >= SWIPE_DISTANCE) {
                      const direction = deltaY < 0 ? 'up' : 'down';
                      console.log('✅ Swipe gesture detected!', direction, 'Distance:', Math.round(distance));
                      onSwipeGestureRef.current?.(direction);
                      swipeState.startY = null;
                      swipeState.startTime = null;
                      swipeState.lastTrigger = now;
                      swipeState.lastDirection = direction;
                    }
                  }
                }
              }
            }
          }

          // Report no palm if no open palm detected
          if (!results.multiHandLandmarks?.some((_: any, i: number) => {
            const lm = results.multiHandLandmarks[i];
            return lm[8].y < lm[5].y && lm[12].y < lm[9].y && lm[16].y < lm[13].y;
          })) {
            onPalmMoveRef.current?.(null, false);
          }

          onGrabChange(anyHandGrabbing, grabPositions);
        });

        handsRef.current = hands;

        if (videoRef.current) {
          const camera = new Camera(videoRef.current, {
            onFrame: async () => {
              if (videoRef.current && handsRef.current) {
                await handsRef.current.send({ image: videoRef.current });
              }
            },
            width: 640,
            height: 480,
          });

          cameraRef.current = camera;
          await camera.start();

          if (mounted) {
            setIsLoading(false);
          }
        }
      } catch (err) {
        console.error('MediaPipe init error:', err);
        if (mounted) {
          setError('Camera access denied or MediaPipe failed to load');
          setIsLoading(false);
        }
      }
    };

    initMediaPipe();

    return () => {
      mounted = false;
      if (cameraRef.current) {
        cameraRef.current.stop();
      }
      if (handsRef.current) {
        handsRef.current.close();
      }
    };
  }, [onGrabChange]);

  return (
    <>
      <video
        ref={videoRef}
        className="hidden"
        playsInline
        autoPlay
        muted
      />

      {/* Full-screen hand overlay */}
      <canvas
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
        className="fixed inset-0 z-40 pointer-events-none"
        style={{ transform: 'scaleX(-1)' }}
      />

      {/* Loading/error indicator - small, bottom right */}
      {(isLoading || error) && (
        <div className="fixed bottom-6 right-6 z-50">
          {isLoading && (
            <div className="text-white/40 text-xs px-3 py-1.5 bg-black/30 rounded-lg backdrop-blur-sm">
              Loading camera...
            </div>
          )}
          {error && (
            <div className="text-red-400/60 text-xs px-3 py-1.5 bg-black/30 rounded-lg backdrop-blur-sm">
              {error}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default HandTracker;
