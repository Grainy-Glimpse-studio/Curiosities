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
              className="absolute top-4 right-4 text-white/40 hover:text-white/70"
              style={{ fontSize: '18px' }}
            >
              ×
            </button>

            {/* Success state */}
            {success ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-8"
                style={{ fontFamily: "'Tango', sans-serif" }}
              >
                <div className="text-white/50 text-lg">
                  sent
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
                  placeholder="write something..."
                  maxLength={200}
                  className="w-full h-28 bg-white/5 border border-white/15 rounded-lg p-4 text-white/80 placeholder:text-white/25 resize-none focus:outline-none focus:border-white/30"
                  style={{ fontFamily: "'Tango', sans-serif", fontSize: '18px' }}
                />

                {/* Character count & error */}
                <div className="flex justify-between items-center mt-3">
                  <span className="text-white/25" style={{ fontSize: '14px' }}>
                    {text.length}/200
                  </span>
                  {error && (
                    <span className="text-red-400/60" style={{ fontSize: '14px' }}>
                      {error}
                    </span>
                  )}
                </div>

                {/* Submit button */}
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || text.trim().length === 0}
                  className="w-full mt-5 py-3 bg-white/10 hover:bg-white/15 disabled:bg-white/5 disabled:text-white/20 text-white/60 rounded transition-colors"
                  style={{ fontFamily: "'Tango', sans-serif", fontSize: '16px' }}
                >
                  {isSubmitting ? '...' : 'send'}
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
