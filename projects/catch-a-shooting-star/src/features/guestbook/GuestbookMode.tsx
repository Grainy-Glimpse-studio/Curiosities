/**
 * Guestbook Mode
 *
 * A special mode where:
 * - Content comes from user-submitted messages (stored in Redis)
 * - Users can submit their own messages
 * - Each caught star reveals a random message from others
 *
 * This is NOT included in the public skill release.
 * For personal use only.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Starfield from '../../core/Starfield';
import ShootingStar from '../../core/ShootingStar';
import MessageInput from './MessageInput';
import { fetchRandomMessage, submitMessage } from './guestbookService';
import type { GuestMessage } from './types';
import type { InteractionMode } from '../../types';

interface GuestbookModeProps {
  interactionMode: InteractionMode;
  apiUrl?: string;
  onBack?: () => void;
}

// Catch sound
const CATCH_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3';

const GuestbookMode: React.FC<GuestbookModeProps> = ({
  interactionMode,
  apiUrl = '/api/messages',
  onBack,
}) => {
  const [currentMessage, setCurrentMessage] = useState<GuestMessage | null>(null);
  const [showInput, setShowInput] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const catchSoundRef = useRef<HTMLAudioElement | null>(null);

  // Initialize sound
  useEffect(() => {
    catchSoundRef.current = new Audio(CATCH_SOUND_URL);
    catchSoundRef.current.volume = 0.4;
  }, []);

  const playCatchSound = () => {
    if (catchSoundRef.current) {
      catchSoundRef.current.currentTime = 0;
      catchSoundRef.current.play().catch(() => {});
    }
  };

  // Handle catching a star
  const handleCatch = useCallback(async () => {
    playCatchSound();

    const message = await fetchRandomMessage(apiUrl);
    if (message) {
      setCurrentMessage(message);
      setMessageCount((prev) => prev + 1);
    } else {
      // No messages yet - show a default
      setCurrentMessage({
        id: 'empty',
        content: 'Be the first to leave a message...',
        createdAt: Date.now(),
      });
    }
  }, [apiUrl]);

  // Handle submitting a message
  const handleSubmit = useCallback(async (content: string) => {
    return await submitMessage(content, apiUrl);
  }, [apiUrl]);

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Starfield */}
      <Starfield />

      {/* Shooting Stars */}
      <ShootingStar
        onCatch={handleCatch}
        mode={interactionMode}
        keyboardScheme="space"
        maxConcurrent={1}
        intervalRange={[5000, 10000]}
        speedRange={[1.5, 2.5]}
      />

      {/* Current Message Display */}
      <div className="fixed inset-0 flex items-center justify-center z-20 pointer-events-none">
        <AnimatePresence mode="wait">
          {currentMessage && (
            <motion.div
              key={currentMessage.id + '-' + messageCount}
              className="pointer-events-auto max-w-lg mx-4"
              initial={{ opacity: 0, scale: 0.9, filter: 'blur(20px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.95, filter: 'blur(15px)' }}
              transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <div
                className="p-8 bg-black/40 backdrop-blur-md rounded-lg border border-white/10"
                style={{
                  boxShadow: '0 0 60px rgba(255,255,255,0.1), 0 30px 80px rgba(0,0,0,0.5)',
                }}
              >
                <p className="text-white/90 text-lg leading-relaxed italic text-center">
                  "{currentMessage.content}"
                </p>
                {currentMessage.id !== 'empty' && (
                  <p className="text-white/30 text-xs text-center mt-4 tracking-widest">
                    {new Date(currentMessage.createdAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Message Input Modal */}
      <MessageInput
        isOpen={showInput}
        onClose={() => setShowInput(false)}
        onSubmit={handleSubmit}
      />

      {/* Controls */}
      <div className="fixed bottom-6 left-6 z-50 text-white/30 text-xs tracking-widest uppercase">
        {interactionMode === 'keyboard' ? 'space to catch' : 'grab to catch'}
      </div>

      {/* Back button */}
      {onBack && (
        <button
          onClick={onBack}
          className="fixed top-6 left-6 z-50 text-white/40 hover:text-white/70 text-xs tracking-widest uppercase transition-colors"
        >
          back
        </button>
      )}

      {/* Leave message button */}
      <button
        onClick={() => setShowInput(true)}
        className="fixed top-6 right-6 z-50 text-white/40 hover:text-white/70 text-xs tracking-widest uppercase transition-colors border border-white/20 px-3 py-1 rounded hover:border-white/40"
      >
        leave a message
      </button>

      {/* Initial hint */}
      {!currentMessage && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/40 text-sm tracking-widest text-center"
        >
          <p>catch a shooting star</p>
          <p className="mt-2 text-white/20 text-xs">to read messages from others</p>
        </motion.div>
      )}
    </div>
  );
};

export default GuestbookMode;
