import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, RotateCcw, CheckSquare, Square } from 'lucide-react';
import { Memo } from '../types';

interface RecycleBinProps {
  isOpen: boolean;
  onClose: () => void;
  trashedMemos: Memo[];
  onRecover: (ids: string[]) => void;
  onDeleteForever: (ids: string[]) => void;
  contentFont: string;
}

const RecycleBin: React.FC<RecycleBinProps> = ({
  isOpen,
  onClose,
  trashedMemos,
  onRecover,
  onDeleteForever,
  contentFont,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === trashedMemos.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(trashedMemos.map(m => m.id)));
    }
  };

  const handleRecover = () => {
    if (selectedIds.size > 0) {
      onRecover(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  const handleDeleteForever = () => {
    if (selectedIds.size > 0) {
      const confirmed = window.confirm(`Permanently delete ${selectedIds.size} item(s)? This cannot be undone.`);
      if (confirmed) {
        onDeleteForever(Array.from(selectedIds));
        setSelectedIds(new Set());
      }
    }
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const content = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
            transition={{ duration: 0.3 }}
            className="relative w-full max-w-lg max-h-[70vh] backdrop-blur-2xl rounded-2xl shadow-2xl overflow-hidden border border-white/20"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Trash2 size={18} className="text-white/40" />
                <span
                  className="text-white/80 text-sm tracking-widest uppercase"
                  style={{ fontFamily: contentFont }}
                >
                  Recycle Bin
                </span>
                {trashedMemos.length > 0 && (
                  <span className="text-white/30 text-xs">
                    ({trashedMemos.length})
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1 text-white/40 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[50vh] p-4">
              {trashedMemos.length === 0 ? (
                <div className="text-center py-12 text-white/30">
                  <Trash2 size={32} className="mx-auto mb-3 opacity-50" />
                  <p style={{ fontFamily: contentFont }}>Recycle bin is empty</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {trashedMemos.map(memo => (
                    <div
                      key={memo.id}
                      onClick={() => toggleSelect(memo.id)}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedIds.has(memo.id)
                          ? 'bg-white/15 border border-white/30'
                          : 'bg-white/5 border border-transparent hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 text-white/40">
                          {selectedIds.has(memo.id) ? (
                            <CheckSquare size={16} />
                          ) : (
                            <Square size={16} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-white/60 text-xs" style={{ fontFamily: contentFont }}>
                              {formatDate(memo.createdAt)}
                            </span>
                            {memo.tags.slice(0, 2).map(tag => (
                              <span
                                key={tag}
                                className="text-white/30 text-[10px] uppercase tracking-wider"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                          <p
                            className="text-white/50 text-sm line-clamp-2"
                            style={{ fontFamily: contentFont }}
                          >
                            {memo.transcription || '(No content)'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {trashedMemos.length > 0 && (
              <div className="px-6 py-4 border-t border-white/10 flex justify-between items-center">
                <button
                  onClick={selectAll}
                  className="text-white/40 hover:text-white/70 text-xs tracking-widest uppercase transition-colors"
                  style={{ fontFamily: contentFont }}
                >
                  {selectedIds.size === trashedMemos.length ? 'Deselect All' : 'Select All'}
                </button>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleRecover}
                    disabled={selectedIds.size === 0}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-colors ${
                      selectedIds.size > 0
                        ? 'bg-white/10 text-white/80 hover:bg-white/20'
                        : 'bg-white/5 text-white/20 cursor-not-allowed'
                    }`}
                    style={{ fontFamily: contentFont }}
                  >
                    <RotateCcw size={14} />
                    Recover
                  </button>
                  <button
                    onClick={handleDeleteForever}
                    disabled={selectedIds.size === 0}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-colors ${
                      selectedIds.size > 0
                        ? 'bg-[#903e4f]/20 text-[#903e4f] hover:bg-[#903e4f]/30'
                        : 'bg-white/5 text-white/20 cursor-not-allowed'
                    }`}
                    style={{ fontFamily: contentFont }}
                  >
                    <Trash2 size={14} />
                    Delete Forever
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Only render portal when open
  if (!isOpen) return null;

  if (typeof document !== 'undefined') {
    return createPortal(content, document.body);
  }
  return null;
};

export default RecycleBin;
