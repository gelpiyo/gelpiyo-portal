// ============================================
// physics.ts — 2D 物理エンジン（軽量自作）
// ============================================

import type { CollisionResult } from './types';
import { MAX_VELOCITY } from './types';

/** 2Dベクトルユーティリティ */
export const Vec2Util = {
  length(vx: number, vy: number): number {
    return Math.sqrt(vx * vx + vy * vy);
  },
  dot(ax: number, ay: number, bx: number, by: number): number {
    return ax * bx + ay * by;
  },
};

/**
 * 円 vs 矩形 (AABB) の衝突判定
 */
export function circleVsRect(
  cx: number, cy: number, cr: number,
  rx: number, ry: number, rw: number, rh: number,
): CollisionResult | null {
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));

  const dx = cx - closestX;
  const dy = cy - closestY;
  const distSq = dx * dx + dy * dy;

  if (distSq >= cr * cr) return null;

  const dist = Math.sqrt(distSq);
  const penetration = cr - dist;

  let nx: number, ny: number;
  if (dist < 0.0001) {
    const toLeft = cx - rx;
    const toRight = (rx + rw) - cx;
    const toTop = cy - ry;
    const toBottom = (ry + rh) - cy;
    const minDist = Math.min(toLeft, toRight, toTop, toBottom);
    if (minDist === toLeft) { nx = -1; ny = 0; }
    else if (minDist === toRight) { nx = 1; ny = 0; }
    else if (minDist === toTop) { nx = 0; ny = -1; }
    else { nx = 0; ny = 1; }
  } else {
    nx = dx / dist;
    ny = dy / dist;
  }

  return { hit: true, penetration, normalX: nx, normalY: ny, contactX: closestX, contactY: closestY };
}

/**
 * 衝突応答：反発＋位置補正
 */
export function resolveCollision(
  body: { x: number; y: number; vx: number; vy: number },
  collision: CollisionResult,
  restitution: number,
): number {
  body.x += collision.normalX * collision.penetration;
  body.y += collision.normalY * collision.penetration;

  const dotVN = body.vx * collision.normalX + body.vy * collision.normalY;
  if (dotVN > 0) return 0;

  const impact = Math.abs(dotVN);
  body.vx -= (1 + restitution) * dotVN * collision.normalX;
  body.vy -= (1 + restitution) * dotVN * collision.normalY;

  return impact;
}

/**
 * スクワッシュ＆ストレッチ計算
 */
export function calcSquashStretch(impact: number, time: number): { scaleX: number; scaleY: number } {
  const maxDeform = Math.min(impact / 800, 0.4);
  const decay = Math.exp(-time * 12);
  const oscillation = Math.cos(time * 30) * decay;
  const deform = maxDeform * oscillation;

  return { scaleX: 1 + deform, scaleY: 1 - deform };
}

/**
 * 引っ張り発射速度を計算
 */
export function calcLaunchVelocity(
  dx: number, dy: number, power: number = 16.0,
): { vx: number; vy: number; speed: number } {
  let vx = -dx * power;
  let vy = -dy * power;
  const speed = Vec2Util.length(vx, vy);

  if (speed > MAX_VELOCITY) {
    const ratio = MAX_VELOCITY / speed;
    return { vx: vx * ratio, vy: vy * ratio, speed: MAX_VELOCITY };
  }

  return { vx, vy, speed };
}
