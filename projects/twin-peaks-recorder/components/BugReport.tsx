import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mic, Play, Download, FileText, Palette, HelpCircle, ArrowRight, ArrowLeft, Upload, Send, Loader2, Check, Image } from 'lucide-react';
import emailjs from '@emailjs/browser';

export interface BugReportProps {
  isOpen: boolean;
  onClose: () => void;
}

// 问题分类
const CATEGORIES = [
  { id: 'recording', icon: Mic, label: 'Recording' },
  { id: 'playback', icon: Play, label: 'Playback' },
  { id: 'export', icon: Download, label: 'Export' },
  { id: 'editor', icon: FileText, label: 'Editor' },
  { id: 'ui', icon: Palette, label: 'UI/Display' },
  { id: 'other', icon: HelpCircle, label: 'Other' },
];

// 严重程度
const SEVERITY = [
  { id: 'blocking', label: "Can't continue", desc: "I'm completely stuck", color: '#ef4444' },
  { id: 'annoying', label: 'Annoying but works', desc: 'I can work around it', color: '#eab308' },
  { id: 'minor', label: 'Minor issue', desc: 'Nice to have fixed', color: '#22c55e' },
];

const BugReport: React.FC<BugReportProps> = ({ isOpen, onClose }) => {
  // 步骤状态
  const [step, setStep] = useState(1);
  const totalSteps = 3;

  // Step 1: 分类和描述
  const [category, setCategory] = useState<string | null>(null);
  const [description, setDescription] = useState('');

  // Step 2: 截图
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 3: 严重程度
  const [severity, setSeverity] = useState<string | null>(null);

  // 提交状态
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // 重置表单
  const resetForm = useCallback(() => {
    setStep(1);
    setCategory(null);
    setDescription('');
    setScreenshot(null);
    setScreenshotFile(null);
    setSeverity(null);
    setSubmitStatus('idle');
  }, []);

  // 关闭时重置
  const handleClose = () => {
    resetForm();
    onClose();
  };

  // 下一步
  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    }
  };

  // 上一步
  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  // 处理文件上传
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setScreenshotFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setScreenshot(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // 处理粘贴
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            setScreenshotFile(file);
            const reader = new FileReader();
            reader.onload = (event) => {
              setScreenshot(event.target?.result as string);
            };
            reader.readAsDataURL(file);
          }
          break;
        }
      }
    }
  }, []);

  // 处理拖放
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setScreenshotFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setScreenshot(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  // 提交报告
  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      // 收集环境信息
      const envInfo = {
        browser: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        screenSize: `${window.innerWidth}x${window.innerHeight}`,
      };

      // 使用 EmailJS 发送
      await emailjs.send(
        'service_dianerecorder',
        'template_bugreport', // 需要在 EmailJS 创建这个模板
        {
          category: CATEGORIES.find(c => c.id === category)?.label || category,
          description: description || '(No description)',
          severity: SEVERITY.find(s => s.id === severity)?.label || severity,
          severity_desc: SEVERITY.find(s => s.id === severity)?.desc || '',
          screenshot: screenshot ? 'Yes (see attachment)' : 'No',
          browser: envInfo.browser,
          url: envInfo.url,
          timestamp: envInfo.timestamp,
          screen_size: envInfo.screenSize,
        },
        'PNhUQVNGCo0nuEF1k'
      );

      setSubmitStatus('success');
    } catch (error) {
      console.error('Bug report submission failed:', error);
      setSubmitStatus('error');

      // Fallback: 打开 mailto
      const subject = encodeURIComponent(`[Bug] ${CATEGORIES.find(c => c.id === category)?.label || 'Issue'}`);
      const body = encodeURIComponent(
        `Category: ${CATEGORIES.find(c => c.id === category)?.label || category}\n` +
        `Severity: ${SEVERITY.find(s => s.id === severity)?.label || severity}\n` +
        `Description: ${description || '(none)'}\n\n` +
        `Browser: ${navigator.userAgent}\n` +
        `URL: ${window.location.href}`
      );
      window.open(`mailto:diane@twinpeaks.fm?subject=${subject}&body=${body}`, '_blank');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 检查是否可以继续
  const canProceed = () => {
    if (step === 1) return category !== null;
    if (step === 2) return true; // 截图可选
    if (step === 3) return severity !== null;
    return false;
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
            onClick={handleClose}
          />

          {/* Window */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[201]"
            onClick={(e) => e.stopPropagation()}
            onPaste={handlePaste}
          >
            <div
              className="w-[480px] rounded-lg overflow-hidden backdrop-blur-xl border border-white/10"
              style={{ background: 'rgba(0,0,0,0.5)' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <h2
                  className="text-white/90 text-sm tracking-wide"
                  style={{ fontFamily: "'Consulate', monospace" }}
                >
                  Something's wrong
                </h2>
                <button
                  onClick={handleClose}
                  className="p-1 text-white/40 hover:text-white/70 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Progress bar */}
              <div className="px-5 pt-4">
                <div className="flex items-center justify-between text-[10px] text-white/40 mb-2" style={{ fontFamily: "'Consulate', monospace" }}>
                  <span>Step {step} of {totalSteps}</span>
                  <span>{Math.round((step / totalSteps) * 100)}%</span>
                </div>
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: '#b69fbb' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(step / totalSteps) * 100}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>

              {/* Content */}
              <div className="p-5">
                <AnimatePresence mode="wait">
                  {/* Step 1: Category */}
                  {step === 1 && (
                    <motion.div
                      key="step1"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                    >
                      <h3
                        className="text-white/90 text-base mb-2"
                        style={{ fontFamily: "'Consulate', monospace" }}
                      >
                        What's the problem?
                      </h3>
                      <p className="text-white/50 text-[11px] mb-4" style={{ fontFamily: "'Consulate', monospace" }}>
                        Select a category
                      </p>

                      {/* Category grid */}
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        {CATEGORIES.map((cat) => {
                          const Icon = cat.icon;
                          return (
                            <button
                              key={cat.id}
                              onClick={() => setCategory(cat.id)}
                              className={`flex flex-col items-center gap-2 p-3 rounded transition-all ${
                                category === cat.id
                                  ? 'bg-white/15 border border-[#b69fbb]/50'
                                  : 'bg-white/5 border border-transparent hover:bg-white/10'
                              }`}
                            >
                              <Icon
                                size={20}
                                className={category === cat.id ? 'text-[#b69fbb]' : 'text-white/50'}
                              />
                              <span
                                className={`text-[11px] ${category === cat.id ? 'text-white/90' : 'text-white/50'}`}
                                style={{ fontFamily: "'Consulate', monospace" }}
                              >
                                {cat.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Optional description */}
                      <p className="text-white/50 text-[11px] mb-2" style={{ fontFamily: "'Consulate', monospace" }}>
                        Brief description (optional)
                      </p>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="I was trying to..."
                        className="w-full h-20 px-3 py-2 bg-white/5 border border-white/10 rounded text-white/90 text-[13px] placeholder-white/30 resize-none focus:outline-none focus:border-[#b69fbb]/50"
                        style={{ fontFamily: "'Consulate', monospace" }}
                        maxLength={200}
                      />
                      <p className="text-white/30 text-[10px] mt-1 text-right" style={{ fontFamily: "'Consulate', monospace" }}>
                        {description.length}/200
                      </p>
                    </motion.div>
                  )}

                  {/* Step 2: Screenshot */}
                  {step === 2 && (
                    <motion.div
                      key="step2"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                    >
                      <h3
                        className="text-white/90 text-base mb-2"
                        style={{ fontFamily: "'Consulate', monospace" }}
                      >
                        Add a screenshot
                      </h3>
                      <p className="text-white/50 text-[11px] mb-4" style={{ fontFamily: "'Consulate', monospace" }}>
                        Optional, but very helpful
                      </p>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />

                      {screenshot ? (
                        <div className="relative">
                          <img
                            src={screenshot}
                            alt="Screenshot"
                            className="w-full h-48 object-contain bg-white/5 rounded border border-white/10"
                          />
                          <button
                            onClick={() => { setScreenshot(null); setScreenshotFile(null); }}
                            className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full text-white/70 hover:text-white transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          onDrop={handleDrop}
                          onDragOver={(e) => e.preventDefault()}
                          className="flex flex-col items-center justify-center gap-3 h-48 border-2 border-dashed border-white/20 rounded cursor-pointer hover:border-white/40 hover:bg-white/5 transition-all"
                        >
                          <Upload size={32} className="text-white/30" />
                          <div className="text-center">
                            <p className="text-white/60 text-[13px]" style={{ fontFamily: "'Consulate', monospace" }}>
                              Drop an image or click to upload
                            </p>
                            <p className="text-white/40 text-[11px] mt-1" style={{ fontFamily: "'Consulate', monospace" }}>
                              Or paste from clipboard (Cmd+V)
                            </p>
                          </div>
                          <p className="text-white/30 text-[10px]" style={{ fontFamily: "'Consulate', monospace" }}>
                            PNG, JPG up to 5MB
                          </p>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* Step 3: Severity */}
                  {step === 3 && submitStatus === 'idle' && (
                    <motion.div
                      key="step3"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                    >
                      <h3
                        className="text-white/90 text-base mb-2"
                        style={{ fontFamily: "'Consulate', monospace" }}
                      >
                        How bad is it?
                      </h3>
                      <p className="text-white/50 text-[11px] mb-4" style={{ fontFamily: "'Consulate', monospace" }}>
                        Select the impact level
                      </p>

                      <div className="space-y-2">
                        {SEVERITY.map((sev) => (
                          <button
                            key={sev.id}
                            onClick={() => setSeverity(sev.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded transition-all text-left ${
                              severity === sev.id
                                ? 'bg-white/15 border border-white/30'
                                : 'bg-white/5 border border-transparent hover:bg-white/10'
                            }`}
                          >
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: sev.color }}
                            />
                            <div>
                              <p
                                className={`text-[13px] ${severity === sev.id ? 'text-white/90' : 'text-white/70'}`}
                                style={{ fontFamily: "'Consulate', monospace" }}
                              >
                                {sev.label}
                              </p>
                              <p
                                className="text-[11px] text-white/40"
                                style={{ fontFamily: "'Consulate', monospace" }}
                              >
                                {sev.desc}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Success state */}
                  {submitStatus === 'success' && (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex flex-col items-center justify-center py-8"
                    >
                      <div className="w-16 h-16 rounded-full bg-[#22c55e]/20 flex items-center justify-center mb-4">
                        <Check size={32} className="text-[#22c55e]" />
                      </div>
                      <h3
                        className="text-white/90 text-base mb-2"
                        style={{ fontFamily: "'Consulate', monospace" }}
                      >
                        Report sent
                      </h3>
                      <p
                        className="text-white/50 text-[11px] text-center"
                        style={{ fontFamily: "'Consulate', monospace" }}
                      >
                        Thank you for helping improve Diane
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-5 py-4 border-t border-white/10">
                {submitStatus === 'success' ? (
                  <div />
                ) : step > 1 ? (
                  <button
                    onClick={handleBack}
                    className="flex items-center gap-2 px-4 py-2 rounded bg-white/5 hover:bg-white/10 text-white/60 text-[13px] transition-all"
                    style={{ fontFamily: "'Consulate', monospace" }}
                  >
                    <ArrowLeft size={14} />
                    Back
                  </button>
                ) : (
                  <div />
                )}

                {submitStatus === 'success' ? (
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 rounded text-white/90 text-[13px] transition-all"
                    style={{ fontFamily: "'Consulate', monospace", backgroundColor: '#b69fbb' }}
                  >
                    Done
                  </button>
                ) : step < totalSteps ? (
                  <button
                    onClick={handleNext}
                    disabled={!canProceed()}
                    className={`flex items-center gap-2 px-4 py-2 rounded text-[13px] transition-all ${
                      canProceed()
                        ? 'bg-white/10 hover:bg-white/20 text-white/90'
                        : 'bg-white/5 text-white/30 cursor-not-allowed'
                    }`}
                    style={{ fontFamily: "'Consulate', monospace" }}
                  >
                    {step === 2 ? (screenshot ? 'Next' : 'Skip') : 'Next'}
                    <ArrowRight size={14} />
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={!canProceed() || isSubmitting}
                    className={`flex items-center gap-2 px-4 py-2 rounded text-[13px] transition-all ${
                      canProceed() && !isSubmitting
                        ? 'text-white/90'
                        : 'opacity-50 cursor-not-allowed'
                    }`}
                    style={{ fontFamily: "'Consulate', monospace", backgroundColor: '#b69fbb' }}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send size={14} />
                        Submit Report
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  if (typeof document !== 'undefined') {
    return createPortal(content, document.body);
  }
  return null;
};

export default BugReport;
