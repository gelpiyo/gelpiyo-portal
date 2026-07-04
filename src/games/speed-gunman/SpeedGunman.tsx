import React, { useEffect, useRef, useState } from 'react';
import { usePortalStore } from '@/stores/portalStore';
import './speed-gunman.css';

// ゲーム画面の型定義
type ScreenState = 'loading' | 'title' | 'countdown' | 'playing' | 'result';

// 各ターンの試行結果の型
interface TurnResult {
  turnIndex: number;
  type: 'enemy' | 'friendly';
  status: 'hit' | 'miss' | 'safe' | 'bad'; // hit: 敵撃破, miss: 敵逃し, safe: 一般見逃し, bad: 一般誤射
  time?: number; // 記録タイム（ミリ秒）。一般見逃し(safe)の場合は undefined
}

// キャラクターの状態
interface TargetState {
  type: 'enemy' | 'friendly';
  x: number;
  y: number;
  radius: number;
  spawnTime: number;
  active: boolean;
  scale: number; // ポップアップアニメーション用
  isShot: boolean; // 撃たれた状態か
  shotTime?: number; // 撃たれた時刻
  fadeOut: number; // フェードアウト不透明度 (1 -> 0)
}

// タップ時の銃撃エフェクト
interface ShotEffect {
  x: number;
  y: number;
  time: number;
  radius: number;
  opacity: number;
}

// 撃破時に飛び散る火花/パーティクル
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

const LOCAL_STORAGE_KEY = 'gelpiyo_speed_gunman_save_v1';
const TOTAL_TURNS = 5;
const ENEMY_TIMEOUT_MS = 2000; // 敵が消えるまでの時間 (2.0秒)
const FRIENDLY_WAIT_MS = 800; // 一般ぴよが自動消滅するまでの時間
const PENALTY_TIME_MS = 2000; // 失敗時のペナルティタイム (2.0秒)

export const SpeedGunman: React.FC = () => {
  const navigateToPortal = usePortalStore((state) => state.navigateToPortal);
  const [screen, setScreen] = useState<ScreenState>('loading');
  const [playCount, setPlayCount] = useState(0);
  const [bestAverageTime, setBestAverageTime] = useState<number | null>(null);

  // ゲームの進行管理
  const [results, setResults] = useState<TurnResult[]>([]);
  const [countdownText, setCountdownText] = useState('READY...');

  // Canvas用参照
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // アセット画像
  const imagesRef = useRef<{
    bg: HTMLImageElement | null;
    enemy: HTMLImageElement | null;
    friendly: HTMLImageElement | null;
  }>({ bg: null, enemy: null, friendly: null });

  // ロード完了フラグ
  const [assetsLoaded, setAssetsLoaded] = useState(false);

  // ゲームのリアルタイム状態（Canvasループで参照する変更頻度の高い値）
  const gameStateRef = useRef<{
    screen: ScreenState;
    turn: number;
    turnStartTime: number; // ターン開始ウェイトの開始時刻
    waitDuration: number; // ランダムな出現前ウェイト時間 (ms)
    phase: 'wait' | 'active' | 'feedback'; // wait: 出現前, active: 出現中, feedback: 判定エフェクト表示中
    target: TargetState | null;
    shotEffects: ShotEffect[];
    particles: Particle[];
    feedbackText: { text: string; color: string; scale: number; opacity: number } | null;
    feedbackStartTime: number;
    results: TurnResult[];
    shuffledTurnTypes: ('enemy' | 'friendly')[]; // ゲーム開始時にシャッフルされた出現順 (敵3、一般2)
  }>({
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

  // 1. ローカルストレージデータの読み込み
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data && typeof data.bestAverageTime === 'number') {
          setBestAverageTime(data.bestAverageTime);
        }
        if (data && typeof data.playCount === 'number') {
          setPlayCount(data.playCount);
        }
      }
    } catch (e) {
      console.error('Failed to load speed gunman save data:', e);
    }
  }, []);

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
      // 代替描画を行うため、ロード完了としては進める
      onAssetLoad();
    };

    const bgImg = new Image();
    bgImg.onload = onAssetLoad;
    bgImg.onerror = onAssetError as any;
    bgImg.src = bgSrc;
    imagesRef.current.bg = bgImg;

    const enemyImg = new Image();
    enemyImg.onload = onAssetLoad;
    enemyImg.onerror = onAssetError as any;
    enemyImg.src = enemySrc;
    imagesRef.current.enemy = enemyImg;

    const friendlyImg = new Image();
    friendlyImg.onload = onAssetLoad;
    friendlyImg.onerror = onAssetError as any;
    friendlyImg.src = friendlySrc;
    imagesRef.current.friendly = friendlyImg;
  }, []);

  // 3. 画面遷移時の gameStateRef 同期
  useEffect(() => {
    gameStateRef.current.screen = screen;
  }, [screen]);

  // 4. ゲームの開始初期化
  const startGame = () => {
    // 敵3回、一般2回をランダムにシャッフルした配列を作成
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

    // カウントダウン演出開始
    setCountdownText('READY...');
    setTimeout(() => {
      setCountdownText('FIRE!');
      setTimeout(() => {
        // メインゲームへ移行
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
    // 1.0秒〜2.5秒のランダムな待機時間
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

    // 出現座標の計算（画面中央付近のランダム座標）
    const borderX = canvas.width * 0.15;
    const borderY = canvas.height * 0.25;
    const spawnWidth = canvas.width - borderX * 2;
    const spawnHeight = canvas.height - borderY * 2;

    const x = borderX + Math.random() * spawnWidth;
    const y = borderY + Math.random() * spawnHeight;
    const radius = Math.min(canvas.width, canvas.height) * 0.1; // スマホでのタップしやすさを考慮した半径

    state.phase = 'active';
    state.target = {
      type,
      x,
      y,
      radius,
      spawnTime: performance.now(),
      active: true,
      scale: 0,
      isShot: false,
      fadeOut: 1,
    };
  };

  // パーティクル生成 (銃撃成功時)
  const createParticles = (x: number, y: number, color: string) => {
    const count = 15;
    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      const maxLife = 20 + Math.random() * 20;
      particles.push({
        x,
        y,
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
      color = '#4caf50'; // 緑
      if (state.target) {
        state.target.isShot = true;
        state.target.shotTime = performance.now();
        createParticles(state.target.x, state.target.y, '#ffcc00');
      }
    } else if (status === 'miss') {
      text = 'MISS!';
      color = '#f44336'; // 赤
    } else if (status === 'safe') {
      text = 'SAFE';
      color = '#2196f3'; // 青
    } else if (status === 'bad') {
      text = 'BAD!';
      color = '#ff9800'; // オレンジ
      if (state.target) {
        state.target.isShot = true;
        state.target.shotTime = performance.now();
        createParticles(state.target.x, state.target.y, '#ff3333');
      }
    }

    state.feedbackText = {
      text,
      color,
      scale: 0.5,
      opacity: 1,
    };

    const turnResult: TurnResult = {
      turnIndex: state.turn,
      type: state.shuffledTurnTypes[state.turn],
      status,
      time: reactionTime,
    };

    state.results.push(turnResult);
    setResults([...state.results]);

    // 1.0秒間のフィードバック演出を挟んで次のターンへ
    setTimeout(() => {
      const nextTurn = state.turn + 1;
      if (nextTurn < TOTAL_TURNS) {
        startTurn(nextTurn);
      } else {
        // 全ターン終了 -> リザルト画面へ
        endGame(state.results);
      }
    }, 1200);
  };

  // ゲームの完全終了処理
  const endGame = (gameResults: TurnResult[]) => {
    setScreen('result');

    // 平均タイムの計算 (一般スルー成功ターンは分母・分子から除外)
    const validResults = gameResults.filter((r) => r.status !== 'safe');
    let avgTime = 0;

    if (validResults.length > 0) {
      const sum = validResults.reduce((acc, curr) => {
        // 成功なら実測値、失敗ならペナルティ最大値 (2.0s)
        const time = curr.status === 'hit' ? curr.time || PENALTY_TIME_MS : PENALTY_TIME_MS;
        return acc + time;
      }, 0);
      avgTime = sum / validResults.length;
    }

    // ハイスコア更新判定
    const newPlayCount = playCount + 1;
    setPlayCount(newPlayCount);

    let isNewRecord = false;
    if (bestAverageTime === null || avgTime < bestAverageTime) {
      setBestAverageTime(avgTime);
      isNewRecord = true;
    }

    // ローカルストレージ保存
    try {
      localStorage.setItem(
        LOCAL_STORAGE_KEY,
        JSON.stringify({
          version: 1,
          bestAverageTime: isNewRecord ? avgTime : bestAverageTime,
          playCount: newPlayCount,
        })
      );
    } catch (e) {
      console.error('Failed to save speed gunman data to localStorage:', e);
    }
  };

  // 6. タップイベントハンドラ
  const handleCanvasTouch = (e: React.TouchEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>) => {
    if (screen !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // クライアント座標の取得
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

    // タップ位置に銃撃エフェクトを追加
    state.shotEffects.push({
      x,
      y,
      time: performance.now(),
      radius: 5,
      opacity: 1,
    });

    // メインフェーズでの当たり判定
    if (state.phase === 'active' && state.target && !state.target.isShot) {
      const dx = x - state.target.x;
      const dy = y - state.target.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // タッチ判定の緩和（半径に20pxのマージンを加える）
      const touchRadius = state.target.radius + 20;

      if (distance <= touchRadius) {
        // ヒット！
        const hitTime = performance.now();
        const reactionTime = hitTime - state.target.spawnTime;

        if (state.target.type === 'enemy') {
          handleTurnEnd('hit', reactionTime);
        } else {
          // 一般ぴよを撃ってしまった！
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

      // --- 1. キャンバスのクリアと背景描画 ---
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (imagesRef.current.bg && assetsLoaded) {
        ctx.drawImage(imagesRef.current.bg, 0, 0, canvas.width, canvas.height);
      } else {
        // 代替背景（夕暮れのグラデーション）
        const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        grad.addColorStop(0, '#3b1c0a');
        grad.addColorStop(0.5, '#7c3f12');
        grad.addColorStop(1, '#a66023');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // プレイ中以外の描画スキップ
      if (state.screen !== 'playing') {
        animationFrameId = requestAnimationFrame(updateAndDraw);
        return;
      }

      // --- 2. 状態更新とターゲット出現判定 ---
      if (state.phase === 'wait') {
        const elapsed = now - state.turnStartTime;
        if (elapsed >= state.waitDuration) {
          spawnTarget();
        }
      } else if (state.phase === 'active' && state.target) {
        const target = state.target;
        const elapsed = now - target.spawnTime;

        // ポップアップアニメーション (0.15秒でスケール1へ)
        if (target.scale < 1 && !target.isShot) {
          target.scale = Math.min(1, (now - target.spawnTime) / 150);
        }

        // タイムアウト監視
        if (target.type === 'enemy' && elapsed >= ENEMY_TIMEOUT_MS) {
          handleTurnEnd('miss', PENALTY_TIME_MS);
        } else if (target.type === 'friendly' && elapsed >= FRIENDLY_WAIT_MS) {
          handleTurnEnd('safe');
        }
      }

      // --- 3. ターゲットの描画 ---
      if (state.target) {
        const target = state.target;

        ctx.save();
        ctx.translate(target.x, target.y);
        ctx.scale(target.scale, target.scale);

        // 撃たれたときのフェードアウト
        if (target.isShot && target.shotTime) {
          const elapsedShot = now - target.shotTime;
          target.fadeOut = Math.max(0, 1 - elapsedShot / 200);
          ctx.globalAlpha = target.fadeOut;
          ctx.rotate((elapsedShot / 200) * Math.PI * 0.25); // 少し回転させる演出
        }

        const img = target.type === 'enemy' ? imagesRef.current.enemy : imagesRef.current.friendly;

        if (img && assetsLoaded && img.complete && img.naturalWidth !== 0) {
          // 画像を中央配置で描画
          const size = target.radius * 2;
          ctx.drawImage(img, -target.radius, -target.radius, size, size);
        } else {
          // 代替のベクトル描画
          ctx.beginPath();
          ctx.arc(0, 0, target.radius, 0, Math.PI * 2);
          ctx.fillStyle = target.type === 'enemy' ? '#111' : '#ffcc00';
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 4;
          ctx.fill();
          ctx.stroke();

          // 簡易表情の描画
          ctx.fillStyle = '#fff';
          if (target.type === 'enemy') {
            // 怒り目
            ctx.beginPath();
            ctx.moveTo(-15, -10); ctx.lineTo(-5, -5);
            ctx.moveTo(15, -10); ctx.lineTo(5, -5);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 3;
            ctx.stroke();
            // サングラス風の黒帯
            ctx.fillStyle = '#000';
            ctx.fillRect(-22, -12, 44, 10);
          } else {
            // にっこり目
            ctx.beginPath();
            ctx.arc(-10, -5, 3, 0, Math.PI * 2);
            ctx.arc(10, -5, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#000';
            ctx.fill();
          }
        }
        ctx.restore();
      }

      // --- 4. 銃撃エフェクトの更新と描画 ---
      state.shotEffects = state.shotEffects.filter((effect) => {
        const elapsed = now - effect.time;
        if (elapsed > 200) return false;

        effect.radius = 5 + (elapsed / 200) * 20;
        effect.opacity = 1 - elapsed / 200;

        ctx.save();
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(212, 175, 55, ${effect.opacity})`;
        ctx.lineWidth = 3;
        ctx.stroke();

        // 中心点
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${effect.opacity})`;
        ctx.fill();
        ctx.restore();

        return true;
      });

      // --- 5. パーティクルの更新と描画 ---
      state.particles = state.particles.filter((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1; // 重力
        p.life--;

        if (p.life <= 0) return false;

        ctx.save();
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.restore();

        return true;
      });

      // --- 6. フィードバックテキスト（HIT / MISSなど）の描画 ---
      if (state.feedbackText) {
        const textObj = state.feedbackText;
        const elapsed = now - state.feedbackStartTime;

        if (elapsed < 1000) {
          textObj.scale = 0.5 + Math.min(0.5, elapsed / 150) * 0.5;
          if (elapsed > 700) {
            textObj.opacity = 1 - (elapsed - 700) / 300;
          }

          ctx.save();
          ctx.font = "bold 28px 'Press Start 2P', cursive, sans-serif";
          ctx.fillStyle = textObj.color;
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 6;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.globalAlpha = textObj.opacity;

          ctx.translate(canvas.width / 2, canvas.height * 0.25);
          ctx.scale(textObj.scale, textObj.scale);
          ctx.strokeText(textObj.text, 0, 0);
          ctx.fillText(textObj.text, 0, 0);
          ctx.restore();
        }
      }

      // UI表示用のオーバーレイ（上部にターン進行度等を描画）
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(0, 0, canvas.width, 50);

      ctx.fillStyle = '#ffcc00';
      ctx.font = "bold 14px 'Outfit', sans-serif";
      ctx.textAlign = 'left';
      ctx.fillText(`TURN: ${state.turn + 1} / ${TOTAL_TURNS}`, 20, 30);

      // 実績メーター
      const circleRadius = 6;
      const startX = canvas.width - 120;
      for (let i = 0; i < TOTAL_TURNS; i++) {
        const cx = startX + i * 20;
        const cy = 27;

        ctx.beginPath();
        ctx.arc(cx, cy, circleRadius, 0, Math.PI * 2);

        const result = state.results[i];
        if (result) {
          if (result.status === 'hit' || result.status === 'safe') {
            ctx.fillStyle = '#4caf50'; // 成功（緑）
          } else {
            ctx.fillStyle = '#f44336'; // 失敗（赤）
          }
        } else if (i === state.turn) {
          ctx.fillStyle = '#ffcc00'; // 現在（黄）
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.2)'; // 未（白）
        }
        ctx.fill();
      }
      ctx.restore();

      animationFrameId = requestAnimationFrame(updateAndDraw);
    };

    // ループ開始
    animationFrameId = requestAnimationFrame(updateAndDraw);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
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
    handleResize(); // 初回起動

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [screen]);

  // 平均タイム（リザルト用）の算出ヘルパー
  const getAverageTimeStr = (gameResults: TurnResult[]) => {
    const validResults = gameResults.filter((r) => r.status !== 'safe');
    if (validResults.length === 0) return '--';

    const sum = validResults.reduce((acc, curr) => {
      const time = curr.status === 'hit' ? curr.time || PENALTY_TIME_MS : PENALTY_TIME_MS;
      return acc + time;
    }, 0);
    return `${((sum / validResults.length) / 1000).toFixed(3)}s`;
  };

  return (
    <div className="sg-container" ref={containerRef}>
      {/* もどるボタン */}
      <button className="sg-back-btn" onClick={navigateToPortal}>
        &#8592; もどる
      </button>

      {/* 1. ローディング画面 */}
      {screen === 'loading' && (
        <div className="sg-screen">
          <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '14px', color: '#ffcc00' }}>
            LOADING ASSETS...
          </div>
        </div>
      )}

      {/* 2. タイトル画面 */}
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

      {/* 3. カウントダウン画面 */}
      {screen === 'countdown' && (
        <div className="sg-countdown-overlay">
          <span className="sg-countdown-text">{countdownText}</span>
        </div>
      )}

      {/* 4. メインゲーム画面（Canvas） */}
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

      {/* 5. リザルト画面 */}
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
                  {getAverageTimeStr(results)}
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
