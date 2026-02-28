import React, { useState, useEffect } from 'react';
import { Play, Square, Pause, Mic, FastForward, Rewind, Trash } from 'lucide-react';
import { RecorderState, Memo } from '../types';

interface RecorderUIProps {
  state: RecorderState;
  elapsedTime: number;
  currentMemo: Memo | null;
  onRecord: () => void;
  onPause: () => void;
  onStop: () => void;
  onPlay: () => void;
  onRewind: () => void;
  onFastForward: () => void;
  onErase: () => void;
  onToggleDrawer: () => void;
}

const RecorderUI: React.FC<RecorderUIProps> = ({
  state,
  elapsedTime,
  currentMemo,
  onRecord,
  onPause,
  onStop,
  onPlay,
  onRewind,
  onFastForward,
  onErase,
  onToggleDrawer
}) => {
  const [ledOn, setLedOn] = useState(false);

  // LED blink effect for recording
  useEffect(() => {
    let interval: number;
    if (state === RecorderState.RECORDING) {
      interval = window.setInterval(() => {
        setLedOn(prev => !prev);
      }, 500);
    } else {
      setLedOn(state === RecorderState.PLAYING);
    }
    return () => clearInterval(interval);
  }, [state]);

  const isSpinning = state === RecorderState.RECORDING || state === RecorderState.PLAYING;

  const formatMechanicalCounter = (seconds: number) => {
    const num = Math.floor(seconds * 0.8);
    return num.toString().padStart(3, '0').split('');
  };

  const MechanicalButton = ({ 
    onClick, 
    label, 
    icon: Icon, 
    color = "silver", 
    active = false,
  }: any) => {
    const colorStyles: Record<string, string> = {
      silver: `bg-gradient-to-b from-[#e0e0e0] via-[#b0b0b0] to-[#888] text-zinc-800`,
      red: `bg-gradient-to-b from-[#ff4d4d] via-[#d32f2f] to-[#8e0000] text-white`,
      black: `bg-gradient-to-b from-[#555] via-[#333] to-[#111] text-zinc-400`,
    };

    return (
      <div className="flex flex-col items-center w-full gap-1.5 relative z-10">
        <button 
          className="w-full h-16 relative group outline-none touch-manipulation perspective-500"
          onClick={onClick}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className={`
            absolute inset-0 rounded-t-[4px] rounded-b-[6px]
            flex flex-col items-center justify-center 
            border-x border-black/50
            transition-all duration-100 ease-out
            group-active:translate-y-[4px] group-active:shadow-[0_1px_0_rgba(0,0,0,0.9)]
            ${active ? 'translate-y-[4px] shadow-[0_1px_0_rgba(0,0,0,0.9)] border-t-black/40 brightness-90' : 'shadow-[0_6px_0_rgba(0,0,0,0.9),0_10px_15px_rgba(0,0,0,0.6)] border-t-white/40'}
            ${colorStyles[color]}
          `}>
             {label === 'PAUSE' ? (
                <span className={`font-black text-2xl leading-none ${active ? 'opacity-100 text-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.5)]' : 'opacity-60'} ${color==='red'?'text-white':'text-zinc-800'}`}>II</span>
             ) : (
                <Icon size={20} strokeWidth={2.5} fill={color === 'red' ? 'currentColor' : 'none'} className={active ? "opacity-100 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)] text-amber-400" : "opacity-60"}/>
             )}
             
             {/* Brushed Metal Texture */}
             <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/brushed-alum.png')] opacity-20 pointer-events-none mix-blend-overlay"></div>
             {/* Highlight */}
             <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none"></div>
          </div>
        </button>
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono-retro">{label}</span>
      </div>
    );
  };

  const Spool = ({ spinning }: { spinning: boolean }) => (
    <div className={`w-24 h-24 rounded-full bg-[#111] relative flex items-center justify-center border-[6px] border-[#0a0a0a] shadow-[0_0_15px_rgba(0,0,0,0.8),inset_0_0_10px_black] ${spinning ? 'animate-[spin_2s_linear_infinite]' : ''}`}>
       <div className="absolute w-full h-full">
         {[0, 45, 90, 135].map(deg => (
           <div key={deg} className="absolute top-1/2 left-1/2 w-[90%] h-1 bg-zinc-800/40 -translate-x-1/2 -translate-y-1/2" style={{ transform: `translate(-50%, -50%) rotate(${deg}deg)` }}></div>
         ))}
       </div>
       <div className="absolute w-12 h-12 rounded-full border-4 border-zinc-800 bg-zinc-900 z-10 shadow-inner flex items-center justify-center">
          <div className="w-4 h-4 rounded-full bg-zinc-700 border border-black shadow-lg"></div>
       </div>
       {/* Tape Texture */}
       <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,transparent_40%,rgba(0,0,0,0.3)_100%)]"></div>
    </div>
  );

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-6">
      
      <div className="w-[400px] bg-[#222] rounded-[32px] p-8 shadow-[0_50px_100px_-20px_rgba(0,0,0,1),inset_0_2px_4px_rgba(255,255,255,0.1)] border-r-[12px] border-b-[12px] border-[#111] relative flex flex-col gap-8 overflow-hidden">
        
        {/* Textures */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-leather.png')] opacity-40 pointer-events-none z-0"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-black/80 pointer-events-none z-0"></div>

        {/* --- Top Section --- */}
        <div className="flex justify-between items-start px-2 relative z-10">
           <div className="flex flex-col gap-2">
             <div className="text-[10px] text-zinc-500 font-bold tracking-[0.2em] font-mono-retro">INPUT LEVEL</div>
             <div className="flex gap-1 bg-[#0a0a0a] p-2 rounded-md border border-zinc-800 shadow-inner">
               {[...Array(12)].map((_, i) => (
                 <div key={i} className={`w-1.5 h-4 rounded-sm ${i > 9 ? 'bg-red-900/50' : i > 7 ? 'bg-amber-900/50' : 'bg-zinc-900'} transition-colors duration-300 ${state === RecorderState.RECORDING && i < (elapsedTime % 8 + 4) ? (i > 9 ? 'bg-red-500 shadow-[0_0_8px_red]' : i > 7 ? 'bg-amber-500 shadow-[0_0_8px_orange]' : 'bg-zinc-400') : ''}`}></div>
               ))}
             </div>
           </div>

           <div className="flex flex-col items-center">
             <div className="text-zinc-400 font-serif italic text-xl tracking-widest mb-1 drop-shadow-lg">Twin Peaks</div>
             <div className="text-[10px] text-zinc-600 font-bold tracking-[0.3em] uppercase">Professional TP-119</div>
           </div>

           <div className="flex flex-col items-end">
              <div className="text-[10px] text-zinc-500 font-bold tracking-widest mb-1">INDEX</div>
              <div className="flex items-center bg-[#050505] p-2 rounded-lg border-2 border-zinc-800 shadow-[inset_0_4px_8px_rgba(0,0,0,1)]">
                  {formatMechanicalCounter(elapsedTime).map((digit, i) => (
                    <div key={i} className="w-6 h-9 bg-[#eee] text-[#111] font-mono font-bold text-2xl flex items-center justify-center mx-[1px] rounded-sm relative overflow-hidden shadow-inner">
                      {digit}
                      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/20 pointer-events-none"></div>
                      <div className="absolute top-1/2 w-full h-px bg-black/10"></div>
                    </div>
                  ))}
              </div>
           </div>
        </div>

        {/* --- Middle Section: Cassette Window --- */}
        <div className="relative z-10 w-full bg-[#111] rounded-2xl border-[8px] border-[#181818] shadow-[inset_0_20px_40px_rgba(0,0,0,1),0_2px_0_rgba(255,255,255,0.05)] h-60 flex items-center justify-center overflow-hidden group">
            
            {/* Glass Reflection */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.03] to-white/[0.08] pointer-events-none z-30"></div>
            <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none z-30"></div>

            {state === RecorderState.PROCESSING && (
               <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                 <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin"></div>
                    <div className="text-amber-500 font-mono-retro text-xs tracking-[0.4em] animate-pulse">ANALYZING TAPE...</div>
                 </div>
               </div>
            )}

            {/* Cassette Shell */}
            <div className="w-[92%] h-[88%] bg-[#e8e6df] rounded-lg relative flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,0.8)] overflow-hidden border border-zinc-400">
               {/* Screws */}
               {[
                 'top-3 left-3', 'top-3 right-3', 
                 'bottom-3 left-3', 'bottom-3 right-3'
               ].map(pos => (
                 <div key={pos} className={`absolute ${pos} w-3 h-3 rounded-full bg-zinc-400 shadow-inner flex items-center justify-center border border-zinc-500/50`}>
                   <div className="w-2 h-0.5 bg-zinc-600 rotate-45"></div>
                 </div>
               ))}

               {/* Label */}
               <div className="absolute inset-3 bg-[#fdfcf8] rounded-md border border-zinc-300 shadow-sm overflow-hidden">
                  <div className="w-full h-4 bg-[#c62828] mt-3 shadow-sm"></div>
                  <div className="w-full h-1 bg-zinc-900 mt-1"></div>
                  
                  {/* Title Area */}
                  <div className="absolute top-10 left-6 right-6 h-10 border-b-2 border-zinc-200 flex items-end pb-1">
                     {currentMemo && state !== RecorderState.RECORDING && (
                        <span className="font-handwriting text-[#1a237e] text-2xl transform -rotate-1 ml-2 opacity-90">
                           {currentMemo.tags[0] || 'Untitled Memo'}
                        </span>
                     )}
                  </div>
                  <div className="absolute top-20 left-6 right-6 h-px bg-zinc-200"></div>
               </div>

               {/* Spools Window */}
               <div className="absolute top-[55%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[75%] h-[42%] bg-[#080808] rounded-[24px] border-[3px] border-zinc-400/50 flex justify-between items-center px-6 shadow-[inset_0_0_25px_black] z-10 overflow-hidden">
                  <Spool spinning={isSpinning} />
                  {/* Tape Ribbon */}
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%] h-16 bg-[#2d1b15] opacity-80 -z-10 blur-[1px]"></div>
                  <Spool spinning={isSpinning} />
                  
                  {/* Window Highlight */}
                  <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none"></div>
               </div>
            </div>
        </div>

        {/* --- Bottom Section: Controls --- */}
        <div className="mt-auto relative z-10 flex flex-col gap-6">
           
           <div className="flex justify-between items-center px-1">
             <div className="flex items-center gap-3 bg-[#111] px-4 py-2 rounded-full border border-white/5 shadow-inner">
                <div className={`w-3.5 h-3.5 rounded-full border-2 border-black transition-all duration-300 ${ledOn ? 'bg-red-500 shadow-[0_0_12px_#f00]' : 'bg-[#300]'}`}></div>
                <span className="text-[10px] text-zinc-500 font-bold tracking-[0.2em] uppercase">RECORD / POWER</span>
             </div>
             <div className="text-[10px] text-zinc-600 font-bold tracking-widest font-mono-retro">AUTO STOP</div>
           </div>

           <div className="grid grid-cols-6 gap-3 p-3 bg-[#151515] rounded-2xl border-t border-white/5 shadow-[inset_0_8px_16px_rgba(0,0,0,0.8)]">
               <MechanicalButton label="REC" icon={Mic} color="red" onClick={onRecord} active={state === RecorderState.RECORDING} />
               <MechanicalButton label="PLAY" icon={Play} onClick={onPlay} active={state === RecorderState.PLAYING} />
               <MechanicalButton label="PAUSE" icon={Pause} onClick={onPause} active={state === RecorderState.PAUSED} />
               <MechanicalButton label="REW" icon={Rewind} onClick={onRewind} />
               <MechanicalButton label="F.FWD" icon={FastForward} onClick={onFastForward} />
               <MechanicalButton label="STOP" icon={Square} onClick={onStop} />
           </div>
           
           <div className="flex justify-between items-center px-2 pt-2 border-t border-white/5">
              <button onClick={onErase} className="group flex items-center gap-2 text-zinc-600 hover:text-red-500 transition-colors">
                <div className="p-1.5 rounded-full bg-zinc-900 border border-zinc-800 group-hover:border-red-900/50">
                  <Trash size={12} />
                </div>
                <span className="text-[10px] font-bold tracking-widest uppercase">Erase Tape</span>
              </button>

              <div className="flex flex-col items-end gap-1.5">
                 <div className="text-[9px] text-zinc-700 font-bold tracking-widest uppercase">Monitor Speaker</div>
                 <div className="grid grid-cols-6 gap-1 bg-[#0a0a0a] p-1.5 rounded-md border border-zinc-900 shadow-inner">
                    {[...Array(18)].map((_, i) => (
                      <div key={i} className="w-1.5 h-1.5 bg-black rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]"></div>
                    ))}
                 </div>
              </div>
           </div>

        </div>

      </div>

      {/* Drawer Trigger */}
      <button 
        onClick={onToggleDrawer}
        className="mt-12 group flex flex-col items-center gap-3 transition-all duration-500 hover:-translate-y-1"
      >
        <div className="relative">
          <div className="w-32 h-2.5 bg-[#1a1a1a] rounded-full border border-zinc-800 shadow-2xl group-hover:w-40 transition-all duration-500 overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
          </div>
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>
        </div>
        <div className="text-zinc-500 font-mono-retro text-[10px] tracking-[0.4em] uppercase group-hover:text-amber-600 transition-colors">
          Access Archive
        </div>
      </button>

    </div>
  );
};

export default RecorderUI;