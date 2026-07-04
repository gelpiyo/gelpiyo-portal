// ============================================
// slingshot.ts — スリングショット操作
// ============================================

import { calcLaunchVelocity } from './physics';
import type { Piyo } from './entities';

const MAX_DRAG_DISTANCE = 150;
const TRAJECTORY_DOTS = 8;
const TRAJECTORY_DOT_RADIUS = 3;

interface TrajectoryPoint {
  x: number;
  y: number;
}

export class Slingshot {
  anchorX: number;
  anchorY: number;
  isDragging = false;
  dragX: number;
  dragY: number;
  power = 0;
  angle = 0;
  touchStartX = 0;
  touchStartY = 0;
  trajectoryPoints: TrajectoryPoint[];

  constructor(anchorX: number, anchorY: number) {
    this.anchorX = anchorX;
    this.anchorY = anchorY;
    this.dragX = anchorX;
    this.dragY = anchorY;
    this.trajectoryPoints = new Array(TRAJECTORY_DOTS);
    for (let i = 0; i < TRAJECTORY_DOTS; i++) {
      this.trajectoryPoints[i] = { x: 0, y: 0 };
    }
  }

  startDrag(touchX: number, touchY: number, piyo: Piyo): boolean {
    this.isDragging = true;
    this.touchStartX = touchX;
    this.touchStartY = touchY;
    piyo.isDragging = true;
    return true;
  }

  updateDrag(touchX: number, touchY: number, piyo: Piyo): void {
    if (!this.isDragging) return;

    let dx = touchX - this.touchStartX;
    let dy = touchY - this.touchStartY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > MAX_DRAG_DISTANCE) {
      dx = (dx / dist) * MAX_DRAG_DISTANCE;
      dy = (dy / dist) * MAX_DRAG_DISTANCE;
    }

    this.dragX = this.anchorX + dx;
    this.dragY = this.anchorY + dy;
    this.power = Math.min(dist / MAX_DRAG_DISTANCE, 1);
    this.angle = Math.atan2(dy, dx);

    piyo.x = this.dragX;
    piyo.y = this.dragY;
    piyo.dragOffsetX = dx;
    piyo.dragOffsetY = dy;

    const stretchFactor = 1 + this.power * 0.3;
    piyo.scaleX = 1 / stretchFactor;
    piyo.scaleY = stretchFactor;
    piyo.rotation = this.angle + Math.PI / 2;

    this._updateTrajectory(dx, dy);
  }

  release(piyo: Piyo): { vx: number; vy: number; speed: number } | null {
    if (!this.isDragging) return null;

    this.isDragging = false;
    piyo.isDragging = false;
    piyo.scaleX = 1;
    piyo.scaleY = 1;
    piyo.rotation = 0;

    const dx = this.dragX - this.anchorX;
    const dy = this.dragY - this.anchorY;

    if (this.power < 0.1) {
      piyo.x = this.anchorX;
      piyo.y = this.anchorY;
      return null;
    }

    piyo.x = this.anchorX;
    piyo.y = this.anchorY;

    const velocity = calcLaunchVelocity(dx, dy);
    piyo.launch(velocity.vx, velocity.vy);
    return velocity;
  }

  private _updateTrajectory(dx: number, dy: number): void {
    const vel = calcLaunchVelocity(dx, dy);
    let px = this.anchorX;
    let py = this.anchorY;
    let vx = vel.vx;
    let vy = vel.vy;
    const timeStep = 0.08;

    for (let i = 0; i < TRAJECTORY_DOTS; i++) {
      px += vx * timeStep;
      py += vy * timeStep;
      vy += 980 * timeStep;
      this.trajectoryPoints[i].x = px;
      this.trajectoryPoints[i].y = py;
    }
  }

  render(ctx: CanvasRenderingContext2D, piyo: Piyo, camera: { x: number; y: number }): void {
    if (!this.isDragging) return;

    const ox = camera.x;
    const oy = camera.y;

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 200, 100, 0.8)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.moveTo(this.anchorX - ox, this.anchorY - oy);
    ctx.lineTo(piyo.x - ox, piyo.y - oy);
    ctx.stroke();

    const hue = 60 - this.power * 60;
    ctx.strokeStyle = `hsla(${hue}, 100%, 60%, 0.6)`;
    ctx.lineWidth = 4 + this.power * 4;
    ctx.beginPath();
    ctx.moveTo(this.anchorX - ox, this.anchorY - oy);
    ctx.lineTo(piyo.x - ox, piyo.y - oy);
    ctx.stroke();

    for (let i = 0; i < TRAJECTORY_DOTS; i++) {
      const p = this.trajectoryPoints[i];
      const alpha = 1 - (i / TRAJECTORY_DOTS) * 0.8;
      const radius = TRAJECTORY_DOT_RADIUS * (1 - i / TRAJECTORY_DOTS * 0.5);
      ctx.fillStyle = `rgba(255, 230, 50, ${alpha * 0.85})`;
      ctx.beginPath();
      ctx.arc(p.x - ox, p.y - oy, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(255, 200, 100, 0.9)';
    ctx.beginPath();
    ctx.arc(this.anchorX - ox, this.anchorY - oy, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  setAnchor(x: number, y: number): void {
    this.anchorX = x;
    this.anchorY = y;
  }
}
