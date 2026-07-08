import React, { useEffect, useRef, useState } from 'react';
import { usePortalStore } from '@/stores/portalStore';
import type { ScreenState, TurnResult, Particle, GameRuntimeState, ImageAssets } from './core/types';
import { TOTAL_TURNS, ENEMY_TIMEOUT_MS, FRIENDLY_WAIT_MS, PENALTY_TIME_MS } from './core/types';
import { drawGame, getAverageTimeStr } from './core/renderer';
import { useSaveDataStore } from '@/stores/saveDataStore';
import './speed-gunman.css';

export const SpeedGunman: React.FC = () => {
  const navigateToPortal = usePortalStore((state) => state.navigateToPortal);
  const [screen, setScreen] = useState<ScreenState>('loading');
  const storeData = useSaveDataStore(s => s.games['speed-gunman']);
  const updateSpeedGunmanData = useSaveDataStore(s => s.updateSpeedGunmanData);

  const [playCount, setPlayCount] = useState(storeData?.playCount || 0);
  const [bestAverageTime, setBestAverageTime] = useState<number | null>(storeData?.bestAverageTime ?? null);

  const [results, setResults] = useState<TurnResult[]>([]);
  const [countdownText, setCountdownText] = useState('READY...');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const imagesRef = useRef<ImageAssets>({ bg: null, enemy: null, friendly: null });

  const [assetsLoaded, setAssetsLoaded] = useState(false);

  const gameStateRef = useRef<GameRuntimeState>({
    screen: 'loading',
    turn: 0,
    turnStartTime: 0,
    waitDuration: 0,
    phase: 'wait',
    target: null,
    shotEffects: [],
    particles: [],
    feedbackText: null,
    feedbackStartTime: 0,
    results: [],
    shuffledTurnTypes: [],
  });

  useEffect(() => {
    if (storeData) {
      setPlayCount(storeData.playCount);
      setBestAverageTime(storeData.bestAverageTime);
    }
  }, [storeData]);

  // 2. 画像アセットのロード
  useEffect(() => {
    const baseUrl = import.meta.env.BASE_URL || '/';
    const bgSrc = `${baseUrl}assets/speed-gunman/bg.png`;
    const enemySrc = `${baseUrl}assets/speed-gunman/enemy_piyo.png`;
    const friendlySrc = `${baseUrl}assets/speed-gunman/friendly_piyo.png`;

    let loadedCount = 0;
    const totalAssets = 3;

    const onAssetLoad = () => {
      loadedCount++;
      if (loadedCount === totalAssets) {
        setAssetsLoaded(true);
        setScreen('title');
      }
    };

    const onAssetError = (e: ErrorEvent) => {
      const target = e.target as HTMLImageElement;
      console.warn(`Failed to load asset: ${target.src}. Standard Canvas shape fallback will be used.`);
      onAssetLoad();
    };

    const bgImg = new Image();
    bgImg.onload = onAssetLoad;
    bgImg.onerror = onAssetError as unknown as OnErrorEventHandler;
    bgImg.src = bgSrc;
    imagesRef.current.bg = bgImg;

    const enemyImg = new Image();
    enemyImg.onload = onAssetLoad;
    enemyImg.onerror = onAssetError as unknown as OnErrorEventHandler;
    enemyImg.src = enemySrc;
    imagesRef.current.enemy = enemyImg;

    const friendlyImg = new Image();
    friendlyImg.onload = onAssetLoad;
    friendlyImg.onerror = onAssetError as unknown as OnErrorEventHandler;
    friendlyImg.src = friendlySrc;
    imagesRef.current.friendly = friendlyImg;
  }, []);

  // 3. 画面遷移時の gameStateRef 同期
  useEffect(() => {
    gameStateRef.current.screen = screen;
  }, [screen]);

  // 4. ゲームの開始初期化
  const startGame = () => {
    const types: ('enemy' | 'friendly')[] = ['enemy', 'enemy', 'enemy', 'friendly', 'friendly'];
    for (let i = types.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [types[i], types[j]] = [types[j], types[i]];
    }

    gameStateRef.current = {
      screen: 'countdown',
      turn: 0,
      turnStartTime: 0,
      waitDuration: 0,
      phase: 'wait',
      target: null,
      shotEffects: [],
      particles: [],
      feedbackText: null,
      feedbackStartTime: 0,
      results: [],
      shuffledTurnTypes: types,
    };

    setResults([]);
    setScreen('countdown');

    setCountdownText('READY...');
    setTimeout(() => {
      setCountdownText('FIRE!');
      setTimeout(() => {
        setScreen('playing');
        startTurn(0);
      }, 800);
    }, 1200);
  };

  // 5. ターンの開始
  const startTurn = (turnIndex: number) => {
    const state = gameStateRef.current;
    state.phase = 'wait';
    state.turn = turnIndex;
    state.turnStartTime = performance.now();
    state.waitDuration = 1000 + Math.random() * 1500;
    state.target = null;
    state.feedbackText = null;
  };

  // ターゲットの出現
  const spawnTarget = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const state = gameStateRef.current;
    const type = state.shuffledTurnTypes[state.turn];

    const borderX = canvas.width * 0.15;
    const borderY = canvas.height * 0.25;
    const spawnWidth = canvas.width - borderX * 2;
    const spawnHeight = canvas.height - borderY * 2;

    const x = borderX + Math.random() * spawnWidth;
    const y = borderY + Math.random() * spawnHeight;
    const radius = Math.min(canvas.width, canvas.height) * 0.1;

    state.phase = 'active';
    state.target = {
      type, x, y, radius,
      spawnTime: performance.now(),
      active: true,
      scale: 0,
      isShot: false,
      fadeOut: 1,
    };
  };

  // パーティクル生成
  const createParticles = (x: number, y: number, color: string) => {
    const count = 15;
    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      const maxLife = 20 + Math.random() * 20;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: 2 + Math.random() * 4,
        life: maxLife,
        maxLife,
      });
    }
    gameStateRef.current.particles.push(...particles);
  };

  // ターンの終了判定・記録処理
  const handleTurnEnd = (status: 'hit' | 'miss' | 'safe' | 'bad', reactionTime?: number) => {
    const state = gameStateRef.current;
    state.phase = 'feedback';
    state.feedbackStartTime = performance.now();

    let text = '';
    let color = '#fff';

    if (status === 'hit') {
      text = `HIT! ${(reactionTime! / 1000).toFixed(3)}s`;
      color = '#4caf50';
      if (state.target) {
        state.target.isShot = true;
        state.target.shotTime = performance.now();
        createParticles(state.target.x, state.target.y, '#ffcc00');
      }
    } else if (status === 'miss') {
      text = 'MISS!';
      color = '#f44336';
    } else if (status === 'safe') {
      text = 'SAFE';
      color = '#2196f3';
    } else if (status === 'bad') {
      text = 'BAD!';
      color = '#ff9800';
      if (state.target) {
        state.target.isShot = true;
        state.target.shotTime = performance.now();
        createParticles(state.target.x, state.target.y, '#ff3333');
      }
    }

    state.feedbackText = { text, color, scale: 0.5, opacity: 1 };

    const turnResult: TurnResult = {
      turnIndex: state.turn,
      type: state.shuffledTurnTypes[state.turn],
      status,
      time: reactionTime,
    };

    state.results.push(turnResult);
    setResults([...state.results]);

    setTimeout(() => {
      const nextTurn = state.turn + 1;
      if (nextTurn < TOTAL_TURNS) {
        startTurn(nextTurn);
      } else {
        endGame(state.results);
      }
    }, 1200);
  };

  // ゲームの完全終了処理
  const endGame = (gameResults: TurnResult[]) => {
    setScreen('result');

    const validResults = gameResults.filter((r) => r.status !== 'safe');
    let avgTime = 0;

    if (validResults.length > 0) {
      const sum = validResults.reduce((acc, curr) => {
        const time = curr.status === 'hit' ? curr.time || PENALTY_TIME_MS : PENALTY_TIME_MS;
        return acc + time;
      }, 0);
      avgTime = sum / validResults.length;
    }

    updateSpeedGunmanData(avgTime);
    setPlayCount(playCount + 1);
    if (bestAverageTime === null || avgTime < bestAverageTime) {
      setBestAverageTime(avgTime);
    }
  };

  // 6. タップイベントハンドラ
  const handleCanvasTouch = (e: React.TouchEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>) => {
    if (screen !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;

    const state = gameStateRef.current;

    state.shotEffects.push({
      x, y,
      time: performance.now(),
      radius: 5,
      opacity: 1,
    });

    if (state.phase === 'active' && state.target && !state.target.isShot) {
      const dx = x - state.target.x;
      const dy = y - state.target.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const touchRadius = state.target.radius + 20;

      if (distance <= touchRadius) {
        const hitTime = performance.now();
        const reactionTime = hitTime - state.target.spawnTime;

        if (state.target.type === 'enemy') {
          handleTurnEnd('hit', reactionTime);
        } else {
          handleTurnEnd('bad', PENALTY_TIME_MS);
        }
      }
    }
  };

  // 7. アニメーション＆描画ループ
  useEffect(() => {
    let animationFrameId: number;

    const updateAndDraw = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) {
        animationFrameId = requestAnimationFrame(updateAndDraw);
        return;
      }

      const state = gameStateRef.current;
      const now = performance.now();

      // 描画処理（renderer.tsに委譲）
      drawGame(ctx, canvas, state, imagesRef.current, assetsLoaded);

      // 状態更新（ターゲット出現判定）
      if (state.screen === 'playing') {
        if (state.phase === 'wait') {
          const elapsed = now - state.turnStartTime;
          if (elapsed >= state.waitDuration) {
            spawnTarget();
          }
        } else if (state.phase === 'active' && state.target) {
          const target = state.target;
          const elapsed = now - target.spawnTime;

          if (target.scale < 1 && !target.isShot) {
            target.scale = Math.min(1, (now - target.spawnTime) / 150);
          }

          if (target.type === 'enemy' && elapsed >= ENEMY_TIMEOUT_MS) {
            handleTurnEnd('miss', PENALTY_TIME_MS);
          } else if (target.type === 'friendly' && elapsed >= FRIENDLY_WAIT_MS) {
            handleTurnEnd('safe');
          }
        }
      }

      animationFrameId = requestAnimationFrame(updateAndDraw);
    };

    animationFrameId = requestAnimationFrame(updateAndDraw);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetsLoaded, screen]);

  // 8. キャンバスリサイズハンドラ
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [screen]);

  return (
    <div className="sg-container" ref={containerRef}>
      <button className="sg-back-btn" onClick={navigateToPortal}>
        &#8592; もどる
      </button>

      {screen === 'loading' && (
        <div className="sg-screen">
          <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '14px', color: '#ffcc00' }}>
            LOADING ASSETS...
          </div>
        </div>
      )}

      {screen === 'title' && (
        <div className="sg-screen">
          <div className="sg-panel">
            <h1 className="sg-title">早撃ちゲルぴよ<br />ガンマン</h1>
            <p className="sg-subtitle">READY... FIRE!</p>

            <div className="sg-stats">
              <div className="sg-stat-row">
                <span className="sg-stat-label">ベストタイム:</span>
                <span className="sg-stat-value">
                  {bestAverageTime !== null ? `${(bestAverageTime / 1000).toFixed(3)}s` : 'なし'}
                </span>
              </div>
              <div className="sg-stat-row">
                <span className="sg-stat-label">プレイ回数:</span>
                <span className="sg-stat-value">{playCount} 回</span>
              </div>
            </div>

            <button className="sg-btn" onClick={startGame}>
              ゲームスタート
            </button>
          </div>
        </div>
      )}

      {screen === 'countdown' && (
        <div className="sg-countdown-overlay">
          <span className="sg-countdown-text">{countdownText}</span>
        </div>
      )}

      {screen === 'playing' && (
        <div className="sg-canvas-container">
          <canvas
            ref={canvasRef}
            className="sg-canvas"
            onTouchStart={handleCanvasTouch}
            onMouseDown={handleCanvasTouch}
          />
        </div>
      )}

      {screen === 'result' && (
        <div className="sg-screen">
          <div className="sg-panel">
            <h1 className="sg-title" style={{ fontSize: '18px' }}>RESULT</h1>
            <p className="sg-subtitle">スコア詳細</p>

            <div className="sg-result-list">
              {results.map((res, idx) => {
                const isSuccess = res.status === 'hit' || res.status === 'safe';
                let label = `第 ${idx + 1} 戦: `;
                let valStr = '';

                if (res.status === 'hit') {
                  label += '敵 (撃破)';
                  valStr = `${(res.time! / 1000).toFixed(3)}s`;
                } else if (res.status === 'miss') {
                  label += '敵 (タイムアウト)';
                  valStr = `失敗 (2.000s)`;
                } else if (res.status === 'safe') {
                  label += '一般ぴよ (スルー成功)';
                  valStr = 'SAFE';
                } else if (res.status === 'bad') {
                  label += '一般ぴよ (誤射)';
                  valStr = `誤射 (2.000s)`;
                }

                return (
                  <div key={idx} className={`sg-result-item ${isSuccess ? 'success' : 'failed'}`}>
                    <span className="sg-result-label">{label}</span>
                    <span className={`sg-result-value ${isSuccess ? 'success' : 'failed'}`}>
                      {valStr}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="sg-stats" style={{ marginTop: 0, marginBottom: '24px' }}>
              <div className="sg-stat-row" style={{ borderLeftColor: '#ffcc00', background: 'rgba(255, 204, 0, 0.1)' }}>
                <span className="sg-stat-label" style={{ fontWeight: 'bold' }}>平均タイム:</span>
                <span className="sg-stat-value" style={{ color: '#ffcc00', fontSize: '18px' }}>
                  {getAverageTimeStr(results, PENALTY_TIME_MS)}
                </span>
              </div>
              {bestAverageTime !== null && results.length > 0 && (
                (() => {
                  const validResults = results.filter((r) => r.status !== 'safe');
                  if (validResults.length === 0) return null;
                  const sum = validResults.reduce((acc, curr) => {
                    const time = curr.status === 'hit' ? curr.time || PENALTY_TIME_MS : PENALTY_TIME_MS;
                    return acc + time;
                  }, 0);
                  const currentAvg = sum / validResults.length;

                  if (currentAvg <= bestAverageTime) {
                    return (
                      <div className="sg-new-record">
                        👑 NEW RECORD!!
                      </div>
                    );
                  }
                  return null;
                })()
              )}
            </div>

            <button className="sg-btn" onClick={startGame}>
              もう一度遊ぶ
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
