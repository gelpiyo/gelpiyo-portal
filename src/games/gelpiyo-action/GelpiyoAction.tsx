import React, { useEffect, useRef } from 'react';
import { usePortalStore } from '@/stores/portalStore';
import { StartGame } from './game/main';
import './gelpiyo-action.css';

export const GelpiyoAction: React.FC = () => {
  const navigateToPortal = usePortalStore((state) => state.navigateToPortal);
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const gameInstanceRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (gameContainerRef.current && !gameInstanceRef.current) {
      gameInstanceRef.current = StartGame(gameContainerRef.current.id);
    }

    return () => {
      if (gameInstanceRef.current) {
        gameInstanceRef.current.destroy(true);
        gameInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div className="gelpiyo-action-container">
      <button className="gelpiyo-action-back-btn" onClick={navigateToPortal}>
        &#8592; もどる
      </button>
      <div id="gelpiyo-action-game" ref={gameContainerRef} className="gelpiyo-action-game" />
      {/* バーチャルパッド用のUI配置 */}
      <div className="gelpiyo-action-controls">
        <div className="dpad">
          <button id="btn-left" className="control-btn" style={{ touchAction: 'none' }}>◀</button>
          <button id="btn-right" className="control-btn" style={{ touchAction: 'none' }}>▶</button>
        </div>
        <div className="action-buttons">
          <button id="btn-jump" className="control-btn action-btn" style={{ touchAction: 'none' }}>JUMP</button>
        </div>
      </div>
    </div>
  );
};
