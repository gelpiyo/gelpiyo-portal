import React, { useEffect, useRef, useState } from 'react';
import { usePortalStore } from '@/stores/portalStore';
import { useBreedingState } from './useBreedingState';
import { GelpiyoPhysics } from './GelpiyoPhysics';
import './breeding.css';

export const BreedingGame: React.FC = () => {
  const navigateToPortal = usePortalStore((state) => state.navigateToPortal);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const physicsRef = useRef<GelpiyoPhysics | null>(null);
  
  // メッセージ吹き出しのステート
  const [message, setMessage] = useState<string | null>(null);
  const messageTimeoutRef = useRef<number | null>(null);

  const { size, bounce, hue, happiness, fullness, feed, play, pet } = useBreedingState();

  useEffect(() => {
    if (canvasRef.current) {
      const physics = new GelpiyoPhysics(canvasRef.current);
      physics.start();
      physicsRef.current = physics;

      return () => {
        physics.stop();
      };
    }
  }, []);

  // 状態が変更されたらPhysicsクラスに反映
  useEffect(() => {
    if (physicsRef.current) {
      physicsRef.current.size = size;
      physicsRef.current.bounce = bounce;
      physicsRef.current.hue = hue;
    }
  }, [size, bounce, hue]);

  // メッセージ表示ヘルパー
  const showMessage = (msg: string) => {
    setMessage(msg);
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current);
    }
    messageTimeoutRef.current = window.setTimeout(() => {
      setMessage(null);
    }, 2500);
  };

  const handleCanvasClick = () => {
    if (physicsRef.current) {
      pet();
      physicsRef.current.setState('idle', 1.0); // なでられた時は軽く跳ねてアイドル
      physicsRef.current.emitParticles('heart', 3);
      
      const msgs = [
        'えへへ！', 'ぷるんっ', 'なでなで〜', '♪', 
        'くすぐったいよ〜！', 'もっと撫でて！', 'あたたかいなぁ', 
        'すりすり…', 'きゅんっ💖', 'わーい！'
      ];
      showMessage(msgs[Math.floor(Math.random() * msgs.length)]);
    }
  };

  const handleFeed = () => {
    if (fullness >= 100) {
      showMessage('もうおなかいっぱい…！');
      return;
    }
    
    if (physicsRef.current) {
      const foods = [
        { emoji: '🍰', msg: 'あま〜い！🍰' },
        { emoji: '🍔', msg: 'もぐもぐ…バーガー最高！🍔' },
        { emoji: '🍙', msg: 'お米がおいしい！🍙' },
        { emoji: '🍎', msg: 'シャキシャキ！🍎' },
        { emoji: '🍖', msg: 'お肉だ〜！🍖' },
        { emoji: '🍩', msg: 'ふんわりドーナツ！🍩' }
      ];
      const food = foods[Math.floor(Math.random() * foods.length)];
      
      // アイテムを投擲し、ヒットした瞬間に状態を更新する
      physicsRef.current.throwItem(food.emoji, 'food', () => {
        feed(); // Zustand更新
        const variant = Math.floor(Math.random() * 4);
        physicsRef.current?.setState('feeding', 1.5, variant);
        physicsRef.current?.emitParticles('food', 4);
        showMessage(food.msg);
      });
    }
  };

  const handlePlay = () => {
    if (fullness <= 0) {
      showMessage('おなかがすいて遊べないよ…');
      return;
    }
    
    if (physicsRef.current) {
      // 遊ぶ側はサッカーボール固定
      const emoji = '⚽️';

      physicsRef.current.throwItem(emoji, 'toy', (isSlip?: boolean) => {
        play(); // Zustand更新
        
        if (isSlip) {
          // 転んだ時用の専用メッセージ
          const slipMsgs = ['すてんっ！💦', 'あわわっ！', 'いてて…', 'すべっちゃった！', 'あちゃー💦'];
          showMessage(slipMsgs[Math.floor(Math.random() * slipMsgs.length)]);
          return;
        }

        const variant = Math.floor(Math.random() * 4);
        physicsRef.current?.setState('playing', 2.0, variant);
        physicsRef.current?.emitParticles('note', 5);
        
        const playMsgs = [
          'えいっ！⚽️', 'ナイスヘディング！', 'そりゃっ！⚽️',
          'キック！', 'パス！', 'ボールあそび大好き！', 'ヘディング！'
        ];
        showMessage(playMsgs[Math.floor(Math.random() * playMsgs.length)]);
      });
    }
  };

  return (
    <div className="breeding-container">
      <header className="breeding-header">
        <button className="breeding-back-btn glass-panel" onClick={navigateToPortal}>
          <span aria-hidden="true">◀</span> もどる
        </button>
        
        <div className="breeding-status-container glass-panel">
          <div className="breeding-status-row">
            <span>💖</span>
            <div className="progress-bar">
              <div className="progress-fill happiness" style={{ width: `${happiness}%` }} />
            </div>
          </div>
          <div className="breeding-status-row">
            <span>🍔</span>
            <div className="progress-bar">
              <div className="progress-fill fullness" style={{ width: `${fullness}%` }} />
            </div>
          </div>
        </div>
      </header>

      <div className="breeding-canvas-container" onClick={handleCanvasClick}>
        {message && (
          <div className="breeding-speech-bubble">
            {message}
          </div>
        )}
        <canvas ref={canvasRef} className="breeding-canvas" />
      </div>

      <footer className="breeding-footer">
        <button className="breeding-action-btn" onClick={handleFeed}>
          <div className="btn-icon">🍔</div>
          <div className="btn-label">ごはん</div>
        </button>
        <button className="breeding-action-btn" onClick={handlePlay}>
          <div className="btn-icon">⚽</div>
          <div className="btn-label">あそぶ</div>
        </button>
      </footer>
    </div>
  );
};
