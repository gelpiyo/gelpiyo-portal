/**
 * BounceGame.tsx — ゲルぴよバウンス ラッパーコンポーネント
 * ポータルから呼び出される、画面遷移を含む完結したゲーム画面
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { Renderer } from './core/renderer';
import { Game } from './core/game';
import { initAudio, toggleMute } from './core/audio';
import {
  loadData, saveStageResult, unlockStage, saveEndlessResult,
} from './core/storage';
import { getStageIds, getNextStageId, STAGES } from './core/stages';
import { loadBounceAssets } from './core/assetLoader';
import { BackButton } from '@/components/BackButton';
import './bounce.css';

type Scene = 'title' | 'stageSelect' | 'playing' | 'result' | 'failed' | 'endless-over';

export function BounceGame(): React.JSX.Element {
  const [scene, setScene] = useState<Scene>('title');
  const [score, setScore] = useState(0);
  const [stars, setStars] = useState(0);
  const [piyoCount, setPiyoCount] = useState(0);
  const [wave, setWave] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [currentStageId, setCurrentStageId] = useState<string | null>(null);
  const [isEndless, setIsEndless] = useState(false);
  const [isNewRecord, setIsNewRecord] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const assetsRef = useRef<Record<string, HTMLCanvasElement | HTMLImageElement> | null>(null);

  // キャンバスにゲームを初期化
  const initGame = useCallback(async (stageId: string | 'endless') => {
    if (!canvasRef.current) return;

    // 既存のゲームを停止
    if (gameRef.current) gameRef.current.stop();
    if (rendererRef.current) rendererRef.current.destroy();

    // アセットをロード（初回のみ、以降はキャッシュ）
    if (!assetsRef.current) {
      assetsRef.current = await loadBounceAssets();
    }

    const renderer = new Renderer(canvasRef.current);

    // ロード済み画像をレンダラーに登録
    for (const [key, img] of Object.entries(assetsRef.current)) {
      renderer.setImage(key, img);
    }

    const game = new Game(renderer);

    // コールバック設定
    game.callbacks = {
      onScoreUpdate: (s) => setScore(s),
      onPiyoCountUpdate: (c) => setPiyoCount(c),
      onStageComplete: (s, st) => {
        saveStageResult(stageId, s, st);
        const next = getNextStageId(stageId);
        if (next) unlockStage(next);
        setScore(s);
        setStars(st);
        setScene('result');
      },
      onStageFailed: (s) => {
        setScore(s);
        setScene('failed');
      },
      onWaveUpdate: (w) => setWave(w),
      onEndlessGameOver: (s, w) => {
        const result = saveEndlessResult(s, w);
        setIsNewRecord(result.isNewRecord);
        setScore(s);
        setWave(w);
        setScene('endless-over');
      },
    };

    rendererRef.current = renderer;
    gameRef.current = game;

    if (stageId === 'endless') {
      game.initEndless();
    } else {
      game.initStage(stageId);
    }
    game.start();
  }, []);

  // 入力ハンドラをゲームに接続
  useEffect(() => {
    if (scene !== 'playing' || !canvasRef.current) return;

    const canvas = canvasRef.current;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    const dragThreshold = 10;

    const getCanvasPos = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    };

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      initAudio();
      const touch = e.changedTouches[0];
      const pos = getCanvasPos(touch.clientX, touch.clientY);
      startX = pos.x;
      startY = pos.y;
      isDragging = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      const pos = getCanvasPos(touch.clientX, touch.clientY);
      const dx = pos.x - startX;
      const dy = pos.y - startY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (!isDragging && dist >= dragThreshold) {
        isDragging = true;
        gameRef.current?.handleDragStart(startX, startY);
      }
      if (isDragging) {
        gameRef.current?.handleDragMove(pos.x, pos.y);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      if (isDragging) {
        gameRef.current?.handleDragEnd();
      }
      isDragging = false;
    };

    const handleMouseDown = (e: MouseEvent) => {
      initAudio();
      const pos = getCanvasPos(e.clientX, e.clientY);
      startX = pos.x;
      startY = pos.y;
      isDragging = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (e.buttons === 0) return;
      const pos = getCanvasPos(e.clientX, e.clientY);
      const dx = pos.x - startX;
      const dy = pos.y - startY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (!isDragging && dist >= dragThreshold) {
        isDragging = true;
        gameRef.current?.handleDragStart(startX, startY);
      }
      if (isDragging) {
        gameRef.current?.handleDragMove(pos.x, pos.y);
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        gameRef.current?.handleDragEnd();
      }
      isDragging = false;
    };

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvas.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      canvas.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [scene]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      gameRef.current?.stop();
      rendererRef.current?.destroy();
    };
  }, []);

  const handleStartStage = useCallback((stageId: string) => {
    setCurrentStageId(stageId);
    setIsEndless(false);
    setScore(0);
    setScene('playing');
    setTimeout(() => initGame(stageId), 50);
  }, [initGame]);

  const handleStartEndless = useCallback(() => {
    setCurrentStageId('endless');
    setIsEndless(true);
    setScore(0);
    setWave(0);
    setScene('playing');
    setTimeout(() => initGame('endless'), 50);
  }, [initGame]);

  const handleRetry = useCallback(() => {
    if (currentStageId) {
      setScore(0);
      setScene('playing');
      setTimeout(() => initGame(currentStageId), 50);
    }
  }, [currentStageId, initGame]);

  const handleNextStage = useCallback(() => {
    if (!currentStageId || currentStageId === 'endless') return;
    const next = getNextStageId(currentStageId);
    if (next) {
      handleStartStage(next);
    } else {
      setScene('stageSelect');
    }
  }, [currentStageId, handleStartStage]);

  const handleToggleMute = useCallback(() => {
    initAudio();
    const muted = toggleMute();
    setIsMuted(muted);
  }, []);

  const saveData = loadData();

  // ── タイトル画面 ──
  if (scene === 'title') {
    const best = saveData.endlessBest;
    return (
      <div className="bn-game">
        <BackButton />
        <div className="bn-title-screen">
          <div className="bn-title-icon">🐤</div>
          <h1 className="bn-title">ゲルぴよバウンス</h1>
          <p className="bn-title-subtitle">引っ張って飛ばせ！ぷにぷにバウンドアクション💥</p>
          {best.score > 0 && (
            <div className="bn-best-score">
              🏆 Best: {best.score.toLocaleString()} pts / Wave {best.wave}
            </div>
          )}
          <div className="bn-title-btns">
            <button className="bn-start-btn" id="bn-start" onClick={() => setScene('stageSelect')}>
              ステージを選ぶ
            </button>
            <button className="bn-endless-btn" id="bn-endless" onClick={handleStartEndless}>
              エンドレスモード
            </button>
          </div>
          <button className="bn-sound-btn" onClick={handleToggleMute}>
            {isMuted ? '🔇' : '🔊'}
          </button>
        </div>
      </div>
    );
  }

  // ── ステージ選択画面 ──
  if (scene === 'stageSelect') {
    const stageIds = getStageIds();
    return (
      <div className="bn-game">
        <div className="bn-stage-select">
          <h2 className="bn-stage-title">ステージ選択</h2>
          <div className="bn-stage-grid">
            {stageIds.map((id) => {
              const unlocked = saveData.unlockedStages[id];
              const starCount = saveData.stageStars[id] || 0;
              const stageData = STAGES[id];
              return (
                <button
                  key={id}
                  className={`bn-stage-card ${unlocked ? '' : 'bn-locked'}`}
                  disabled={!unlocked}
                  onClick={() => handleStartStage(id)}
                >
                  <span className="bn-stage-id">{id}</span>
                  <span className="bn-stage-name">{stageData.name}</span>
                  <span className="bn-stage-stars">
                    {'⭐'.repeat(starCount)}{'☆'.repeat(3 - starCount)}
                  </span>
                </button>
              );
            })}
          </div>
          <button className="bn-back-btn" onClick={() => setScene('title')}>もどる</button>
        </div>
      </div>
    );
  }

  // ── ゲーム画面 ──
  if (scene === 'playing') {
    return (
      <div className="bn-game">
        <div className="bn-hud">
          <div className="bn-hud-left">
            <span className="bn-hud-score">💰 {score.toLocaleString()}</span>
            <span className="bn-hud-piyo">🐤 ×{piyoCount}</span>
          </div>
          <div className="bn-hud-right">
            {isEndless && <span className="bn-hud-wave">Wave {wave}</span>}
            <button className="bn-sound-btn bn-sound-btn--small" onClick={handleToggleMute}>
              {isMuted ? '🔇' : '🔊'}
            </button>
          </div>
        </div>
        <canvas ref={canvasRef} className="bn-canvas" />
      </div>
    );
  }

  // ── クリア画面 ──
  if (scene === 'result') {
    return (
      <div className="bn-game">
        <div className="bn-result-screen">
          <div className="bn-result-icon">🎉</div>
          <h2 className="bn-result-title">ステージクリア！</h2>
          <div className="bn-result-stars">{'⭐'.repeat(stars)}{'☆'.repeat(3 - stars)}</div>
          <div className="bn-result-score">スコア: {score.toLocaleString()}</div>
          <div className="bn-result-btns">
            <button className="bn-retry-btn" onClick={handleRetry}>もう一度</button>
            <button className="bn-next-btn" onClick={handleNextStage}>次のステージ</button>
            <button className="bn-home-btn" onClick={() => setScene('stageSelect')}>ステージ選択</button>
          </div>
        </div>
      </div>
    );
  }

  // ── 失敗画面 ──
  if (scene === 'failed') {
    return (
      <div className="bn-game">
        <div className="bn-result-screen">
          <div className="bn-result-icon">😢</div>
          <h2 className="bn-result-title bn-fail">ステージ失敗…</h2>
          <div className="bn-result-score">スコア: {score.toLocaleString()}</div>
          <div className="bn-result-btns">
            <button className="bn-retry-btn" onClick={handleRetry}>もう一度</button>
            <button className="bn-home-btn" onClick={() => setScene('stageSelect')}>ステージ選択</button>
          </div>
        </div>
      </div>
    );
  }

  // ── エンドレス ゲームオーバー ──
  return (
    <div className="bn-game">
      <div className="bn-result-screen">
        <div className="bn-result-icon">{isNewRecord ? '🏆' : '💫'}</div>
        <h2 className="bn-result-title">{isNewRecord ? 'NEW RECORD!' : 'GAME OVER'}</h2>
        <div className="bn-result-score">
          スコア: {score.toLocaleString()} / Wave {wave}
        </div>
        <div className="bn-result-btns">
          <button className="bn-retry-btn" onClick={handleStartEndless}>もう一度</button>
          <button className="bn-home-btn" onClick={() => setScene('title')}>タイトルへ</button>
        </div>
      </div>
    </div>
  );
}
