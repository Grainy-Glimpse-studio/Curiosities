/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useState, useRef } from 'react';
import { CosmicCanvas } from './components/CosmicCanvas';
import { useGameStore } from './store/useGameStore';
import { Users, Upload } from 'lucide-react';

export default function App() {
  const connect = useGameStore((state) => state.connect);
  const disconnect = useGameStore((state) => state.disconnect);
  const players = useGameStore((state) => state.players);
  const myColor = useGameStore((state) => state.myColor);
  
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
    }
  };

  const playerCount = Object.keys(players).length + 1;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black text-white font-sans">
      {videoUrl && (
        <video 
          src={videoUrl} 
          autoPlay 
          loop 
          muted 
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      
      <CosmicCanvas />
      
      {/* UI Overlay */}
      <div className="absolute top-0 left-0 w-full p-6 pointer-events-none flex justify-between items-start z-10">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
            Fireworks Flow
          </h1>
          <p className="text-sm text-gray-400 max-w-xs leading-relaxed">
            Move cursor to spawn sparks.<br/>
            <span className="text-white font-medium">Left click</span> to trigger a firework explosion.<br/>
            <span className="text-white font-medium">Spacebar</span> to place a repulsor.
          </p>
          
          {myColor && (
            <div className="flex items-center gap-2 mt-4">
              <div className="w-3 h-3 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]" style={{ backgroundColor: myColor }} />
              <span className="text-xs text-gray-400 uppercase tracking-wider">Your Color</span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-4 pointer-events-auto">
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-lg">
            <Users size={16} className="text-yellow-400" />
            <span className="text-sm font-medium">{playerCount} {playerCount === 1 ? 'Player' : 'Players'}</span>
          </div>
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 transition-colors backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-lg cursor-pointer"
          >
            <Upload size={16} className="text-orange-400" />
            <span className="text-sm font-medium">Upload Background Video</span>
          </button>
          <input 
            type="file" 
            accept="video/*" 
            ref={fileInputRef} 
            onChange={handleVideoUpload} 
            className="hidden" 
          />
        </div>
      </div>
    </div>
  );
}
