import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, AlertTriangle, Check } from 'lucide-react';
import { SRTEntry, parseSRT, generateSRT, formatTime, analyzeTTSTiming, TimingAnalysis } from '../utils/srtParser';

interface SRTEditorProps {
  isOpen: boolean;
  onClose: () => void;
  srtContent: string;
  onSave: (newContent: string) => void;
  fileName?: string;
  speed?: number;
}

const SRTEditor: React.FC<SRTEditorProps> = ({
  isOpen,
  onClose,
  srtContent,
  onSave,
  fileName = 'subtitles.srt',
  speed = 1.0,
}) => {
  const [entries, setEntries] = useState<SRTEntry[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Parse SRT content on open
  useEffect(() => {
    if (isOpen && srtContent) {
      const parsed = parseSRT(srtContent);
      setEntries(parsed);
      setHasChanges(false);
    }
  }, [isOpen, srtContent]);

  // Analyze timing
  const timingAnalysis = useMemo(() => {
    if (entries.length === 0) return null;
    return analyzeTTSTiming(entries, speed);
  }, [entries, speed]);

  // Statistics
  const stats = useMemo(() => {
    let chineseCount = 0;
    let englishCount = 0;
    let totalDuration = 0;

    entries.forEach(entry => {
      const chineseChars = (entry.text.match(/[\u4e00-\u9fa5]/g) || []).length;
      const totalChars = entry.text.replace(/\s/g, '').length;

      if (chineseChars > totalChars * 0.3) {
        chineseCount++;
      } else {
        englishCount++;
      }

      totalDuration = Math.max(totalDuration, entry.endTime);
    });

    return {
      total: entries.length,
      chinese: chineseCount,
      english: englishCount,
      duration: totalDuration,
    };
  }, [entries]);

  // Detect language for a single entry
  const detectLanguage = (text: string): 'zh' | 'en' => {
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const totalChars = text.replace(/\s/g, '').length;
    return chineseChars > totalChars * 0.3 ? 'zh' : 'en';
  };

  // Format time for display (editable format)
  const formatTimeDisplay = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.round((seconds % 1) * 1000);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  // Parse time from display format
  const parseTimeDisplay = (timeStr: string): number | null => {
    const match = timeStr.match(/^(\d{2}):(\d{2}):(\d{2})[.,](\d{3})$/);
    if (!match) return null;
    const [, h, m, s, ms] = match;
    return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(ms) / 1000;
  };

  // Update entry
  const updateEntry = (index: number, field: 'startTime' | 'endTime' | 'text', value: string) => {
    setEntries(prev => {
      const newEntries = [...prev];
      const entry = { ...newEntries[index] };

      if (field === 'text') {
        entry.text = value;
      } else {
        const time = parseTimeDisplay(value);
        if (time !== null) {
          entry[field] = time;
        }
      }

      newEntries[index] = entry;
      return newEntries;
    });
    setHasChanges(true);
  };

  // Save changes
  const handleSave = () => {
    const newContent = generateSRT(entries);
    onSave(newContent);
    setHasChanges(false);
    onClose();
  };

  // Get overflow status for an entry
  const getOverflowStatus = (index: number): { overflow: boolean; requiredSpeed: number } | null => {
    if (!timingAnalysis) return null;
    const analysis = timingAnalysis.entries.find(e => e.index === entries[index]?.index);
    if (!analysis) return null;
    return { overflow: analysis.overflow, requiredSpeed: analysis.requiredSpeed };
  };

  if (!isOpen) return null;

  const content = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[300] flex items-center justify-center p-8"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-5xl max-h-[85vh] flex flex-col backdrop-blur-2xl rounded-2xl shadow-2xl overflow-hidden border border-white/30"
            style={{ backgroundColor: 'rgba(26, 26, 46, 0.95)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div>
                <h2 className="text-white/90 text-lg font-medium flex items-center gap-2">
                  📄 {fileName}
                </h2>
                <div className="text-white/50 text-sm mt-1">
                  {stats.total} entries &nbsp;|&nbsp;
                  ZH: {stats.chinese} &nbsp;|&nbsp;
                  EN: {stats.english} &nbsp;|&nbsp;
                  Duration: {stats.duration.toFixed(1)}s
                  {timingAnalysis?.hasIssues && (
                    <span className="ml-3 text-yellow-400">
                      ⚠ {timingAnalysis.summary.overflowCount} may overflow
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {hasChanges && (
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Save size={14} />
                    Save Changes
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-2 text-white/60 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr style={{ backgroundColor: 'rgba(26, 26, 46, 0.98)' }}>
                    <th className="px-4 py-3 text-left text-white/60 font-medium w-12">#</th>
                    <th className="px-4 py-3 text-left text-white/60 font-medium w-36">Start</th>
                    <th className="px-4 py-3 text-left text-white/60 font-medium w-36">End</th>
                    <th className="px-4 py-3 text-center text-white/60 font-medium w-20">Duration</th>
                    <th className="px-4 py-3 text-left text-white/60 font-medium w-20">Lang</th>
                    <th className="px-4 py-3 text-left text-white/60 font-medium">Content</th>
                    <th className="px-4 py-3 text-center text-white/60 font-medium w-20">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, index) => {
                    const overflow = getOverflowStatus(index);
                    const isOverflow = overflow?.overflow || false;
                    const lang = detectLanguage(entry.text);
                    const duration = entry.endTime - entry.startTime;

                    return (
                      <tr
                        key={entry.index}
                        className={`border-b border-white/5 transition-colors ${
                          isOverflow
                            ? 'bg-yellow-500/5 hover:bg-yellow-500/10'
                            : index % 2 === 0
                            ? 'bg-white/[0.02] hover:bg-white/[0.04]'
                            : 'hover:bg-white/[0.04]'
                        }`}
                      >
                        <td className="px-4 py-3 text-white/40">{entry.index}</td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={formatTimeDisplay(entry.startTime)}
                            onChange={(e) => updateEntry(index, 'startTime', e.target.value)}
                            className="w-full bg-white/5 hover:bg-white/10 text-white/80 font-mono focus:outline-none focus:bg-white/15 focus:ring-1 focus:ring-white/20 rounded px-2 py-1 cursor-text"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={formatTimeDisplay(entry.endTime)}
                            onChange={(e) => updateEntry(index, 'endTime', e.target.value)}
                            className={`w-full bg-white/5 hover:bg-white/10 font-mono focus:outline-none focus:bg-white/15 focus:ring-1 focus:ring-white/20 rounded px-2 py-1 cursor-text ${
                              isOverflow ? 'text-yellow-400' : 'text-white/80'
                            }`}
                          />
                        </td>
                        <td className="px-4 py-3 text-center text-white/50">
                          {duration.toFixed(1)}s
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {lang === 'zh' ? (
                            <span className="text-white/50">ZH</span>
                          ) : (
                            <span className="text-white/50">EN</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <textarea
                            value={entry.text}
                            onChange={(e) => updateEntry(index, 'text', e.target.value)}
                            className="w-full bg-white/5 hover:bg-white/10 text-white/90 focus:outline-none focus:bg-white/15 focus:ring-1 focus:ring-white/20 rounded px-2 py-1 resize-none leading-relaxed cursor-text"
                            rows={Math.ceil(entry.text.length / 50) || 1}
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isOverflow ? (
                            <span className="inline-flex items-center gap-1 text-yellow-400/80 text-xs">
                              <AlertTriangle size={12} />
                              {overflow?.requiredSpeed.toFixed(1)}x
                            </span>
                          ) : (
                            <span className="text-white/30">
                              <Check size={14} />
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-white/[0.02]">
              <div className="text-white/40 text-xs">
                Click time or text to edit &nbsp;|&nbsp; Speed: {speed.toFixed(1)}x
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-white/60 hover:text-white text-sm transition-colors"
                >
                  {hasChanges ? 'Discard' : 'Close'}
                </button>
                {hasChanges && (
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <Save size={14} />
                    Save & Close
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document !== 'undefined') {
    return createPortal(content, document.body);
  }
  return null;
};

export default SRTEditor;
