import React, { useState, useMemo } from 'react';
import { Memo } from '../types';
import CassetteTape from './CassetteTape';
import { Search, ChevronDown, Filter, Calendar, Type } from 'lucide-react';

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
  onContentFontChange
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [sortMethod, setSortMethod] = useState<SortMethod>('date_desc');

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

    // Sort
    result.sort((a, b) => {
      if (sortMethod === 'date_desc') return b.createdAt - a.createdAt;
      return a.createdAt - b.createdAt;
    });

    return result;

  }, [memos, searchQuery, activeTag, sortMethod]);


  return (
    <div 
      className={`fixed inset-0 z-50 transform transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
    >
      {/* Background with Wood Texture */}
      <div className="absolute inset-0 texture-wood shadow-[inset_0_20px_50px_rgba(0,0,0,0.8)] flex flex-col">
        
        {/* Handle / Header */}
        <div 
          onClick={onClose}
          className="h-16 bg-black/40 backdrop-blur-md cursor-pointer flex flex-col justify-center items-center border-b border-white/5 group"
        >
          <div className="w-12 h-1 bg-white/20 rounded-full mb-2 group-hover:bg-amber-500/50 transition-colors"></div>
          <ChevronDown className="text-white/30 group-hover:text-amber-500 transition-colors" size={20} />
        </div>

        {/* Controls Bar */}
        <div className="px-8 py-6 bg-black/20 backdrop-blur-xl border-b border-white/5 space-y-6">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex flex-col">
              <h2 className="text-3xl font-serif italic text-amber-100/90 tracking-wide">The Archive</h2>
              <p className="text-[10px] text-amber-200/30 font-mono-retro tracking-[0.3em] uppercase mt-1">Classified Case Files</p>
            </div>

            {/* Search */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-200/30" size={16} />
              <input 
                type="text" 
                placeholder="Search transcripts..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/60 border border-white/5 rounded-full pl-12 pr-6 py-3 text-amber-50 placeholder-amber-200/20 focus:outline-none focus:border-amber-500/30 focus:ring-1 focus:ring-amber-500/20 font-mono-retro text-xs transition-all"
              />
            </div>
          </div>

          <div className="flex flex-wrap justify-between items-center gap-4 border-t border-white/5 pt-4">
             {/* Font Settings */}
             <div className="flex items-center gap-4">
               <div className="flex items-center gap-2">
                 <Type size={14} className="text-amber-200/30" />
                 <span className="text-[10px] text-amber-100/40 uppercase tracking-widest font-mono-retro mr-1">Title:</span>
                 <div className="flex bg-black/40 border border-white/5 rounded-md overflow-hidden">
                   <button 
                     onClick={() => onTitleFontChange("'Permanent Marker', 'Kawaiitegakimoji', cursive")}
                     className={`px-3 py-1.5 text-[10px] uppercase tracking-wider transition-colors ${titleFont.includes('Permanent Marker') ? 'bg-amber-600/20 text-amber-400 font-bold' : 'text-amber-100/60 hover:bg-white/5'}`}
                   >
                     Marker
                   </button>
                   <button 
                     onClick={() => onTitleFontChange("'Kawaiitegakimoji', sans-serif")}
                     className={`px-3 py-1.5 text-[10px] uppercase tracking-wider transition-colors border-l border-white/5 ${titleFont === "'Kawaiitegakimoji', sans-serif" ? 'bg-amber-600/20 text-amber-400 font-bold' : 'text-amber-100/60 hover:bg-white/5'}`}
                   >
                     Cute
                   </button>
                   <button 
                     onClick={() => onTitleFontChange("'Cormorant Garamond', serif")}
                     className={`px-3 py-1.5 text-[10px] uppercase tracking-wider transition-colors border-l border-white/5 ${titleFont.includes('Garamond') ? 'bg-amber-600/20 text-amber-400 font-bold' : 'text-amber-100/60 hover:bg-white/5'}`}
                   >
                     Serif
                   </button>
                 </div>
               </div>
               
               <div className="w-px h-4 bg-white/10 hidden md:block"></div>

               <div className="flex items-center gap-2">
                 <Type size={14} className="text-amber-200/30" />
                 <span className="text-[10px] text-amber-100/40 uppercase tracking-widest font-mono-retro mr-1">Text:</span>
                 <div className="flex bg-black/40 border border-white/5 rounded-md overflow-hidden">
                   <button 
                     onClick={() => onContentFontChange("'Courier Prime', monospace")}
                     className={`px-3 py-1.5 text-[10px] uppercase tracking-wider transition-colors ${contentFont.includes('Courier') ? 'bg-amber-600/20 text-amber-400 font-bold' : 'text-amber-100/60 hover:bg-white/5'}`}
                   >
                     Typewriter
                   </button>
                   <button 
                     onClick={() => onContentFontChange("'Inter', sans-serif")}
                     className={`px-3 py-1.5 text-[10px] uppercase tracking-wider transition-colors border-l border-white/5 ${contentFont.includes('Inter') ? 'bg-amber-600/20 text-amber-400 font-bold' : 'text-amber-100/60 hover:bg-white/5'}`}
                   >
                     Clean
                   </button>
                   <button 
                     onClick={() => onContentFontChange("'Kawaiitegakimoji', sans-serif")}
                     className={`px-3 py-1.5 text-[10px] uppercase tracking-wider transition-colors border-l border-white/5 ${contentFont === "'Kawaiitegakimoji', sans-serif" ? 'bg-amber-600/20 text-amber-400 font-bold' : 'text-amber-100/60 hover:bg-white/5'}`}
                   >
                     Cute
                   </button>
                 </div>
               </div>
             </div>

             {/* Sort Toggle */}
             <button 
               onClick={() => setSortMethod(prev => prev === 'date_desc' ? 'date_asc' : 'date_desc')}
               className="flex items-center gap-3 px-4 py-2 rounded-full bg-white/5 border border-white/5 text-amber-100/60 hover:text-amber-100 hover:bg-white/10 transition-all text-xs font-bold tracking-widest uppercase"
             >
               <Calendar size={14} />
               <span>{sortMethod === 'date_desc' ? 'Newest First' : 'Oldest First'}</span>
             </button>

             {/* Tag Cloud */}
             <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide flex-1 md:justify-end">
                <Filter size={14} className="text-amber-200/30 shrink-0" />
                <div className="flex gap-2">
                  {allTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                      className={`px-4 py-1.5 rounded-full text-[10px] font-bold border whitespace-nowrap transition-all tracking-wider uppercase ${
                        activeTag === tag 
                          ? 'bg-amber-600 text-white border-amber-500 shadow-[0_0_15px_rgba(217,119,6,0.3)]' 
                          : 'bg-black/40 text-amber-200/40 border-white/5 hover:border-amber-500/30 hover:text-amber-200/60'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                  {activeTag && (
                    <button 
                      onClick={() => setActiveTag(null)} 
                      className="px-4 py-1.5 rounded-full text-[10px] font-bold border border-red-900/30 text-red-400/60 hover:text-red-400 hover:bg-red-900/10 transition-all tracking-wider uppercase"
                    >
                      Clear
                    </button>
                  )}
                </div>
             </div>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 pb-32">
             {filteredMemos.length === 0 ? (
               <div className="col-span-full flex flex-col items-center justify-center mt-20 opacity-20">
                 <div className="w-20 h-20 border-2 border-dashed border-amber-100 rounded-full flex items-center justify-center mb-4">
                    <Search size={32} />
                 </div>
                 <div className="font-mono-retro text-sm tracking-[0.5em] uppercase">
                   Archive Empty
                 </div>
               </div>
             ) : (
               filteredMemos.map(memo => (
                 <CassetteTape 
                   key={memo.id} 
                   memo={memo} 
                   onPlay={onPlay} 
                   onDelete={onDelete}
                   onTogglePermanent={onTogglePermanent}
                   titleFont={titleFont}
                   contentFont={contentFont}
                 />
               ))
             )}
           </div>
        </div>

        {/* Bottom Fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/60 to-transparent pointer-events-none"></div>

      </div>
    </div>
  );
};

export default TapeDrawer;
