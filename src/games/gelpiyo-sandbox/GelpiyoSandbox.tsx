import React, { useEffect, useRef } from 'react';
import { usePortalStore } from '@/stores/portalStore';
import { initGame } from './game/main';
import './gelpiyo-sandbox.css';

export const GelpiyoSandbox: React.FC = () => {
  const navigateToPortal = usePortalStore((state) => state.navigateToPortal);
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (containerRef.current && !gameRef.current) {
      gameRef.current = initGame(containerRef.current);
    }
    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  const triggerInput = (action: string, isDown: boolean) => {
    if (!gameRef.current) return;
    const scene = gameRef.current.scene.getScene('GameScene') as any;
    if (scene && scene.handleVirtualInput) {
      scene.handleVirtualInput(action, isDown);
    }
  };

  return (
    <div className="gelpiyo-sandbox-container">
      <div className="gelpiyo-sandbox-header">
        <button className="gelpiyo-sandbox-back-btn" onClick={navigateToPortal}>
          &#8592; もどる
        </button>
        <span className="gelpiyo-sandbox-title">ゲルぴよクラフト</span>
      </div>
      
      {/* ゲームキャンバスのコンテナ */}
      <div ref={containerRef} className="gelpiyo-sandbox-game" />

      {/* バーチャルパッド */}
      <div className="gelpiyo-sandbox-ui">
        <div className="dpad">
          <button
            className="dpad-btn left"
            onPointerDown={() => triggerInput('left', true)}
            onPointerUp={() => triggerInput('left', false)}
            onPointerOut={() => triggerInput('left', false)}
            onPointerCancel={() => triggerInput('left', false)}
            onContextMenu={(e) => e.preventDefault()}
          >
            ◀
          </button>
          <button
            className="dpad-btn right"
            onPointerDown={() => triggerInput('right', true)}
            onPointerUp={() => triggerInput('right', false)}
            onPointerOut={() => triggerInput('right', false)}
            onPointerCancel={() => triggerInput('right', false)}
            onContextMenu={(e) => e.preventDefault()}
          >
            ▶
          </button>
        </div>
        <div className="action-buttons">
          <button
            className="action-btn tackle"
            onPointerDown={() => triggerInput('tackle', true)}
            onPointerUp={() => triggerInput('tackle', false)}
            onPointerOut={() => triggerInput('tackle', false)}
            onPointerCancel={() => triggerInput('tackle', false)}
            onContextMenu={(e) => e.preventDefault()}
          >
            体当たり
          </button>
          <button
            className="action-btn jump"
            onPointerDown={() => triggerInput('jump', true)}
            onPointerUp={() => triggerInput('jump', false)}
            onPointerOut={() => triggerInput('jump', false)}
            onPointerCancel={() => triggerInput('jump', false)}
            onContextMenu={(e) => e.preventDefault()}
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
};
