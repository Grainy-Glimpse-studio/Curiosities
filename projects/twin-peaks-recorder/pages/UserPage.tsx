import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ExternalLink, Check, Loader2, LogOut, HelpCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// API info
const API_INFO = {
  deepgram: {
    name: 'Deepgram',
    description: 'Cloud-based speech recognition. Supports English, Chinese (zh-TW), and 30+ languages.',
    pros: ['High accuracy', 'Low latency (<300ms)', 'Good for English'],
    cons: ['AUTO mode uses 2x quota', 'Chinese uses zh-TW (Traditional)'],
    price: '$0.46/hour',
    freeCredits: '$200 free (~435 hours)',
    signupUrl: 'https://console.deepgram.com/signup',
  },
  dashscope: {
    name: '千问 (百炼)',
    description: '阿里云实时语音识别。支持中英日混合，20+ 种中文方言。',
    pros: ['中英日混合识别', '支持粤语/闽南语等方言', '价格便宜'],
    cons: ['需要阿里云账号'],
    price: '¥1.2/hour (~$0.17)',
    freeCredits: '新用户有免费额度',
    signupUrl: 'https://bailian.console.aliyun.com/',
  },
  openai: {
    name: 'OpenAI',
    description: 'For cleaning up transcripts, auto-tagging, and summarization.',
    pros: ['High quality text processing', 'Auto-tagging', 'Summarization'],
    cons: ['Pay as you go'],
    price: 'GPT-4o-mini: ~$0.15/1M tokens',
    freeCredits: 'Very affordable',
    signupUrl: 'https://platform.openai.com/api-keys',
  },
};

const UserPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, apiKeys, saveKeys, logout, loading: authLoading } = useAuth();

  // Active tab
  const [activeTab, setActiveTab] = useState<'profile' | 'speech' | 'text'>('profile');

  // API keys (local state for editing)
  const [deepgramKey, setDeepgramKey] = useState('');
  const [dashscopeKey, setDashscopeKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [primarySpeechApi, setPrimarySpeechApi] = useState<'deepgram' | 'dashscope'>('deepgram');

  // Info popover
  const [showInfo, setShowInfo] = useState<string | null>(null);

  // Save status
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load keys from context
  useEffect(() => {
    if (apiKeys) {
      setDeepgramKey(apiKeys.deepgram || '');
      setDashscopeKey(apiKeys.dashscope || '');
      setOpenaiKey(apiKeys.openai || '');
      setPrimarySpeechApi(apiKeys.primarySpeechApi || 'deepgram');
    }
  }, [apiKeys]);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/');
    }
  }, [user, authLoading, navigate]);


  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    setError(null);

    try {
      await saveKeys({
        deepgram: deepgramKey || undefined,
        dashscope: dashscopeKey || undefined,
        openai: openaiKey || undefined,
        primarySpeechApi: primarySpeechApi,
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <Loader2 className="animate-spin text-white/50" size={32} />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#121212] text-white">
      {/* Centered Layout */}
      <div className="max-w-[800px] mx-auto min-h-screen flex pt-16">
        {/* Sidebar */}
        <div className="w-[180px] pr-8">
          {/* Back */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors text-[13px] mb-10"
            style={{ fontFamily: "'Consulate', monospace" }}
          >
            <ArrowLeft size={14} />
            Back
          </button>

          {/* Nav */}
          <nav className="space-y-1">
            {[
              { id: 'profile', label: 'Profile' },
              { id: 'speech', label: 'Speech API' },
              { id: 'text', label: 'Text API' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full px-4 py-2.5 text-left text-[14px] rounded transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white/10 text-white/90'
                    : 'text-white/40 hover:text-white/70'
                }`}
                style={{ fontFamily: "'Consulate', monospace" }}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-white/30 hover:text-white/50 transition-colors text-[12px] mt-12"
            style={{ fontFamily: "'Consulate', monospace" }}
          >
            <LogOut size={12} />
            Logout
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 border-l border-white/10 pl-10">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'profile' && (
              <ProfileSection user={user} />
            )}

            {activeTab === 'speech' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-white/90 text-[18px] mb-2" style={{ fontFamily: "'Consulate', monospace" }}>
                    Speech Recognition
                  </h2>
                  <p className="text-white/40 text-[14px]" style={{ fontFamily: "'Consulate', monospace" }}>
                    Fill in one or both. If both are configured, check "Use as Primary" to set the preferred one.
                  </p>
                </div>

                {/* Deepgram */}
                <SpeechApiInput
                  api="deepgram"
                  info={API_INFO.deepgram}
                  value={deepgramKey}
                  onChange={setDeepgramKey}
                  isPrimary={primarySpeechApi === 'deepgram'}
                  onSetPrimary={() => setPrimarySpeechApi('deepgram')}
                  showBothConfigured={!!deepgramKey && !!dashscopeKey}
                  showInfo={showInfo}
                  onToggleInfo={setShowInfo}
                />

                {/* DashScope / 千问 */}
                <SpeechApiInput
                  api="dashscope"
                  info={API_INFO.dashscope}
                  value={dashscopeKey}
                  onChange={setDashscopeKey}
                  isPrimary={primarySpeechApi === 'dashscope'}
                  onSetPrimary={() => setPrimarySpeechApi('dashscope')}
                  showBothConfigured={!!deepgramKey && !!dashscopeKey}
                  showInfo={showInfo}
                  onToggleInfo={setShowInfo}
                />

                {/* Save Section */}
                <SaveSection
                  error={error}
                  saving={saving}
                  saved={saved}
                  onSave={handleSave}
                />
              </div>
            )}

            {activeTab === 'text' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-white/90 text-[18px] mb-2" style={{ fontFamily: "'Consulate', monospace" }}>
                    Text Processing
                  </h2>
                  <p className="text-white/40 text-[14px]" style={{ fontFamily: "'Consulate', monospace" }}>
                    For cleaning up transcripts and auto-tagging.
                  </p>
                </div>

                {/* OpenAI */}
                <ApiKeyInput
                  api="openai"
                  info={API_INFO.openai}
                  value={openaiKey}
                  onChange={setOpenaiKey}
                  showInfo={showInfo}
                  onToggleInfo={setShowInfo}
                />

                {/* Save Section */}
                <SaveSection
                  error={error}
                  saving={saving}
                  saved={saved}
                  onSave={handleSave}
                />
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

// Profile Section
const ProfileSection: React.FC<{ user: any }> = ({ user }) => {
  return (
    <div style={{ fontFamily: "'Consulate', monospace" }}>
      <h2 className="text-white/90 text-[18px] mb-6">Profile</h2>

      <div className="space-y-4">
        <div className="flex justify-between items-center py-3 border-b border-white/10">
          <span className="text-white/40 text-[14px]">Email</span>
          <span className="text-white/80 text-[14px]">{user.email}</span>
        </div>

        <div className="flex justify-between items-center py-3 border-b border-white/10">
          <span className="text-white/40 text-[14px]">Status</span>
          <span className="text-white/80 text-[14px]">Registered User</span>
        </div>

        <div className="flex justify-between items-center py-3 border-b border-white/10">
          <span className="text-white/40 text-[14px]">HD Quota</span>
          <span className="text-white/80 text-[14px]">Unlimited (with API keys)</span>
        </div>

        <div className="flex justify-between items-center py-3">
          <span className="text-white/40 text-[14px]">Storage</span>
          <span className="text-white/80 text-[14px]">Cloud sync</span>
        </div>
      </div>

      <p className="text-white/30 text-[12px] mt-8">
        Your API keys are encrypted with your password before storage.
      </p>
    </div>
  );
};

// Info Button - toggles inline expansion
interface InfoButtonProps {
  api: string;
  showInfo: string | null;
  onToggleInfo: (api: string | null) => void;
}

const InfoButton: React.FC<InfoButtonProps> = ({ api, showInfo, onToggleInfo }) => {
  const isOpen = showInfo === api;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggleInfo(isOpen ? null : api);
      }}
      className={`p-1 rounded transition-colors ${isOpen ? 'text-white/70' : 'text-white/30 hover:text-white/50'}`}
    >
      <HelpCircle size={14} />
    </button>
  );
};

// Inline Info Panel - shows below input when expanded
interface InfoPanelProps {
  info: typeof API_INFO.deepgram;
  isOpen: boolean;
}

const InfoPanel: React.FC<InfoPanelProps> = ({ info, isOpen }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div
            className="mt-3 p-4 rounded-lg bg-white/[0.03] border border-white/10"
            style={{ fontFamily: "'Consulate', monospace" }}
          >
            {/* Description */}
            <p className="text-white/50 text-[13px] mb-4">
              {info.description}
            </p>

            {/* Pros & Cons */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-white/40 text-[11px] uppercase tracking-wider mb-2">Pros</p>
                <ul className="space-y-1">
                  {info.pros.map((pro, i) => (
                    <li key={i} className="text-white/50 text-[12px] flex items-start gap-1.5">
                      <span className="text-green-400/50">+</span> {pro}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-white/40 text-[11px] uppercase tracking-wider mb-2">Cons</p>
                <ul className="space-y-1">
                  {info.cons.map((con, i) => (
                    <li key={i} className="text-white/50 text-[12px] flex items-start gap-1.5">
                      <span className="text-yellow-400/50">-</span> {con}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Price */}
            <div className="flex gap-4 text-[12px]">
              <span><span className="text-white/30">Price:</span> <span className="text-white/50">{info.price}</span></span>
              <span><span className="text-white/30">Free:</span> <span className="text-white/50">{info.freeCredits}</span></span>
            </div>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Speech API Input Component (with Primary checkbox)
interface SpeechApiInputProps {
  api: string;
  info: typeof API_INFO.deepgram;
  value: string;
  onChange: (value: string) => void;
  isPrimary: boolean;
  onSetPrimary: () => void;
  showBothConfigured: boolean;
  showInfo: string | null;
  onToggleInfo: (api: string | null) => void;
}

const SpeechApiInput: React.FC<SpeechApiInputProps> = ({
  api,
  info,
  value,
  onChange,
  isPrimary,
  onSetPrimary,
  showBothConfigured,
  showInfo,
  onToggleInfo,
}) => {
  const isInfoOpen = showInfo === api;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-white/70 text-[15px]" style={{ fontFamily: "'Consulate', monospace" }}>
          {info.name}
        </span>
        <InfoButton
          api={api}
          showInfo={showInfo}
          onToggleInfo={onToggleInfo}
        />
      </div>

      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Enter ${info.name} API key...`}
        className="w-full px-4 py-2.5 bg-black/40 border border-white/15 rounded text-white/90 text-[14px] placeholder:text-white/25 focus:outline-none focus:border-white/30 transition-colors"
        style={{ fontFamily: "'Consulate', monospace" }}
      />

      <div className="flex items-center justify-between">
        <a
          href={info.signupUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[12px] text-white/40 hover:text-white/60 transition-colors"
          style={{ fontFamily: "'Consulate', monospace" }}
        >
          <ExternalLink size={12} />
          Get API Key
        </a>

        {/* Primary toggle - only show when both are configured */}
        {showBothConfigured && (
          <button
            type="button"
            onClick={onSetPrimary}
            className={`text-[12px] transition-colors ${
              isPrimary
                ? 'text-violet-400'
                : 'text-white/40 hover:text-white/60'
            }`}
            style={{ fontFamily: "'Consulate', monospace" }}
          >
            {isPrimary ? '✦ Primary' : 'Use as Primary'}
          </button>
        )}
      </div>

      {/* Inline expandable info */}
      <InfoPanel info={info} isOpen={isInfoOpen} />
    </div>
  );
};

// API Key Input Component (for Text API)
interface ApiKeyInputProps {
  api: string;
  info: typeof API_INFO.openai;
  value: string;
  onChange: (value: string) => void;
  showInfo: string | null;
  onToggleInfo: (api: string | null) => void;
}

const ApiKeyInput: React.FC<ApiKeyInputProps> = ({ api, info, value, onChange, showInfo, onToggleInfo }) => {
  const isInfoOpen = showInfo === api;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-white/70 text-[15px]" style={{ fontFamily: "'Consulate', monospace" }}>
          {info.name}
        </span>
        <InfoButton
          api={api}
          showInfo={showInfo}
          onToggleInfo={onToggleInfo}
        />
      </div>

      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Enter ${info.name} API key...`}
        className="w-full px-4 py-2.5 bg-black/40 border border-white/15 rounded text-white/90 text-[14px] placeholder:text-white/25 focus:outline-none focus:border-white/30 transition-colors"
        style={{ fontFamily: "'Consulate', monospace" }}
      />

      <a
        href={info.signupUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-[12px] text-white/40 hover:text-white/60 transition-colors"
        style={{ fontFamily: "'Consulate', monospace" }}
      >
        <ExternalLink size={12} />
        Get API Key
      </a>

      {/* Inline expandable info */}
      <InfoPanel info={info} isOpen={isInfoOpen} />
    </div>
  );
};

// Save Section Component
interface SaveSectionProps {
  error: string | null;
  saving: boolean;
  saved: boolean;
  onSave: () => void;
}

const SaveSection: React.FC<SaveSectionProps> = ({
  error,
  saving,
  saved,
  onSave,
}) => {
  return (
    <div className="pt-6 border-t border-white/10">
      {error && (
        <div className="mb-4 p-3 rounded bg-red-500/15 border border-red-500/25 text-red-400 text-[13px]" style={{ fontFamily: "'Consulate', monospace" }}>
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 rounded bg-white/10 hover:bg-white/15 disabled:opacity-50 text-white/80 text-[14px] transition-all"
          style={{ fontFamily: "'Consulate', monospace" }}
        >
          {saving ? (
            <Loader2 className="animate-spin" size={16} />
          ) : saved ? (
            <Check size={16} />
          ) : null}
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>
    </div>
  );
};

export default UserPage;
