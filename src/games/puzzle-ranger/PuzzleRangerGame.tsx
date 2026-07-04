import React, { useEffect, useRef, useState } from 'react';
import './puzzle-ranger.css';
import { GameEngine } from './core/game';
import { loadPuzzleRangerAssets } from './core/assetLoader';
import { initAudio, toggleMute, getMuted } from './core/audio';
import { BackButton } from '@/components/BackButton';

type Scene = 'title' | 'playing' | 'result' | 'gameover' | 'howto';



export const PuzzleRangerGame: React.FC = () => {
  const [scene, setScene] = useState<Scene>('title');
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [wave, setWave] = useState(1);
  const [announceWave, setAnnounceWave] = useState<number | null>(null);
  
  const [allyHp, setAllyHp] = useState(500);
  const [allyMaxHp, setAllyMaxHp] = useState(500);
  const [enemyHp, setEnemyHp] = useState(500);
  const [enemyMaxHp, setEnemyMaxHp] = useState(500);

  const puzzleCanvasRef = useRef<HTMLCanvasElement>(null);
  const tdCanvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const imagesRef = useRef<Record<string, HTMLCanvasElement | HTMLImageElement>>({});
  const [assetsLoaded, setAssetsLoaded] = useState(false);

  // Asset Loading
  useEffect(() => {
    loadPuzzleRangerAssets().then(images => {
      imagesRef.current = images;
      setAssetsLoaded(true);
    });
  }, []);

  // Engine Setup / Cleanup
  useEffect(() => {
    if (scene !== 'playing') {
      engineRef.current?.stop();
      return;
    }

    if (!assetsLoaded) return;
    if (!puzzleCanvasRef.current || !tdCanvasRef.current) return;

    engineRef.current = new GameEngine(
      puzzleCanvasRef.current,
      tdCanvasRef.current,
      imagesRef.current,
      {
        onScoreUpdate: setScore,
        onComboUpdate: setCombo,
        onWaveUpdate: (w) => {
          setWave(w);
          setAnnounceWave(w);
          setTimeout(() => setAnnounceWave(null), 2500);
        },
        onHpUpdate: (aHp, aMax, eHp, eMax) => {
          setAllyHp(aHp);
          setAllyMaxHp(aMax);
          setEnemyHp(eHp);
          setEnemyMaxHp(eMax);
        },
        onWaveCleared: (w, s) => {
          setTimeout(() => {
            setWave(w);
            setScore(s); // Though GameEngine updates it, good to ensure
            setScene('result');
          }, 1500);
        },
        onGameOver: (w, s) => {
          setTimeout(() => {
            setWave(w);
            setScore(s);
            setScene('gameover');
          }, 1500);
        }
      }
    );

    engineRef.current.startGame();

    return () => {
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, [scene, assetsLoaded]);

  // Actions
  const handleStart = () => {
    initAudio();
    setScene('playing');
  };

  const handleNextWave = () => {
    setScene('playing');
    // Start with wave + 1
    setTimeout(() => {
      engineRef.current?.startWave(wave + 1);
    }, 50);
  };

  return (
    <div className="puzzle-ranger-game">
      {scene === 'title' && (
        <div className="pr-screen pr-title-screen">
          <div className="pr-title-logo">
            <h1>ぴよレンジャー</h1>
            <span className="pr-title-sub">TOWER DEFENSE</span>
          </div>
          {assetsLoaded ? (
            <>
              <button className="pr-btn-primary" onClick={handleStart}>ゲームスタート</button>
              <button className="pr-btn-secondary" onClick={() => setScene('howto')}>あそびかた</button>
              <BackButton />
            </>
          ) : (
            <p style={{ color: '#fff' }}>Loading assets...</p>
          )}
        </div>
      )}

      {scene === 'howto' && (
        <div className="pr-screen" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <div className="pr-glass-panel">
            <h2 style={{ marginBottom: 20, color: '#fff' }}>あそびかた</h2>
            <div style={{ textAlign: 'left', marginBottom: 20, color: '#aaa', fontSize: '0.9rem', lineHeight: 1.6 }}>
              <p>👆 下画面のブロックをスワイプして入れ替え、同じ色を3つ以上揃えよう！</p>
              <p>🐤 揃えた色に応じたぴよレンジャーが上画面に出撃！</p>
              <p>⚔️ レンジャーは自動で敵と戦うよ。連鎖でパワーアップ！</p>
              <p>🏆 敵の拠点を破壊してウェーブクリア！全ウェーブ制覇を目指せ！</p>
            </div>
            <button className="pr-btn-secondary" onClick={() => setScene('title')}>もどる</button>
          </div>
        </div>
      )}

      {scene === 'playing' && (
        <div className="pr-screen pr-game-screen" style={{ display: 'flex' }}>
          {announceWave !== null && (
            <div className="pr-wave-announce">WAVE {announceWave}</div>
          )}
          
          <div className="pr-td-area">
            <canvas ref={tdCanvasRef} className="pr-td-canvas" />
            <div className="pr-td-hud">
              <div className="pr-hp-bar pr-ally-hp">
                <span className="pr-hp-label">自陣</span>
                <div className="pr-hp-track">
                  <div className="pr-hp-fill" style={{ width: `${Math.max(0, (allyHp / allyMaxHp) * 100)}%` }} />
                </div>
              </div>
              <div className="pr-wave-info">WAVE {wave}</div>
              <div className="pr-hp-bar pr-enemy-hp">
                <span className="pr-hp-label">敵陣</span>
                <div className="pr-hp-track">
                  <div className="pr-hp-fill" style={{ width: `${Math.max(0, (enemyHp / enemyMaxHp) * 100)}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="pr-status-bar">
            <div className="pr-combo-display">
              {combo > 1 && <span className="pr-combo-text-show">{combo} COMBO!</span>}
            </div>
            <div className="pr-score-display">
              SCORE: <span className="pr-score-value">{score.toLocaleString()}</span>
            </div>
            <button 
              style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}
              onClick={() => toggleMute()}
            >
              {getMuted() ? '🔇' : '🔊'}
            </button>
          </div>

          <div className="pr-puzzle-area">
            <canvas ref={puzzleCanvasRef} className="pr-puzzle-canvas" />
          </div>
        </div>
      )}

      {scene === 'result' && (
        <div className="pr-screen" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="pr-glass-panel">
            <h2 style={{ color: '#fff', fontSize: '1.8rem', marginBottom: 10 }}>STAGE CLEAR!</h2>
            <div style={{ color: 'var(--color-yellow)', marginBottom: 20 }}>WAVE {wave} クリア！</div>
            <div style={{ fontSize: '1.2rem', marginBottom: 30, color: '#fff' }}>
              SCORE: <span style={{ color: 'var(--color-accent)' }}>{score.toLocaleString()}</span>
            </div>
            <button className="pr-btn-primary" onClick={handleNextWave}>次のWAVEへ</button>
            <button className="pr-btn-secondary" onClick={() => setScene('title')}>タイトルへ</button>
          </div>
        </div>
      )}

      {scene === 'gameover' && (
        <div className="pr-screen" style={{ background: 'rgba(50,0,0,0.8)' }}>
          <div className="pr-glass-panel">
            <h2 style={{ color: '#ff4466', fontSize: '1.8rem', marginBottom: 10 }}>GAME OVER</h2>
            <div style={{ color: '#aaa', marginBottom: 20 }}>WAVE {wave} で力尽きた…</div>
            <div style={{ fontSize: '1.2rem', marginBottom: 30, color: '#fff' }}>
              SCORE: <span style={{ color: 'var(--color-accent)' }}>{score.toLocaleString()}</span>
            </div>
            <button className="pr-btn-primary" onClick={() => setScene('playing')}>リトライ</button>
            <button className="pr-btn-secondary" onClick={() => setScene('title')}>タイトルへ</button>
          </div>
        </div>
      )}
    </div>
  );
};
