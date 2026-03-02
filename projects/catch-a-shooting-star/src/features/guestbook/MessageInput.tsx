import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { validateMessage } from '../../utils/contentFilter';

interface MessageInputProps {
  onSubmit: (message: string) => Promise<boolean>;
  isOpen: boolean;
  onClose: () => void;
}

const MessageInput: React.FC<MessageInputProps> = ({ onSubmit, isOpen, onClose }) => {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    // Validate locally first
    const validation = validateMessage(text);
    if (!validation.valid) {
      setError(validation.reason || 'Invalid message');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const ok = await onSubmit(text.trim());
      if (ok) {
        setSuccess(true);
        setText('');
        setTimeout(() => {
          setSuccess(false);
          onClose();
        }, 1500);
      } else {
        setError('Failed to send. Try again.');
      }
    } catch (e) {
      setError('Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="relative w-full max-w-md mx-4 p-6 bg-black/80 border border-white/20 rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-white/40 hover:text-white/70 text-sm"
            >
              ✕
            </button>

            {/* Title */}
            <h3 className="text-white/80 text-sm tracking-widest uppercase mb-4">
              Leave a message
            </h3>

            {/* Success state */}
            {success ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-8"
              >
                <div className="text-white/60 text-sm">
                  Your star is now in the sky ✨
                </div>
              </motion.div>
            ) : (
              <>
                {/* Input */}
                <textarea
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setError(null);
                  }}
                  placeholder="Write something nice..."
                  maxLength={200}
                  className="w-full h-24 bg-white/5 border border-white/20 rounded-lg p-3 text-white/90 text-sm placeholder:text-white/30 resize-none focus:outline-none focus:border-white/40"
                />

                {/* Character count */}
                <div className="flex justify-between items-center mt-2">
                  <span className="text-white/30 text-xs">
                    {text.length}/200
                  </span>
                  {error && (
                    <span className="text-red-400/80 text-xs">
                      {error}
                    </span>
                  )}
                </div>

                {/* Submit button */}
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || text.trim().length === 0}
                  className="w-full mt-4 py-2 bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:text-white/30 text-white/70 text-sm tracking-widest uppercase rounded transition-colors"
                >
                  {isSubmitting ? 'sending...' : 'send to the stars'}
                </button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MessageInput;
