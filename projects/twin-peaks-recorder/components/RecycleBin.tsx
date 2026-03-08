import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, RotateCcw } from 'lucide-react';
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
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [size, setSize] = useState({ width: 420, height: 400 });
  const dragStartPos = useRef({ x: 0, y: 0 });
  const resizeStartPos = useRef({ x: 0, y: 0 });
  const resizeStartSize = useRef({ width: 0, height: 0 });

  // Center window on open
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      setPosition({
        x: (window.innerWidth - size.width) / 2,
        y: (window.innerHeight - size.height) / 2,
      });
      setSelectedIds(new Set());
    }
  }, [isOpen]);

  // Drag handling
  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    dragStartPos.current = { x: e.clientX - position.x, y: e.clientY - position.y };

    const handleDrag = (e: MouseEvent) => {
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - size.width, e.clientX - dragStartPos.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - 50, e.clientY - dragStartPos.current.y)),
      });
    };

    const handleDragEnd = () => {
      window.removeEventListener('mousemove', handleDrag);
      window.removeEventListener('mouseup', handleDragEnd);
    };

    window.addEventListener('mousemove', handleDrag);
    window.addEventListener('mouseup', handleDragEnd);
  };

  // Resize handling
  const handleResizeStart = (e: React.MouseEvent, direction: string) => {
    e.preventDefault();
    e.stopPropagation();
    resizeStartPos.current = { x: e.clientX, y: e.clientY };
    resizeStartSize.current = { width: size.width, height: size.height };
    const startPosition = { ...position };

    const handleResize = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStartPos.current.x;
      const deltaY = e.clientY - resizeStartPos.current.y;

      let newWidth = resizeStartSize.current.width;
      let newHeight = resizeStartSize.current.height;
      let newX = startPosition.x;
      let newY = startPosition.y;

      if (direction.includes('e')) newWidth = Math.max(300, resizeStartSize.current.width + deltaX);
      if (direction.includes('w')) {
        newWidth = Math.max(300, resizeStartSize.current.width - deltaX);
        newX = startPosition.x + (resizeStartSize.current.width - newWidth);
      }
      if (direction.includes('s')) newHeight = Math.max(200, resizeStartSize.current.height + deltaY);
      if (direction.includes('n')) {
        newHeight = Math.max(200, resizeStartSize.current.height - deltaY);
        newY = startPosition.y + (resizeStartSize.current.height - newHeight);
      }

      setSize({ width: newWidth, height: newHeight });
      setPosition({ x: newX, y: newY });
    };

    const handleResizeEnd = () => {
      window.removeEventListener('mousemove', handleResize);
      window.removeEventListener('mouseup', handleResizeEnd);
    };

    window.addEventListener('mousemove', handleResize);
    window.addEventListener('mouseup', handleResizeEnd);
  };

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

  // Only render when open
  if (!isOpen) return null;

  const content = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
          transition={{ duration: 0.3 }}
          className="fixed z-[200] flex flex-col backdrop-blur-2xl rounded-2xl shadow-2xl overflow-hidden border border-white/60"
          style={{
            left: position.x,
            top: position.y,
            width: size.width,
            height: trashedMemos.length === 0 ? 200 : size.height,
            backgroundColor: 'rgba(255, 255, 255, 0)',
          }}
        >
          {/* Header - Draggable */}
          <div
            className="flex items-center justify-between px-6 py-4 bg-transparent border-b border-white/20 cursor-move select-none shrink-0"
            onMouseDown={handleDragStart}
          >
            <div className="flex items-center gap-3">
              <Trash2 size={16} className="text-white/50" />
              <span
                className="text-[10px] text-white/60 font-bold tracking-widest uppercase"
              >
                Recycle Bin
              </span>
              {trashedMemos.length > 0 && (
                <span className="text-white/40 text-xs">
                  ({trashedMemos.length})
                </span>
              )}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="p-1 text-white/40 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {trashedMemos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-white/30 py-8">
                <Trash2 size={28} className="mb-3 opacity-50" />
                <p className="text-sm" style={{ fontFamily: contentFont }}>Empty</p>
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {trashedMemos.map(memo => {
                  const isSelected = selectedIds.has(memo.id);
                  return (
                    <div
                      key={memo.id}
                      onClick={() => toggleSelect(memo.id)}
                      className={`px-6 py-4 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#b69fbb]/15'
                          : 'hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-xs ${isSelected ? 'text-[#b69fbb]' : 'text-white/60'}`}
                          style={{ fontFamily: contentFont }}
                        >
                          {formatDate(memo.createdAt)}
                        </span>
                        {memo.tags.slice(0, 2).map(tag => (
                          <span
                            key={tag}
                            className={`text-[10px] uppercase tracking-wider ${isSelected ? 'text-[#b69fbb]/60' : 'text-white/30'}`}
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                      <p
                        className={`text-sm line-clamp-2 ${isSelected ? 'text-[#b69fbb]/80' : 'text-white/50'}`}
                        style={{ fontFamily: contentFont }}
                      >
                        {memo.transcription || '(No content)'}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {trashedMemos.length > 0 && (
            <div className="px-6 py-4 border-t border-white/20 flex justify-between items-center shrink-0">
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
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-colors border ${
                    selectedIds.size > 0
                      ? 'bg-white/5 text-white/80 border-white/20 hover:bg-white/15'
                      : 'bg-transparent text-white/20 border-white/10 cursor-not-allowed'
                  }`}
                  style={{ fontFamily: contentFont }}
                >
                  <RotateCcw size={14} />
                  Recover
                </button>
                <button
                  onClick={handleDeleteForever}
                  disabled={selectedIds.size === 0}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-colors border ${
                    selectedIds.size > 0
                      ? 'bg-[#903e4f]/10 text-[#903e4f] border-[#903e4f]/30 hover:bg-[#903e4f]/20'
                      : 'bg-transparent text-white/20 border-white/10 cursor-not-allowed'
                  }`}
                  style={{ fontFamily: contentFont }}
                >
                  <Trash2 size={14} />
                  Delete Forever
                </button>
              </div>
            </div>
          )}

          {/* Resize handles */}
          <div className="absolute top-0 left-0 w-2 h-full cursor-ew-resize" onMouseDown={(e) => handleResizeStart(e, 'w')} />
          <div className="absolute top-0 right-0 w-2 h-full cursor-ew-resize" onMouseDown={(e) => handleResizeStart(e, 'e')} />
          <div className="absolute top-0 left-0 w-full h-2 cursor-ns-resize" onMouseDown={(e) => handleResizeStart(e, 'n')} />
          <div className="absolute bottom-0 left-0 w-full h-2 cursor-ns-resize" onMouseDown={(e) => handleResizeStart(e, 's')} />
          <div className="absolute top-0 left-0 w-4 h-4 cursor-nwse-resize" onMouseDown={(e) => handleResizeStart(e, 'nw')} />
          <div className="absolute top-0 right-0 w-4 h-4 cursor-nesw-resize" onMouseDown={(e) => handleResizeStart(e, 'ne')} />
          <div className="absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize" onMouseDown={(e) => handleResizeStart(e, 'sw')} />
          <div className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize" onMouseDown={(e) => handleResizeStart(e, 'se')} />
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document !== 'undefined') {
    return createPortal(content, document.body);
  }
  return null;
};

export default RecycleBin;
