import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, AlertTriangle, Check, Timer, Play, RotateCcw } from 'lucide-react';
import { SRTEntry, parseSRT, generateSRT, formatTime, analyzeTTSTiming, TimingAnalysis } from '../utils/srtParser';

interface SRTEditorProps {
  isOpen: boolean;
  onClose: () => void;
  srtContent: string;
  onSave: (newContent: string) => void;
  fileName?: string;
  speed?: number;
}

// Practice mode result for each entry
interface PracticeResult {
  index: number;
  allocatedTime: number;  // Time allocated in SRT
  actualTime: number;     // Actual time taken to read
  overflow: boolean;      // Did we exceed allocated time?
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

  // Practice mode state
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [practiceStartTime, setPracticeStartTime] = useState<number | null>(null);
  const [practiceElapsed, setPracticeElapsed] = useState(0);
  const [practiceResults, setPracticeResults] = useState<PracticeResult[]>([]);
  const [isPracticeComplete, setIsPracticeComplete] = useState(false);
  const [isPracticeRunning, setIsPracticeRunning] = useState(false);
  const practiceTimerRef = useRef<number | null>(null);

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

  // ========== Practice Mode Functions ==========

  // Start practice mode
  const startPracticeMode = useCallback(() => {
    setIsPracticeMode(true);
    setPracticeIndex(0);
    setPracticeStartTime(null);
    setPracticeElapsed(0);
    setPracticeResults([]);
    setIsPracticeComplete(false);
    setIsPracticeRunning(false);
  }, []);

  // Start the timer for current entry
  const startPracticeTimer = useCallback(() => {
    if (isPracticeRunning) return;

    setPracticeStartTime(Date.now());
    setIsPracticeRunning(true);
    setPracticeElapsed(0);

    // Update elapsed time every 100ms
    practiceTimerRef.current = window.setInterval(() => {
      setPracticeElapsed(prev => prev + 0.1);
    }, 100);
  }, [isPracticeRunning]);

  // Record current entry and move to next
  const recordAndNext = useCallback(() => {
    if (!isPracticeRunning || practiceStartTime === null) return;

    // Stop timer
    if (practiceTimerRef.current) {
      clearInterval(practiceTimerRef.current);
      practiceTimerRef.current = null;
    }

    const actualTime = (Date.now() - practiceStartTime) / 1000;
    const currentEntry = entries[practiceIndex];
    const allocatedTime = currentEntry.endTime - currentEntry.startTime;

    // Record result
    const result: PracticeResult = {
      index: currentEntry.index,
      allocatedTime,
      actualTime,
      overflow: actualTime > allocatedTime,
    };
    setPracticeResults(prev => [...prev, result]);

    // Move to next or complete
    if (practiceIndex < entries.length - 1) {
      setPracticeIndex(prev => prev + 1);
      setPracticeStartTime(null);
      setPracticeElapsed(0);
      setIsPracticeRunning(false);
    } else {
      setIsPracticeComplete(true);
      setIsPracticeRunning(false);
    }
  }, [isPracticeRunning, practiceStartTime, practiceIndex, entries]);

  // Exit practice mode
  const exitPracticeMode = useCallback(() => {
    if (practiceTimerRef.current) {
      clearInterval(practiceTimerRef.current);
      practiceTimerRef.current = null;
    }
    setIsPracticeMode(false);
    setPracticeIndex(0);
    setPracticeStartTime(null);
    setPracticeElapsed(0);
    setPracticeResults([]);
    setIsPracticeComplete(false);
    setIsPracticeRunning(false);
  }, []);

  // Reset practice (start over)
  const resetPractice = useCallback(() => {
    if (practiceTimerRef.current) {
      clearInterval(practiceTimerRef.current);
      practiceTimerRef.current = null;
    }
    setPracticeIndex(0);
    setPracticeStartTime(null);
    setPracticeElapsed(0);
    setPracticeResults([]);
    setIsPracticeComplete(false);
    setIsPracticeRunning(false);
  }, []);

  // Handle keyboard in practice mode
  useEffect(() => {
    if (!isPracticeMode || isPracticeComplete) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!isPracticeRunning) {
          startPracticeTimer();
        } else {
          recordAndNext();
        }
      } else if (e.key === 'Escape') {
        exitPracticeMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPracticeMode, isPracticeComplete, isPracticeRunning, startPracticeTimer, recordAndNext, exitPracticeMode]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (practiceTimerRef.current) {
        clearInterval(practiceTimerRef.current);
      }
    };
  }, []);

  // Practice mode statistics
  const practiceStats = useMemo(() => {
    if (practiceResults.length === 0) return null;

    const overflowCount = practiceResults.filter(r => r.overflow).length;
    const totalActual = practiceResults.reduce((sum, r) => sum + r.actualTime, 0);
    const totalAllocated = practiceResults.reduce((sum, r) => sum + r.allocatedTime, 0);

    return {
      overflowCount,
      totalActual,
      totalAllocated,
      avgRatio: totalActual / totalAllocated,
    };
  }, [practiceResults]);

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
                <button
                  onClick={startPracticeMode}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg text-sm font-medium transition-colors"
                  title="Practice reading with timer"
                >
                  <Timer size={14} />
                  Practice
                </button>
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

          {/* Practice Mode Overlay */}
          {isPracticeMode && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex flex-col items-center justify-center"
              style={{ backgroundColor: 'rgba(10, 10, 20, 0.98)' }}
            >
              {!isPracticeComplete ? (
                <>
                  {/* Progress indicator */}
                  <div className="absolute top-8 left-8 text-white/40 text-sm">
                    {practiceIndex + 1} / {entries.length}
                  </div>

                  {/* Exit button */}
                  <button
                    onClick={exitPracticeMode}
                    className="absolute top-8 right-8 p-2 text-white/40 hover:text-white transition-colors"
                  >
                    <X size={24} />
                  </button>

                  {/* Timer display */}
                  <div className="mb-8 text-center">
                    <div className={`text-6xl font-mono font-light ${
                      isPracticeRunning && practiceElapsed > (entries[practiceIndex]?.endTime - entries[practiceIndex]?.startTime)
                        ? 'text-red-400'
                        : 'text-white/80'
                    }`}>
                      {practiceElapsed.toFixed(1)}s
                    </div>
                    <div className="text-white/40 text-sm mt-2">
                      Allocated: {(entries[practiceIndex]?.endTime - entries[practiceIndex]?.startTime).toFixed(1)}s
                    </div>
                  </div>

                  {/* Current entry text */}
                  <div className="max-w-3xl px-8 text-center">
                    <div className="text-white text-3xl leading-relaxed font-light">
                      {entries[practiceIndex]?.text}
                    </div>
                  </div>

                  {/* Instructions */}
                  <div className="absolute bottom-12 text-center">
                    {!isPracticeRunning ? (
                      <div className="text-white/60 text-lg">
                        Press <span className="px-3 py-1 bg-white/10 rounded-lg mx-1 font-mono">Enter</span> or <span className="px-3 py-1 bg-white/10 rounded-lg mx-1 font-mono">Space</span> to start
                      </div>
                    ) : (
                      <div className="text-white/60 text-lg">
                        Press <span className="px-3 py-1 bg-white/10 rounded-lg mx-1 font-mono">Enter</span> when done reading
                      </div>
                    )}
                    <div className="text-white/30 text-sm mt-3">
                      Press <span className="font-mono">ESC</span> to exit
                    </div>
                  </div>

                  {/* Previous result */}
                  {practiceResults.length > 0 && (
                    <div className="absolute bottom-32 text-center">
                      <div className={`text-sm ${practiceResults[practiceResults.length - 1].overflow ? 'text-yellow-400' : 'text-green-400'}`}>
                        Previous: {practiceResults[practiceResults.length - 1].actualTime.toFixed(1)}s
                        {practiceResults[practiceResults.length - 1].overflow
                          ? ` (+${(practiceResults[practiceResults.length - 1].actualTime - practiceResults[practiceResults.length - 1].allocatedTime).toFixed(1)}s over)`
                          : ' ✓'
                        }
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Practice Complete - Results */
                <div className="w-full max-w-2xl px-8">
                  <h2 className="text-white text-2xl font-light text-center mb-8">Practice Complete</h2>

                  {/* Summary stats */}
                  {practiceStats && (
                    <div className="grid grid-cols-3 gap-4 mb-8">
                      <div className="text-center p-4 bg-white/5 rounded-xl">
                        <div className="text-3xl font-light text-white/90">{practiceStats.overflowCount}</div>
                        <div className="text-white/50 text-sm">Overflow</div>
                      </div>
                      <div className="text-center p-4 bg-white/5 rounded-xl">
                        <div className="text-3xl font-light text-white/90">{practiceStats.totalActual.toFixed(1)}s</div>
                        <div className="text-white/50 text-sm">Total Time</div>
                      </div>
                      <div className="text-center p-4 bg-white/5 rounded-xl">
                        <div className={`text-3xl font-light ${practiceStats.avgRatio > 1 ? 'text-yellow-400' : 'text-green-400'}`}>
                          {(practiceStats.avgRatio * 100).toFixed(0)}%
                        </div>
                        <div className="text-white/50 text-sm">Speed Ratio</div>
                      </div>
                    </div>
                  )}

                  {/* Results list */}
                  <div className="max-h-[40vh] overflow-y-auto thin-scrollbar mb-8">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-white/50 border-b border-white/10">
                          <th className="text-left py-2 px-3">#</th>
                          <th className="text-left py-2 px-3">Content</th>
                          <th className="text-right py-2 px-3">Allocated</th>
                          <th className="text-right py-2 px-3">Actual</th>
                          <th className="text-right py-2 px-3">Diff</th>
                        </tr>
                      </thead>
                      <tbody>
                        {practiceResults.map((result, i) => {
                          const diff = result.actualTime - result.allocatedTime;
                          return (
                            <tr
                              key={result.index}
                              className={`border-b border-white/5 ${result.overflow ? 'bg-yellow-500/5' : ''}`}
                            >
                              <td className="py-2 px-3 text-white/40">{result.index}</td>
                              <td className="py-2 px-3 text-white/80 max-w-xs truncate">
                                {entries.find(e => e.index === result.index)?.text.slice(0, 40)}...
                              </td>
                              <td className="py-2 px-3 text-right text-white/50">{result.allocatedTime.toFixed(1)}s</td>
                              <td className="py-2 px-3 text-right text-white/80">{result.actualTime.toFixed(1)}s</td>
                              <td className={`py-2 px-3 text-right ${result.overflow ? 'text-yellow-400' : 'text-green-400'}`}>
                                {diff > 0 ? '+' : ''}{diff.toFixed(1)}s
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-center gap-4">
                    <button
                      onClick={resetPractice}
                      className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                    >
                      <RotateCcw size={16} />
                      Try Again
                    </button>
                    <button
                      onClick={exitPracticeMode}
                      className="flex items-center gap-2 px-6 py-3 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
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
