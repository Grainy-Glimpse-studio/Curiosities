import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// Storage keys
const STORAGE_KEYS = {
  speechMode: 'speech_mode',
};

export interface ApiSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onSpeechModeChange: (mode: 'standard' | 'hd') => void;
  currentSpeechMode: 'standard' | 'hd';
  indicatorColor?: string;
}

const ApiSettings: React.FC<ApiSettingsProps> = ({
  isOpen,
  onClose,
  onSpeechModeChange,
  currentSpeechMode,
  indicatorColor = '#b69fbb',
}) => {
  const { user, login, register, logout, loading: authLoading } = useAuth();

  // Speech mode
  const [speechMode, setSpeechMode] = useState<'standard' | 'hd'>(currentSpeechMode);

  // Auth state
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Save status
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSpeechMode((localStorage.getItem(STORAGE_KEYS.speechMode) as 'standard' | 'hd') || 'standard');
      setSaved(false);
      setAuthError(null);
      setAuthSuccess(null);
    }
  }, [isOpen]);

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEYS.speechMode, speechMode);
    onSpeechModeChange(speechMode);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);
    setIsSubmitting(true);

    try {
      if (authMode === 'register') {
        if (password !== confirmPassword) {
          setAuthError('Passwords do not match');
          setIsSubmitting(false);
          return;
        }
        if (password.length < 6) {
          setAuthError('Password must be at least 6 characters');
          setIsSubmitting(false);
          return;
        }
        await register(email, password);
        // 注册成功，提示验证邮箱
        setAuthSuccess('Check your email to confirm your account.');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
      } else {
        await login(email, password);
        // 登录成功后清空表单
        setEmail('');
        setPassword('');
        setConfirmPassword('');
      }
    } catch (error: any) {
      setAuthError(error.message || 'Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error: any) {
      console.error('Logout failed:', error);
    }
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
              className="w-[580px] max-h-[80vh] rounded-lg overflow-hidden backdrop-blur-xl border border-white/10"
              style={{ background: 'rgba(0,0,0,0.5)' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <h2
                  className="text-white/90 text-sm tracking-wide"
                  style={{ fontFamily: "'Consulate', monospace" }}
                >
                  Settings
                </h2>
                <button
                  onClick={onClose}
                  className="p-1 text-white/40 hover:text-white/70 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Content */}
              <div className="p-5 overflow-y-auto max-h-[calc(80vh-80px)]">
                <div className="flex gap-6">
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
                          <div
                            className="w-2 h-2 rounded-full transition-colors"
                            style={{ backgroundColor: speechMode === 'standard' ? indicatorColor : 'rgba(255,255,255,0.3)' }}
                          />
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
                          <div
                            className="w-2 h-2 rounded-full transition-colors"
                            style={{ backgroundColor: speechMode === 'hd' ? indicatorColor : 'rgba(255,255,255,0.3)' }}
                          />
                          HD
                        </div>
                      </button>
                    </div>

                    {/* Mode description */}
                    <div className="mt-4 text-[10px] text-white/40" style={{ fontFamily: "'Consulate', monospace" }}>
                      {speechMode === 'standard' ? (
                        <p>Free, browser-based recognition</p>
                      ) : (
                        <p>High accuracy, cloud-based</p>
                      )}
                    </div>
                  </div>

                  {/* Column 2: Auth */}
                  <div className="flex-1 border-l border-white/10 pl-6">
                    {authLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="animate-spin text-white/50" size={24} />
                      </div>
                    ) : user ? (
                      // Logged in state
                      <div style={{ fontFamily: "'Consulate', monospace" }}>
                        <p className="text-white/50 text-[11px] uppercase tracking-wider mb-4">
                          Logged in as
                        </p>
                        <p className="text-white/90 text-[14px] mb-6">{user.email}</p>

                        <div className="space-y-3">
                          <a
                            href="/settings"
                            className="block w-full py-2.5 rounded bg-white/10 hover:bg-white/20 text-white/90 text-[13px] text-center transition-all"
                          >
                            Manage API Keys
                          </a>

                          <button
                            onClick={handleLogout}
                            className="w-full py-2.5 rounded bg-transparent border border-white/20 hover:border-white/40 text-white/70 text-[13px] transition-all"
                          >
                            Logout
                          </button>
                        </div>
                      </div>
                    ) : (
                      // Login / Register form
                      <>
                        <div className="flex items-center gap-4 mb-5">
                          <button
                            onClick={() => { setAuthMode('login'); setAuthError(null); setAuthSuccess(null); }}
                            className={`text-[16px] transition-colors ${
                              authMode === 'login' ? 'text-white/90' : 'text-white/40 hover:text-white/60'
                            }`}
                            style={{ fontFamily: "'Consulate', monospace" }}
                          >
                            Login
                          </button>
                          <span className="text-white/20 text-[16px]">|</span>
                          <button
                            onClick={() => { setAuthMode('register'); setAuthError(null); setAuthSuccess(null); }}
                            className={`text-[16px] transition-colors ${
                              authMode === 'register' ? 'text-white/90' : 'text-white/40 hover:text-white/60'
                            }`}
                            style={{ fontFamily: "'Consulate', monospace" }}
                          >
                            Register
                          </button>
                        </div>

                        <form onSubmit={handleAuthSubmit} className="space-y-5">
                          {authError && (
                            <div className="p-4 rounded bg-red-500/20 border border-red-500/30 text-red-400 text-[14px]" style={{ fontFamily: "'Consulate', monospace" }}>
                              {authError}
                            </div>
                          )}

                          {authSuccess && (
                            <div className="p-4 rounded bg-green-500/20 border border-green-500/30 text-green-400 text-[14px]" style={{ fontFamily: "'Consulate', monospace" }}>
                              {authSuccess}
                            </div>
                          )}

                          <div className="space-y-2">
                            <label
                              className="text-white/50 text-[13px] uppercase tracking-wider"
                              style={{ fontFamily: "'Consulate', monospace" }}
                            >
                              Email
                            </label>
                            <input
                              type="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder="your@email.com"
                              required
                              className="w-full px-4 py-3 bg-black/40 border border-white/20 rounded text-white/90 text-[15px] placeholder:text-white/30 focus:outline-none focus:border-white/40 transition-colors"
                              style={{ fontFamily: "'Consulate', monospace" }}
                            />
                          </div>

                          <div className="space-y-2">
                            <label
                              className="text-white/50 text-[13px] uppercase tracking-wider"
                              style={{ fontFamily: "'Consulate', monospace" }}
                            >
                              Password
                            </label>
                            <input
                              type="password"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="••••••••"
                              required
                              className="w-full px-4 py-3 bg-black/40 border border-white/20 rounded text-white/90 text-[15px] placeholder:text-white/30 focus:outline-none focus:border-white/40 transition-colors"
                              style={{ fontFamily: "'Consulate', monospace" }}
                            />
                          </div>

                          <AnimatePresence>
                            {authMode === 'register' && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-2 overflow-hidden"
                              >
                                <label
                                  className="text-white/50 text-[13px] uppercase tracking-wider"
                                  style={{ fontFamily: "'Consulate', monospace" }}
                                >
                                  Confirm Password
                                </label>
                                <input
                                  type="password"
                                  value={confirmPassword}
                                  onChange={(e) => setConfirmPassword(e.target.value)}
                                  placeholder="••••••••"
                                  required={authMode === 'register'}
                                  className="w-full px-4 py-3 bg-black/40 border border-white/20 rounded text-white/90 text-[15px] placeholder:text-white/30 focus:outline-none focus:border-white/40 transition-colors"
                                  style={{ fontFamily: "'Consulate', monospace" }}
                                />
                              </motion.div>
                            )}
                          </AnimatePresence>

                          <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-3 rounded bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white/90 text-[15px] transition-all mt-3 flex items-center justify-center gap-2"
                            style={{ fontFamily: "'Consulate', monospace" }}
                          >
                            {isSubmitting && <Loader2 className="animate-spin" size={16} />}
                            {authMode === 'login' ? 'Login' : 'Create Account'}
                          </button>

                          {authMode === 'login' && (
                            <p className="text-[13px] text-white/40 text-center" style={{ fontFamily: "'Consulate', monospace" }}>
                              Don't have an account?{' '}
                              <button
                                type="button"
                                onClick={() => { setAuthMode('register'); setAuthError(null); setAuthSuccess(null); }}
                                className="text-white/60 hover:text-white/80 underline"
                              >
                                Register
                              </button>
                            </p>
                          )}

                          {authMode === 'register' && (
                            <p className="text-[13px] text-white/40 text-center" style={{ fontFamily: "'Consulate', monospace" }}>
                              Already have an account?{' '}
                              <button
                                type="button"
                                onClick={() => { setAuthMode('login'); setAuthError(null); setAuthSuccess(null); }}
                                className="text-white/60 hover:text-white/80 underline"
                              >
                                Login
                              </button>
                            </p>
                          )}
                        </form>

                        {/* Guest info */}
                        <div className="mt-6 pt-4 border-t border-white/10">
                          <p className="text-[12px] text-white/40" style={{ fontFamily: "'Consulate', monospace" }}>
                            Guest users get 10 min/week free HD transcription.
                            <br />
                            Login to manage API keys and unlock more features.
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

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

export default ApiSettings;

export const loadSpeechMode = (): 'standard' | 'hd' => {
  return (localStorage.getItem(STORAGE_KEYS.speechMode) as 'standard' | 'hd') || 'standard';
};
