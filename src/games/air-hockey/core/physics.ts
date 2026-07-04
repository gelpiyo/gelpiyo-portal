/**
 * physics.ts — 物理演算コア
 * 壁反射・円同士の衝突・摩擦などを扱う
 */
import type { Vec2, Puck, Mallet, Circle, SplitItem } from './types';
import {
  TABLE_W, TABLE_H, GOAL_W, PUCK_MAX_SPEED, PUCK_FRICTION,
  WALL_THICKNESS, GOAL_DEPTH, PUCK_RADIUS, SPLIT_COUNT,
} from './types';

// ── ベクトルユーティリティ ──

export function vecAdd(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}
export function vecSub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}
export function vecScale(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s };
}
export function vecLen(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}
export function vecNormalize(v: Vec2): Vec2 {
  const len = vecLen(v);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}
export function vecDot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}
export function vecDist(a: Vec2, b: Vec2): number {
  return vecLen(vecSub(a, b));
}

// ── フィールド境界 ──

/** ゴールのX範囲 */
const goalLeft = (TABLE_W - GOAL_W) / 2;
const goalRight = (TABLE_W + GOAL_W) / 2;

/** パックが壁に当たるかチェック＆反射 */
export function wallBounce(puck: Puck): void {
  const r = puck.radius;
  const left = WALL_THICKNESS + r;
  const right = TABLE_W - WALL_THICKNESS - r;
  const top = WALL_THICKNESS + r;
  const bottom = TABLE_H - WALL_THICKNESS - r;

  // 左右の壁
  if (puck.pos.x < left) {
    puck.pos.x = left;
    puck.vel.x = Math.abs(puck.vel.x);
  } else if (puck.pos.x > right) {
    puck.pos.x = right;
    puck.vel.x = -Math.abs(puck.vel.x);
  }

  // 上の壁（ゴール部分を除く）
  if (puck.pos.y < top) {
    if (puck.pos.x < goalLeft || puck.pos.x > goalRight) {
      puck.pos.y = top;
      puck.vel.y = Math.abs(puck.vel.y);
    }
  }

  // 下の壁（ゴール部分を除く）
  if (puck.pos.y > bottom) {
    if (puck.pos.x < goalLeft || puck.pos.x > goalRight) {
      puck.pos.y = bottom;
      puck.vel.y = -Math.abs(puck.vel.y);
    }
  }

  // ゴール左右の内壁（ゴール開口部の角）
  // CPU側ゴール（上側）
  if (puck.pos.y < top + GOAL_DEPTH && puck.pos.y >= top - GOAL_DEPTH) {
    if (puck.pos.x >= goalLeft - r && puck.pos.x < goalLeft + r && puck.vel.x < 0) {
      if (puck.pos.y < top) {
        puck.pos.x = goalLeft + r;
        puck.vel.x = Math.abs(puck.vel.x);
      }
    }
    if (puck.pos.x <= goalRight + r && puck.pos.x > goalRight - r && puck.vel.x > 0) {
      if (puck.pos.y < top) {
        puck.pos.x = goalRight - r;
        puck.vel.x = -Math.abs(puck.vel.x);
      }
    }
  }
  // プレイヤー側ゴール（下側）
  if (puck.pos.y > bottom - GOAL_DEPTH && puck.pos.y <= bottom + GOAL_DEPTH) {
    if (puck.pos.x >= goalLeft - r && puck.pos.x < goalLeft + r && puck.vel.x < 0) {
      if (puck.pos.y > bottom) {
        puck.pos.x = goalLeft + r;
        puck.vel.x = Math.abs(puck.vel.x);
      }
    }
    if (puck.pos.x <= goalRight + r && puck.pos.x > goalRight - r && puck.vel.x > 0) {
      if (puck.pos.y > bottom) {
        puck.pos.x = goalRight - r;
        puck.vel.x = -Math.abs(puck.vel.x);
      }
    }
  }
}

/** ゴール判定 */
export function checkGoal(puck: Puck): 'player' | 'cpu' | null {
  if (puck.scored) return null;

  // CPU側ゴール（上端より上に抜けた） → プレイヤーの得点
  if (puck.pos.y < -GOAL_DEPTH) {
    if (puck.pos.x >= goalLeft && puck.pos.x <= goalRight) {
      return 'player';
    }
  }
  // プレイヤー側ゴール（下端より下に抜けた） → CPUの得点
  if (puck.pos.y > TABLE_H + GOAL_DEPTH) {
    if (puck.pos.x >= goalLeft && puck.pos.x <= goalRight) {
      return 'cpu';
    }
  }
  return null;
}

/** 円同士の衝突判定と応答 */
export function circleCollision(
  puck: Puck,
  mallet: Mallet | Circle,
  malletVel: Vec2,
  bounceFactor: number = 1.2,
): boolean {
  const diff = vecSub(puck.pos, mallet.pos);
  const dist = vecLen(diff);
  const minDist = puck.radius + mallet.radius;

  if (dist < minDist && dist > 0) {
    // 位置を重ならないよう補正
    const normal = vecNormalize(diff);
    const overlap = minDist - dist;
    puck.pos = vecAdd(puck.pos, vecScale(normal, overlap));

    // 衝突応答（マレットの速度を反映）
    const relVel = vecSub(puck.vel, malletVel);
    const velAlongNormal = vecDot(relVel, normal);

    if (velAlongNormal < 0) {
      const impulse = vecScale(normal, -velAlongNormal * bounceFactor);
      puck.vel = vecAdd(puck.vel, impulse);
      // マレットの速度を付加（打ち返す感覚を出す）
      puck.vel = vecAdd(puck.vel, vecScale(malletVel, 0.6));
    }

    // 最大速度制限
    const speed = vecLen(puck.vel);
    if (speed > PUCK_MAX_SPEED) {
      puck.vel = vecScale(vecNormalize(puck.vel), PUCK_MAX_SPEED);
    }
    return true;
  }
  return false;
}

/** パック同士の衝突判定と応答 */
export function puckCollision(a: Puck, b: Puck): void {
  if (a.scored || b.scored) return;
  const diff = vecSub(a.pos, b.pos);
  const dist = vecLen(diff);
  const minDist = a.radius + b.radius;

  if (dist < minDist && dist > 0) {
    const normal = vecNormalize(diff);
    const overlap = minDist - dist;
    a.pos = vecAdd(a.pos, vecScale(normal, overlap * 0.5));
    b.pos = vecAdd(b.pos, vecScale(normal, -overlap * 0.5));

    const relVel = vecSub(a.vel, b.vel);
    const velAlongNormal = vecDot(relVel, normal);

    if (velAlongNormal < 0) {
      const impulse = vecScale(normal, -velAlongNormal);
      a.vel = vecAdd(a.vel, impulse);
      b.vel = vecSub(b.vel, impulse);
    }
  }
}

/** パックの摩擦適用 */
export function applyFriction(puck: Puck): void {
  puck.vel.x *= PUCK_FRICTION;
  puck.vel.y *= PUCK_FRICTION;
  // 微速停止
  if (Math.abs(puck.vel.x) < 1) puck.vel.x = 0;
  if (Math.abs(puck.vel.y) < 1) puck.vel.y = 0;
}

/** パックの位置更新 */
export function movePuck(puck: Puck, dt: number): void {
  if (puck.scored) return;
  puck.pos.x += puck.vel.x * dt;
  puck.pos.y += puck.vel.y * dt;
}

/** パックとアイテムの衝突判定 */
export function checkItemCollision(puck: Puck, item: SplitItem): boolean {
  if (!item.active || puck.scored) return false;
  return vecDist(puck.pos, item.pos) < puck.radius + item.radius;
}

/** パックを分裂させる（元のパック＋追加の分裂パック） */
export function splitPuck(
  puck: Puck,
  nextIdStart: number,
): Puck[] {
  const result: Puck[] = [];
  const speed = vecLen(puck.vel);
  const baseAngle = Math.atan2(puck.vel.y, puck.vel.x);
  const spreadAngle = Math.PI / 4; // 45度の開き

  for (let i = 0; i < SPLIT_COUNT; i++) {
    const angleOffset = (i - Math.floor(SPLIT_COUNT / 2)) * spreadAngle;
    const angle = baseAngle + angleOffset;
    const newSpeed = Math.max(speed, 300); // 最低速度を保証
    result.push({
      id: i === 0 ? puck.id : nextIdStart + i - 1,
      pos: { x: puck.pos.x, y: puck.pos.y },
      radius: PUCK_RADIUS,
      vel: {
        x: Math.cos(angle) * newSpeed,
        y: Math.sin(angle) * newSpeed,
      },
      scored: false,
      scoredSide: null,
    });
  }
  return result;
}

/** マレットの移動制限（自陣のみ） */
export function clampMalletPlayer(mallet: Mallet): void {
  const r = mallet.radius;
  const halfH = TABLE_H / 2;
  // 下半分のみ
  mallet.pos.y = Math.max(halfH + r, Math.min(TABLE_H - WALL_THICKNESS - r, mallet.pos.y));
  mallet.pos.x = Math.max(WALL_THICKNESS + r, Math.min(TABLE_W - WALL_THICKNESS - r, mallet.pos.x));
}

export function clampMalletCpu(mallet: Mallet): void {
  const r = mallet.radius;
  const halfH = TABLE_H / 2;
  // 上半分のみ
  mallet.pos.y = Math.max(WALL_THICKNESS + r, Math.min(halfH - r, mallet.pos.y));
  mallet.pos.x = Math.max(WALL_THICKNESS + r, Math.min(TABLE_W - WALL_THICKNESS - r, mallet.pos.x));
}
