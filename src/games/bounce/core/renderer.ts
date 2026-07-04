// ============================================
// renderer.ts — Canvas描画処理
// ============================================

import { OBJ_TYPE, WORLD_WIDTH, WORLD_HEIGHT } from './types';
import type { Particle } from './types';
import type { Piyo, GameObject, ParticlePool } from './entities';

// ============================================
// カメラ
// ============================================
export class Camera {
  x = 0;
  y = 0;
  targetX = 0;
  targetY = 0;
  shakeX = 0;
  shakeY = 0;
  shakeTimer = 0;
  shakeIntensity = 0;

  follow(targetX: number, targetY: number, viewWidth: number, viewHeight: number, dt: number): void {
    this.targetX = Math.max(0, Math.min(targetX - viewWidth / 2, WORLD_WIDTH - viewWidth));
    this.targetY = Math.max(0, Math.min(targetY - viewHeight / 2, WORLD_HEIGHT - viewHeight));
    this.x += (this.targetX - this.x) * Math.min(dt * 3, 1);
    this.y += (this.targetY - this.y) * Math.min(dt * 3, 1);
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      const decay = this.shakeTimer / 0.3;
      this.shakeX = (Math.random() - 0.5) * this.shakeIntensity * decay * 2;
      this.shakeY = (Math.random() - 0.5) * this.shakeIntensity * decay * 2;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }

  shake(intensity: number): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeTimer = 0.3;
  }

  reset(): void {
    this.x = 0; this.y = 0; this.targetX = 0; this.targetY = 0;
    this.shakeX = 0; this.shakeY = 0; this.shakeTimer = 0; this.shakeIntensity = 0;
  }
}

// ============================================
// ユーティリティ
// ============================================
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function darkenColor(hex: string, amount: number): string {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount);
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount);
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount);
  return `rgb(${r},${g},${b})`;
}

function lightenColor(hex: string, amount: number): string {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
  return `rgb(${r},${g},${b})`;
}

// ============================================
// メインレンダラー
// ============================================
export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  images: Record<string, HTMLCanvasElement | HTMLImageElement> = {};
  scale = 1;
  offsetX = 0;
  offsetY = 0;
  private _resizeHandler: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this._resizeHandler = () => this.resize();
    window.addEventListener('resize', this._resizeHandler);
    this.resize();
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const containerWidth = this.canvas.parentElement?.clientWidth || window.innerWidth;
    const containerHeight = this.canvas.parentElement?.clientHeight || window.innerHeight;
    const worldAspect = WORLD_WIDTH / WORLD_HEIGHT;
    const screenAspect = containerWidth / containerHeight;

    let drawWidth: number, drawHeight: number;
    if (screenAspect > worldAspect) {
      drawHeight = containerHeight;
      drawWidth = drawHeight * worldAspect;
    } else {
      drawWidth = containerWidth;
      drawHeight = drawWidth / worldAspect;
    }

    this.canvas.style.width = containerWidth + 'px';
    this.canvas.style.height = containerHeight + 'px';
    this.canvas.width = containerWidth * dpr;
    this.canvas.height = containerHeight * dpr;
    this.scale = drawWidth / WORLD_WIDTH * dpr;
    this.offsetX = (containerWidth * dpr - drawWidth * dpr) / 2;
    this.offsetY = (containerHeight * dpr - drawHeight * dpr) / 2;
  }

  beginFrame(camera: Camera, bgColors: string[] | null): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = bgColors ? bgColors[0] : '#0f0f23';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);
    ctx.translate(-(camera.x + camera.shakeX), -(camera.y + camera.shakeY));
  }

  endFrame(): void {
    this.ctx.restore();
  }

  drawBackground(bgColors: string[] | null, groundColor: string | null): void {
    const ctx = this.ctx;
    if (bgColors && bgColors.length >= 2) {
      const grad = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
      bgColors.forEach((color, i) => {
        grad.addColorStop(i / (bgColors.length - 1), color);
      });
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    }
    const groundY = WORLD_HEIGHT - 60;
    const gc = groundColor || '#2d5a3d';
    const groundGrad = ctx.createLinearGradient(0, groundY, 0, WORLD_HEIGHT);
    groundGrad.addColorStop(0, gc);
    groundGrad.addColorStop(1, darkenColor(gc, 40));
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, groundY, WORLD_WIDTH, 60);
    ctx.strokeStyle = lightenColor(gc, 30);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(WORLD_WIDTH, groundY);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    for (let i = 0; i < 30; i++) {
      const sx = ((i * 127 + 53) % WORLD_WIDTH);
      const sy = ((i * 89 + 17) % (WORLD_HEIGHT - 100));
      const size = 1 + (i % 3);
      ctx.beginPath();
      ctx.arc(sx, sy, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawPiyo(piyo: Piyo): void {
    const ctx = this.ctx;
    if (!piyo.active || piyo.alpha <= 0) return;
    this._drawTrail(piyo);
    ctx.save();
    ctx.globalAlpha = piyo.alpha;
    ctx.translate(piyo.x, piyo.y);
    ctx.rotate(piyo.rotation);
    ctx.scale(piyo.scaleX, piyo.scaleY);
    const r = piyo.radius;
    const img = this.images[piyo.imageKey];
    if (img) {
      ctx.drawImage(img, -r, -r, r * 2, r * 2);
    } else {
      this._drawFallbackPiyo(ctx, r);
    }
    ctx.restore();
  }

  private _drawFallbackPiyo(ctx: CanvasRenderingContext2D, r: number): void {
    const bodyGrad = ctx.createRadialGradient(-r * 0.2, -r * 0.3, r * 0.1, 0, 0, r);
    bodyGrad.addColorStop(0, '#ffe44d');
    bodyGrad.addColorStop(0.7, '#ffd000');
    bodyGrad.addColorStop(1, '#e6b800');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, r * 0.05, r * 0.85, r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.15, -r * 0.35, r * 0.35, r * 0.25, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(-r * 0.25, -r * 0.1, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r * 0.25, -r * 0.1, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-r * 0.22, -r * 0.15, r * 0.04, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r * 0.28, -r * 0.15, r * 0.04, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff9933';
    ctx.beginPath();
    ctx.moveTo(-r * 0.08, r * 0.05);
    ctx.lineTo(r * 0.08, r * 0.05);
    ctx.lineTo(0, r * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffd000';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.85);
    ctx.quadraticCurveTo(r * 0.3, -r * 1.3, r * 0.1, -r * 1.15);
    ctx.stroke();
    ctx.fillStyle = '#ffd000';
    ctx.beginPath();
    ctx.ellipse(-r * 0.85, r * 0.05, r * 0.18, r * 0.12, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(r * 0.85, r * 0.05, r * 0.18, r * 0.12, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  private _drawTrail(piyo: Piyo): void {
    const ctx = this.ctx;
    if (piyo.trailPoints.length < 2) return;
    for (let i = 1; i < piyo.trailPoints.length; i++) {
      const p = piyo.trailPoints[i];
      const prevP = piyo.trailPoints[i - 1];
      ctx.strokeStyle = `rgba(255, 215, 0, ${p.alpha * 0.4})`;
      ctx.lineWidth = 3 * p.alpha;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(prevP.x, prevP.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
  }

  drawObject(obj: GameObject): void {
    const ctx = this.ctx;
    if (obj.alpha <= 0) return;
    const shake = obj.getShakeOffset();
    const wobble = obj.getWobbleOffset();
    ctx.save();
    ctx.globalAlpha = obj.alpha;
    ctx.translate(obj.x + obj.width / 2 + shake.x, obj.y + obj.height / 2 + shake.y + wobble);
    const hw = obj.width / 2;
    const hh = obj.height / 2;
    const img = obj.imageKey ? this.images[obj.imageKey] : null;

    if (img && (obj.type === OBJ_TYPE.ENEMY || obj.type === OBJ_TYPE.ENEMY_BOMB || obj.type === OBJ_TYPE.ENEMY_WARP)) {
      ctx.drawImage(img, -hw, -hh, obj.width, obj.height);
      if (obj.type === OBJ_TYPE.ENEMY_BOMB) {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
        ctx.beginPath(); ctx.arc(0, 0, hw, 0, Math.PI * 2); ctx.fill();
      } else if (obj.type === OBJ_TYPE.ENEMY_WARP) {
        ctx.fillStyle = 'rgba(150, 0, 255, 0.4)';
        ctx.beginPath(); ctx.arc(0, 0, hw, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      switch (obj.type) {
        case OBJ_TYPE.JELLY: this._drawJellyBlock(ctx, hw, hh); break;
        case OBJ_TYPE.WOOD: this._drawWoodBlock(ctx, hw, hh); break;
        case OBJ_TYPE.IRON: this._drawIronBlock(ctx, hw, hh); break;
        case OBJ_TYPE.GLASS: this._drawGlassBlock(ctx, hw, hh); break;
        case OBJ_TYPE.TNT: this._drawTNTBlock(ctx, hw, hh); break;
        case OBJ_TYPE.SPRING: this._drawSpring(ctx, hw, hh); break;
        case OBJ_TYPE.ENEMY: case OBJ_TYPE.ENEMY_BOMB: case OBJ_TYPE.ENEMY_WARP:
          this._drawEnemyFallback(ctx, hw, hh, obj.color); break;
        case OBJ_TYPE.ITEM_GIANT: this._drawItemBubble(ctx, hw, hh, 'GIANT'); break;
        case OBJ_TYPE.ITEM_SPLIT: this._drawItemBubble(ctx, hw, hh, 'SPLIT'); break;
      }
      if (obj.crackLevel > 0 && obj.alive) {
        this._drawCracks(ctx, hw, hh, obj.crackLevel);
      }
    }
    ctx.restore();
  }

  private _drawJellyBlock(ctx: CanvasRenderingContext2D, hw: number, hh: number): void {
    ctx.save();
    ctx.shadowColor = '#00ff88'; ctx.shadowBlur = 14;
    ctx.fillStyle = 'rgba(0, 255, 136, 0.18)';
    roundRect(ctx, -hw, -hh, hw * 2, hh * 2, 8); ctx.fill();
    ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 3;
    roundRect(ctx, -hw, -hh, hw * 2, hh * 2, 8); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath(); ctx.ellipse(-hw * 0.2, -hh * 0.3, hw * 0.4, hh * 0.25, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  private _drawWoodBlock(ctx: CanvasRenderingContext2D, hw: number, hh: number): void {
    ctx.save();
    ctx.shadowColor = '#ffaa44'; ctx.shadowBlur = 10;
    const grad = ctx.createLinearGradient(-hw, -hh, hw, hh);
    grad.addColorStop(0, 'rgba(200, 140, 60, 0.88)');
    grad.addColorStop(1, 'rgba(150, 95, 25, 0.88)');
    ctx.fillStyle = grad;
    roundRect(ctx, -hw, -hh, hw * 2, hh * 2, 4); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 200, 80, 0.25)'; ctx.lineWidth = 1;
    const lineCount = Math.max(2, Math.floor(hh * 0.15));
    for (let i = 0; i < lineCount; i++) {
      const y = -hh + (hh * 2 / (lineCount + 1)) * (i + 1);
      ctx.beginPath(); ctx.moveTo(-hw + 4, y);
      ctx.bezierCurveTo(-hw * 0.3, y - 2, hw * 0.3, y + 2, hw - 4, y); ctx.stroke();
    }
    ctx.shadowColor = '#ffaa44'; ctx.shadowBlur = 8;
    ctx.strokeStyle = '#ffaa44'; ctx.lineWidth = 2.5;
    roundRect(ctx, -hw, -hh, hw * 2, hh * 2, 4); ctx.stroke();
    ctx.restore();
  }

  private _drawIronBlock(ctx: CanvasRenderingContext2D, hw: number, hh: number): void {
    ctx.save();
    ctx.shadowColor = '#4499dd'; ctx.shadowBlur = 10;
    const grad = ctx.createLinearGradient(-hw, -hh, hw, hh);
    grad.addColorStop(0, 'rgba(100, 130, 170, 0.92)');
    grad.addColorStop(0.5, 'rgba(140, 175, 210, 0.92)');
    grad.addColorStop(1, 'rgba(80, 110, 155, 0.92)');
    ctx.fillStyle = grad;
    roundRect(ctx, -hw, -hh, hw * 2, hh * 2, 3); ctx.fill();
    ctx.strokeStyle = '#7bbcee'; ctx.lineWidth = 2.5;
    roundRect(ctx, -hw, -hh, hw * 2, hh * 2, 3); ctx.stroke();
    ctx.shadowColor = '#00d4ff'; ctx.shadowBlur = 8;
    ctx.fillStyle = '#00d4ff';
    const boltR = Math.min(4, Math.min(hw, hh) * 0.2);
    const boltPositions: [number, number][] = [
      [-hw + boltR + 4, -hh + boltR + 4], [hw - boltR - 4, -hh + boltR + 4],
      [-hw + boltR + 4, hh - boltR - 4], [hw - boltR - 4, hh - boltR - 4],
    ];
    boltPositions.forEach(([bx, by]) => {
      ctx.beginPath(); ctx.arc(bx, by, boltR, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
  }

  private _drawGlassBlock(ctx: CanvasRenderingContext2D, hw: number, hh: number): void {
    ctx.save();
    ctx.shadowColor = '#00d4ff'; ctx.shadowBlur = 15;
    ctx.fillStyle = 'rgba(0, 212, 255, 0.1)';
    roundRect(ctx, -hw, -hh, hw * 2, hh * 2, 4); ctx.fill();
    ctx.strokeStyle = '#00d4ff'; ctx.lineWidth = 2.5;
    roundRect(ctx, -hw, -hh, hw * 2, hh * 2, 4); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.beginPath();
    ctx.moveTo(-hw + 4, -hh + 4); ctx.lineTo(hw * 0.3, -hh + 4);
    ctx.lineTo(-hw + 4, hh * 0.3); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  private _drawTNTBlock(ctx: CanvasRenderingContext2D, hw: number, hh: number): void {
    ctx.save();
    ctx.shadowColor = '#ff2244'; ctx.shadowBlur = 16;
    const grad = ctx.createLinearGradient(-hw, 0, hw, 0);
    grad.addColorStop(0, 'rgba(170, 18, 40, 0.92)');
    grad.addColorStop(0.5, 'rgba(255, 40, 70, 0.92)');
    grad.addColorStop(1, 'rgba(170, 18, 40, 0.92)');
    ctx.fillStyle = grad;
    roundRect(ctx, -hw, -hh, hw * 2, hh * 2, 6); ctx.fill();
    ctx.shadowBlur = 0;
    const stripeW = (hw * 2) / 5;
    ctx.fillStyle = 'rgba(255, 180, 0, 0.2)';
    for (let i = 0; i < 3; i++) ctx.fillRect(-hw + stripeW * i * 2, -hh, stripeW, hh * 2);
    ctx.shadowColor = '#ff2244'; ctx.shadowBlur = 12;
    ctx.strokeStyle = '#ff6688'; ctx.lineWidth = 2.5;
    roundRect(ctx, -hw, -hh, hw * 2, hh * 2, 6); ctx.stroke();
    ctx.shadowColor = '#ffaa00'; ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.min(hw, hh) * 0.85}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('💣', 0, 0);
    ctx.restore();
  }

  private _drawSpring(ctx: CanvasRenderingContext2D, hw: number, hh: number): void {
    ctx.fillStyle = '#ffdd00';
    ctx.fillRect(-hw, hh * 0.3, hw * 2, hh * 0.7);
    ctx.strokeStyle = '#cc8800'; ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const y = -hh + (hh * 2 * 0.3 / 4) * (i + 0.5) + hh * 0.3;
      ctx.moveTo(-hw * 0.6, y); ctx.lineTo(hw * 0.6, y);
    }
    ctx.stroke();
  }

  private _drawEnemyFallback(ctx: CanvasRenderingContext2D, hw: number, hh: number, baseColor: string): void {
    const r = Math.min(hw, hh);
    ctx.fillStyle = baseColor;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.moveTo(-r * 0.4, -r * 0.3); ctx.lineTo(-r * 0.1, -r * 0.1); ctx.lineTo(-r * 0.4, 0); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(r * 0.4, -r * 0.3); ctx.lineTo(r * 0.1, -r * 0.1); ctx.lineTo(r * 0.4, 0); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(-r * 0.1, r * 0.2); ctx.lineTo(0, r * 0.4); ctx.lineTo(r * 0.1, r * 0.2); ctx.fill();
  }

  private _drawItemBubble(ctx: CanvasRenderingContext2D, hw: number, hh: number, typeLabel: string): void {
    const r = Math.min(hw, hh);
    const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    const color = typeLabel === 'GIANT' ? '255, 100, 100' : '255, 255, 100';
    grad.addColorStop(0, `rgba(${color}, 0.8)`);
    grad.addColorStop(0.7, `rgba(${color}, 0.3)`);
    grad.addColorStop(1, `rgba(${color}, 0.9)`);
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath(); ctx.ellipse(-r * 0.3, -r * 0.4, r * 0.4, r * 0.2, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.floor(r * 0.6)}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 4;
    ctx.fillText(typeLabel, 0, 0);
    ctx.shadowBlur = 0;
  }

  private _drawCracks(ctx: CanvasRenderingContext2D, hw: number, hh: number, level: number): void {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; ctx.lineWidth = 1.5;
    const count = Math.ceil(level * 4);
    for (let i = 0; i < count; i++) {
      const sx = Math.sin(i * 2.7) * hw * 0.8;
      const sy = Math.cos(i * 3.1) * hh * 0.8;
      const ex = sx + Math.cos(i * 1.3) * hw * 0.5;
      const ey = sy + Math.sin(i * 1.7) * hh * 0.5;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey);
      ctx.lineTo(ex + Math.sin(i * 4.3) * hw * 0.2, ey + Math.cos(i * 5.1) * hh * 0.2);
      ctx.stroke();
    }
  }

  drawParticles(pool: ParticlePool): void {
    const ctx = this.ctx;
    for (let i = 0; i < pool.particles.length; i++) {
      const p: Particle = pool.particles[i];
      if (!p.active) continue;
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      switch (p.type) {
        case 'circle':
          ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI * 2); ctx.fill(); break;
        case 'star':
          this._drawStar(ctx, p.size); break;
        case 'square':
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size); break;
      }
      ctx.restore();
    }
  }

  private _drawStar(ctx: CanvasRenderingContext2D, size: number): void {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const x = Math.cos(angle) * size;
      const y = Math.sin(angle) * size;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill();
  }

  drawComboText(x: number, y: number, bounceCount: number): void {
    if (bounceCount < 2) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.shadowColor = 'rgba(255, 215, 0, 0.5)'; ctx.shadowBlur = 10;
    ctx.fillText(`${bounceCount} COMBO!`, x, y - 40);
    ctx.restore();
  }

  drawNiceLanding(x: number, y: number, timer: number): void {
    if (timer <= 0) return;
    const ctx = this.ctx;
    ctx.save();
    const alpha = Math.min(1, timer * 2.5);
    const floatY = (1.5 - timer) * 25;
    const scale = 1.0 + Math.max(0, (0.5 - timer)) * 0.3;
    ctx.globalAlpha = alpha;
    ctx.translate(x, y - 55 - floatY);
    ctx.scale(scale, scale);
    ctx.shadowColor = '#ffde00'; ctx.shadowBlur = 22;
    ctx.fillStyle = '#ffde00';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('ナイス着地！🛬', 0, 0);
    ctx.restore();
  }

  setImage(key: string, img: HTMLCanvasElement | HTMLImageElement): void {
    this.images[key] = img;
  }

  destroy(): void {
    window.removeEventListener('resize', this._resizeHandler);
  }
}
