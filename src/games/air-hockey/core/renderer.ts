/**
 * renderer.ts — Canvas描画処理
 * 明るくポップなデザインで描画する
 */
import type { GameState, Puck, Mallet, SplitItem, RoundState } from './types';
import {
  TABLE_W, TABLE_H, GOAL_W, WALL_THICKNESS, GOAL_DEPTH,
} from './types';

// ── カラーパレット（サイバーネオン） ──
const COLORS = {
  bg: '#020208',
  tableTop: '#0a0b16',
  tableBottom: '#140a18',
  wall: '#1f202e',
  wallBorder: '#3f3f5c',
  centerLine: 'rgba(0, 242, 254, 0.25)',
  centerCircle: 'rgba(0, 242, 254, 0.25)',
  goalCpu: '#00f2fe',
  goalPlayer: '#ff007f',
  puck: '#ffea00',
  puckStroke: '#fff',
  puckTrail: 'rgba(255, 234, 0, 0.2)',
  malletPlayer: '#ff007f',
  malletPlayerStroke: '#ff5ea7',
  malletPlayerInner: '#fff',
  malletCpu: '#00f2fe',
  malletCpuStroke: '#5ef3ff',
  malletCpuInner: '#fff',
  item: '#a78bfa',
  itemGlow: 'rgba(167, 139, 250, 0.4)',
  scoreText: '#ffffff',
  roundDot: '#3a3f58',
  roundDotWonPlayer: '#ff007f',
  roundDotWonCpu: '#00f2fe',
};

/** トレイル用の履歴 */
interface TrailPoint {
  x: number;
  y: number;
  age: number;
}
const puckTrails = new Map<number, TrailPoint[]>();
const TRAIL_MAX_AGE = 0.15;

/** スパークパーティクル */
interface SparkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  decay: number;
}
let sparkParticles: SparkParticle[] = [];

/** ゴール波紋 */
interface GoalRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  life: number;
}
let goalRings: GoalRing[] = [];

/** ゴールテキスト表示 */
interface GoalText {
  y: number;
  scale: number;
  alpha: number;
  life: number;
}
let activeGoalText: GoalText | null = null;

/** 衝突検知用・前回の速度 */
const puckLastVels = new Map<number, { x: number; y: number }>();
/** ゴール検知用・スコア状態 */
const puckScoredState = new Map<number, boolean>();

/** 画面揺れ制御 */
let shakeTimer = 0;
let shakeIntensity = 0;

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
      ctx.fillStyle = `rgba(255, 234, 0, ${alpha * 0.22})`;
      ctx.beginPath();
      ctx.arc(t.x, t.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** スパークスポーン */
function spawnSparks(x: number, y: number, count: number, color: string) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 5.0;
    sparkParticles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color,
      size: 1.5 + Math.random() * 2.5,
      life: 1.0,
      decay: 0.02 + Math.random() * 0.04,
    });
  }
}

/** スパーク・ゴール波紋の更新 */
function updateEffects(dt: number) {
  // スクリーンシェイク更新
  if (shakeTimer > 0) shakeTimer -= dt;

  // パーティクル更新
  sparkParticles = sparkParticles.filter(p => p.life > 0);
  for (const p of sparkParticles) {
    p.x += p.vx;
    p.y += p.vy;
    p.life -= p.decay;
  }

  // ゴール波紋更新
  goalRings = goalRings.filter(r => r.life > 0);
  for (const r of goalRings) {
    r.radius += (r.maxRadius - r.radius) * 0.12;
    r.life -= dt * 1.5;
  }

  // ゴールテキスト更新
  if (activeGoalText) {
    activeGoalText.life -= dt;
    activeGoalText.scale = 1 + (0.4 * (0.8 - activeGoalText.life) / 0.8);
    activeGoalText.alpha = activeGoalText.life / 0.8;
    if (activeGoalText.life <= 0) activeGoalText = null;
  }
}

/** スパーク・ゴール波紋の描画 */
function drawEffects(ctx: CanvasRenderingContext2D) {
  // 波紋
  for (const r of goalRings) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, r.life);
    ctx.strokeStyle = r.color;
    ctx.shadowColor = r.color;
    ctx.shadowBlur = 15;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // スパーク
  for (const p of sparkParticles) {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ゴールテキスト
  if (activeGoalText) {
    ctx.save();
    ctx.globalAlpha = activeGoalText.alpha;
    ctx.font = `bold ${Math.round(38 * activeGoalText.scale)}px Outfit, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffea00';
    ctx.shadowColor = '#ff007f';
    ctx.shadowBlur = 20;
    ctx.fillText('GOAL!! 🐣', TABLE_W / 2, activeGoalText.y);
    ctx.restore();
  }
}

/** テーブルの背景を描画 */
function drawTable(ctx: CanvasRenderingContext2D): void {
  const grad = ctx.createLinearGradient(0, 0, 0, TABLE_H);
  grad.addColorStop(0, COLORS.tableTop);
  grad.addColorStop(1, COLORS.tableBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, TABLE_W, TABLE_H);

  // 背景にうっすらとサイバーグリッドラインを描画
  ctx.strokeStyle = 'rgba(100, 100, 255, 0.05)';
  ctx.lineWidth = 1;
  const gridSize = 25;
  for (let x = WALL_THICKNESS; x < TABLE_W - WALL_THICKNESS; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, WALL_THICKNESS);
    ctx.lineTo(x, TABLE_H - WALL_THICKNESS);
    ctx.stroke();
  }
  for (let y = WALL_THICKNESS; y < TABLE_H - WALL_THICKNESS; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(WALL_THICKNESS, y);
    ctx.lineTo(TABLE_W - WALL_THICKNESS, y);
    ctx.stroke();
  }

  // 中央線
  ctx.strokeStyle = COLORS.centerLine;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(WALL_THICKNESS, TABLE_H / 2);
  ctx.lineTo(TABLE_W - WALL_THICKNESS, TABLE_H / 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // 中央円
  ctx.strokeStyle = COLORS.centerCircle;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(TABLE_W / 2, TABLE_H / 2, 50, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(TABLE_W / 2, TABLE_H / 2, 54, 0, Math.PI * 2);
  ctx.stroke();

  const goalLeft = (TABLE_W - GOAL_W) / 2;
  const goalRight = (TABLE_W + GOAL_W) / 2;

  // CPUゴール（グロー）
  ctx.save();
  ctx.shadowColor = COLORS.goalCpu;
  ctx.shadowBlur = 15;
  ctx.fillStyle = COLORS.goalCpu;
  ctx.globalAlpha = 0.2;
  ctx.fillRect(goalLeft, 0, GOAL_W, WALL_THICKNESS + GOAL_DEPTH);
  ctx.globalAlpha = 1;
  ctx.fillStyle = COLORS.goalCpu;
  ctx.fillRect(goalLeft, WALL_THICKNESS, GOAL_W, 3);
  ctx.restore();

  // プレイヤーゴール（グロー）
  ctx.save();
  ctx.shadowColor = COLORS.goalPlayer;
  ctx.shadowBlur = 15;
  ctx.fillStyle = COLORS.goalPlayer;
  ctx.globalAlpha = 0.2;
  ctx.fillRect(goalLeft, TABLE_H - WALL_THICKNESS - GOAL_DEPTH, GOAL_W, WALL_THICKNESS + GOAL_DEPTH);
  ctx.globalAlpha = 1;
  ctx.fillStyle = COLORS.goalPlayer;
  ctx.fillRect(goalLeft, TABLE_H - WALL_THICKNESS - 3, GOAL_W, 3);
  ctx.restore();

  // 壁
  ctx.fillStyle = COLORS.wall;
  ctx.fillRect(0, 0, goalLeft, WALL_THICKNESS);
  ctx.fillRect(goalRight, 0, TABLE_W - goalRight, WALL_THICKNESS);
  ctx.fillRect(0, TABLE_H - WALL_THICKNESS, goalLeft, WALL_THICKNESS);
  ctx.fillRect(goalRight, TABLE_H - WALL_THICKNESS, TABLE_W - goalRight, WALL_THICKNESS);
  ctx.fillRect(0, 0, WALL_THICKNESS, TABLE_H);
  ctx.fillRect(TABLE_W - WALL_THICKNESS, 0, WALL_THICKNESS, TABLE_H);

  // 壁の光沢枠
  ctx.strokeStyle = COLORS.wallBorder;
  ctx.lineWidth = 1;
  ctx.strokeRect(WALL_THICKNESS, WALL_THICKNESS, TABLE_W - WALL_THICKNESS * 2, TABLE_H - WALL_THICKNESS * 2);
}

/** パック描画 */
function drawPuck(ctx: CanvasRenderingContext2D, puck: Puck): void {
  if (puck.scored) return;
  ctx.save();
  ctx.shadowColor = COLORS.puck;
  ctx.shadowBlur = 14;
  ctx.fillStyle = COLORS.puck;
  ctx.strokeStyle = COLORS.puckStroke;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(puck.pos.x, puck.pos.y, puck.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  // ディスク風の模様
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(puck.pos.x, puck.pos.y, puck.radius * 0.6, 0, Math.PI * 2);
  ctx.stroke();

  // 回転するスパイラル
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const rotation = (Date.now() / 150) % (Math.PI * 2);
  ctx.arc(puck.pos.x, puck.pos.y, puck.radius * 0.35, rotation, rotation + Math.PI);
  ctx.stroke();

  ctx.restore();
}

/** マレット描画（ゲルぴよフェイステクスチャ） */
function drawMallet(ctx: CanvasRenderingContext2D, mallet: Mallet, isPlayer: boolean): void {
  const colors = isPlayer
    ? { fill: COLORS.malletPlayer, stroke: COLORS.malletPlayerStroke, inner: COLORS.malletPlayerInner }
    : { fill: COLORS.malletCpu, stroke: COLORS.malletCpuStroke, inner: COLORS.malletCpuInner };

  ctx.save();
  ctx.shadowColor = colors.fill;
  ctx.shadowBlur = 18;
  ctx.fillStyle = colors.fill;
  ctx.strokeStyle = colors.stroke;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(mallet.pos.x, mallet.pos.y, mallet.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  // 内側の同心円
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(mallet.pos.x, mallet.pos.y, mallet.radius * 0.7, 0, Math.PI * 2);
  ctx.stroke();

  // 中心に「ゲルぴよ」の顔を可愛く描画
  const px = mallet.pos.x;
  const py = mallet.pos.y;
  
  // ひよこ体（黄色いベース）
  ctx.fillStyle = '#ffea00';
  ctx.beginPath();
  ctx.arc(px, py + 2, mallet.radius * 0.4, 0, Math.PI * 2);
  ctx.fill();

  // 目
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(px - 3, py, 1.5, 0, Math.PI * 2);
  ctx.arc(px + 3, py, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // くちばし（オレンジ）
  ctx.fillStyle = '#ff8800';
  ctx.beginPath();
  ctx.moveTo(px - 3, py + 2);
  ctx.lineTo(px + 3, py + 2);
  ctx.lineTo(px, py + 5);
  ctx.closePath();
  ctx.fill();

  // アホ毛
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(px, py - mallet.radius * 0.4 + 2);
  ctx.quadraticCurveTo(px + 2, py - mallet.radius * 0.4 - 2, px + 1, py - mallet.radius * 0.4 - 6);
  ctx.stroke();

  ctx.restore();
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
    ctx.fillStyle = COLORS.roundDotWonCpu;
    ctx.fillText(`${round.cpuGoals}`, TABLE_W / 2, 40);
    ctx.fillStyle = COLORS.roundDotWonPlayer;
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

  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, TABLE_H / 2 - 40, TABLE_W, 80);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 24px Outfit, sans-serif';
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

  // エフェクト状態の更新
  updateEffects(dt);

  // パックの移動トレイルと衝突検知
  for (const puck of r.pucks) {
    updateTrail(puck, dt);
    
    if (puck.scored) continue;
    
    // スパーク発生判定 (急激な速度変化)
    const lastVel = puckLastVels.get(puck.id);
    if (lastVel) {
      const dvx = puck.vel.x - lastVel.x;
      const dvy = puck.vel.y - lastVel.y;
      const speedDiff = Math.sqrt(dvx * dvx + dvy * dvy);
      if (speedDiff > 90) {
        const color = puck.pos.y > TABLE_H / 2 ? COLORS.malletPlayer : COLORS.malletCpu;
        spawnSparks(puck.pos.x, puck.pos.y, 8, color);
      }
    }
    puckLastVels.set(puck.id, { x: puck.vel.x, y: puck.vel.y });

    // ゴール時エフェクトキック
    const wasScored = puckScoredState.get(puck.id) || false;
    if (puck.scored && !wasScored) {
      const side = puck.scoredSide;
      const isPlayerScore = side === 'cpu';
      const color = isPlayerScore ? COLORS.goalPlayer : COLORS.goalCpu;

      // 画面揺れ起動
      shakeTimer = 0.35;
      shakeIntensity = 7;

      // ゴール波紋
      const gy = side === 'cpu' ? WALL_THICKNESS + GOAL_DEPTH : TABLE_H - WALL_THICKNESS - GOAL_DEPTH;
      goalRings.push({
        x: puck.pos.x,
        y: gy,
        radius: 6,
        maxRadius: 160,
        color,
        life: 1.0
      });

      // ゴールテキスト
      activeGoalText = {
        y: isPlayerScore ? TABLE_H * 0.4 : TABLE_H * 0.6,
        scale: 1,
        alpha: 1,
        life: 0.8
      };

      // 大量スパーク
      spawnSparks(puck.pos.x, gy, 30, color);
    }
    puckScoredState.set(puck.id, puck.scored);
  }

  // 描画開始
  ctx.save();
  
  // スクリーンシェイク適用
  if (shakeTimer > 0) {
    const dx = (Math.random() - 0.5) * shakeIntensity;
    const dy = (Math.random() - 0.5) * shakeIntensity;
    ctx.translate(dx, dy);
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
  
  drawEffects(ctx);
  
  ctx.restore(); // スクリーンシェイク復帰
  
  drawHUD(ctx, r, state.playerRounds, state.cpuRounds);
  drawRoundResult(ctx, r);
}

/** トレイルキャッシュをクリア */
export function clearTrails(): void {
  puckTrails.clear();
  sparkParticles = [];
  goalRings = [];
  activeGoalText = null;
  puckLastVels.clear();
  puckScoredState.clear();
  shakeTimer = 0;
}
