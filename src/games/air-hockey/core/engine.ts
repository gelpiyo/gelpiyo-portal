/**
 * engine.ts — ゲームエンジン
 * 1フレームの更新処理をまとめる
 */
import type { GameState, RoundState, Puck, SplitItem } from './types';
import {
  TABLE_W, TABLE_H, PUCK_RADIUS, MALLET_RADIUS, WALL_THICKNESS,
  ROUNDS_TO_WIN, ROUND_COOLDOWN, ITEM_RADIUS,
  ITEM_SPAWN_INTERVAL_BASE, ITEM_SPAWN_INTERVAL_RAND,
} from './types';
import {
  wallBounce, checkGoal, circleCollision, puckCollision,
  applyFriction, movePuck, checkItemCollision, splitPuck,
  clampMalletPlayer,
} from './physics';
import { updateCpu } from './cpu';

/** 初期ラウンド状態を作成 */
export function createInitialRound(): RoundState {
  return {
    pucks: [createPuck(0)],
    playerMallet: {
      pos: { x: TABLE_W / 2, y: TABLE_H * 0.78 },
      radius: MALLET_RADIUS,
      vel: { x: 0, y: 0 },
      prevPos: { x: TABLE_W / 2, y: TABLE_H * 0.78 },
    },
    cpuMallet: {
      pos: { x: TABLE_W / 2, y: TABLE_H * 0.18 },
      radius: MALLET_RADIUS,
      vel: { x: 0, y: 0 },
      prevPos: { x: TABLE_W / 2, y: TABLE_H * 0.18 },
    },
    splitItem: null,
    playerGoals: 0,
    cpuGoals: 0,
    isSplitActive: false,
    roundOver: false,
    roundCooldown: 0,
    nextPuckId: 1,
    itemSpawnTimer: ITEM_SPAWN_INTERVAL_BASE + Math.random() * ITEM_SPAWN_INTERVAL_RAND,
  };
}

/** パック生成 */
function createPuck(id: number): Puck {
  return {
    id,
    pos: { x: TABLE_W / 2, y: TABLE_H / 2 },
    radius: PUCK_RADIUS,
    vel: { x: (Math.random() - 0.5) * 100, y: (Math.random() > 0.5 ? 1 : -1) * 200 },
    scored: false,
    scoredSide: null,
  };
}

/** 初期ゲーム状態を作成 */
export function createInitialGameState(): GameState {
  return {
    scene: 'title',
    playerRounds: 0,
    cpuRounds: 0,
    matchWinner: null,
    round: createInitialRound(),
  };
}

/** アイテム生成 */
function createSplitItem(): SplitItem {
  const margin = WALL_THICKNESS + ITEM_RADIUS + 30;
  return {
    pos: {
      x: margin + Math.random() * (TABLE_W - margin * 2),
      y: TABLE_H * 0.3 + Math.random() * TABLE_H * 0.4,
    },
    radius: ITEM_RADIUS,
    active: true,
    spawnTimer: 0,
  };
}

/** ラウンド結果判定用コールバック */
export type RoundEndCallback = (winner: 'player' | 'cpu' | 'draw') => void;

/**
 * 1フレーム分のゲーム更新
 */
export function updateGame(
  state: GameState,
  dt: number,
  onRoundEnd?: RoundEndCallback,
): void {
  if (state.scene !== 'playing') return;
  const r = state.round;

  // ── ラウンド終了後のクールダウン ──
  if (r.roundOver) {
    r.roundCooldown -= dt;
    if (r.roundCooldown <= 0) {
      r.roundOver = false;
      // ラウンド結果を確定
      let roundWinner: 'player' | 'cpu' | 'draw';
      if (r.playerGoals > r.cpuGoals) {
        roundWinner = 'player';
        state.playerRounds++;
      } else if (r.cpuGoals > r.playerGoals) {
        roundWinner = 'cpu';
        state.cpuRounds++;
      } else {
        roundWinner = 'draw';
      }

      onRoundEnd?.(roundWinner);

      // マッチ勝利判定
      if (state.playerRounds >= ROUNDS_TO_WIN) {
        state.matchWinner = 'player';
        state.scene = 'result';
        return;
      }
      if (state.cpuRounds >= ROUNDS_TO_WIN) {
        state.matchWinner = 'cpu';
        state.scene = 'result';
        return;
      }

      // 次のラウンドをリセット
      const newRound = createInitialRound();
      state.round = newRound;
    }
    return;
  }

  // ── パック移動＆壁反射 ──
  for (const puck of r.pucks) {
    movePuck(puck, dt);
    wallBounce(puck);
    applyFriction(puck);
  }

  // ── パック同士の衝突 ──
  for (let i = 0; i < r.pucks.length; i++) {
    for (let j = i + 1; j < r.pucks.length; j++) {
      puckCollision(r.pucks[i], r.pucks[j]);
    }
  }

  // ── マレットとパックの衝突 ──
  for (const puck of r.pucks) {
    circleCollision(puck, r.playerMallet, r.playerMallet.vel);
    circleCollision(puck, r.cpuMallet, r.cpuMallet.vel);
  }

  // ── CPU更新 ──
  updateCpu(r.cpuMallet, r.pucks, dt);

  // ── アイテム出現管理 ──
  if (!r.splitItem && !r.isSplitActive) {
    r.itemSpawnTimer -= dt;
    if (r.itemSpawnTimer <= 0) {
      r.splitItem = createSplitItem();
    }
  }

  // アイテムのスポーンアニメーション
  if (r.splitItem?.active) {
    r.splitItem.spawnTimer = Math.min(1, r.splitItem.spawnTimer + dt * 3);
  }

  // ── パックとアイテムの衝突 ──
  if (r.splitItem?.active) {
    for (const puck of r.pucks) {
      if (checkItemCollision(puck, r.splitItem)) {
        // 分裂！
        r.splitItem.active = false;
        r.splitItem = null;
        r.isSplitActive = true;

        const newPucks = splitPuck(puck, r.nextPuckId);
        r.nextPuckId += newPucks.length;
        // 元のパックを置き換え
        const idx = r.pucks.indexOf(puck);
        r.pucks.splice(idx, 1, ...newPucks);
        break;
      }
    }
  }

  // ── ゴール判定 ──
  for (const puck of r.pucks) {
    if (puck.scored) continue;
    const goalSide = checkGoal(puck);
    if (goalSide) {
      puck.scored = true;
      puck.scoredSide = goalSide;
      if (goalSide === 'player') {
        r.playerGoals++;
      } else {
        r.cpuGoals++;
      }
    }
  }

  // ── ラウンド終了判定 ──
  const allScored = r.pucks.every((p) => p.scored);

  if (r.isSplitActive) {
    // 分裂モード: 全パックがゴールしたらラウンド終了
    if (allScored) {
      r.roundOver = true;
      r.roundCooldown = ROUND_COOLDOWN;
    }
  } else {
    // 通常モード: 1点入ったらラウンド終了
    if (allScored) {
      r.roundOver = true;
      r.roundCooldown = ROUND_COOLDOWN;
    }
  }
}

/** プレイヤーマレットの位置を更新（タッチ入力から呼ばれる） */
export function setPlayerMalletTarget(state: GameState, x: number, y: number, dt: number): void {
  const m = state.round.playerMallet;
  m.prevPos = { ...m.pos };
  m.pos.x = x;
  m.pos.y = y;
  clampMalletPlayer(m);
  // 速度を計算
  if (dt > 0) {
    m.vel = {
      x: (m.pos.x - m.prevPos.x) / dt,
      y: (m.pos.y - m.prevPos.y) / dt,
    };
  }
}
