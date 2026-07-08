import React, { useEffect, useRef } from 'react';
import { usePortalStore } from '@/stores/portalStore';
import type { GameState } from './core/types';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './core/types';
import { update } from './core/engine';
import { draw } from './core/renderer';
import { useSaveDataStore } from '@/stores/saveDataStore';
import './invader.css';

export const Invader: React.FC = () => {
  const navigateToPortal = usePortalStore((state) => state.navigateToPortal);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const storeHighScore = useSaveDataStore(s => s.games['invader']?.highScore || 0);
  
  // ゲームの内部状態（ミュータブルにして高速化）
  const stateRef = useRef<GameState>({
    mode: 'title',
    score: 0,
    highScore: storeHighScore,
    lives: 3,
    wave: 1,
    player: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 30, isAlive: true, respawnTimer: 0 },
    enemies: [],
    playerBullets: [],
    enemyBullets: [],
    ufo: { x: 0, y: 0, isAlive: false, timer: 0, dx: 0 },
    bunkers: [],
    enemyDirection: 1,
    enemyMoveTimer: 0,
    enemyMoveInterval: 60,
    enemyBaseInterval: 60,
    fireCooldown: 0,
    waveTransitionTimer: 0,
    keys: { left: false, right: false, fire: false }
  });

  useEffect(() => {
    stateRef.current.highScore = storeHighScore;
  }, [storeHighScore]);

  // メインループ
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const loop = () => {
      animationFrameId = requestAnimationFrame(loop);
      update(stateRef.current);
      draw(ctx, stateRef.current);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // --- 入力ハンドラ ---
  const handleTouchStart = (key: 'left' | 'right' | 'fire') => (e: React.TouchEvent | React.MouseEvent) => {
    if ('preventDefault' in e) e.preventDefault();
    stateRef.current.keys[key] = true;
  };

  const handleTouchEnd = (key: 'left' | 'right' | 'fire') => (e: React.TouchEvent | React.MouseEvent) => {
    if ('preventDefault' in e) e.preventDefault();
    stateRef.current.keys[key] = false;
  };

  return (
    <div className="invader-container">
      <button className="invader-back-btn" onClick={navigateToPortal}>
        &#8592; もどる
      </button>

      <div className="invader-canvas-wrapper">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="invader-canvas"
        />
      </div>

      <div className="invader-controls">
        <div className="invader-controls-dpad">
          <div
            className="invader-btn"
            onTouchStart={handleTouchStart('left')}
            onTouchEnd={handleTouchEnd('left')}
            onMouseDown={handleTouchStart('left')}
            onMouseUp={handleTouchEnd('left')}
            onMouseLeave={handleTouchEnd('left')}
          >
            ◀
          </div>
          <div
            className="invader-btn"
            onTouchStart={handleTouchStart('right')}
            onTouchEnd={handleTouchEnd('right')}
            onMouseDown={handleTouchStart('right')}
            onMouseUp={handleTouchEnd('right')}
            onMouseLeave={handleTouchEnd('right')}
          >
            ▶
          </div>
        </div>
        <div
          className="invader-btn invader-btn-fire"
          onTouchStart={handleTouchStart('fire')}
          onTouchEnd={handleTouchEnd('fire')}
          onMouseDown={handleTouchStart('fire')}
          onMouseUp={handleTouchEnd('fire')}
          onMouseLeave={handleTouchEnd('fire')}
        >
          FIRE
        </div>
      </div>
    </div>
  );
};
