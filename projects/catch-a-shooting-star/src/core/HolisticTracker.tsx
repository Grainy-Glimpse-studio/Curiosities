import { useEffect, useRef, useState } from 'react';

interface HolisticTrackerProps {
  // Hand tracking
  onGrabChange: (isGrabbing: boolean, positions: { x: number; y: number }[]) => void;
  onPalmMove?: (position: { x: number; y: number } | null, isOpen: boolean) => void;
  onSwipeGesture?: (direction: 'up' | 'down') => void;

  // Face tracking
  onBlowStart?: () => void;
  onBlowEnd?: () => void;
  onBlow?: () => void;
  blowDuration?: number;
  blowEnabled?: boolean;
}

// Load script from CDN
const loadScript = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
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

// Wait for global object
const waitForGlobal = (name: string, timeout = 10000): Promise<any> => {
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

const HolisticTracker: React.FC<HolisticTrackerProps> = ({
  onGrabChange,
  onPalmMove,
  onSwipeGesture,
  onBlowStart,
  onBlowEnd,
  onBlow,
  blowDuration = 600,
  blowEnabled = true,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [_isLoading, setIsLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);
  const holisticRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);

  // Store callbacks in refs
  const onGrabChangeRef = useRef(onGrabChange);
  const onPalmMoveRef = useRef(onPalmMove);
  const onSwipeGestureRef = useRef(onSwipeGesture);
  const onBlowStartRef = useRef(onBlowStart);
  const onBlowEndRef = useRef(onBlowEnd);
  const onBlowRef = useRef(onBlow);
  const blowDurationRef = useRef(blowDuration);
  const blowEnabledRef = useRef(blowEnabled);

  useEffect(() => {
    onGrabChangeRef.current = onGrabChange;
    onPalmMoveRef.current = onPalmMove;
    onSwipeGestureRef.current = onSwipeGesture;
    onBlowStartRef.current = onBlowStart;
    onBlowEndRef.current = onBlowEnd;
    onBlowRef.current = onBlow;
    blowDurationRef.current = blowDuration;
    blowEnabledRef.current = blowEnabled;
  }, [onGrabChange, onPalmMove, onSwipeGesture, onBlowStart, onBlowEnd, onBlow, blowDuration, blowEnabled]);

  // Palm flip detection - track palm orientation (facing camera vs away)
  const palmFlipStateRef = useRef<{
    lastOrientation: 'front' | 'back' | null;  // palm facing camera = front
    lastTrigger: number;
    stableCount: number;  // frames with same orientation (for debounce)
  }>({ lastOrientation: null, lastTrigger: 0, stableCount: 0 });

  // Blow detection state
  const isBlowingRef = useRef(false);
  const blowStartTimeRef = useRef<number | null>(null);
  const blowTriggeredRef = useRef(false);
  const [_blowProgress, setBlowProgress] = useState(0);
  const [_faceDetected, setFaceDetected] = useState(false);

  useEffect(() => {
    let mounted = true;

    const initHolistic = async () => {
      try {
        // Load MediaPipe scripts
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/holistic/holistic.js');
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');

        if (!mounted) return;

        const Holistic = await waitForGlobal('Holistic');
        const Camera = await waitForGlobal('Camera');

        if (!mounted) return;

        const holistic = new Holistic({
          locateFile: (file: string) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`;
          },
        });

        holistic.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          enableSegmentation: false,
          smoothSegmentation: false,
          refineFaceLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        holistic.onResults((results: any) => {
          if (!mounted) return;

          const canvas = canvasRef.current;
          const ctx = canvas?.getContext('2d');
          if (!canvas || !ctx) return;

          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // ============ HAND TRACKING ============
          let anyHandGrabbing = false;
          const grabPositions: { x: number; y: number }[] = [];
          let palmFlipProcessed = false;  // Only process flip for first detected hand

          // Process both hands
          const hands = [
            { landmarks: results.leftHandLandmarks, name: 'left' },
            { landmarks: results.rightHandLandmarks, name: 'right' },
          ];

          // Debug: log hand detection
          const handsDetected = hands.filter(h => h.landmarks).length;
          if (handsDetected > 0 && Math.random() < 0.02) {
            console.log(`🖐️ Hands detected: ${handsDetected}`);
          }

          hands.forEach((hand, h) => {
            if (!hand.landmarks) return;

            const landmarks = hand.landmarks;

            // Draw hand - both hands same light color
            ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
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

            // Check gestures
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

            const fingersExtended =
              indexTip.y < indexKnuckle.y &&
              middleTip.y < middleKnuckle.y &&
              ringTip.y < ringKnuckle.y;

            const isGrabbing = fingersCurled;
            const isPalmOpen = fingersExtended;

            if (isGrabbing) {
              anyHandGrabbing = true;
              grabPositions.push({ x: 1 - palm.x, y: palm.y });

              // Draw grab indicator
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(palm.x * canvas.width, palm.y * canvas.height, 25, 0, 2 * Math.PI);
              ctx.stroke();
            }

            // Track palm for flip gesture (first detected hand only)
            if (!palmFlipProcessed) {
              palmFlipProcessed = true;  // Mark as processed
              const palmScreenX = (1 - palm.x) * window.innerWidth;
              const palmScreenY = palm.y * window.innerHeight;

              if (isPalmOpen) {
                onPalmMoveRef.current?.({ x: palmScreenX, y: palmScreenY }, true);

                // Draw palm indicator
                ctx.strokeStyle = 'rgba(255, 220, 180, 0.4)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(palm.x * canvas.width, palm.y * canvas.height, 35, 0, 2 * Math.PI);
                ctx.stroke();
              }

              // Palm flip detection - ONLY when palm is open (fingers extended)
              // Use cross product of palm vectors to determine orientation
              if (isPalmOpen) {
                const wrist = landmarks[0];
                const indexMCP = landmarks[5];  // index finger knuckle
                const pinkyMCP = landmarks[17]; // pinky knuckle

                // Vector from wrist to index knuckle
                const v1 = { x: indexMCP.x - wrist.x, y: indexMCP.y - wrist.y, z: indexMCP.z - wrist.z };
                // Vector from wrist to pinky knuckle
                const v2 = { x: pinkyMCP.x - wrist.x, y: pinkyMCP.y - wrist.y, z: pinkyMCP.z - wrist.z };

                // Cross product z-component tells us palm orientation
                const crossZ = v1.x * v2.y - v1.y * v2.x;

                const flipState = palmFlipStateRef.current;
                const now = Date.now();
                const COOLDOWN = 1000;  // ms between flips
                const STABLE_FRAMES = 5;  // need 5 stable frames
                const THRESHOLD = 0.012;  // higher threshold to reduce sensitivity

                // Determine current orientation
                const currentOrientation: 'front' | 'back' | null =
                  crossZ > THRESHOLD ? 'front' :
                  crossZ < -THRESHOLD ? 'back' :
                  null;

                // Debug: show orientation value occasionally
                if (Math.random() < 0.05) {
                  console.log(`👋 crossZ: ${crossZ.toFixed(4)}, orient: ${currentOrientation}, stable: ${flipState.stableCount}`);
                }

                if (currentOrientation && now - flipState.lastTrigger >= COOLDOWN) {
                  if (currentOrientation === flipState.lastOrientation) {
                    flipState.stableCount++;
                  } else if (flipState.lastOrientation !== null && flipState.stableCount >= STABLE_FRAMES) {
                    // Flip detected!
                    const direction = currentOrientation === 'back' ? 'up' : 'down';
                    console.log('🔄 Palm flip:', flipState.lastOrientation, '→', currentOrientation);
                    onSwipeGestureRef.current?.(direction);
                    flipState.lastTrigger = now;
                    flipState.stableCount = 0;
                  }

                  if (currentOrientation !== flipState.lastOrientation) {
                    flipState.lastOrientation = currentOrientation;
                    flipState.stableCount = 1;
                  }
                }
              } else {
                // Reset stable count when palm is not open
                palmFlipStateRef.current.stableCount = 0;
              }
            }
          });

          // Report no palm if no open palm detected
          if (!hands.some(h => h.landmarks &&
            h.landmarks[8].y < h.landmarks[5].y &&
            h.landmarks[12].y < h.landmarks[9].y)) {
            onPalmMoveRef.current?.(null, false);
          }

          onGrabChangeRef.current(anyHandGrabbing, grabPositions);

          // ============ FACE TRACKING ============
          const hasFace = results.faceLandmarks && results.faceLandmarks.length > 0;
          setFaceDetected(hasFace);

          if (hasFace && blowEnabledRef.current) {
            const landmarks = results.faceLandmarks;

            // Draw face (subtle)
            ctx.fillStyle = 'rgba(100, 200, 255, 0.3)';
            for (let i = 0; i < landmarks.length; i += 5) {
              const lm = landmarks[i];
              const x = lm.x * canvas.width;
              const y = lm.y * canvas.height;
              ctx.beginPath();
              ctx.arc(x, y, 1.5, 0, 2 * Math.PI);
              ctx.fill();
            }

            // Lip landmarks for blow detection
            const upperLip = landmarks[13];
            const lowerLip = landmarks[14];
            const leftCorner = landmarks[61];
            const rightCorner = landmarks[291];

            const lipOpenDistance = Math.abs(upperLip.y - lowerLip.y);
            const lipWidth = Math.abs(leftCorner.x - rightCorner.x);
            const ratio = lipOpenDistance / lipWidth;

            const isOShape = ratio > 0.2 && lipWidth < 0.22 && lipOpenDistance > 0.008;

            if (isOShape) {
              if (!isBlowingRef.current) {
                isBlowingRef.current = true;
                blowStartTimeRef.current = Date.now();
                blowTriggeredRef.current = false;
                setBlowProgress(0);
                onBlowStartRef.current?.();
              } else if (!blowTriggeredRef.current && blowStartTimeRef.current) {
                const elapsed = Date.now() - blowStartTimeRef.current;
                const progress = Math.min(100, (elapsed / blowDurationRef.current) * 100);
                setBlowProgress(progress);

                if (elapsed >= blowDurationRef.current) {
                  blowTriggeredRef.current = true;
                  setBlowProgress(0);
                  console.log('💨 Blow triggered!');
                  onBlowRef.current?.();
                }
              }
            } else {
              if (isBlowingRef.current) {
                isBlowingRef.current = false;
                blowStartTimeRef.current = null;
                setBlowProgress(0);
                onBlowEndRef.current?.();
              }
            }
          }
        });

        holisticRef.current = holistic;

        if (videoRef.current) {
          const camera = new Camera(videoRef.current, {
            onFrame: async () => {
              if (videoRef.current && holisticRef.current) {
                await holisticRef.current.send({ image: videoRef.current });
              }
            },
            width: 640,
            height: 480,
          });

          cameraRef.current = camera;
          await camera.start();

          if (mounted) {
            setIsLoading(false);
            console.log('✅ HolisticTracker: Camera started');
          }
        }
      } catch (err) {
        console.error('Holistic init error:', err);
        if (mounted) {
          setError('Tracking failed to load');
          setIsLoading(false);
        }
      }
    };

    initHolistic();

    return () => {
      mounted = false;
      if (cameraRef.current) {
        cameraRef.current.stop();
      }
      if (holisticRef.current) {
        holisticRef.current.close();
      }
    };
  }, []);

  return (
    <>
      <video
        ref={videoRef}
        className="hidden"
        playsInline
        autoPlay
        muted
      />

      <canvas
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
        className="fixed inset-0 z-40 pointer-events-none"
        style={{ transform: 'scaleX(-1)' }}
      />

      {/* Blow progress indicator - removed per user request */}

      {/* Status indicators - hidden for production, enable for debugging */}
      {/*
      <div className="fixed bottom-6 left-6 z-50 flex gap-2">
        {isLoading && (
          <div className="text-white/40 text-xs px-3 py-1.5 bg-black/30 rounded-lg backdrop-blur-sm">
            Loading tracking...
          </div>
        )}
        {error && (
          <div className="text-red-400/60 text-xs px-3 py-1.5 bg-black/30 rounded-lg backdrop-blur-sm">
            {error}
          </div>
        )}
        {!isLoading && !error && (
          <div className={`text-xs px-2 py-1 rounded-lg backdrop-blur-sm transition-colors ${
            faceDetected ? 'bg-green-500/20 text-green-400/70' : 'bg-black/20 text-white/20'
          }`}>
            {faceDetected ? '👤' : '·'}
          </div>
        )}
      </div>
      */}
    </>
  );
};

export default HolisticTracker;
