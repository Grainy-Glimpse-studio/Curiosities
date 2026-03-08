import React, { useState, useEffect } from 'react';
import { Play, Square, Pause, Mic, FastForward, Rewind, Trash } from 'lucide-react';
import { RecorderState, Memo } from '../types';

interface FocusRecorderUIProps {
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

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const OutlineButton = ({ onClick, icon: Icon, label, active, soundUrl, isDanger }: any) => {
  const handleClick = (e: React.MouseEvent) => {
    if (soundUrl) {
      const audio = new Audio(soundUrl);
      audio.play().catch(err => console.error("Error playing sound:", err));
    }
    onClick(e);
  };

  const baseClass = "flex flex-col items-center justify-center gap-2 py-4 border transition-all duration-200";
  
  let colorClass = "border-white/20 text-white/50 hover:border-white/60 hover:text-white/90 hover:bg-white/5";
  if (active) {
    colorClass = isDanger 
      ? "border-red-500 text-red-500 bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.2)]" 
      : "border-amber-500 text-amber-500 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.2)]";
  } else if (isDanger) {
    colorClass = "border-white/20 text-white/50 hover:border-red-500/60 hover:text-red-500 hover:bg-red-500/5";
  }

  return (
    <button onClick={handleClick} className={`${baseClass} ${colorClass}`}>
      <Icon size={18} strokeWidth={1.5} />
      <span className="text-[9px] tracking-[0.2em] uppercase font-mono">{label}</span>
    </button>
  );
};

const FocusRecorderUI: React.FC<FocusRecorderUIProps> = ({
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

  useEffect(() => {
    let interval: number;
    if (state === RecorderState.RECORDING) {
      interval = window.setInterval(() => setLedOn(prev => !prev), 500);
    } else {
      setLedOn(state === RecorderState.PLAYING);
    }
    return () => clearInterval(interval);
  }, [state]);

  const isSpinning = state === RecorderState.RECORDING || state === RecorderState.PLAYING;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-6 font-mono">
      
      {/* Main Wireframe Container */}
      <div className="w-[400px] bg-black border border-white/20 p-8 flex flex-col gap-10 relative">
        
        {/* Corner Accents */}
        <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-white/50"></div>
        <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-white/50"></div>
        <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-white/50"></div>
        <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-white/50"></div>

        {/* Top Header */}
        <div className="flex justify-between items-end border-b border-white/10 pb-4">
          <div className="flex flex-col gap-1">
            <div className="text-[10px] text-white/40 tracking-[0.3em] uppercase">Status</div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${ledOn ? (state === RecorderState.RECORDING ? 'bg-red-500 shadow-[0_0_8px_red]' : 'bg-amber-500 shadow-[0_0_8px_orange]') : 'bg-white/10'}`}></div>
              <span className={`text-xs tracking-widest uppercase ${state === RecorderState.RECORDING ? 'text-red-500' : state === RecorderState.PLAYING ? 'text-amber-500' : 'text-white/60'}`}>
                {state === RecorderState.IDLE ? 'STANDBY' : state}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="text-[10px] text-white/40 tracking-[0.3em] uppercase">Timer</div>
            <div className="text-3xl text-white/90 font-light tracking-wider">
              {formatTime(elapsedTime)}
            </div>
          </div>
        </div>

        {/* Minimalist Tape Visual */}
        <div className="relative h-32 border border-white/10 flex items-center justify-center gap-16 overflow-hidden">
          {/* Connecting Line */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-px bg-white/10"></div>
          
          {/* Left Spool */}
          <div className={`w-16 h-16 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center ${isSpinning ? 'animate-spin-slow' : ''}`}>
            <div className="w-2 h-2 bg-white/20 rounded-full"></div>
          </div>
          
          {/* Right Spool */}
          <div className={`w-16 h-16 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center ${isSpinning ? 'animate-spin-slow' : ''}`}>
            <div className="w-2 h-2 bg-white/20 rounded-full"></div>
          </div>

          {/* Current Memo Title Overlay */}
          {currentMemo && state !== RecorderState.RECORDING && (
            <div className="absolute bottom-2 left-0 right-0 text-center">
              <span className="bg-black px-2 text-[10px] text-white/50 tracking-widest uppercase">
                {currentMemo.tags[0] || 'Untitled'}
              </span>
            </div>
          )}
        </div>

        {/* Controls Grid */}
        <div className="grid grid-cols-3 gap-px bg-white/10 border border-white/10">
          <OutlineButton label="REC" icon={Mic} onClick={onRecord} active={state === RecorderState.RECORDING} isDanger soundUrl={clickSoundUrl} />
          <OutlineButton label="PLAY" icon={Play} onClick={onPlay} active={state === RecorderState.PLAYING} soundUrl={clickSoundUrl} />
          <OutlineButton label="PAUSE" icon={Pause} onClick={onPause} active={state === RecorderState.PAUSED} soundUrl={clickSoundUrl} />
          <OutlineButton label="REW" icon={Rewind} onClick={onRewind} soundUrl={clickSoundUrl} />
          <OutlineButton label="STOP" icon={Square} onClick={onStop} soundUrl={clickSoundUrl} />
          <OutlineButton label="F.FWD" icon={FastForward} onClick={onFastForward} soundUrl={clickSoundUrl} />
        </div>

        {/* Bottom Actions */}
        <div className="flex justify-between items-center pt-2">
          <button 
            onClick={onErase}
            className="flex items-center gap-2 text-white/30 hover:text-red-500 transition-colors"
          >
            <Trash size={12} />
            <span className="text-[9px] tracking-widest uppercase">Erase</span>
          </button>

          {/* Audio Level Meter (Minimal) */}
          <div className="flex gap-1">
            {[...Array(8)].map((_, i) => (
              <div 
                key={i} 
                className={`w-1 h-2 transition-all duration-150 ${
                  state === RecorderState.RECORDING && i < (elapsedTime % 8) 
                    ? 'bg-white/80' 
                    : 'bg-white/10'
                }`}
              ></div>
            ))}
          </div>
        </div>

      </div>

      {/* Drawer Trigger */}
      <button 
        onClick={onToggleDrawer}
        className="mt-12 text-[10px] text-white/30 hover:text-white/80 tracking-[0.4em] uppercase transition-colors flex items-center gap-2"
      >
        <span>[ Access Archive ]</span>
      </button>

    </div>
  );
};

export default FocusRecorderUI;
