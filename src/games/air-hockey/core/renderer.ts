/**
 * renderer.ts — Canvas描画処理
 * 明るくポップなデザインで描画する
 */
import type { GameState, Puck, Mallet, SplitItem, RoundState } from './types';
import {
  TABLE_W, TABLE_H, GOAL_W, WALL_THICKNESS, GOAL_DEPTH,
} from './types';

// ── カラーパレット ──
const COLORS = {
  bg: '#f0f4ff',
  tableTop: '#e8fff0',
  tableBottom: '#fff0f6',
  wall: '#4a5568',
  centerLine: '#c4b5fd',
  centerCircle: '#c4b5fd',
  goalCpu: '#60d9fa',
  goalPlayer: '#ff6ec7',
  puck: '#fbbf24',
  puckStroke: '#f59e0b',
  puckTrail: 'rgba(251, 191, 36, 0.15)',
  malletPlayer: '#ff6ec7',
  malletPlayerStroke: '#ec4899',
  malletPlayerInner: '#fff',
  malletCpu: '#60d9fa',
  malletCpuStroke: '#06b6d4',
  malletCpuInner: '#fff',
  item: '#a78bfa',
  itemGlow: 'rgba(167, 139, 250, 0.4)',
  scoreText: '#334155',
  roundDot: '#cbd5e1',
  roundDotWonPlayer: '#ff6ec7',
  roundDotWonCpu: '#60d9fa',
};

/** トレイル用の履歴 */
interface TrailPoint {
  x: number;
  y: number;
  age: number;
}
const puckTrails = new Map<number, TrailPoint[]>();
const TRAIL_MAX_AGE = 0.15;

/** トレイル更新 */
function updateTrail(puck: Puck, dt: number): void {
  if (puck.scored) return;
  let trail = puckTrails.get(puck.id);
  if (!trail) {
    trail = [];
    puckTrails.set(puck.id, trail);
  }
  trail.unshift({ x: puck.pos.x, y: puck.pos.y, age: 0 });
  for (const p of trail) {
    p.age += dt;
  }
  // 古いトレイルを削除
  while (trail.length > 0 && trail[trail.length - 1].age > TRAIL_MAX_AGE) {
    trail.pop();
  }
}

/** トレイル描画 */
function drawTrails(ctx: CanvasRenderingContext2D): void {
  for (const [, trail] of puckTrails) {
    if (trail.length < 2) continue;
    for (let i = 1; i < trail.length; i++) {
      const t = trail[i];
      const alpha = 1 - t.age / TRAIL_MAX_AGE;
      const radius = 14 * alpha;
      ctx.fillStyle = `rgba(251, 191, 36, ${alpha * 0.25})`;
      ctx.beginPath();
      ctx.arc(t.x, t.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** テーブルの背景を描画 */
function drawTable(ctx: CanvasRenderingContext2D): void {
  const grad = ctx.createLinearGradient(0, 0, 0, TABLE_H);
  grad.addColorStop(0, COLORS.tableTop);
  grad.addColorStop(1, COLORS.tableBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, TABLE_W, TABLE_H);

  ctx.strokeStyle = COLORS.centerLine;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(WALL_THICKNESS, TABLE_H / 2);
  ctx.lineTo(TABLE_W - WALL_THICKNESS, TABLE_H / 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = COLORS.centerCircle;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(TABLE_W / 2, TABLE_H / 2, 50, 0, Math.PI * 2);
  ctx.stroke();

  const goalLeft = (TABLE_W - GOAL_W) / 2;
  const goalRight = (TABLE_W + GOAL_W) / 2;

  ctx.fillStyle = COLORS.goalCpu;
  ctx.globalAlpha = 0.3;
  ctx.fillRect(goalLeft, 0, GOAL_W, WALL_THICKNESS + GOAL_DEPTH);
  ctx.globalAlpha = 1;

  ctx.fillStyle = COLORS.goalPlayer;
  ctx.globalAlpha = 0.3;
  ctx.fillRect(goalLeft, TABLE_H - WALL_THICKNESS - GOAL_DEPTH, GOAL_W, WALL_THICKNESS + GOAL_DEPTH);
  ctx.globalAlpha = 1;

  ctx.fillStyle = COLORS.wall;
  ctx.fillRect(0, 0, goalLeft, WALL_THICKNESS);
  ctx.fillRect(goalRight, 0, TABLE_W - goalRight, WALL_THICKNESS);
  ctx.fillRect(0, TABLE_H - WALL_THICKNESS, goalLeft, WALL_THICKNESS);
  ctx.fillRect(goalRight, TABLE_H - WALL_THICKNESS, TABLE_W - goalRight, WALL_THICKNESS);
  ctx.fillRect(0, 0, WALL_THICKNESS, TABLE_H);
  ctx.fillRect(TABLE_W - WALL_THICKNESS, 0, WALL_THICKNESS, TABLE_H);

  ctx.fillRect(goalLeft - 3, 0, 3, WALL_THICKNESS + GOAL_DEPTH);
  ctx.fillRect(goalRight, 0, 3, WALL_THICKNESS + GOAL_DEPTH);
  ctx.fillRect(goalLeft - 3, TABLE_H - WALL_THICKNESS - GOAL_DEPTH, 3, WALL_THICKNESS + GOAL_DEPTH);
  ctx.fillRect(goalRight, TABLE_H - WALL_THICKNESS - GOAL_DEPTH, 3, WALL_THICKNESS + GOAL_DEPTH);
}

/** パック描画 */
function drawPuck(ctx: CanvasRenderingContext2D, puck: Puck): void {
  if (puck.scored) return;
  ctx.shadowColor = COLORS.puck;
  ctx.shadowBlur = 12;
  ctx.fillStyle = COLORS.puck;
  ctx.strokeStyle = COLORS.puckStroke;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(puck.pos.x, puck.pos.y, puck.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.arc(puck.pos.x - 3, puck.pos.y - 3, puck.radius * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

/** マレット描画 */
function drawMallet(ctx: CanvasRenderingContext2D, mallet: Mallet, isPlayer: boolean): void {
  const colors = isPlayer
    ? { fill: COLORS.malletPlayer, stroke: COLORS.malletPlayerStroke, inner: COLORS.malletPlayerInner }
    : { fill: COLORS.malletCpu, stroke: COLORS.malletCpuStroke, inner: COLORS.malletCpuInner };

  ctx.shadowColor = colors.fill;
  ctx.shadowBlur = 16;
  ctx.fillStyle = colors.fill;
  ctx.strokeStyle = colors.stroke;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(mallet.pos.x, mallet.pos.y, mallet.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = colors.inner;
  ctx.beginPath();
  ctx.arc(mallet.pos.x, mallet.pos.y, mallet.radius * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

/** アイテム描画 */
function drawItem(ctx: CanvasRenderingContext2D, item: SplitItem, time: number): void {
  if (!item.active) return;
  const scale = item.spawnTimer;
  const pulse = 1 + Math.sin(time * 6) * 0.08;
  const r = item.radius * scale * pulse;

  ctx.shadowColor = COLORS.item;
  ctx.shadowBlur = 20;
  ctx.fillStyle = COLORS.itemGlow;
  ctx.beginPath();
  ctx.arc(item.pos.x, item.pos.y, r * 1.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = COLORS.item;
  drawStar(ctx, item.pos.x, item.pos.y, r, 5, 0.5);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.round(r * 1.1)}px Outfit, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('×3', item.pos.x, item.pos.y);
  ctx.shadowBlur = 0;
}

/** 星形パス */
function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number, points: number, innerRatio: number,
): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const angle = (Math.PI * i) / points - Math.PI / 2;
    const radius = i % 2 === 0 ? r : r * innerRatio;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** スコア＆ラウンド表示を描画 */
function drawHUD(
  ctx: CanvasRenderingContext2D,
  round: RoundState,
  playerRounds: number,
  cpuRounds: number,
): void {
  if (round.isSplitActive) {
    ctx.fillStyle = COLORS.scoreText;
    ctx.font = 'bold 18px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.malletCpu;
    ctx.fillText(`${round.cpuGoals}`, TABLE_W / 2, 40);
    ctx.fillStyle = COLORS.malletPlayer;
    ctx.fillText(`${round.playerGoals}`, TABLE_W / 2, TABLE_H - 30);
  }

  const dotRadius = 6;
  const dotGap = 18;
  const dotY = TABLE_H / 2;

  for (let i = 0; i < 3; i++) {
    const x = 24 + i * dotGap;
    ctx.fillStyle = i < cpuRounds ? COLORS.roundDotWonCpu : COLORS.roundDot;
    ctx.beginPath();
    ctx.arc(x, dotY, dotRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 3; i++) {
    const x = TABLE_W - 24 - (2 - i) * dotGap;
    ctx.fillStyle = i < playerRounds ? COLORS.roundDotWonPlayer : COLORS.roundDot;
    ctx.beginPath();
    ctx.arc(x, dotY, dotRadius, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** ラウンド終了テキスト描画 */
function drawRoundResult(ctx: CanvasRenderingContext2D, round: RoundState): void {
  if (!round.roundOver) return;

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(0, TABLE_H / 2 - 40, TABLE_W, 80);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 28px Outfit, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  let text = '';
  if (round.playerGoals > round.cpuGoals) text = 'ラウンド獲得！🎉';
  else if (round.cpuGoals > round.playerGoals) text = 'ラウンド失った…';
  else text = '引き分け！';

  ctx.fillText(text, TABLE_W / 2, TABLE_H / 2);
}

// ── メイン描画関数 ──

/** ゲーム画面を描画 */
export function render(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  dt: number,
  elapsedTime: number,
): void {
  const r = state.round;

  for (const puck of r.pucks) {
    updateTrail(puck, dt);
  }

  ctx.clearRect(0, 0, TABLE_W, TABLE_H);
  drawTable(ctx);
  drawTrails(ctx);

  if (r.splitItem) {
    drawItem(ctx, r.splitItem, elapsedTime);
  }

  for (const puck of r.pucks) {
    drawPuck(ctx, puck);
  }

  drawMallet(ctx, r.cpuMallet, false);
  drawMallet(ctx, r.playerMallet, true);
  drawHUD(ctx, r, state.playerRounds, state.cpuRounds);
  drawRoundResult(ctx, r);
}

/** トレイルキャッシュをクリア */
export function clearTrails(): void {
  puckTrails.clear();
}
