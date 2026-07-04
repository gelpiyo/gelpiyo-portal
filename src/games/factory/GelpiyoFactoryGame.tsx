import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from './core/game';
import { loadFactoryAssets } from './core/assetLoader';
import { initAudio, toggleMute, getMuted } from './core/audio';
import { BackButton } from '@/components/BackButton';
import './gelpiyo-factory.css';

export const GelpiyoFactoryGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameEngine | null>(null);
  const assetsRef = useRef<Record<string, HTMLCanvasElement> | null>(null);
  
  const [isMuted, setIsMuted] = useState(false);
  const [assetsLoaded, setAssetsLoaded] = useState(false);

  useEffect(() => {
    setIsMuted(getMuted());
    
    const init = async () => {
      assetsRef.current = await loadFactoryAssets();
      setAssetsLoaded(true);
      
      if (canvasRef.current) {
        gameRef.current = new GameEngine(canvasRef.current, assetsRef.current);
      }
    };
    
    init();

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy();
      }
    };
  }, []);

  const handleMuteToggle = () => {
    initAudio();
    toggleMute();
    setIsMuted(getMuted());
  };

  return (
    <div className="factory-game-container">
      <div className="factory-canvas-wrapper">
        <canvas ref={canvasRef} />
        {!assetsLoaded && (
          <div style={{ position: 'absolute', color: '#fff', fontSize: '1.2rem', fontFamily: 'DotGothic16' }}>
            Loading assets...
          </div>
        )}
      </div>
      <BackButton />
      
      <button 
        onClick={handleMuteToggle}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          background: 'rgba(0,0,0,0.5)',
          border: '2px solid #555',
          borderRadius: '50%',
          width: '50px',
          height: '50px',
          fontSize: '24px',
          cursor: 'pointer',
          zIndex: 100,
          color: '#fff',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        {isMuted ? '🔇' : '🔊'}
      </button>
    </div>
  );
};
