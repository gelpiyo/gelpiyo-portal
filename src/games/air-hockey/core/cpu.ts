/**
 * cpu.ts — CPUマレットのAIロジック
 */
import type { Mallet, Puck, Vec2 } from './types';
import { TABLE_W, TABLE_H } from './types';
import { vecSub, vecLen, vecScale, vecNormalize, clampMalletCpu } from './physics';

/** CPU速度上限 */
const CPU_SPEED = 320;
/** CPUの守備位置（Y座標） */
const CPU_HOME_Y = TABLE_H * 0.18;
/** 反応遅れの補間係数 */
const CPU_LERP = 0.08;

/** CPUマレットの目標位置を計算 */
function getCpuTarget(mallet: Mallet, pucks: Puck[]): Vec2 {
  // スコア済みでないパックのうち、最もCPUゴール（上側）に近いものを追跡
  const activePucks = pucks.filter((p) => !p.scored);
  if (activePucks.length === 0) {
    return { x: TABLE_W / 2, y: CPU_HOME_Y };
  }

  // CPU側に向かってきているパックを優先
  let target: Puck | null = null;
  let minY = Infinity;

  for (const p of activePucks) {
    // 上方向に移動中か、CPUエリア内にいるパック
    if (p.vel.y < 0 || p.pos.y < TABLE_H * 0.45) {
      if (p.pos.y < minY) {
        minY = p.pos.y;
        target = p;
      }
    }
  }

  // 脅威がなければ中央で待機
  if (!target) {
    // 最も近いパックに軽く追従
    let closestDist = Infinity;
    for (const p of activePucks) {
      const d = vecLen(vecSub(p.pos, mallet.pos));
      if (d < closestDist) {
        closestDist = d;
        target = p;
      }
    }
    if (target) {
      return {
        x: target.pos.x,
        y: CPU_HOME_Y,
      };
    }
    return { x: TABLE_W / 2, y: CPU_HOME_Y };
  }

  // パックに向かって移動（少し手前に構える）
  return {
    x: target.pos.x,
    y: Math.min(target.pos.y - mallet.radius, TABLE_H * 0.4),
  };
}

/** CPUマレットを更新 */
export function updateCpu(mallet: Mallet, pucks: Puck[], dt: number): void {
  const target = getCpuTarget(mallet, pucks);

  // 目標位置への補間移動（反応遅延を演出）
  const diff = vecSub(target, mallet.pos);
  const dist = vecLen(diff);

  if (dist < 1) {
    mallet.vel = { x: 0, y: 0 };
    return;
  }

  // 滑らかに目標位置に向かう
  const desiredX = mallet.pos.x + diff.x * CPU_LERP;
  const desiredY = mallet.pos.y + diff.y * CPU_LERP;

  // 速度を制限
  const moveDir = vecNormalize(diff);
  const moveSpeed = Math.min(dist / dt, CPU_SPEED);
  const actualVel = vecScale(moveDir, moveSpeed);

  mallet.prevPos = { ...mallet.pos };
  mallet.vel = actualVel;

  mallet.pos.x = desiredX;
  mallet.pos.y = desiredY;

  clampMalletCpu(mallet);

  // 実際の移動量から速度を逆算（クランプ後）
  mallet.vel = {
    x: (mallet.pos.x - mallet.prevPos.x) / dt,
    y: (mallet.pos.y - mallet.prevPos.y) / dt,
  };
}
