import React from 'react';
import { Memo } from '../types';
import { Play, Trash2, FileText, Download } from 'lucide-react';

interface CassetteTapeProps {
  memo: Memo;
  onPlay: (memo: Memo) => void;
  onDelete: (id: string) => void;
  onTogglePermanent: (id: string) => void;
  titleFont: string;
  contentFont: string;
}

const CassetteTape: React.FC<CassetteTapeProps> = ({ memo, onPlay, onDelete, onTogglePermanent, titleFont, contentFont }) => {
  
  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute:'2-digit', hour12: false });
  };

  const handleExport = () => {
    const element = document.createElement("a");
    const file = new Blob([`Date: ${new Date(memo.createdAt).toLocaleString()}\nTags: ${memo.tags.join(', ')}\n\nTranscription:\n${memo.transcription}`], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `memo-${memo.id}.txt`;
    document.body.appendChild(element);
    element.click();
  };

  return (
    <div className="relative group w-full mb-6 perspective-1000">
      {/* Tape Body */}
      <div className="bg-[#1a1a1a] rounded-xl shadow-[0_20px_40px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.1)] border border-black p-3 transform transition-all duration-300 group-hover:-rotate-1 group-hover:scale-[1.02] relative overflow-hidden">
        
        {/* Plastic Texture */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/black-scales.png')] opacity-20 pointer-events-none"></div>
        
        {/* Label Area */}
        <div className="relative z-10 bg-[#fdfcf8] rounded-lg p-4 shadow-inner border border-zinc-300 flex flex-col gap-2 min-h-[160px]">
          {/* Label Header */}
          <div className="flex justify-between items-center border-b-2 border-zinc-200 pb-2">
             <div className="flex flex-col">
                <span className="text-[8px] text-zinc-400 font-bold tracking-widest uppercase">Date / Time</span>
                <span className="text-[#1a237e] text-xl leading-none mt-1" style={{ fontFamily: titleFont }}>
                  {formatDate(memo.createdAt)} <span className="text-sm opacity-70">{formatTime(memo.createdAt)}</span>
                </span>
             </div>
             <button 
               onClick={() => onTogglePermanent(memo.id)}
               className={`w-5 h-5 rounded-full border-2 transition-all ${memo.isPermanent ? 'bg-red-500 border-red-600 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-transparent border-zinc-300 hover:border-red-400'}`}
               title="Keep Forever"
             />
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 py-1">
            {memo.tags.map(tag => (
              <span key={tag} className="px-2 py-0.5 bg-zinc-100 text-zinc-600 text-[9px] uppercase font-bold tracking-wider border border-zinc-200 rounded-sm italic">
                #{tag}
              </span>
            ))}
          </div>

          {/* Transcription Preview */}
          <div className="flex-1 relative">
             <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="w-full h-px bg-zinc-200"></div>
                ))}
             </div>
             <p className="italic text-zinc-800 text-sm leading-[1.6rem] line-clamp-3 relative z-10 pt-0.5" style={{ fontFamily: contentFont }}>
               {memo.transcription || "No transcription available..."}
             </p>
          </div>
          
          {/* Tape Info */}
          <div className="flex justify-between items-center mt-2 pt-2 border-t border-zinc-100">
             <span className="text-[8px] text-zinc-400 font-mono tracking-widest uppercase">Side A / 60 Min</span>
             <span className="text-[8px] text-zinc-400 font-mono tracking-widest uppercase">TP-PROFESSIONAL</span>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-4 flex items-center justify-between px-2 relative z-10">
          <button 
            onClick={() => onPlay(memo)}
            className="flex items-center gap-3 px-4 py-2 rounded-full bg-zinc-900 text-zinc-300 border border-zinc-800 hover:bg-zinc-800 hover:text-white active:scale-95 transition-all shadow-lg group/play"
          >
            <Play size={14} fill="currentColor" className="group-hover/play:text-amber-500 transition-colors" />
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase">Play Tape</span>
          </button>

          <div className="flex gap-3">
            <button 
              onClick={handleExport} 
              className="p-2 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-all shadow-md"
              title="Export as Text"
            >
              <Download size={16} />
            </button>
            <button 
              onClick={() => onDelete(memo.id)} 
              className="p-2 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-red-500 hover:border-red-900/50 transition-all shadow-md"
              title="Delete Tape"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Decorative Tape Spools (Visible through shell) */}
        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-40 h-40 bg-zinc-800/10 rounded-full blur-3xl pointer-events-none"></div>
      </div>
      
      {/* Tape Spine Shadow */}
      <div className="absolute top-4 -right-2 w-4 h-[85%] bg-black/40 rounded-r-xl blur-sm -z-10"></div>
    </div>
  );
};

export default CassetteTape;
