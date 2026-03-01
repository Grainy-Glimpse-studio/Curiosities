import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Check, Trash2 } from 'lucide-react';

interface ApiSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onApiKeyChange: (key: string | null) => void;
  currentApiKey: string | null;
}

const STORAGE_KEY = 'deepgram_api_key';

const ApiSettings: React.FC<ApiSettingsProps> = ({
  isOpen,
  onClose,
  onApiKeyChange,
  currentApiKey,
}) => {
  const [inputKey, setInputKey] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Load from localStorage when opening
      const storedKey = localStorage.getItem(STORAGE_KEY);
      if (storedKey) {
        setInputKey(storedKey);
      } else {
        setInputKey('');
      }
      setSaved(false);
    }
  }, [isOpen]);

  const handleSave = () => {
    const trimmedKey = inputKey.trim();
    if (trimmedKey) {
      localStorage.setItem(STORAGE_KEY, trimmedKey);
      onApiKeyChange(trimmedKey);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const handleClear = () => {
    localStorage.removeItem(STORAGE_KEY);
    setInputKey('');
    onApiKeyChange(null);
  };

  const content = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]"
            onClick={onClose}
          />

          {/* Window */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[201]"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="w-[420px] rounded-lg overflow-hidden backdrop-blur-xl border border-white/10"
              style={{ background: 'rgba(0,0,0,0.5)' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <h2
                  className="text-white/90 text-sm tracking-wide"
                  style={{ fontFamily: "'Consulate', monospace" }}
                >
                  Speech Recognition
                </h2>
                <button
                  onClick={onClose}
                  className="p-1 text-white/40 hover:text-white/70 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Content */}
              <div className="p-5 space-y-5">
                {/* Mode explanation */}
                <div
                  className="space-y-3 text-[13px]"
                  style={{ fontFamily: "'Consulate', monospace" }}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 ${currentApiKey ? 'bg-green-400' : 'bg-white/30'}`} />
                    <div>
                      <p className="text-white/90 font-medium">HD Mode</p>
                      <p className="text-white/50 text-[12px]">Powered by Deepgram. Higher accuracy.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 ${!currentApiKey ? 'bg-green-400' : 'bg-white/30'}`} />
                    <div>
                      <p className="text-white/90 font-medium">Standard Mode</p>
                      <p className="text-white/50 text-[12px]">Browser built-in. Less accurate but always free.</p>
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-white/10" />

                {/* API Key input */}
                <div className="space-y-2">
                  <label
                    className="text-white/70 text-[12px] tracking-wide"
                    style={{ fontFamily: "'Consulate', monospace" }}
                  >
                    Deepgram API Key
                  </label>
                  <input
                    type="password"
                    value={inputKey}
                    onChange={(e) => setInputKey(e.target.value)}
                    placeholder="Enter your API key..."
                    className="w-full px-3 py-2.5 bg-black/40 border border-white/20 rounded text-white/90 text-[13px] placeholder:text-white/30 focus:outline-none focus:border-white/40 transition-colors"
                    style={{ fontFamily: "'Consulate', monospace" }}
                  />
                </div>

                {/* Get API key link */}
                <a
                  href="https://console.deepgram.com/signup"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-[12px] text-white/50 hover:text-white/70 transition-colors"
                  style={{ fontFamily: "'Consulate', monospace" }}
                >
                  <ExternalLink size={12} />
                  Get your free API key
                </a>

                {/* Info */}
                <div
                  className="text-[11px] text-white/40 space-y-1"
                  style={{ fontFamily: "'Consulate', monospace" }}
                >
                  <p>$200 free credits (~770 hours of transcription)</p>
                  <p>Your key is stored locally and never shared.</p>
                </div>

                {/* Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleSave}
                    disabled={!inputKey.trim()}
                    className={`flex items-center gap-2 px-4 py-2 rounded text-[12px] transition-all ${
                      inputKey.trim()
                        ? 'bg-white/10 hover:bg-white/20 text-white/90'
                        : 'bg-white/5 text-white/30 cursor-not-allowed'
                    }`}
                    style={{ fontFamily: "'Consulate', monospace" }}
                  >
                    {saved ? (
                      <>
                        <Check size={14} />
                        Saved
                      </>
                    ) : (
                      'Save'
                    )}
                  </button>
                  {currentApiKey && (
                    <button
                      onClick={handleClear}
                      className="flex items-center gap-2 px-4 py-2 rounded text-[12px] text-white/50 hover:text-red-400 hover:bg-red-400/10 transition-all"
                      style={{ fontFamily: "'Consulate', monospace" }}
                    >
                      <Trash2 size={14} />
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
};

export default ApiSettings;

// Helper to load API key from localStorage
export const loadApiKey = (): string | null => {
  return localStorage.getItem(STORAGE_KEY);
};
