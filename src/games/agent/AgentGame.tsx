import React, { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from './Scene';
import { usePortalStore } from '../../stores/portalStore';
import { setPlayerKey } from './Player';
import './agent-game.css';

export const AgentGame: React.FC = () => {
  const navigateToPortal = usePortalStore((state) => state.navigateToPortal);

  const handleBack = () => {
    navigateToPortal();
  };

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  return (
    <div className="agent-game-container">
      <Canvas dpr={0.3} gl={{ antialias: false }} camera={{ position: [0, 2, 5], fov: 75 }}>
        <Scene />
      </Canvas>
      
      <div className="agent-overlay">
        <button className="agent-back-btn" onClick={handleBack}>
          &#8592; もどる
        </button>
        <div className="agent-controls-hint">
          <p>W A S D - Move</p>
        </div>
        <div className="agent-title">
          <h2>PS1 Grassland</h2>
        </div>

        {/* スマホ用 バーチャル D-Pad */}
        <div className="agent-dpad">
          <button 
            className="dpad-btn up" 
            onPointerDown={() => setPlayerKey('w', true)} 
            onPointerUp={() => setPlayerKey('w', false)}
            onPointerLeave={() => setPlayerKey('w', false)}
          >W</button>
          <div className="dpad-row">
            <button 
              className="dpad-btn left" 
              onPointerDown={() => setPlayerKey('a', true)} 
              onPointerUp={() => setPlayerKey('a', false)}
              onPointerLeave={() => setPlayerKey('a', false)}
            >A</button>
            <button 
              className="dpad-btn down" 
              onPointerDown={() => setPlayerKey('s', true)} 
              onPointerUp={() => setPlayerKey('s', false)}
              onPointerLeave={() => setPlayerKey('s', false)}
            >S</button>
            <button 
              className="dpad-btn right" 
              onPointerDown={() => setPlayerKey('d', true)} 
              onPointerUp={() => setPlayerKey('d', false)}
              onPointerLeave={() => setPlayerKey('d', false)}
            >D</button>
          </div>
        </div>

      </div>
    </div>
  );
};

