// ============================================
// entities.ts — ゲームエンティティ定義
// ============================================

import type { TrailPoint, ObjType, AABB, Particle, ParticleEmitOptions } from './types';
import { OBJ_TYPE, OBJ_DEFAULTS, GRAVITY, FRICTION, GROUND_FRICTION, STOP_THRESHOLD, MAX_VELOCITY } from './types';
import { calcSquashStretch } from './physics';

// ============================================
// ゲルぴよ（プレイヤー弾）
// ============================================
export class Piyo {
  x: number;
  y: number;
  radius: number;
  imageKey: string;
  vx = 0;
  vy = 0;
  isGiant = false;
  isClone = false;
  launched = false;
  stopped = false;
  active = true;
  scaleX = 1;
  scaleY = 1;
  rotation = 0;
  squashTime = -1;
  squashImpact = 0;
  alpha = 1;
  trailPoints: TrailPoint[] = [];
  bounceCount = 0;
  comboTimer = 0;
  dragOffsetX = 0;
  dragOffsetY = 0;
  originX: number;
  originY: number;
  isDragging = false;
  restTimer = 0;
  isClearing = false;
  _lastHighVx = 0;
  _lastHighVy = 0;

  constructor(x: number, y: number, radius: number, imageKey: string) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.imageKey = imageKey || 'gelpiyo';
    this.originX = x;
    this.originY = y;
  }

  update(dt: number, worldWidth: number, worldHeight: number): void {
    if (!this.active || this.stopped || !this.launched) return;

    this.vy += GRAVITY * dt;
    this.vx *= FRICTION;
    this.vy *= FRICTION;

    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (speed > MAX_VELOCITY) {
      const ratio = MAX_VELOCITY / speed;
      this.vx *= ratio;
      this.vy *= ratio;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (speed > 30) {
      this.rotation += (this.vx > 0 ? 1 : -1) * speed * dt * 0.003;
    }

    if (speed > 50) {
      this.trailPoints.push({ x: this.x, y: this.y, alpha: 1 });
      if (this.trailPoints.length > 30) this.trailPoints.shift();
    }

    for (let i = this.trailPoints.length - 1; i >= 0; i--) {
      this.trailPoints[i].alpha -= dt * 2;
      if (this.trailPoints[i].alpha <= 0) this.trailPoints.splice(i, 1);
    }

    this._handleWorldBounds(worldWidth, worldHeight);

    if (this.squashTime >= 0) {
      this.squashTime += dt;
      const ss = calcSquashStretch(this.squashImpact, this.squashTime);
      this.scaleX = ss.scaleX;
      this.scaleY = ss.scaleY;
      if (this.squashTime > 0.5) {
        this.scaleX = 1;
        this.scaleY = 1;
        this.squashTime = -1;
      }
    }

    if (this.comboTimer > 0) this.comboTimer -= dt;

    if (speed < STOP_THRESHOLD) {
      this.restTimer += dt;
      if (this.restTimer > 0.5) {
        this.vx = 0;
        this.vy = 0;
        this.stopped = true;
      }
    } else {
      this.restTimer = 0;
    }
  }

  private _handleWorldBounds(worldWidth: number, worldHeight: number): void {
    if (this.y + this.radius > worldHeight) {
      this.y = worldHeight - this.radius;
      this.vy = -this.vy * (this.isClearing ? 0.2 : 0.85);
      this.vx *= GROUND_FRICTION;
      this._triggerBounce(Math.abs(this.vy));
    }
    if (this.x - this.radius < 0) {
      this.x = this.radius;
      this.vx = -this.vx * 0.9;
      this._triggerBounce(Math.abs(this.vx));
    }
    if (this.x + this.radius > worldWidth) {
      this.x = worldWidth - this.radius;
      this.vx = -this.vx * 0.9;
      this._triggerBounce(Math.abs(this.vx));
    }
    if (this.y - this.radius < 0) {
      this.y = this.radius;
      this.vy = -this.vy * 0.85;
      this._triggerBounce(Math.abs(this.vy));
    }
  }

  private _triggerBounce(impact: number): void {
    if (impact > 30) {
      this.squashTime = 0;
      this.squashImpact = impact;
      this.bounceCount++;
      this.comboTimer = 2.0;
    }
  }

  onBounce(impact: number): void {
    this._triggerBounce(impact);
  }

  launch(vx: number, vy: number): void {
    this.vx = vx;
    this.vy = vy;
    this.launched = true;
    this.isDragging = false;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
  }

  reset(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.originX = x;
    this.originY = y;
    this.vx = 0;
    this.vy = 0;
    this.launched = false;
    this.stopped = false;
    this.active = true;
    this.scaleX = 1;
    this.scaleY = 1;
    this.rotation = 0;
    this.squashTime = -1;
    this.alpha = 1;
    this.bounceCount = 0;
    this.comboTimer = 0;
    this.trailPoints.length = 0;
    this.isDragging = false;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
  }
}

// ============================================
// ゲームオブジェクト（障害物・敵）
// ============================================
export class GameObject {
  x: number;
  y: number;
  width: number;
  height: number;
  type: ObjType;
  hp: number;
  maxHp: number;
  restitution: number;
  scoreValue: number;
  color: string;
  breakable: boolean;
  imageKey: string | null;
  alive = true;
  shakeTime = -1;
  shakeIntensity = 0;
  alpha = 1;
  crackLevel = 0;
  collisionRadius: number;
  wobblePhase: number;
  isItem = false;

  constructor(x: number, y: number, width: number, height: number, type: ObjType, options: { imageKey?: string | null; hp?: number } = {}) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.type = type;

    const defaults = OBJ_DEFAULTS[type] || OBJ_DEFAULTS[OBJ_TYPE.WOOD];
    this.hp = options.hp ?? defaults.hp;
    this.maxHp = this.hp;
    this.restitution = defaults.restitution;
    this.scoreValue = defaults.scoreValue;
    this.color = defaults.color;
    this.breakable = defaults.breakable;
    this.imageKey = options.imageKey || null;
    this.collisionRadius = Math.max(width, height) / 2;
    this.wobblePhase = Math.random() * Math.PI * 2;
  }

  takeDamage(amount: number = 1): boolean {
    if (!this.breakable || !this.alive) return false;
    this.hp -= amount;
    this.crackLevel = 1 - (this.hp / this.maxHp);
    this.shakeTime = 0;
    this.shakeIntensity = 6;
    if (this.hp <= 0) {
      this.alive = false;
      return true;
    }
    return false;
  }

  update(dt: number): void {
    if (this.shakeTime >= 0) {
      this.shakeTime += dt;
      if (this.shakeTime > 0.3) {
        this.shakeTime = -1;
        this.shakeIntensity = 0;
      }
    }
    if (this.type === OBJ_TYPE.ENEMY && this.alive) {
      this.wobblePhase += dt * 3;
    }
    if (!this.alive) {
      this.alpha -= dt * 3;
      if (this.alpha < 0) this.alpha = 0;
    }
  }

  getShakeOffset(): { x: number; y: number } {
    if (this.shakeTime < 0) return { x: 0, y: 0 };
    const decay = 1 - (this.shakeTime / 0.3);
    const intensity = this.shakeIntensity * decay;
    return {
      x: (Math.random() - 0.5) * intensity * 2,
      y: (Math.random() - 0.5) * intensity * 2,
    };
  }

  getWobbleOffset(): number {
    if (this.type !== OBJ_TYPE.ENEMY) return 0;
    return Math.sin(this.wobblePhase) * 2;
  }

  getAABB(): AABB {
    return { x: this.x, y: this.y, w: this.width, h: this.height };
  }

  getCenterX(): number { return this.x + this.width / 2; }
  getCenterY(): number { return this.y + this.height / 2; }
}

// ============================================
// パーティクルプール
// ============================================
const PARTICLE_POOL_SIZE = 200;

function lightenColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.min(255, r + 80)},${Math.min(255, g + 80)},${Math.min(255, b + 80)})`;
}

export class ParticlePool {
  particles: Particle[];

  constructor() {
    this.particles = new Array(PARTICLE_POOL_SIZE);
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      this.particles[i] = {
        active: false, x: 0, y: 0, vx: 0, vy: 0,
        life: 0, maxLife: 0, size: 0, color: '#fff',
        type: 'circle', rotation: 0, rotationSpeed: 0, gravity: true, alpha: 1,
      };
    }
  }

  emit(x: number, y: number, count: number, options: ParticleEmitOptions = {}): void {
    let emitted = 0;
    for (let i = 0; i < PARTICLE_POOL_SIZE && emitted < count; i++) {
      const p = this.particles[i];
      if (p.active) continue;

      p.active = true;
      p.x = x + (Math.random() - 0.5) * (options.spread || 10);
      p.y = y + (Math.random() - 0.5) * (options.spread || 10);

      const angle = options.angle ?? Math.random() * Math.PI * 2;
      const angleVariance = options.angleVariance ?? Math.PI * 2;
      const dir = angle + (Math.random() - 0.5) * angleVariance;
      const speed = (options.speed ?? 200) * (0.5 + Math.random() * 0.5);

      p.vx = Math.cos(dir) * speed;
      p.vy = Math.sin(dir) * speed;
      p.life = 0;
      p.maxLife = (options.life ?? 0.8) * (0.5 + Math.random() * 0.5);
      p.size = (options.size ?? 4) * (0.5 + Math.random() * 0.5);
      p.color = options.colors
        ? options.colors[Math.floor(Math.random() * options.colors.length)]
        : (options.color || '#ffffff');
      p.type = options.type || 'circle';
      p.rotation = Math.random() * Math.PI * 2;
      p.rotationSpeed = (Math.random() - 0.5) * 10;
      p.gravity = options.gravity !== false;
      p.alpha = 1;
      emitted++;
    }
  }

  emitBounce(x: number, y: number, impact: number): void {
    const count = Math.min(Math.floor(impact / 30), 15);
    this.emit(x, y, count, {
      speed: impact * 0.5, life: 0.6, size: 3,
      colors: ['#ffd700', '#ff6b9d', '#00d4ff', '#00ff88', '#b44dff'],
      type: 'star', gravity: true,
    });
  }

  emitDestroy(x: number, y: number, color: string): void {
    this.emit(x, y, 20, {
      speed: 300, life: 0.8, size: 5,
      colors: [color, '#ffffff', lightenColor(color)],
      type: 'square', spread: 20, gravity: true,
    });
  }

  emitExplosion(x: number, y: number): void {
    this.emit(x, y, 40, {
      speed: 500, life: 1.0, size: 8,
      colors: ['#ff4444', '#ff8800', '#ffdd00', '#ffffff'],
      type: 'circle', spread: 30, gravity: false,
    });
  }

  update(dt: number): void {
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) { p.active = false; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.gravity) p.vy += GRAVITY * 0.5 * dt;
      p.vx *= 0.98;
      p.vy *= 0.98;
      p.rotation += p.rotationSpeed * dt;
      p.alpha = 1 - (p.life / p.maxLife);
    }
  }
}
