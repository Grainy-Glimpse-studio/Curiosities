import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, HelpCircle, ExternalLink, Check, ChevronRight } from 'lucide-react';

// Storage keys
const STORAGE_KEYS = {
  deepgram: 'deepgram_api_key',
  aliyunAccessKeyId: 'aliyun_access_key_id',
  aliyunAccessKeySecret: 'aliyun_access_key_secret',
  aliyunAppKey: 'aliyun_app_key',
  openai: 'openai_api_key',
  speechMode: 'speech_mode', // 'standard' | 'hd'
};

export interface AliyunKeys {
  accessKeyId: string | null;
  accessKeySecret: string | null;
  appKey: string | null;
}

export interface ApiKeys {
  deepgram: string | null;
  aliyun: AliyunKeys;
  openai: string | null;
}

export interface ApiSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onApiKeysChange: (keys: ApiKeys) => void;
  onSpeechModeChange: (mode: 'standard' | 'hd') => void;
  currentKeys: ApiKeys;
  currentSpeechMode: 'standard' | 'hd';
}

// API info data
const API_INFO = {
  deepgram: {
    name: 'Deepgram',
    price: '$0.46/hour',
    freeCredits: '$200 free credits (~435 hours)',
    features: ['High accuracy', 'Low latency (<300ms)', 'English, Spanish, French, etc.'],
    limitations: ['Does not support Chinese in multilingual mode', 'Need to manually switch language'],
    signupUrl: 'https://console.deepgram.com/signup',
  },
  aliyun: {
    name: '阿里云 (Alibaba Cloud)',
    price: '¥3.5/hour (~$0.48)',
    freeCredits: '3 months free trial',
    features: ['Chinese-English mixed recognition', 'Supports 50+ languages', '20+ Chinese dialects'],
    limitations: ['Outputs Simplified Chinese only', 'Requires 3 keys: AccessKey ID, Secret, AppKey'],
    signupUrl: 'https://ai.aliyun.com/nls',
  },
};

const ApiSettings: React.FC<ApiSettingsProps> = ({
  isOpen,
  onClose,
  onApiKeysChange,
  onSpeechModeChange,
  currentKeys,
  currentSpeechMode,
}) => {
  // Tab state
  const [activeTab, setActiveTab] = useState<'speech' | 'text'>('speech');

  // Speech mode
  const [speechMode, setSpeechMode] = useState<'standard' | 'hd'>(currentSpeechMode);

  // API keys input
  const [deepgramKey, setDeepgramKey] = useState('');
  const [aliyunAccessKeyId, setAliyunAccessKeyId] = useState('');
  const [aliyunAccessKeySecret, setAliyunAccessKeySecret] = useState('');
  const [aliyunAppKey, setAliyunAppKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');

  // Which API detail is expanded
  const [expandedApi, setExpandedApi] = useState<'deepgram' | 'aliyun' | null>(null);

  // Save status
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Load from localStorage
      setDeepgramKey(localStorage.getItem(STORAGE_KEYS.deepgram) || '');
      setAliyunAccessKeyId(localStorage.getItem(STORAGE_KEYS.aliyunAccessKeyId) || '');
      setAliyunAccessKeySecret(localStorage.getItem(STORAGE_KEYS.aliyunAccessKeySecret) || '');
      setAliyunAppKey(localStorage.getItem(STORAGE_KEYS.aliyunAppKey) || '');
      setOpenaiKey(localStorage.getItem(STORAGE_KEYS.openai) || '');
      setSpeechMode((localStorage.getItem(STORAGE_KEYS.speechMode) as 'standard' | 'hd') || 'standard');
      setSaved(false);
      setExpandedApi(null);
    }
  }, [isOpen]);

  const handleSave = () => {
    // Save speech mode
    localStorage.setItem(STORAGE_KEYS.speechMode, speechMode);
    onSpeechModeChange(speechMode);

    // Save API keys
    const trimmedDeepgram = deepgramKey.trim();
    const trimmedAliyunAccessKeyId = aliyunAccessKeyId.trim();
    const trimmedAliyunAccessKeySecret = aliyunAccessKeySecret.trim();
    const trimmedAliyunAppKey = aliyunAppKey.trim();
    const trimmedOpenai = openaiKey.trim();

    // Deepgram
    if (trimmedDeepgram) {
      localStorage.setItem(STORAGE_KEYS.deepgram, trimmedDeepgram);
    } else {
      localStorage.removeItem(STORAGE_KEYS.deepgram);
    }

    // Aliyun (3 keys)
    if (trimmedAliyunAccessKeyId) {
      localStorage.setItem(STORAGE_KEYS.aliyunAccessKeyId, trimmedAliyunAccessKeyId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.aliyunAccessKeyId);
    }

    if (trimmedAliyunAccessKeySecret) {
      localStorage.setItem(STORAGE_KEYS.aliyunAccessKeySecret, trimmedAliyunAccessKeySecret);
    } else {
      localStorage.removeItem(STORAGE_KEYS.aliyunAccessKeySecret);
    }

    if (trimmedAliyunAppKey) {
      localStorage.setItem(STORAGE_KEYS.aliyunAppKey, trimmedAliyunAppKey);
    } else {
      localStorage.removeItem(STORAGE_KEYS.aliyunAppKey);
    }

    // OpenAI
    if (trimmedOpenai) {
      localStorage.setItem(STORAGE_KEYS.openai, trimmedOpenai);
    } else {
      localStorage.removeItem(STORAGE_KEYS.openai);
    }

    onApiKeysChange({
      deepgram: trimmedDeepgram || null,
      aliyun: {
        accessKeyId: trimmedAliyunAccessKeyId || null,
        accessKeySecret: trimmedAliyunAccessKeySecret || null,
        appKey: trimmedAliyunAppKey || null,
      },
      openai: trimmedOpenai || null,
    });

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
              className="w-[680px] max-h-[80vh] rounded-lg overflow-hidden backdrop-blur-xl border border-white/10"
              style={{ background: 'rgba(0,0,0,0.5)' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <h2
                  className="text-white/90 text-sm tracking-wide"
                  style={{ fontFamily: "'Consulate', monospace" }}
                >
                  API Settings
                </h2>
                <button
                  onClick={onClose}
                  className="p-1 text-white/40 hover:text-white/70 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-white/10">
                <button
                  onClick={() => setActiveTab('speech')}
                  className={`flex-1 px-4 py-3 text-[13px] transition-colors ${
                    activeTab === 'speech'
                      ? 'text-white/90 border-b-2 border-white/50'
                      : 'text-white/40 hover:text-white/60'
                  }`}
                  style={{ fontFamily: "'Consulate', monospace" }}
                >
                  🎤 Speech Recognition
                </button>
                <button
                  onClick={() => setActiveTab('text')}
                  className={`flex-1 px-4 py-3 text-[13px] transition-colors ${
                    activeTab === 'text'
                      ? 'text-white/90 border-b-2 border-white/50'
                      : 'text-white/40 hover:text-white/60'
                  }`}
                  style={{ fontFamily: "'Consulate', monospace" }}
                >
                  📝 Text Processing
                </button>
              </div>

              {/* Content */}
              <div className="p-5 overflow-y-auto max-h-[calc(80vh-140px)]">
                {activeTab === 'speech' ? (
                  <SpeechTab
                    speechMode={speechMode}
                    setSpeechMode={setSpeechMode}
                    deepgramKey={deepgramKey}
                    setDeepgramKey={setDeepgramKey}
                    aliyunAccessKeyId={aliyunAccessKeyId}
                    setAliyunAccessKeyId={setAliyunAccessKeyId}
                    aliyunAccessKeySecret={aliyunAccessKeySecret}
                    setAliyunAccessKeySecret={setAliyunAccessKeySecret}
                    aliyunAppKey={aliyunAppKey}
                    setAliyunAppKey={setAliyunAppKey}
                    expandedApi={expandedApi}
                    setExpandedApi={setExpandedApi}
                  />
                ) : (
                  <TextTab
                    openaiKey={openaiKey}
                    setOpenaiKey={setOpenaiKey}
                  />
                )}

                {/* Save Button */}
                <div className="flex justify-end mt-6 pt-4 border-t border-white/10">
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-2 px-5 py-2.5 rounded bg-white/10 hover:bg-white/20 text-white/90 text-[13px] transition-all"
                    style={{ fontFamily: "'Consulate', monospace" }}
                  >
                    {saved ? (
                      <>
                        <Check size={14} />
                        Saved
                      </>
                    ) : (
                      'Save Settings'
                    )}
                  </button>
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

// Speech Recognition Tab
interface SpeechTabProps {
  speechMode: 'standard' | 'hd';
  setSpeechMode: (mode: 'standard' | 'hd') => void;
  deepgramKey: string;
  setDeepgramKey: (key: string) => void;
  aliyunAccessKeyId: string;
  setAliyunAccessKeyId: (key: string) => void;
  aliyunAccessKeySecret: string;
  setAliyunAccessKeySecret: (key: string) => void;
  aliyunAppKey: string;
  setAliyunAppKey: (key: string) => void;
  expandedApi: 'deepgram' | 'aliyun' | null;
  setExpandedApi: (api: 'deepgram' | 'aliyun' | null) => void;
}

const SpeechTab: React.FC<SpeechTabProps> = ({
  speechMode,
  setSpeechMode,
  deepgramKey,
  setDeepgramKey,
  aliyunAccessKeyId,
  setAliyunAccessKeyId,
  aliyunAccessKeySecret,
  setAliyunAccessKeySecret,
  aliyunAppKey,
  setAliyunAppKey,
  expandedApi,
  setExpandedApi,
}) => {
  return (
    <div className="flex gap-4">
      {/* Column 1: Mode Selection */}
      <div className="w-[140px] flex-shrink-0">
        <p
          className="text-white/50 text-[11px] mb-3 uppercase tracking-wider"
          style={{ fontFamily: "'Consulate', monospace" }}
        >
          Mode
        </p>

        <div className="space-y-2">
          <button
            onClick={() => setSpeechMode('standard')}
            className={`w-full px-3 py-3 rounded text-left text-[13px] transition-all ${
              speechMode === 'standard'
                ? 'bg-white/15 text-white/90 border border-white/30'
                : 'bg-white/5 text-white/50 border border-transparent hover:bg-white/10'
            }`}
            style={{ fontFamily: "'Consulate', monospace" }}
          >
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${speechMode === 'standard' ? 'bg-green-400' : 'bg-white/30'}`} />
              Standard
            </div>
          </button>

          <button
            onClick={() => setSpeechMode('hd')}
            className={`w-full px-3 py-3 rounded text-left text-[13px] transition-all ${
              speechMode === 'hd'
                ? 'bg-white/15 text-white/90 border border-white/30'
                : 'bg-white/5 text-white/50 border border-transparent hover:bg-white/10'
            }`}
            style={{ fontFamily: "'Consulate', monospace" }}
          >
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${speechMode === 'hd' ? 'bg-green-400' : 'bg-white/30'}`} />
              HD
            </div>
          </button>
        </div>
      </div>

      {/* Column 2: Mode Details / API Inputs */}
      <div className="flex-1 border-l border-white/10 pl-4">
        <AnimatePresence mode="wait">
          {speechMode === 'standard' ? (
            <motion.div
              key="standard"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              <p
                className="text-white/50 text-[11px] mb-3 uppercase tracking-wider"
                style={{ fontFamily: "'Consulate', monospace" }}
              >
                About Standard Mode
              </p>
              <div
                className="text-[13px] text-white/70 space-y-3"
                style={{ fontFamily: "'Consulate', monospace" }}
              >
                <p>Uses your browser's built-in speech recognition.</p>
                <ul className="space-y-2 text-[12px] text-white/50">
                  <li>• Free, no API key needed</li>
                  <li>• Auto-detects language</li>
                  <li>• Works offline (in some browsers)</li>
                  <li>• Accuracy may vary by browser</li>
                </ul>
                <p className="text-[11px] text-white/40 pt-2">
                  Recommended for casual use or when you don't need high accuracy.
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="hd"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              <p
                className="text-white/50 text-[11px] mb-3 uppercase tracking-wider"
                style={{ fontFamily: "'Consulate', monospace" }}
              >
                HD Mode APIs
              </p>

              <div className="space-y-4">
                {/* Deepgram */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label
                      className="text-white/70 text-[12px]"
                      style={{ fontFamily: "'Consulate', monospace" }}
                    >
                      Deepgram
                    </label>
                    <button
                      onClick={() => setExpandedApi(expandedApi === 'deepgram' ? null : 'deepgram')}
                      className="p-1 text-white/40 hover:text-white/70 transition-colors"
                      title="More info"
                    >
                      <HelpCircle size={14} />
                    </button>
                  </div>
                  <input
                    type="password"
                    value={deepgramKey}
                    onChange={(e) => setDeepgramKey(e.target.value)}
                    placeholder="Enter Deepgram API key..."
                    className="w-full px-3 py-2 bg-black/40 border border-white/20 rounded text-white/90 text-[12px] placeholder:text-white/30 focus:outline-none focus:border-white/40 transition-colors"
                    style={{ fontFamily: "'Consulate', monospace" }}
                  />
                  <p className="text-[10px] text-white/40" style={{ fontFamily: "'Consulate', monospace" }}>
                    Best for: English and other Western languages
                  </p>
                </div>

                {/* Aliyun */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label
                      className="text-white/70 text-[12px]"
                      style={{ fontFamily: "'Consulate', monospace" }}
                    >
                      阿里云 (Alibaba Cloud)
                    </label>
                    <button
                      onClick={() => setExpandedApi(expandedApi === 'aliyun' ? null : 'aliyun')}
                      className="p-1 text-white/40 hover:text-white/70 transition-colors"
                      title="More info"
                    >
                      <HelpCircle size={14} />
                    </button>
                  </div>

                  <div className="space-y-2 pl-2 border-l border-white/10">
                    <div>
                      <label className="text-white/40 text-[10px]" style={{ fontFamily: "'Consulate', monospace" }}>
                        AccessKey ID
                      </label>
                      <input
                        type="password"
                        value={aliyunAccessKeyId}
                        onChange={(e) => setAliyunAccessKeyId(e.target.value)}
                        placeholder="LTAI5t..."
                        className="w-full px-3 py-1.5 bg-black/40 border border-white/20 rounded text-white/90 text-[11px] placeholder:text-white/30 focus:outline-none focus:border-white/40 transition-colors"
                        style={{ fontFamily: "'Consulate', monospace" }}
                      />
                    </div>

                    <div>
                      <label className="text-white/40 text-[10px]" style={{ fontFamily: "'Consulate', monospace" }}>
                        AccessKey Secret
                      </label>
                      <input
                        type="password"
                        value={aliyunAccessKeySecret}
                        onChange={(e) => setAliyunAccessKeySecret(e.target.value)}
                        placeholder="Enter secret..."
                        className="w-full px-3 py-1.5 bg-black/40 border border-white/20 rounded text-white/90 text-[11px] placeholder:text-white/30 focus:outline-none focus:border-white/40 transition-colors"
                        style={{ fontFamily: "'Consulate', monospace" }}
                      />
                    </div>

                    <div>
                      <label className="text-white/40 text-[10px]" style={{ fontFamily: "'Consulate', monospace" }}>
                        AppKey
                      </label>
                      <input
                        type="password"
                        value={aliyunAppKey}
                        onChange={(e) => setAliyunAppKey(e.target.value)}
                        placeholder="Enter app key..."
                        className="w-full px-3 py-1.5 bg-black/40 border border-white/20 rounded text-white/90 text-[11px] placeholder:text-white/30 focus:outline-none focus:border-white/40 transition-colors"
                        style={{ fontFamily: "'Consulate', monospace" }}
                      />
                    </div>
                  </div>

                  <p className="text-[10px] text-white/40" style={{ fontFamily: "'Consulate', monospace" }}>
                    Best for: Chinese + English mixed speech
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Column 3: API Details (expandable) */}
      <AnimatePresence>
        {expandedApi && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 200 }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.2 }}
            className="border-l border-white/10 pl-4 overflow-hidden"
          >
            <ApiDetailPanel api={expandedApi} onClose={() => setExpandedApi(null)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// API Detail Panel
const ApiDetailPanel: React.FC<{ api: 'deepgram' | 'aliyun'; onClose: () => void }> = ({ api, onClose }) => {
  const info = API_INFO[api];

  return (
    <div className="text-[11px]" style={{ fontFamily: "'Consulate', monospace" }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-white/70 font-medium">{info.name}</p>
      </div>

      <div className="space-y-3 text-white/50">
        <div>
          <p className="text-white/40 text-[10px] uppercase mb-1">Price</p>
          <p>{info.price}</p>
        </div>

        <div>
          <p className="text-white/40 text-[10px] uppercase mb-1">Free Credits</p>
          <p>{info.freeCredits}</p>
        </div>

        <div>
          <p className="text-white/40 text-[10px] uppercase mb-1">Features</p>
          <ul className="space-y-1">
            {info.features.map((f, i) => (
              <li key={i}>• {f}</li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-white/40 text-[10px] uppercase mb-1">Limitations</p>
          <ul className="space-y-1 text-yellow-500/70">
            {info.limitations.map((l, i) => (
              <li key={i}>⚠ {l}</li>
            ))}
          </ul>
        </div>

        <a
          href={info.signupUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-white/50 hover:text-white/70 transition-colors pt-2"
        >
          <ExternalLink size={10} />
          Get API Key
        </a>
      </div>
    </div>
  );
};

// Text Processing Tab
interface TextTabProps {
  openaiKey: string;
  setOpenaiKey: (key: string) => void;
}

const TextTab: React.FC<TextTabProps> = ({ openaiKey, setOpenaiKey }) => {
  return (
    <div style={{ fontFamily: "'Consulate', monospace" }}>
      <p className="text-white/50 text-[11px] mb-4 uppercase tracking-wider">
        Text Processing API
      </p>

      <div className="space-y-4">
        <div className="text-[13px] text-white/70 space-y-2">
          <p>Used for:</p>
          <ul className="text-[12px] text-white/50 space-y-1">
            <li>• <strong>Clean up</strong> - Remove filler words, organize text</li>
            <li>• <strong>Auto-tag</strong> - Automatically categorize recordings</li>
            <li>• <strong>Re-transcribe</strong> - Improve accuracy (coming soon)</li>
          </ul>
        </div>

        <div className="h-px bg-white/10" />

        <div className="space-y-2">
          <label className="text-white/70 text-[12px]">
            OpenAI API Key
          </label>
          <input
            type="password"
            value={openaiKey}
            onChange={(e) => setOpenaiKey(e.target.value)}
            placeholder="Enter OpenAI API key..."
            className="w-full px-3 py-2 bg-black/40 border border-white/20 rounded text-white/90 text-[12px] placeholder:text-white/30 focus:outline-none focus:border-white/40 transition-colors"
          />
          <p className="text-[10px] text-white/40">
            Uses GPT-4o-mini for text processing. Very affordable.
          </p>
        </div>

        <a
          href="https://platform.openai.com/api-keys"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-[11px] text-white/50 hover:text-white/70 transition-colors"
        >
          <ExternalLink size={10} />
          Get OpenAI API Key
        </a>

        <div className="text-[10px] text-white/40 pt-2">
          <p>Note: Underlined words will be preserved during cleanup.</p>
        </div>
      </div>
    </div>
  );
};

export default ApiSettings;

// Helper to load API keys from localStorage
export const loadApiKeys = (): ApiKeys => {
  return {
    deepgram: localStorage.getItem(STORAGE_KEYS.deepgram),
    aliyun: {
      accessKeyId: localStorage.getItem(STORAGE_KEYS.aliyunAccessKeyId),
      accessKeySecret: localStorage.getItem(STORAGE_KEYS.aliyunAccessKeySecret),
      appKey: localStorage.getItem(STORAGE_KEYS.aliyunAppKey),
    },
    openai: localStorage.getItem(STORAGE_KEYS.openai),
  };
};

export const loadSpeechMode = (): 'standard' | 'hd' => {
  return (localStorage.getItem(STORAGE_KEYS.speechMode) as 'standard' | 'hd') || 'standard';
};
