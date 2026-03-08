import { useEffect, useRef, useState } from 'react';

interface FaceTrackerProps {
  onBlowStart?: () => void;
  onBlowEnd?: () => void;
  onBlow?: () => void; // Triggered when blow is confirmed (held long enough)
  blowDuration?: number; // How long to hold O-shape to trigger blow (ms)
  enabled?: boolean;
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

const FaceTracker: React.FC<FaceTrackerProps> = ({
  onBlowStart,
  onBlowEnd,
  onBlow,
  blowDuration = 600,
  enabled = true,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const faceMeshRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const initializedRef = useRef(false);
  const enabledRef = useRef(enabled);

  // Store callbacks in refs to avoid re-initialization
  const onBlowStartRef = useRef(onBlowStart);
  const onBlowEndRef = useRef(onBlowEnd);
  const onBlowRef = useRef(onBlow);
  const blowDurationRef = useRef(blowDuration);

  // Update refs when props change
  useEffect(() => {
    onBlowStartRef.current = onBlowStart;
    onBlowEndRef.current = onBlowEnd;
    onBlowRef.current = onBlow;
    blowDurationRef.current = blowDuration;
  }, [onBlowStart, onBlowEnd, onBlow, blowDuration]);

  // Update enabled ref and reset blow state when enabled changes
  useEffect(() => {
    enabledRef.current = enabled;

    // Reset blow state when enabled changes (new item appeared or item dismissed)
    if (enabled) {
      isBlowingRef.current = false;
      blowStartTimeRef.current = null;
      blowTriggeredRef.current = false;
    }
  }, [enabled]);

  // Blow detection state
  const isBlowingRef = useRef(false);
  const blowStartTimeRef = useRef<number | null>(null);
  const blowTriggeredRef = useRef(false);
  const [blowProgress, setBlowProgress] = useState(0); // 0-100 progress for visual feedback
  const [faceDetected, setFaceDetected] = useState(false); // Show face detection indicator

  // Initialize only once
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    let mounted = true;

    const initFaceMesh = async () => {
      try {
        // Load MediaPipe scripts
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js');
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');

        if (!mounted) return;

        const FaceMesh = await waitForGlobal('FaceMesh');
        const Camera = await waitForGlobal('Camera');

        if (!mounted) return;

        const faceMesh = new FaceMesh({
          locateFile: (file: string) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
          },
        });

        faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        faceMesh.onResults((results: any) => {
          if (!mounted) return;

          // Update face detection state
          const hasFace = results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0;
          setFaceDetected(hasFace);

          if (hasFace) {
            // Only process blow if enabled (content is showing)
            if (!enabledRef.current) {
              return;
            }
            const landmarks = results.multiFaceLandmarks[0];

            const upperLip = landmarks[13];
            const lowerLip = landmarks[14];
            const leftCorner = landmarks[61];
            const rightCorner = landmarks[291];

            const lipOpenDistance = Math.abs(upperLip.y - lowerLip.y);
            const lipWidth = Math.abs(leftCorner.x - rightCorner.x);
            const ratio = lipOpenDistance / lipWidth;

            // More lenient O-shape detection:
            // - ratio > 0.2 (was 0.25) - mouth more open relative to width
            // - lipWidth < 0.22 (was 0.18) - allow slightly wider mouths
            // - lipOpenDistance > 0.008 (was 0.01) - detect smaller openings
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
                  console.log('💨 FaceTracker: Blow triggered!');
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

        faceMeshRef.current = faceMesh;

        if (videoRef.current) {
          const camera = new Camera(videoRef.current, {
            onFrame: async () => {
              if (videoRef.current && faceMeshRef.current) {
                await faceMeshRef.current.send({ image: videoRef.current });
              }
            },
            width: 640,
            height: 480,
          });

          cameraRef.current = camera;
          await camera.start();
          console.log('👤 FaceTracker: Camera started successfully');

          if (mounted) {
            setIsLoading(false);
          }
        }
      } catch (err) {
        console.error('FaceMesh init error:', err);
        if (mounted) {
          setError('Face tracking failed to load');
          setIsLoading(false);
        }
      }
    };

    initFaceMesh();

    return () => {
      mounted = false;
      if (cameraRef.current) {
        cameraRef.current.stop();
      }
      if (faceMeshRef.current) {
        faceMeshRef.current.close();
      }
    };
  }, []); // Empty deps - only run once

  return (
    <>
      <video
        ref={videoRef}
        className="hidden"
        playsInline
        autoPlay
        muted
      />

      {/* Blow progress indicator - shows when blowing */}
      {blowProgress > 0 && enabled && (
        <div className="fixed bottom-1/4 left-1/2 -translate-x-1/2 z-50">
          <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-white/60 rounded-full transition-all duration-75"
              style={{ width: `${blowProgress}%` }}
            />
          </div>
          <div className="text-white/30 text-xs text-center mt-1">
            blowing...
          </div>
        </div>
      )}

      {/* Face detection indicator - bottom left */}
      <div className="fixed bottom-6 left-6 z-50">
        {isLoading && (
          <div className="text-white/40 text-xs px-3 py-1.5 bg-black/30 rounded-lg backdrop-blur-sm">
            Loading face tracking...
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
    </>
  );
};

export default FaceTracker;
