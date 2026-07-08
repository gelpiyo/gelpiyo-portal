import React, { useEffect, useRef, useState } from 'react';
import { usePortalStore } from '@/stores/portalStore';
import type { Direction, Player, Enemy } from './core/types';
import { useSaveDataStore } from '@/stores/saveDataStore';
import {
  MAP_SIZE, CELL_SIZE, CANVAS_WIDTH, CANVAS_HEIGHT,
  PLAYER_SPEED, ENEMY_BASE_SPEED, DIG_DURATION, FILL_DURATION,
  ENEMY_FALLEN_DURATION, PLAYER_FALLEN_DURATION, PLAYER_MUTENKI_DURATION,
  CELL_PATH, CELL_WALL, CELL_DIGGING, CELL_HOLE, CELL_ENEMY_HOLE,
} from './core/types';
import { draw } from './core/renderer';
import './heian-alien.css';

export const HeianAlien: React.FC = () => {
  const navigateToPortal = usePortalStore((state) => state.navigateToPortal);
  
  // Reactの状態管理 (UI描画用)
  const [gameState, setGameState] = useState<'title' | 'playing' | 'gameover' | 'clear'>('title');
  const [score, setScore] = useState<number>(0);
  const [stage, setStage] = useState<number>(1);
  const [lives, setLives] = useState<number>(3);
  const storeHighScore = useSaveDataStore(s => s.games['heian-alien']?.highScore || 0);
  const updateHighScore = useSaveDataStore(s => s.updateHighScore);
  
  const [highScore, setHighScore] = useState<number>(storeHighScore);

  useEffect(() => {
    setHighScore(storeHighScore);
  }, [storeHighScore]);

  // Canvas とループ参照用の ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  
  // ゲームロジック用の ref (Reactの再レンダリング遅延を受けないため)
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const mapRef = useRef<number[][]>([]);
  const playerRef = useRef<Player>({
    x: 7 * CELL_SIZE,
    y: 7 * CELL_SIZE,
    gridX: 7,
    gridY: 7,
    dir: 'NONE',
    nextDir: 'NONE',
    isMoving: false,
    lives: 3,
    isFallen: false,
    fallenTimer: 0,
    isActionActive: false,
    actionType: 'NONE',
    actionProgress: 0,
    actionX: -1,
    actionY: -1,
    mutenkiTimer: 0
  });
  const enemiesRef = useRef<Enemy[]>([]);
  const nextEnemyId = useRef<number>(1);

  // ハイスコアを保存する関数
  const saveHighScore = (newHighScore: number) => {
    updateHighScore('heian-alien', newHighScore);
    setHighScore(newHighScore);
  };

  // マップの初期構築
  const initMap = () => {
    const grid = Array(MAP_SIZE).fill(null).map(() => Array(MAP_SIZE).fill(CELL_PATH));
    // 外周を壁にする
    for (let i = 0; i < MAP_SIZE; i++) {
      grid[0][i] = CELL_WALL;
      grid[MAP_SIZE - 1][i] = CELL_WALL;
      grid[i][0] = CELL_WALL;
      grid[i][MAP_SIZE - 1] = CELL_WALL;
    }
    // 市街地区画（2x2のブロック）を配置
    for (let y = 1; y < MAP_SIZE - 1; y++) {
      for (let x = 1; x < MAP_SIZE - 1; x++) {
        if (x % 3 !== 1 && y % 3 !== 1) {
          grid[y][x] = CELL_WALL;
        }
      }
    }
    mapRef.current = grid;
  };

  // 敵の生成
  const spawnEnemies = (count: number, currentStage: number) => {
    const spawned: Enemy[] = [];
    // 四隅のスポーン候補地
    const spawnPoints = [
      { gx: 1, gy: 1 },
      { gx: 13, gy: 1 },
      { gx: 1, gy: 13 },
      { gx: 13, gy: 13 }
    ];

    // ステージが進むほど敵の基本速度が上がる
    const speed = ENEMY_BASE_SPEED + (currentStage > 2 ? 1 : 0); // ステージ3のみ速度3にする

    for (let i = 0; i < count; i++) {
      const point = spawnPoints[i % spawnPoints.length];
      spawned.push({
        id: nextEnemyId.current++,
        x: point.gx * CELL_SIZE,
        y: point.gy * CELL_SIZE,
        gridX: point.gx,
        gridY: point.gy,
        dir: 'NONE',
        nextDir: 'NONE',
        speed: speed,
        isFallen: false,
        fallenTimer: 0,
        isAngry: false,
        angryTimer: 0
      });
    }
    enemiesRef.current = spawned;
  };

  // ゲームの開始
  const startGame = () => {
    initMap();
    playerRef.current = {
      x: 7 * CELL_SIZE,
      y: 7 * CELL_SIZE,
      gridX: 7,
      gridY: 7,
      dir: 'NONE',
      nextDir: 'NONE',
      isMoving: false,
      lives: 3,
      isFallen: false,
      fallenTimer: 0,
      isActionActive: false,
      actionType: 'NONE',
      actionProgress: 0,
      actionX: -1,
      actionY: -1,
      mutenkiTimer: 0
    };
    
    // ステージ1は敵3体
    spawnEnemies(3, 1);
    
    setScore(0);
    setStage(1);
    setLives(3);
    setGameState('playing');
  };

  // 次のステージへ遷移
  const nextStage = (nextStg: number) => {
    initMap();
    playerRef.current.x = 7 * CELL_SIZE;
    playerRef.current.y = 7 * CELL_SIZE;
    playerRef.current.gridX = 7;
    playerRef.current.gridY = 7;
    playerRef.current.dir = 'NONE';
    playerRef.current.nextDir = 'NONE';
    playerRef.current.isMoving = false;
    playerRef.current.isFallen = false;
    playerRef.current.isActionActive = false;
    playerRef.current.actionType = 'NONE';
    playerRef.current.actionProgress = 0;
    playerRef.current.mutenkiTimer = 60; // 新ステージ開始時少し無敵

    // ステージごとの敵の数 (Stage 2: 4体, Stage 3: 5体)
    const enemyCount = nextStg === 2 ? 4 : 5;
    spawnEnemies(enemyCount, nextStg);
    
    setStage(nextStg);
  };

  // キーボードイベントハンドラ
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'playing') return;
      keysPressed.current[e.code] = true;

      // 移動入力
      if (e.code === 'ArrowUp' || e.code === 'KeyW') playerRef.current.nextDir = 'UP';
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') playerRef.current.nextDir = 'DOWN';
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA') playerRef.current.nextDir = 'LEFT';
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') playerRef.current.nextDir = 'RIGHT';

      // アクション入力
      if (e.code === 'Space' || e.code === 'KeyJ') {
        triggerAction('DIG');
      } else if (e.code === 'KeyK' || e.code === 'KeyX') {
        triggerAction('FILL');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = false;
      
      let newDir: Direction = 'NONE';
      if (keysPressed.current['ArrowUp'] || keysPressed.current['KeyW']) newDir = 'UP';
      else if (keysPressed.current['ArrowDown'] || keysPressed.current['KeyS']) newDir = 'DOWN';
      else if (keysPressed.current['ArrowLeft'] || keysPressed.current['KeyA']) newDir = 'LEFT';
      else if (keysPressed.current['ArrowRight'] || keysPressed.current['KeyD']) newDir = 'RIGHT';
      
      playerRef.current.nextDir = newDir;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState]);

  // バーチャルキー操作用のアクション関数
  const handleDpadInput = (dir: Direction) => {
    if (gameState !== 'playing') return;
    playerRef.current.nextDir = dir;
  };

  const triggerAction = (type: 'DIG' | 'FILL') => {
    const player = playerRef.current;
    if (player.isFallen || player.isActionActive || player.dir === 'NONE') return;

    let dx = 0;
    let dy = 0;
    if (player.dir === 'UP') dy = -1;
    else if (player.dir === 'DOWN') dy = 1;
    else if (player.dir === 'LEFT') dx = -1;
    else if (player.dir === 'RIGHT') dx = 1;

    const tx = player.gridX + dx;
    const ty = player.gridY + dy;

    // マップ境界チェック
    if (tx < 0 || tx >= MAP_SIZE || ty < 0 || ty >= MAP_SIZE) return;

    const map = mapRef.current;
    const cellValue = map[ty][tx];

    if (type === 'DIG' && cellValue === CELL_PATH) {
      player.isActionActive = true;
      player.actionType = 'DIG';
      player.actionProgress = 0;
      player.actionX = tx;
      player.actionY = ty;
      map[ty][tx] = CELL_DIGGING;
    } else if (type === 'FILL' && (cellValue === CELL_HOLE || cellValue === CELL_ENEMY_HOLE)) {
      player.isActionActive = true;
      player.actionType = 'FILL';
      player.actionProgress = 0;
      player.actionX = tx;
      player.actionY = ty;
    }
  };

  // メインループ
  useEffect(() => {
    if (gameState !== 'playing') {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const update = () => {
      const player = playerRef.current;
      const map = mapRef.current;
      const enemies = enemiesRef.current;

      // 1. 無敵タイマー更新
      if (player.mutenkiTimer > 0) {
        player.mutenkiTimer--;
      }

      // 2. プレイヤーのアクション更新 (掘削 / 埋立)
      if (player.isActionActive) {
        player.actionProgress++;
        const limit = player.actionType === 'DIG' ? DIG_DURATION : FILL_DURATION;
        
        if (player.actionProgress >= limit) {
          // アクション完了
          const tx = player.actionX;
          const ty = player.actionY;
          
          if (player.actionType === 'DIG') {
            map[ty][tx] = CELL_HOLE;
          } else if (player.actionType === 'FILL') {
            if (map[ty][tx] === CELL_ENEMY_HOLE) {
              // 敵を撃破！
              // 該当する穴の中の敵を探して退治
              const enemyIdx = enemies.findIndex(e => e.isFallen && e.gridX === tx && e.gridY === ty);
              if (enemyIdx !== -1) {
                enemies.splice(enemyIdx, 1);
                setScore(prev => {
                  const newScore = prev + 100;
                  if (newScore > highScore) {
                    saveHighScore(newScore);
                  }
                  return newScore;
                });
              }
            }
            map[ty][tx] = CELL_PATH;
          }
          
          player.isActionActive = false;
          player.actionType = 'NONE';
        }
      }

      // 3. プレイヤーの落下タイマー更新
      if (player.isFallen) {
        player.fallenTimer--;
        if (player.fallenTimer <= 0) {
          player.isFallen = false;
          player.mutenkiTimer = 60; // 穴からの復帰後、1秒間無敵にする（再落下防止）
        }
      }

      // 4. プレイヤー移動処理 (グリッド吸着アライン)
      if (!player.isFallen && !player.isActionActive) {
        // セルの中心にいるときのみ、方向転換および移動の開始・停止が可能
        if (player.x % CELL_SIZE === 0 && player.y % CELL_SIZE === 0) {
          player.gridX = player.x / CELL_SIZE;
          player.gridY = player.y / CELL_SIZE;

          // 穴に落ちた判定（無敵中は落ちない）
          if (map[player.gridY][player.gridX] === CELL_HOLE && player.mutenkiTimer <= 0) {
            player.isFallen = true;
            player.fallenTimer = PLAYER_FALLEN_DURATION;
            player.dir = 'NONE';
            player.nextDir = 'NONE';
            player.isMoving = false;
          } else {
            if (player.nextDir === 'NONE') {
              player.isMoving = false; // 入力がなければ停止
            } else {
              // 次の進行方向へ転換可能かチェック
              let canTurn = false;
              let dx = 0, dy = 0;
              if (player.nextDir === 'UP') dy = -1;
              else if (player.nextDir === 'DOWN') dy = 1;
              else if (player.nextDir === 'LEFT') dx = -1;
              else if (player.nextDir === 'RIGHT') dx = 1;

              const tx = player.gridX + dx;
              const ty = player.gridY + dy;

              // 壁でなければ方向転換可能
              if (tx >= 0 && tx < MAP_SIZE && ty >= 0 && ty < MAP_SIZE && map[ty]?.[tx] !== CELL_WALL) {
                canTurn = true;
              }

              if (canTurn) {
                player.dir = player.nextDir;
                player.isMoving = true;
              } else {
                // 転換できない場合、元の方向 dir に進めるなら進む
                let fdx = 0, fdy = 0;
                if (player.dir === 'UP') fdy = -1;
                else if (player.dir === 'DOWN') fdy = 1;
                else if (player.dir === 'LEFT') fdx = -1;
                else if (player.dir === 'RIGHT') fdx = 1;

                const fx = player.gridX + fdx;
                const fy = player.gridY + fdy;

                if (player.dir !== 'NONE' && fx >= 0 && fx < MAP_SIZE && fy >= 0 && fy < MAP_SIZE && map[fy]?.[fx] !== CELL_WALL) {
                  player.isMoving = true;
                } else {
                  player.isMoving = false; // 突き当たりで停止
                }
              }
            }
          }
        }

        // 実際の移動
        if (player.isMoving && player.dir !== 'NONE') {
          if (player.dir === 'UP') player.y -= PLAYER_SPEED;
          else if (player.dir === 'DOWN') player.y += PLAYER_SPEED;
          else if (player.dir === 'LEFT') player.x -= PLAYER_SPEED;
          else if (player.dir === 'RIGHT') player.x += PLAYER_SPEED;
        }
      }

      // 5. 敵（ワルぴよ）の更新
      enemies.forEach(enemy => {
        // 落下中の場合
        if (enemy.isFallen) {
          enemy.fallenTimer--;
          if (enemy.fallenTimer <= 0) {
            // 穴から這い出る (激怒状態へ)
            enemy.isFallen = false;
            enemy.isAngry = true;
            enemy.angryTimer = 180; // 3秒間激怒
            map[enemy.gridY][enemy.gridX] = CELL_PATH; // 穴は自動的に埋まる
          }
          return;
        }

        // 激怒状態のタイマー更新
        if (enemy.isAngry) {
          enemy.angryTimer--;
          if (enemy.angryTimer <= 0) {
            enemy.isAngry = false;
          }
        }

        // 移動処理 (グリッドアライン)
        if (enemy.x % CELL_SIZE === 0 && enemy.y % CELL_SIZE === 0) {
          enemy.gridX = enemy.x / CELL_SIZE;
          enemy.gridY = enemy.y / CELL_SIZE;

          // 穴に落ちるかチェック
          if (map[enemy.gridY][enemy.gridX] === CELL_HOLE) {
            enemy.isFallen = true;
            enemy.fallenTimer = ENEMY_FALLEN_DURATION;
            map[enemy.gridY][enemy.gridX] = CELL_ENEMY_HOLE; // 敵が落ちた穴に更新
            enemy.dir = 'NONE';
            return;
          }

          // 交差点での進路決定
          const directions: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
          const possibleDirs = directions.filter(d => {
            // 逆戻りは基本的に避ける (進行可能方向が他にある場合)
            if (
              (enemy.dir === 'UP' && d === 'DOWN') ||
              (enemy.dir === 'DOWN' && d === 'UP') ||
              (enemy.dir === 'LEFT' && d === 'RIGHT') ||
              (enemy.dir === 'RIGHT' && d === 'LEFT')
            ) {
              return false;
            }

            let dx = 0, dy = 0;
            if (d === 'UP') dy = -1;
            else if (d === 'DOWN') dy = 1;
            else if (d === 'LEFT') dx = -1;
            else if (d === 'RIGHT') dx = 1;

            const tx = enemy.gridX + dx;
            const ty = enemy.gridY + dy;

            // 壁と「敵が落ちている穴」には進めない
            return (
              tx >= 0 &&
              tx < MAP_SIZE &&
              ty >= 0 &&
              ty < MAP_SIZE &&
              map[ty][tx] !== CELL_WALL &&
              map[ty][tx] !== CELL_ENEMY_HOLE
            );
          });

          // 行き止まりなどの場合は逆戻りを許容する
          if (possibleDirs.length === 0) {
            const oppositeMap: { [key in Direction]?: Direction } = {
              'UP': 'DOWN', 'DOWN': 'UP', 'LEFT': 'RIGHT', 'RIGHT': 'LEFT'
            };
            const opp = oppositeMap[enemy.dir] || 'NONE';
            
            let dx = 0, dy = 0;
            if (opp === 'UP') dy = -1;
            else if (opp === 'DOWN') dy = 1;
            else if (opp === 'LEFT') dx = -1;
            else if (opp === 'RIGHT') dx = 1;

            const tx = enemy.gridX + dx;
            const ty = enemy.gridY + dy;

            if (opp !== 'NONE' && map[ty]?.[tx] !== CELL_WALL && map[ty]?.[tx] !== CELL_ENEMY_HOLE) {
              enemy.dir = opp;
            } else {
              // それでも進めないなら完全ランダム選択
              enemy.dir = 'NONE';
            }
          } else {
            // 進行可能方向からランダム選択
            enemy.dir = possibleDirs[Math.floor(Math.random() * possibleDirs.length)];
          }
        }

        // 移動
        if (enemy.dir !== 'NONE') {
          const currentSpeed = enemy.isAngry ? enemy.speed + 1 : enemy.speed;
          if (enemy.dir === 'UP') enemy.y -= currentSpeed;
          else if (enemy.dir === 'DOWN') enemy.y += currentSpeed;
          else if (enemy.dir === 'LEFT') enemy.x -= currentSpeed;
          else if (enemy.dir === 'RIGHT') enemy.x += currentSpeed;
        }
      });

      // 6. 当たり判定 (プレイヤー vs 敵)
      if (!player.isFallen && player.mutenkiTimer === 0) {
        const hit = enemies.some(enemy => {
          if (enemy.isFallen) return false; // 穴に落ちている敵は無害
          
          // 実座標での当たり判定 (グリッドの半分以内の距離に近づいたら被弾)
          const distLimit = CELL_SIZE * 0.7;
          const dx = Math.abs(player.x - enemy.x);
          const dy = Math.abs(player.y - enemy.y);
          return dx < distLimit && dy < distLimit;
        });

        if (hit) {
          // ミス時の処理
          player.lives--;
          setLives(player.lives);
          
          if (player.lives <= 0) {
            setGameState('gameover');
          } else {
            // リスポーン（中央に戻る）
            player.x = 7 * CELL_SIZE;
            player.y = 7 * CELL_SIZE;
            player.gridX = 7;
            player.gridY = 7;
            player.dir = 'NONE';
            player.nextDir = 'NONE';
            player.mutenkiTimer = PLAYER_MUTENKI_DURATION;
          }
        }
      }

      if (player.mutenkiTimer > 0) {
        player.mutenkiTimer--;
      }

      // 7. クリアチェック
      if (enemies.length === 0) {
        if (stage < 3) {
          nextStage(stage + 1);
        } else {
          setGameState('clear');
        }
      }
    };

    const loop = () => {
      update();
      draw(ctx, mapRef.current, playerRef.current, enemiesRef.current);
      animationFrameIdRef.current = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, stage]);

  return (
    <div className="heian-alien-container">
      {/* もどるボタン */}
      <button className="heian-alien-back-btn" onClick={navigateToPortal}>
        &#8592; もどる
      </button>

      {/* 1. タイトル画面 */}
      {gameState === 'title' && (
        <div className="heian-alien-screen">
          <h1 className="heian-alien-title-logo">ゲルぴよエイリアン</h1>
          <p className="heian-alien-subtitle">👾 穴掘りアクション 👾</p>
          <div className="heian-alien-best-score">
            <p>ハイスコア</p>
            <span>{highScore}</span>
          </div>
          <button className="heian-alien-start-btn" onClick={startGame}>
            ゲームスタート
          </button>
        </div>
      )}

      {/* 2. ゲームプレイ画面 */}
      {gameState === 'playing' && (
        <div className="heian-alien-gameplay">
          {/* HUD情報 */}
          <div className="heian-alien-hud">
            <div className="heian-alien-hud-item">
              <span className="heian-alien-hud-label">STAGE</span>
              <span className="heian-alien-hud-val">{stage}</span>
            </div>
            <div className="heian-alien-hud-item">
              <span className="heian-alien-hud-label">SCORE</span>
              <span className="heian-alien-hud-val">{score}</span>
            </div>
            <div className="heian-alien-hud-item">
              <span className="heian-alien-hud-label">LIVES</span>
              <span className="heian-alien-hud-lives">
                {Array(lives).fill('💛').join('')}
              </span>
            </div>
          </div>

          {/* ゲーム画面Canvas */}
          <div className="heian-alien-canvas-container">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="heian-alien-canvas"
            />
          </div>

          {/* コントローラー (スマホ専用タッチボタン) */}
          <div className="heian-alien-controls">
            {/* 十字キー (D-Pad) */}
            <div className="heian-alien-dpad">
              <button
                className="heian-alien-dpad-btn heian-alien-dpad-up"
                onTouchStart={() => handleDpadInput('UP')}
                onTouchEnd={() => handleDpadInput('NONE')}
                onMouseDown={() => handleDpadInput('UP')}
                onMouseUp={() => handleDpadInput('NONE')}
              >
                ▲
              </button>
              <button
                className="heian-alien-dpad-btn heian-alien-dpad-left"
                onTouchStart={() => handleDpadInput('LEFT')}
                onTouchEnd={() => handleDpadInput('NONE')}
                onMouseDown={() => handleDpadInput('LEFT')}
                onMouseUp={() => handleDpadInput('NONE')}
              >
                ◀
              </button>
              <div className="heian-alien-dpad-btn heian-alien-dpad-center"></div>
              <button
                className="heian-alien-dpad-btn heian-alien-dpad-right"
                onTouchStart={() => handleDpadInput('RIGHT')}
                onTouchEnd={() => handleDpadInput('NONE')}
                onMouseDown={() => handleDpadInput('RIGHT')}
                onMouseUp={() => handleDpadInput('NONE')}
              >
                ▶
              </button>
              <button
                className="heian-alien-dpad-btn heian-alien-dpad-down"
                onTouchStart={() => handleDpadInput('DOWN')}
                onTouchEnd={() => handleDpadInput('NONE')}
                onMouseDown={() => handleDpadInput('DOWN')}
                onMouseUp={() => handleDpadInput('NONE')}
              >
                ▼
              </button>
            </div>

            {/* アクションボタン (掘る・埋める) */}
            <div className="heian-alien-action-group">
              <button
                className="heian-alien-action-btn heian-alien-btn-dig"
                onTouchStart={() => triggerAction('DIG')}
                onMouseDown={() => triggerAction('DIG')}
              >
                <span>⛏️</span>
                <span className="heian-alien-btn-label">掘る</span>
              </button>
              <button
                className="heian-alien-action-btn heian-alien-btn-fill"
                onTouchStart={() => triggerAction('FILL')}
                onMouseDown={() => triggerAction('FILL')}
              >
                <span>🪵</span>
                <span className="heian-alien-btn-label">埋める</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. ゲームオーバー & クリア画面 */}
      {(gameState === 'gameover' || gameState === 'clear') && (
        <div className="heian-alien-screen">
          <h1 className="heian-alien-title-logo">
            {gameState === 'clear' ? '🎉 ALL CLEAR! 🎉' : '💀 GAME OVER 💀'}
          </h1>
          <p className="heian-alien-subtitle">
            {gameState === 'clear' ? 'ワルぴよ軍団をすべて退治した！' : 'やられてしまった...'}
          </p>
          <div className="heian-alien-best-score">
            <p>今回のスコア</p>
            <span>{score}</span>
            {score >= highScore && score > 0 && (
              <div className="heian-alien-new-record">NEW RECORD!</div>
            )}
          </div>
          <button className="heian-alien-start-btn" onClick={startGame}>
            もう一度遊ぶ
          </button>
        </div>
      )}
    </div>
  );
};
