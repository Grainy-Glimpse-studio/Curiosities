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

  // Blow detection state
  const isBlowingRef = useRef(false);
  const blowStartTimeRef = useRef<number | null>(null);
  const blowTriggeredRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

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

          if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            const landmarks = results.multiFaceLandmarks[0];

            // Lip landmarks (MediaPipe Face Mesh indices)
            // Upper lip: 13 (center top)
            // Lower lip: 14 (center bottom)
            // Left corner: 61
            // Right corner: 291
            // Upper lip outer: 0
            // Lower lip outer: 17

            const upperLip = landmarks[13];
            const lowerLip = landmarks[14];
            const leftCorner = landmarks[61];
            const rightCorner = landmarks[291];

            // Calculate lip metrics
            const lipOpenDistance = Math.abs(upperLip.y - lowerLip.y);
            const lipWidth = Math.abs(leftCorner.x - rightCorner.x);

            // O-shape detection:
            // - Lips slightly open (not too wide, not closed)
            // - Lip width is narrow (pursed)
            // Ratio: lipOpenDistance / lipWidth
            // When pursing lips for blowing: width decreases, opening is moderate

            const ratio = lipOpenDistance / lipWidth;

            // Thresholds (may need tuning)
            // O-shape: ratio > 0.3 (lips open enough) and lipWidth < 0.15 (pursed)
            const isOShape = ratio > 0.25 && lipWidth < 0.18 && lipOpenDistance > 0.01;

            if (isOShape) {
              if (!isBlowingRef.current) {
                // Started blowing
                isBlowingRef.current = true;
                blowStartTimeRef.current = Date.now();
                blowTriggeredRef.current = false;
                onBlowStart?.();
              } else if (!blowTriggeredRef.current && blowStartTimeRef.current) {
                // Check if held long enough
                const elapsed = Date.now() - blowStartTimeRef.current;
                if (elapsed >= blowDuration) {
                  blowTriggeredRef.current = true;
                  onBlow?.();
                }
              }
            } else {
              if (isBlowingRef.current) {
                // Stopped blowing
                isBlowingRef.current = false;
                blowStartTimeRef.current = null;
                onBlowEnd?.();
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
  }, [enabled, blowDuration, onBlowStart, onBlowEnd, onBlow]);

  if (!enabled) return null;

  return (
    <>
      <video
        ref={videoRef}
        className="hidden"
        playsInline
        autoPlay
        muted
      />

      {/* Small status indicator */}
      {(isLoading || error) && (
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
        </div>
      )}
    </>
  );
};

export default FaceTracker;
