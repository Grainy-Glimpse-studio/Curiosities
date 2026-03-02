import { useEffect, useRef, useState } from 'react';

interface HandTrackerProps {
  onGrabChange: (isGrabbing: boolean, position?: { x: number; y: number }) => void;
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

const HandTracker: React.FC<HandTrackerProps> = ({ onGrabChange }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const handsRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;

    const initMediaPipe = async () => {
      try {
        // Load MediaPipe scripts from CDN
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js');
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');

        if (!mounted) return;

        // Access global objects
        const Hands = (window as any).Hands;
        const Camera = (window as any).Camera;

        if (!Hands || !Camera) {
          throw new Error('MediaPipe modules not found');
        }

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
          let grabPos: { x: number; y: number } | undefined;

          if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            for (let h = 0; h < results.multiHandLandmarks.length; h++) {
              const landmarks = results.multiHandLandmarks[h];
              const handedness = results.multiHandedness?.[h]?.label || 'Unknown';

              const handColor = h === 0 ? 'rgba(255, 255, 255, 0.3)' : 'rgba(200, 200, 255, 0.3)';
              ctx.fillStyle = handColor;

              for (const landmark of landmarks) {
                const x = landmark.x * canvas.width;
                const y = landmark.y * canvas.height;
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, 2 * Math.PI);
                ctx.fill();
              }

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

              const isGrabbing = fingersCurled;

              if (isGrabbing) {
                anyHandGrabbing = true;
                grabPos = { x: 1 - palm.x, y: palm.y };

                ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(palm.x * canvas.width, palm.y * canvas.height, 30, 0, 2 * Math.PI);
                ctx.stroke();

                ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                ctx.font = '10px sans-serif';
                ctx.fillText(handedness, palm.x * canvas.width - 15, palm.y * canvas.height - 35);
              }
            }
          }

          onGrabChange(anyHandGrabbing, grabPos);
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

      <div className="fixed bottom-6 right-6 z-50">
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={160}
            height={120}
            className="rounded-lg border border-white/20 bg-black/30 backdrop-blur-sm"
            style={{ transform: 'scaleX(-1)' }}
          />

          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
              <div className="text-white/60 text-xs">Loading camera...</div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg p-2">
              <div className="text-red-400/80 text-xs text-center">{error}</div>
            </div>
          )}

          <p className="text-white/30 text-[10px] text-center mt-1 tracking-widest uppercase">
            hand tracking (1-2 hands)
          </p>
        </div>
      </div>
    </>
  );
};

export default HandTracker;
