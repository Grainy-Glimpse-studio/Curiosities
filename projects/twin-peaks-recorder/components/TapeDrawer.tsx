import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Memo } from '../types';
import CassetteTape from './CassetteTape';
import { Search, ChevronDown, Calendar, X, LayoutGrid } from 'lucide-react';
import { motion } from 'framer-motion';

interface TapeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  memos: Memo[];
  onPlay: (memo: Memo) => void;
  onDelete: (id: string) => void;
  onTogglePermanent: (id: string) => void;
  titleFont: string;
  contentFont: string;
  onTitleFontChange: (font: string) => void;
  onContentFontChange: (font: string) => void;
  onOpenTranscript?: (memo: Memo) => void;
  onOpenAbout?: () => void;
}

type SortMethod = 'date_desc' | 'date_asc';

const TapeDrawer: React.FC<TapeDrawerProps> = ({
  isOpen,
  onClose,
  memos,
  onPlay,
  onDelete,
  onTogglePermanent,
  titleFont,
  contentFont,
  onTitleFontChange,
  onContentFontChange,
  onOpenTranscript,
  onOpenAbout
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [sortMethod, setSortMethod] = useState<SortMethod>('date_desc');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [dragPositions, setDragPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [isTidy, setIsTidy] = useState(true);
  // Easter egg: ARCHIVE <-> EPHEMERA transition
  const [bgWord, setBgWord] = useState<'ARCHIVE' | 'EPHEMERA'>('ARCHIVE');
  const [hoveredLetters, setHoveredLetters] = useState<Set<number>>(new Set());
  const [wordTransition, setWordTransition] = useState(0); // 0 = first word, 1 = second word
  const isTransitioning = useRef(false); // 防止重复触发
  const hoverResetTimer = useRef<NodeJS.Timeout | null>(null); // 超时重置计时器
  const videoRef = useRef<HTMLVideoElement>(null);
  const hiddenTextRefs = useRef<Map<string, HTMLSpanElement | null>>(new Map());
  const letterRefs = useRef<(HTMLSpanElement | null)[]>([]);

  // Tidy up - reset all cards to grid layout
  const handleTidy = useCallback(() => {
    setDragPositions({});
    setIsTidy(true);
  }, []);

  // Track when a card is dragged
  const handleDragEnd = useCallback((memoId: string, info: { offset: { x: number; y: number } }) => {
    if (Math.abs(info.offset.x) > 5 || Math.abs(info.offset.y) > 5) {
      setIsTidy(false);
      setDragPositions(prev => ({
        ...prev,
        [memoId]: {
          x: (prev[memoId]?.x || 0) + info.offset.x,
          y: (prev[memoId]?.y || 0) + info.offset.y,
        }
      }));
    }
  }, []);

  // Hidden phrases scattered across the page (Twin Peaks themed)
  const hiddenPhrases = useMemo(() => {
    const phrases = [
      { text: "THE OWLS ARE NOT WHAT THEY SEEM", id: "owls" },
      { text: "FIRE WALK WITH ME", id: "fire" },
      { text: "MEANWHILE", id: "meanwhile" },
      { text: "DAMN FINE COFFEE", id: "coffee" },
      { text: "WHO KILLED LAURA PALMER", id: "laura" },
      { text: "THE BLACK LODGE", id: "lodge" },
      { text: "THROUGH THE DARKNESS", id: "darkness" },
      { text: "DIANE", id: "diane" },
      { text: "I'LL SEE YOU AGAIN IN 25 YEARS", id: "years" },
      { text: "IT IS HAPPENING AGAIN", id: "again" },
      { text: "THE GIFT OF FEAR", id: "fear" },
      { text: "I WANT ALL MY GARMONBOZIA", id: "garmonbozia" },
      { text: "HOW'S ANNIE", id: "annie" },
      { text: "MY LOG DOES NOT JUDGE", id: "log" },
      { text: "LAURA IS THE ONE", id: "lauraone" },
    ];

    // Generate random but stable positions using seed
    const seed = 42;
    const pseudoRandom = (n: number) => {
      const x = Math.sin(seed + n * 127.1) * 43758.5453;
      return x - Math.floor(x);
    };

    return phrases.map((phrase, i) => ({
      ...phrase,
      x: 5 + pseudoRandom(i * 3) * 85, // 5-90% from left
      y: 10 + pseudoRandom(i * 3 + 1) * 75, // 10-85% from top
      rotation: (pseudoRandom(i * 3 + 2) - 0.5) * 30, // -15 to 15 degrees
      fontSize: 12 + pseudoRandom(i * 3 + 3) * 16, // 12-28px
    }));
  }, []);

  // Mouse tracking for hidden text reveal
  useEffect(() => {
    if (!isOpen) return;

    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isOpen]);

  // Play/pause video based on drawer state
  useEffect(() => {
    if (videoRef.current) {
      if (isOpen) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [isOpen]);

  // Extract all unique tags
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    memos.forEach(m => m.tags.forEach(t => tags.add(t)));
    return Array.from(tags);
  }, [memos]);

  // Filter and Sort Logic
  const filteredMemos = useMemo(() => {
    let result = [...memos];

    // Search
    if (searchQuery) {
      const lowerQ = searchQuery.toLowerCase();
      result = result.filter(m =>
        m.transcription.toLowerCase().includes(lowerQ) ||
        m.tags.some(t => t.toLowerCase().includes(lowerQ))
      );
    }

    // Filter by Tag
    if (activeTag) {
      result = result.filter(m => m.tags.includes(activeTag));
    }

    // Filter by Date Range
    if (dateFrom) {
      const fromDate = new Date(dateFrom).setHours(0, 0, 0, 0);
      result = result.filter(m => m.createdAt >= fromDate);
    }
    if (dateTo) {
      const toDate = new Date(dateTo).setHours(23, 59, 59, 999);
      result = result.filter(m => m.createdAt <= toDate);
    }

    // Sort
    result.sort((a, b) => {
      if (sortMethod === 'date_desc') return b.createdAt - a.createdAt;
      return a.createdAt - b.createdAt;
    });

    return result;

  }, [memos, searchQuery, activeTag, sortMethod, dateFrom, dateTo]);


  return (
    <div
      className={`fixed inset-0 z-50 transform transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
    >
      {/* Video Background Container */}
      <div className="absolute inset-0 bg-black overflow-hidden">
        {/* Video Element */}
        <video
          ref={videoRef}
          className="absolute w-full h-full object-cover"
          style={{
            transform: 'scale(1.4)', // Scale up to crop the 4:3 letterbox
            transformOrigin: 'center center',
          }}
          loop
          muted
          playsInline
          preload="auto"
        >
          <source src="/video/background.mp4" type="video/mp4" />
        </video>

        {/* Feathered Edge - Horizontal Gradient */}
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            background: 'linear-gradient(to right, #000 0%, transparent 15%, transparent 85%, #000 100%)',
          }}
        />

        {/* Feathered Edge - Vertical Gradient */}
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            background: 'linear-gradient(to bottom, #000 0%, transparent 10%, transparent 90%, #000 100%)',
          }}
        />

        {/* Vignette Shadow */}
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            boxShadow: 'inset 0 0 150px 60px rgba(0,0,0,0.7)',
          }}
        />

        {/* Dark Overlay for readability */}
        <div className="absolute inset-0 bg-black/40 pointer-events-none z-10" />

        {/* Background Text - ARCHIVE / EPHEMERA (stacked vertically, cross-dissolve on hover) */}
        <div className="absolute right-12 md:right-16 lg:right-24 top-0 bottom-0 select-none flex items-center justify-center z-30 pointer-events-auto cursor-pointer">
          {/* Both words rendered, cross-dissolve via opacity */}
          {(['ARCHIVE', 'EPHEMERA'] as const).map((word) => {
            const isCurrentWord = bgWord === word;
            const wordOpacity = isCurrentWord ? 1 - wordTransition : wordTransition;

            return (
              <div
                key={word}
                className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center"
                style={{
                  opacity: wordOpacity,
                  transition: 'opacity 2s ease-in-out',
                  pointerEvents: wordOpacity > 0.5 ? 'auto' : 'none',
                  cursor: word === 'EPHEMERA' ? 'pointer' : 'default',
                }}
                onClick={() => {
                  if (word === 'EPHEMERA' && wordOpacity > 0.5 && onOpenAbout) {
                    onOpenAbout();
                  }
                }}
              >
                {/* EPHEMERA 的点击提示 */}
                {word === 'EPHEMERA' && wordOpacity > 0.5 && (
                  <span
                    className="absolute -bottom-8 text-[10px] text-white/20 tracking-widest uppercase whitespace-nowrap"
                    style={{
                      fontFamily: "'Consulate', monospace",
                      opacity: wordOpacity,
                      transition: 'opacity 2s ease-in-out',
                    }}
                  >
                    click for details
                  </span>
                )}
                {word.split('').map((letter, i) => {
                  // Calculate glow intensity based on distance from mouse
                  let glowIntensity = 0;
                  const refIndex = word === 'ARCHIVE' ? i : i + 10; // Offset for EPHEMERA refs
                  if (mousePos && letterRefs.current[refIndex]) {
                    const rect = letterRefs.current[refIndex]!.getBoundingClientRect();
                    const letterCenterX = rect.left + rect.width / 2;
                    const letterCenterY = rect.top + rect.height / 2;
                    const distance = Math.sqrt(
                      Math.pow(mousePos.x - letterCenterX, 2) +
                      Math.pow(mousePos.y - letterCenterY, 2)
                    );
                    glowIntensity = Math.max(0, 1 - distance / 400);
                  }

                  // Check if this letter has been hovered (only for current visible word)
                  const isHovered = isCurrentWord && hoveredLetters.has(i);
                  const hoverBoost = isHovered ? 0.15 : 0;

                  return (
                    <span
                      key={i}
                      ref={(el) => { letterRefs.current[refIndex] = el; }}
                      className="text-[8vh] md:text-[10vh] lg:text-[12vh] font-recorder font-bold leading-[0.85] transition-all duration-200"
                      style={{
                        color: `rgba(255,255,255,${0.02 + glowIntensity * 0.25 + hoverBoost})`,
                        textShadow: (glowIntensity > 0.05 || isHovered)
                          ? `0 0 ${20 + glowIntensity * 50}px rgba(255,255,255,${glowIntensity * 0.7 + hoverBoost}), 0 0 ${50 + glowIntensity * 100}px rgba(255,255,255,${glowIntensity * 0.4 + hoverBoost * 0.5})`
                          : 'none',
                      }}
                      onMouseEnter={() => {
                        if (!isCurrentWord || wordOpacity <= 0.5 || isTransitioning.current) return;

                        // 清除之前的重置计时器
                        if (hoverResetTimer.current) {
                          clearTimeout(hoverResetTimer.current);
                          hoverResetTimer.current = null;
                        }

                        // 设置新的重置计时器（1.5秒后如果没完成就重置）
                        hoverResetTimer.current = setTimeout(() => {
                          setHoveredLetters(new Set());
                        }, 1500);

                        // 更新 hovered letters 并检查是否完成
                        setHoveredLetters(prev => {
                          const next = new Set(prev);
                          next.add(i);

                          // 全部点亮时触发切换
                          if (next.size === word.length && !isTransitioning.current) {
                            // 清除重置计时器
                            if (hoverResetTimer.current) {
                              clearTimeout(hoverResetTimer.current);
                              hoverResetTimer.current = null;
                            }
                            isTransitioning.current = true;
                            setTimeout(() => {
                              setBgWord(p => p === 'ARCHIVE' ? 'EPHEMERA' : 'ARCHIVE');
                              setHoveredLetters(new Set());
                              setTimeout(() => {
                                isTransitioning.current = false;
                              }, 300);
                            }, 500);
                          }
                          return next;
                        });
                      }}
                    >
                      {letter}
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Hidden Scattered Text - Revealed by mouse proximity */}
        {hiddenPhrases.map((phrase) => (
          <div
            key={phrase.id}
            className="absolute pointer-events-none select-none font-recorder tracking-widest uppercase whitespace-nowrap z-20"
            style={{
              left: `${phrase.x}%`,
              top: `${phrase.y}%`,
              transform: `rotate(${phrase.rotation}deg)`,
              fontSize: `${phrase.fontSize}px`,
            }}
          >
            {phrase.text.split('').map((char, charIndex) => {
              const refKey = `${phrase.id}-${charIndex}`;
              let opacity = 0;
              let blur = 8;

              if (mousePos && hiddenTextRefs.current.get(refKey)) {
                const el = hiddenTextRefs.current.get(refKey)!;
                const rect = el.getBoundingClientRect();
                const charCenterX = rect.left + rect.width / 2;
                const charCenterY = rect.top + rect.height / 2;
                const distance = Math.sqrt(
                  Math.pow(mousePos.x - charCenterX, 2) +
                  Math.pow(mousePos.y - charCenterY, 2)
                );
                // Reveal within 120px radius, smooth falloff
                const revealIntensity = Math.max(0, 1 - distance / 120);
                opacity = revealIntensity * 0.6;
                blur = 8 - revealIntensity * 8;
              }

              return (
                <span
                  key={charIndex}
                  ref={(el) => { hiddenTextRefs.current.set(refKey, el); }}
                  style={{
                    color: `rgba(255,255,255,${opacity})`,
                    filter: `blur(${blur}px)`,
                    transition: 'color 0.15s ease-out, filter 0.15s ease-out',
                    textShadow: opacity > 0.1 ? `0 0 ${10 + opacity * 20}px rgba(255,255,255,${opacity * 0.5})` : 'none',
                  }}
                >
                  {char}
                </span>
              );
            })}
          </div>
        ))}
      </div>

      {/* Content Layer - Floating Controls */}
      <div className="absolute inset-0 z-20">

        {/* Minimal Top Bar - Text only */}
        <div className="absolute top-6 left-6 right-6 z-40 flex items-center justify-between">

          {/* Left: Search */}
          <div className="flex items-center gap-2 group cursor-text">
            <Search className="text-white/30 group-hover:text-white/60 transition-colors" size={14} />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none text-white/60 placeholder-white/30 focus:outline-none focus:text-white font-recorder text-sm w-32 hover:text-white/80 transition-colors"
            />
          </div>

          {/* Center: Close & Tidy */}
          <div className="flex items-center gap-6">
            {!isTidy && (
              <button
                onClick={handleTidy}
                className="text-white/30 hover:text-white/80 transition-colors group flex items-center gap-2"
              >
                <LayoutGrid size={14} className="group-hover:scale-110 transition-transform" />
                <span className="text-xs font-recorder tracking-widest uppercase">Tidy</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="text-white/30 hover:text-white/80 transition-colors group flex items-center gap-2"
            >
              <span className="text-xs font-recorder tracking-widest uppercase">Close</span>
              <ChevronDown className="group-hover:translate-y-0.5 transition-transform" size={14} />
            </button>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-6">
            {/* Date & Sort Dropdown */}
            <div className="relative group">
              <button className="text-white/30 hover:text-white/80 transition-colors text-xs font-recorder tracking-widest uppercase flex items-center gap-1">
                Date
                <ChevronDown size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
              {/* Date Dropdown - Transparent */}
              <div className="absolute top-full right-0 mt-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                <div className="p-4 min-w-[220px] space-y-4">
                  {/* Sort Order */}
                  <div>
                    <span className="text-[10px] text-white/40 uppercase tracking-widest font-recorder block mb-2">Sort Order</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setSortMethod('date_desc')}
                        className={`px-3 py-1.5 rounded text-xs transition-all flex-1 ${sortMethod === 'date_desc' ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/70'}`}
                      >
                        Newest
                      </button>
                      <button
                        onClick={() => setSortMethod('date_asc')}
                        className={`px-3 py-1.5 rounded text-xs transition-all flex-1 ${sortMethod === 'date_asc' ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/70'}`}
                      >
                        Oldest
                      </button>
                    </div>
                  </div>
                  {/* Date Range */}
                  <div>
                    <span className="text-[10px] text-white/40 uppercase tracking-widest font-recorder block mb-2">Date Range</span>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-white/40 text-xs w-10">From</span>
                        <input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                          className="bg-white/5 rounded px-2 py-1.5 text-white/80 text-xs focus:outline-none border border-white/10 flex-1"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-white/40 text-xs w-10">To</span>
                        <input
                          type="date"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                          className="bg-white/5 rounded px-2 py-1.5 text-white/80 text-xs focus:outline-none border border-white/10 flex-1"
                        />
                      </div>
                      {(dateFrom || dateTo) && (
                        <button
                          onClick={() => { setDateFrom(''); setDateTo(''); }}
                          className="text-[#903e4f] text-xs hover:text-[#b85a6a] transition-colors"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tags Dropdown */}
            {allTags.length > 0 && (
              <div className="relative group">
                <button className="text-white/30 hover:text-white/80 transition-colors text-xs font-recorder tracking-widest uppercase flex items-center gap-1">
                  Tag
                  <ChevronDown size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
                {/* Tags Dropdown - Transparent */}
                <div className="absolute top-full right-0 mt-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                  <div className="p-2 min-w-[120px] space-y-1">
                    {allTags.map(tag => (
                      <button
                        key={tag}
                        onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                        className={`w-full text-left px-3 py-1.5 rounded text-xs font-recorder tracking-wider uppercase transition-all ${
                          activeTag === tag
                            ? 'text-white'
                            : 'text-white/40 hover:text-white/80'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                    {activeTag && (
                      <button
                        onClick={() => setActiveTag(null)}
                        className="w-full text-left px-3 py-1.5 text-[#903e4f] text-xs hover:text-[#b85a6a] transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Style */}
            <div className="relative group">
              <button className="text-white/30 hover:text-white/80 transition-colors text-xs font-recorder tracking-widest uppercase flex items-center gap-1">
                Style
                <ChevronDown size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
              {/* Style Dropdown - Transparent */}
              <div className="absolute top-full right-0 mt-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                <div className="p-4 min-w-[200px] space-y-4">
                  <div>
                    <span className="text-[10px] text-white/40 uppercase tracking-widest font-recorder block mb-2">Title Font</span>
                    <div className="flex flex-wrap gap-1">
                      {[
                        { name: 'Marker', value: "'Permanent Marker', cursive" },
                        { name: 'Lore', value: "'LORE', cursive" },
                        { name: 'Type', value: "'Consulate', monospace" },
                        { name: '明朝', value: "'HuiWen', serif" },
                      ].map(f => (
                        <button
                          key={f.name}
                          onClick={() => onTitleFontChange(f.value)}
                          className={`px-2 py-1 rounded text-xs transition-all ${titleFont.includes(f.name) || titleFont === f.value ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/70'}`}
                        >
                          {f.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/40 uppercase tracking-widest font-recorder block mb-2">Text Font</span>
                    <div className="flex flex-wrap gap-1">
                      {[
                        { name: 'Journal', value: "'Journal Ultra', sans-serif" },
                        { name: 'Type', value: "'Consulate', monospace" },
                        { name: 'Cute', value: "'Kawaiitegakimoji', sans-serif" },
                        { name: '明朝', value: "'HuiWen', serif" },
                      ].map(f => (
                        <button
                          key={f.name}
                          onClick={() => onContentFontChange(f.value)}
                          className={`px-2 py-1 rounded text-xs transition-all ${contentFont.includes(f.name) || contentFont === f.value ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/70'}`}
                        >
                          {f.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="absolute inset-0 overflow-y-auto pt-20 px-8 pb-8 scrollbar-hide z-10">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 pb-32">
             {filteredMemos.length === 0 ? (
               <div className="col-span-full flex flex-col items-center justify-center mt-20 opacity-30">
                 <div className="w-20 h-20 border-2 border-dashed border-white/30 rounded-full flex items-center justify-center mb-4">
                    <Search size={32} className="text-white/30" />
                 </div>
                 <div className="font-recorder text-sm tracking-[0.5em] uppercase text-white/30">
                   Archive Empty
                 </div>
               </div>
             ) : (
               filteredMemos.map(memo => (
                 <motion.div
                   key={memo.id}
                   drag
                   dragMomentum={false}
                   dragElastic={0.1}
                   whileDrag={{ scale: 1.05, zIndex: 50, cursor: 'grabbing' }}
                   animate={{
                     x: isTidy ? 0 : (dragPositions[memo.id]?.x || 0),
                     y: isTidy ? 0 : (dragPositions[memo.id]?.y || 0),
                   }}
                   transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                   onDragEnd={(_, info) => handleDragEnd(memo.id, info)}
                   className="cursor-grab"
                 >
                   <CassetteTape
                     memo={memo}
                     onPlay={onPlay}
                     onDelete={onDelete}
                     onTogglePermanent={onTogglePermanent}
                     titleFont={titleFont}
                     contentFont={contentFont}
                     onOpenTranscript={onOpenTranscript}
                   />
                 </motion.div>
               ))
             )}
           </div>
        </div>

        {/* About link - bottom left */}
        {onOpenAbout && (
          <button
            onClick={onOpenAbout}
            className="absolute bottom-6 left-8 z-40 text-white/20 hover:text-white/50 transition-colors text-xs tracking-widest uppercase flex items-center gap-2"
            style={{ fontFamily: "'Consulate', monospace" }}
          >
            <span className="text-white/30">✦</span>
            About this project
          </button>
        )}

        {/* Edge Fades */}
        <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/60 to-transparent pointer-events-none z-30"></div>
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/80 to-transparent pointer-events-none z-30"></div>

        {/* Mouse Glow Cursor - Flashlight effect */}
        {mousePos && (
          <div
            className="fixed pointer-events-none z-50"
            style={{
              left: mousePos.x,
              top: mousePos.y,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {/* Outer soft glow */}
            <div
              className="absolute rounded-full"
              style={{
                width: '240px',
                height: '240px',
                left: '-120px',
                top: '-120px',
                background: 'radial-gradient(circle, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 40%, transparent 70%)',
              }}
            />
            {/* Inner glow */}
            <div
              className="absolute rounded-full"
              style={{
                width: '80px',
                height: '80px',
                left: '-40px',
                top: '-40px',
                background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)',
              }}
            />
          </div>
        )}

      </div>
    </div>
  );
};

export default TapeDrawer;
