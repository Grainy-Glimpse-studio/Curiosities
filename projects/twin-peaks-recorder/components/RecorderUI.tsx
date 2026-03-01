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
  clickSoundUrl?: string;
}

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
  soundUrl
}: any) => {
  const colorStyles: Record<string, string> = {
    silver: `bg-gradient-to-b from-white/90 via-white/60 to-white/40 text-zinc-700 backdrop-blur-md`,
    red: `bg-gradient-to-b from-[#b85a6a]/90 via-[#903e4f]/80 to-[#5a2832]/70 text-white backdrop-blur-md`,
    black: `bg-gradient-to-b from-white/30 via-white/15 to-white/5 text-zinc-300 backdrop-blur-md`,
  };

  const glowStyles: Record<string, string> = {
    silver: `group-hover:shadow-[0_6px_0_rgba(0,0,0,0.9),0_10px_15px_rgba(0,0,0,0.6),0_0_20px_rgba(255,255,255,0.3),inset_0_0_10px_rgba(255,255,255,0.2)]`,
    red: `group-hover:shadow-[0_6px_0_rgba(0,0,0,0.9),0_10px_15px_rgba(0,0,0,0.6),0_0_20px_rgba(144,62,79,0.5),inset_0_0_10px_rgba(255,255,255,0.1)]`,
    black: `group-hover:shadow-[0_6px_0_rgba(0,0,0,0.9),0_10px_15px_rgba(0,0,0,0.6),0_0_20px_rgba(255,255,255,0.2),inset_0_0_10px_rgba(255,255,255,0.1)]`,
  };

  const handleClick = (e: React.MouseEvent) => {
    if (soundUrl) {
      const audio = new Audio(soundUrl);
      audio.play().catch(err => console.error("Error playing sound:", err));
    }
    onClick(e);
  };

  return (
    <div className="flex flex-col items-center w-full gap-1.5 relative z-10">
      <button
        className="w-full h-16 relative group outline-none touch-manipulation perspective-500"
        onClick={handleClick}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className={`
          absolute inset-0 rounded-t-[4px] rounded-b-[6px]
          flex flex-col items-center justify-center
          border border-white/20
          transition-all duration-200 ease-out
          group-hover:border-white/40 group-hover:brightness-110
          group-active:translate-y-[4px] group-active:shadow-[0_1px_0_rgba(0,0,0,0.9)]
          ${active ? 'translate-y-[4px] shadow-[0_1px_0_rgba(0,0,0,0.9)] brightness-90' : `shadow-[0_6px_0_rgba(0,0,0,0.9),0_10px_15px_rgba(0,0,0,0.6)] ${glowStyles[color]}`}
          ${colorStyles[color]}
        `}>
           {label === 'PAUSE' ? (
              <span className={`font-black text-2xl leading-none transition-all duration-200 group-hover:opacity-100 ${active ? 'opacity-100 drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]' : 'opacity-70'} ${color==='red'?'text-white':'text-zinc-700'}`}>II</span>
           ) : (
              <Icon size={20} strokeWidth={2.5} fill={color === 'red' ? 'currentColor' : 'none'} className={`transition-all duration-200 group-hover:opacity-100 ${active ? "opacity-100 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" : "opacity-70"}`}/>
           )}

           {/* Glass highlight */}
           <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent pointer-events-none rounded-t-[4px] transition-all duration-200 group-hover:from-white/50"></div>
           {/* Bottom edge shadow */}
           <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/20 to-transparent pointer-events-none rounded-b-[6px]"></div>
        </div>
      </button>
      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-recorder transition-colors duration-200 group-hover:text-zinc-400">{label}</span>
    </div>
  );
};

const Spool = ({ spinning }: { spinning: boolean }) => (
  <div className={`w-24 h-24 rounded-full bg-[#111] relative border-[6px] border-[#0a0a0a] shadow-[0_0_15px_rgba(0,0,0,0.8),inset_0_0_10px_black] ${spinning ? 'animate-spin-slow' : ''}`}>
     <div className="absolute inset-0">
       {[0, 45, 90, 135].map(deg => (
         <div key={deg} className="absolute top-1/2 left-1/2 w-[85%] h-1.5 bg-zinc-800/60 rounded-full" style={{ transform: `translate(-50%, -50%) rotate(${deg}deg)` }}></div>
       ))}
     </div>
     <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full border-4 border-zinc-800 bg-zinc-900 z-10 shadow-inner flex items-center justify-center">
        <div className="w-4 h-4 rounded-full bg-zinc-700 border border-black shadow-lg"></div>
     </div>
     {/* Tape Texture */}
     <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,transparent_40%,rgba(0,0,0,0.3)_100%)] pointer-events-none"></div>
  </div>
);

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
  onToggleDrawer,
  clickSoundUrl
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

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-6">
      
      <div className="w-[420px] bg-[#222]/80 backdrop-blur-xl rounded-[32px] p-8 shadow-[20px_20px_60px_rgba(0,0,0,0.8),-10px_-10px_30px_rgba(60,60,60,0.15),0_50px_100px_-20px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-2px_10px_rgba(0,0,0,0.3)] border-t border-l border-white/15 border-r-[16px] border-b-[16px] border-r-black/70 border-b-black/70 relative flex flex-col gap-8 overflow-hidden">
        
        {/* Glass Textures */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] via-transparent to-black/40 pointer-events-none z-0"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-white/[0.05] pointer-events-none z-0"></div>
        {/* Subtle noise for glass texture */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}></div>

        {/* --- Top Section --- */}
        <div className="flex justify-between items-start px-2 relative z-10">
           <div className="flex flex-col gap-2">
             <div className="text-[10px] text-zinc-500 font-bold tracking-[0.2em] font-recorder">INPUT LEVEL</div>
             <div className="flex gap-1 bg-black/40 backdrop-blur-md p-2 rounded-md border border-white/10 shadow-inner">
               {[...Array(9)].map((_, i) => (
                 <div key={i} className={`w-1.5 h-4 rounded-sm ${i > 6 ? 'bg-[#5a2832]/50' : i > 4 ? 'bg-zinc-900/50' : 'bg-zinc-900'} transition-colors duration-300 ${state === RecorderState.RECORDING && i < (elapsedTime % 6 + 3) ? (i > 6 ? 'bg-[#903e4f] shadow-[0_0_8px_#903e4f]' : i > 4 ? 'bg-zinc-500 shadow-[0_0_8px_#666]' : 'bg-zinc-400') : ''}`}></div>
               ))}
             </div>
           </div>

           <div className="flex flex-col items-center text-center">
             <div className="text-zinc-400 font-recorder italic text-base tracking-widest drop-shadow-lg leading-tight">Twin</div>
             <div className="text-zinc-400 font-recorder italic text-base tracking-widest drop-shadow-lg leading-tight">Peaks</div>
             <div className="text-[8px] text-zinc-600 font-bold tracking-[0.2em] uppercase font-recorder mt-1">Professional</div>
             <div className="text-[8px] text-zinc-600 font-bold tracking-[0.2em] uppercase font-recorder">TP-119</div>
           </div>

           <div className="flex flex-col items-end">
              <div className="text-[10px] text-zinc-500 font-bold tracking-widest mb-1 font-recorder">INDEX</div>
              <div className="flex items-center bg-black/50 backdrop-blur-md p-2 rounded-lg border border-white/10 shadow-[inset_0_4px_8px_rgba(0,0,0,0.5)]">
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
                    <div className="w-12 h-12 border-4 border-zinc-500/20 border-t-zinc-500 rounded-full animate-spin"></div>
                    <div className="text-zinc-500 font-recorder text-xs tracking-[0.4em] animate-pulse">ANALYZING TAPE...</div>
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
                  <div className="w-full h-4 bg-[#903e4f] mt-3 shadow-sm"></div>
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
                <div className={`w-3.5 h-3.5 rounded-full border-2 border-black transition-all duration-300 ${ledOn ? 'bg-[#903e4f] shadow-[0_0_12px_#903e4f]' : 'bg-[#3a1a20]'}`}></div>
                <span className="text-[10px] text-zinc-500 font-bold tracking-[0.2em] uppercase font-recorder">RECORD / POWER</span>
             </div>
             <div className="text-[10px] text-zinc-600 font-bold tracking-widest font-recorder">AUTO STOP</div>
           </div>

           <div className="grid grid-cols-6 gap-3 p-3 bg-[#151515] rounded-2xl border-t border-white/5 shadow-[inset_0_8px_16px_rgba(0,0,0,0.8)]">
               <MechanicalButton label="REC" icon={Mic} color="red" onClick={onRecord} active={state === RecorderState.RECORDING} soundUrl={clickSoundUrl} />
               <MechanicalButton label="PLAY" icon={Play} onClick={onPlay} active={state === RecorderState.PLAYING} soundUrl={clickSoundUrl} />
               <MechanicalButton label="PAUSE" icon={Pause} onClick={onPause} active={state === RecorderState.PAUSED} soundUrl={clickSoundUrl} />
               <MechanicalButton label="REW" icon={Rewind} onClick={onRewind} soundUrl={clickSoundUrl} />
               <MechanicalButton label="F.FWD" icon={FastForward} onClick={onFastForward} soundUrl={clickSoundUrl} />
               <MechanicalButton label="STOP" icon={Square} onClick={onStop} soundUrl={clickSoundUrl} />
           </div>
           
           <div className="flex justify-between items-center px-2 pt-2 border-t border-white/5">
              <button onClick={onErase} className="group flex items-center gap-2 text-zinc-600 hover:text-[#903e4f] transition-colors">
                <div className="p-1.5 rounded-full bg-zinc-900 border border-zinc-800 group-hover:border-[#903e4f]/50">
                  <Trash size={12} />
                </div>
                <span className="text-[10px] font-bold tracking-widest uppercase font-recorder">Erase Tape</span>
              </button>

              <div className="flex flex-col items-end gap-1.5">
                 <div className="text-[9px] text-zinc-700 font-bold tracking-widest uppercase font-recorder">Monitor Speaker</div>
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
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#903e4f] rounded-full animate-pulse shadow-[0_0_8px_rgba(144,62,79,0.6)]"></div>
        </div>
        <div className="text-zinc-500 font-journal text-[10px] tracking-[0.4em] uppercase group-hover:text-[#903e4f] transition-colors">
          Access Archive
        </div>
      </button>

    </div>
  );
};

export default RecorderUI;