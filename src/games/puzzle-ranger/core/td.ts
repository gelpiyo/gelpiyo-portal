// ============================================
// td.ts - Tower Defense Engine (Refactored to Class)
// ============================================

import type { ColorType, EnemyType, Role, GameCallbacks } from './types';
import { UNIT_TYPES, ENEMY_TYPES, WAVES } from './types';
import { playSpawnSound, playHitSound, playWaveClearSound, playGameOverSound } from './audio';

const FIELD_WIDTH = 600;
const ALLY_BASE_X = 25;
const ENEMY_BASE_X = 575;
const GROUND_Y_RATIO = 0.72;

export interface Unit {
  side: 'ally' | 'enemy';
  color?: ColorType;
  typeName?: EnemyType;
  x: number;
  rank: number;
  hp: number;
  maxHp: number;
  atk: number;
  speed: number;
  range: number;
  atkSpeed: number;
  atkTimer: number;
  role?: Role;
  imgKey?: string;
  state: 'moving' | 'attacking' | 'dead';
  animFrame: number;
  animTimer: number;
  bobOffset: number;
}

interface DmgNum {
  active: boolean;
  x: number;
  y: number;
  value: number;
  life: number;
  color: string;
}

interface Projectile {
  active: boolean;
  x: number;
  y: number;
  tx: number;
  ty: number;
  speed: number;
  color: string;
  dmg: number;
  targetSide: string;
}

export class TDEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private charImages: Record<string, HTMLCanvasElement | HTMLImageElement>;
  private callbacks: GameCallbacks;

  private canvasW = 0;
  private canvasH = 0;
  private groundY = 0;
  private scale = 1;

  private allyUnits: Unit[] = [];
  private enemyUnits: Unit[] = [];

  private allyBaseHp = 500;
  private allyBaseMaxHp = 500;
  private enemyBaseHp = 500;
  private enemyBaseMaxHp = 500;

  private currentWave = 0;
  private waveState: 'waiting' | 'spawning' | 'fighting' | 'cleared' | 'gameover' = 'waiting';
  private waveSpawnTimers: Array<{ type: EnemyType; remaining: number; interval: number; timer: number; diffScale: number }> = [];
  
  private continuousSpawnTimer = 0;
  private continuousSpawnInterval = 3000;
  private continuousSpawnDiffScale = 1;

  private dmgNums: DmgNum[] = [];
  private projectiles: Projectile[] = [];

  constructor(canvas: HTMLCanvasElement, images: Record<string, HTMLCanvasElement | HTMLImageElement>, callbacks: GameCallbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.charImages = images;
    this.callbacks = callbacks;

    const MAX_DMG_NUMS = 30;
    for (let i = 0; i < MAX_DMG_NUMS; i++) {
      this.dmgNums.push({ active: false, x: 0, y: 0, value: 0, life: 0, color: '' });
    }
    const MAX_PROJECTILES = 20;
    for (let i = 0; i < MAX_PROJECTILES; i++) {
      this.projectiles.push({ active: false, x: 0, y: 0, tx: 0, ty: 0, speed: 0, color: '', dmg: 0, targetSide: '' });
    }

    this.resize();
    this.reset();
  }

  public destroy() {
    // cleanup if needed
  }

  public resize() {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    if (!rect) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvasW = Math.floor(rect.width * dpr);
    this.canvasH = Math.floor(rect.height * dpr);
    this.canvas.width = this.canvasW;
    this.canvas.height = this.canvasH;

    this.scale = this.canvasW / FIELD_WIDTH;
    this.groundY = this.canvasH * GROUND_Y_RATIO;
  }

  public reset() {
    this.allyUnits = [];
    this.enemyUnits = [];
    this.allyBaseHp = 500;
    this.allyBaseMaxHp = 500;
    this.enemyBaseHp = 500;
    this.enemyBaseMaxHp = 500;
    this.currentWave = 0;
    this.waveState = 'waiting';
    this.waveSpawnTimers = [];

    for (const d of this.dmgNums) d.active = false;
    for (const p of this.projectiles) p.active = false;
  }

  public startWave(waveNum: number) {
    this.currentWave = waveNum;
    this.allyUnits = [];
    this.enemyUnits = [];
    for (const d of this.dmgNums) d.active = false;
    for (const p of this.projectiles) p.active = false;

    this.allyBaseHp = this.allyBaseMaxHp;
    const hpMul = 1 + (waveNum - 1) * 0.3;
    this.enemyBaseMaxHp = Math.floor(500 * hpMul);
    this.enemyBaseHp = this.enemyBaseMaxHp;

    this.waveState = 'spawning';
    this.waveSpawnTimers = [];

    const waveIdx = Math.min(waveNum - 1, WAVES.length - 1);
    const waveDef = WAVES[waveIdx];
    const diffScale = waveNum > WAVES.length ? 1 + (waveNum - WAVES.length) * 0.2 : 1;

    for (const group of waveDef.enemies) {
      const count = Math.ceil(group.count * diffScale);
      const interval = Math.max(group.interval / diffScale, 400);
      this.waveSpawnTimers.push({
        type: group.type,
        remaining: count,
        interval,
        timer: 1000,
        diffScale
      });
    }

    this.continuousSpawnDiffScale = diffScale;
    this.continuousSpawnInterval = Math.max(3500 - waveNum * 200, 1200);
    this.continuousSpawnTimer = 5000;

    this.callbacks.onHpUpdate?.(this.allyBaseHp, this.allyBaseMaxHp, this.enemyBaseHp, this.enemyBaseMaxHp);
  }

  public getWaveState() {
    return this.waveState;
  }

  public activateSkill(skillType: 'bomb' | 'heal') {
    if (skillType === 'bomb') {
      const bombDmg = 80;
      for (const unit of this.enemyUnits) {
        if (unit.state === 'dead') continue;
        unit.hp -= bombDmg;
        this.spawnDmgNum(unit.x * this.scale, this.groundY - 60, bombDmg, '#ff6600');
        if (unit.hp <= 0) {
          unit.state = 'dead';
          unit.animTimer = 0;
        }
      }
      const baseDmg = 30;
      this.enemyBaseHp = Math.max(0, this.enemyBaseHp - baseDmg);
      this.spawnDmgNum(ENEMY_BASE_X * this.scale, this.groundY - 80, baseDmg, '#ff6600');
      this.callbacks.onHpUpdate?.(this.allyBaseHp, this.allyBaseMaxHp, this.enemyBaseHp, this.enemyBaseMaxHp);
      
      if (this.enemyBaseHp <= 0) {
        this.waveState = 'cleared';
        this.callbacks.onWaveCleared?.(this.currentWave, 0); // score added by GameEngine
      }
    } else if (skillType === 'heal') {
      const healAmt = Math.floor(this.allyBaseMaxHp * 0.15);
      const prev = this.allyBaseHp;
      this.allyBaseHp = Math.min(this.allyBaseMaxHp, this.allyBaseHp + healAmt);
      const actual = this.allyBaseHp - prev;
      this.spawnDmgNum(ALLY_BASE_X * this.scale, this.groundY - 80, actual, '#00ff88');
      this.callbacks.onHpUpdate?.(this.allyBaseHp, this.allyBaseMaxHp, this.enemyBaseHp, this.enemyBaseMaxHp);
    }
  }

  public spawnAlly(color: ColorType, comboLevel: number, power: number) {
    const type = UNIT_TYPES[color];
    if (!type) return;

    const comboMul = 1 + comboLevel * 0.15;
    const powerMul = 1 + (power - 1) * 0.2;
    const rank = Math.floor(Math.random() * 3);

    const unit: Unit = {
      side: 'ally',
      color,
      x: ALLY_BASE_X + 30 + Math.random() * 20,
      rank,
      hp: Math.floor(type.hp * comboMul * powerMul),
      maxHp: Math.floor(type.hp * comboMul * powerMul),
      atk: Math.floor(type.atk * comboMul * powerMul),
      speed: type.speed,
      range: type.range,
      atkSpeed: type.atkSpeed,
      atkTimer: 0,
      role: type.role,
      state: 'moving',
      animFrame: 0,
      animTimer: 0,
      bobOffset: Math.random() * Math.PI * 2,
    };

    this.allyUnits.push(unit);
    playSpawnSound();
  }

  private spawnEnemy(typeName: EnemyType, diffScale = 1) {
    const type = ENEMY_TYPES[typeName];
    if (!type) return;

    const rank = Math.floor(Math.random() * 3);

    const unit: Unit = {
      side: 'enemy',
      typeName,
      x: ENEMY_BASE_X - 30 - Math.random() * 20,
      rank,
      hp: Math.floor(type.hp * diffScale),
      maxHp: Math.floor(type.hp * diffScale),
      atk: Math.floor(type.atk * diffScale),
      speed: type.speed,
      range: type.range,
      atkSpeed: type.atkSpeed,
      atkTimer: 0,
      imgKey: type.imgKey,
      state: 'moving',
      animFrame: 0,
      animTimer: 0,
      bobOffset: Math.random() * Math.PI * 2,
    };

    this.enemyUnits.push(unit);
  }

  public update(dt: number) {
    if (this.waveState === 'waiting' || this.waveState === 'cleared' || this.waveState === 'gameover') return;

    if (this.waveState === 'spawning') {
      let allDone = true;
      for (const timer of this.waveSpawnTimers) {
        if (timer.remaining <= 0) continue;
        allDone = false;
        timer.timer -= dt;
        if (timer.timer <= 0) {
          this.spawnEnemy(timer.type, timer.diffScale);
          timer.remaining--;
          timer.timer = timer.interval;
        }
      }
      if (allDone) this.waveState = 'fighting';
    }

    if (this.waveState === 'fighting' || this.waveState === 'spawning') {
      this.continuousSpawnTimer -= dt;
      if (this.continuousSpawnTimer <= 0) {
        const roll = Math.random();
        let enemyType: EnemyType = 'waru';
        if (this.currentWave >= 6 && roll < 0.15) enemyType = 'mecha';
        else if (this.currentWave >= 3 && roll < 0.4) enemyType = 'kuro';
        this.spawnEnemy(enemyType, this.continuousSpawnDiffScale);
        this.continuousSpawnTimer = this.continuousSpawnInterval;
      }
    }

    this.updateUnits(this.allyUnits, this.enemyUnits, 1, dt);
    this.updateUnits(this.enemyUnits, this.allyUnits, -1, dt);

    for (const proj of this.projectiles) {
      if (!proj.active) continue;
      const dx = proj.tx - proj.x;
      const dy = proj.ty - proj.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 5) {
        proj.active = false;
        continue;
      }
      const speed = proj.speed * dt / 16;
      proj.x += (dx / dist) * speed;
      proj.y += (dy / dist) * speed;
    }

    // Base damage logic
    for (const unit of this.allyUnits) {
      if (unit.state === 'dead') continue;
      if (unit.x * this.scale >= (ENEMY_BASE_X - 20) * this.scale) {
        this.enemyBaseHp -= unit.atk;
        unit.hp = 0;
        unit.state = 'dead';
        this.spawnDmgNum(unit.x * this.scale, this.groundY - 40, unit.atk, '#ff4466');
        playHitSound();
      }
    }
    for (const unit of this.enemyUnits) {
      if (unit.state === 'dead') continue;
      if (unit.x * this.scale <= (ALLY_BASE_X + 20) * this.scale) {
        this.allyBaseHp -= unit.atk;
        unit.hp = 0;
        unit.state = 'dead';
        this.spawnDmgNum(unit.x * this.scale, this.groundY - 40, unit.atk, '#ff8888');
        playHitSound();
      }
    }

    this.allyBaseHp = Math.max(0, this.allyBaseHp);
    this.enemyBaseHp = Math.max(0, this.enemyBaseHp);
    this.callbacks.onHpUpdate?.(this.allyBaseHp, this.allyBaseMaxHp, this.enemyBaseHp, this.enemyBaseMaxHp);

    this.allyUnits = this.allyUnits.filter(u => u.state !== 'dead' || u.animTimer < 500);
    this.enemyUnits = this.enemyUnits.filter(u => u.state !== 'dead' || u.animTimer < 500);

    for (const u of [...this.allyUnits, ...this.enemyUnits]) {
      if (u.state === 'dead') u.animTimer += dt;
    }

    for (const d of this.dmgNums) {
      if (!d.active) continue;
      d.life -= dt / 1000;
      d.y -= 0.8;
      if (d.life <= 0) d.active = false;
    }

    if (this.enemyBaseHp <= 0) {
      this.waveState = 'cleared';
      playWaveClearSound();
      this.callbacks.onWaveCleared?.(this.currentWave, 0);
    } else if (this.allyBaseHp <= 0) {
      this.waveState = 'gameover';
      playGameOverSound();
      this.callbacks.onGameOver?.(this.currentWave, 0);
    }
  }

  private updateUnits(units: Unit[], opponents: Unit[], direction: number, dt: number) {
    for (const unit of units) {
      if (unit.state === 'dead') continue;

      let target: Unit | null = null;
      let minDist = Infinity;
      for (const opp of opponents) {
        if (opp.state === 'dead') continue;
        const dist = Math.abs(unit.x - opp.x);
        if (dist < minDist) {
          minDist = dist;
          target = opp;
        }
      }

      if (unit.role === 'healer') {
        unit.atkTimer -= dt;
        if (unit.atkTimer <= 0) {
          let healTarget: Unit | null = null;
          let lowestRatio = 1;
          const friendlyUnits = direction === 1 ? this.allyUnits : this.enemyUnits;
          for (const ally of friendlyUnits) {
            if (ally === unit || ally.state === 'dead') continue;
            const ratio = ally.hp / ally.maxHp;
            if (ratio < lowestRatio) {
              lowestRatio = ratio;
              healTarget = ally;
            }
          }
          if (healTarget && lowestRatio < 0.9) {
            const healAmt = unit.atk * 2;
            healTarget.hp = Math.min(healTarget.maxHp, healTarget.hp + healAmt);
            this.spawnDmgNum(healTarget.x * this.scale, this.groundY - 60, healAmt, '#88ff88');
            this.spawnProjectile(unit.x * this.scale, this.groundY - 25, healTarget.x * this.scale, this.groundY - 25, '#88ff88', 0, 'none');
            unit.atkTimer = unit.atkSpeed;
          }
        }
        if (!target || minDist > unit.range * 3) {
          unit.x += unit.speed * direction * dt / 16;
          unit.state = 'moving';
        }
        unit.animTimer += dt;
        continue;
      }

      if (target && minDist <= unit.range) {
        unit.state = 'attacking';
        unit.atkTimer -= dt;
        if (unit.atkTimer <= 0) {
          if (unit.range > 50) {
            this.spawnProjectile(
              unit.x * this.scale, this.groundY - 25,
              target.x * this.scale, this.groundY - 25,
              unit.side === 'ally' ? '#44dd66' : '#ff4466',
              unit.atk,
              unit.side === 'ally' ? 'enemy' : 'ally'
            );
          }
          target.hp -= unit.atk;
          const dmgColor = unit.side === 'ally' ? '#ffcc22' : '#ff4466';
          this.spawnDmgNum(target.x * this.scale, this.groundY - 50 - Math.random() * 20, unit.atk, dmgColor);
          playHitSound();

          if (target.hp <= 0) {
            target.state = 'dead';
            target.animTimer = 0;
          }
          unit.atkTimer = unit.atkSpeed;
        }
      } else {
        unit.x += unit.speed * direction * dt / 16;
        unit.state = 'moving';
      }
      unit.animTimer += dt;
    }
  }

  private spawnDmgNum(x: number, y: number, value: number, color: string) {
    const d = this.dmgNums.find(d => !d.active);
    if (!d) return;
    d.active = true;
    d.x = x;
    d.y = y;
    d.value = value;
    d.life = 0.8;
    d.color = color;
  }

  private spawnProjectile(x: number, y: number, tx: number, ty: number, color: string, dmg: number, targetSide: string) {
    const p = this.projectiles.find(p => !p.active);
    if (!p) return;
    p.active = true;
    p.x = x;
    p.y = y;
    p.tx = tx;
    p.ty = ty;
    p.speed = 8;
    p.color = color;
    p.dmg = dmg;
    p.targetSide = targetSide;
  }

  public render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvasW, this.canvasH);

    const skyGrad = ctx.createLinearGradient(0, 0, 0, this.groundY);
    skyGrad.addColorStop(0, '#0a1628');
    skyGrad.addColorStop(0.6, '#152040');
    skyGrad.addColorStop(1, '#1a2848');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, this.canvasW, this.groundY);

    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    const starSeed = 42;
    for (let i = 0; i < 30; i++) {
      const sx = ((starSeed * (i + 1) * 7) % 1000) / 1000 * this.canvasW;
      const sy = ((starSeed * (i + 1) * 13) % 1000) / 1000 * this.groundY * 0.6;
      const ss = 1 + (i % 3);
      ctx.fillRect(sx, sy, ss, ss);
    }

    const groundGrad = ctx.createLinearGradient(0, this.groundY, 0, this.canvasH);
    groundGrad.addColorStop(0, '#2a3a20');
    groundGrad.addColorStop(0.3, '#1a2a15');
    groundGrad.addColorStop(1, '#0a1508');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, this.groundY, this.canvasW, this.canvasH - this.groundY);

    ctx.strokeStyle = 'rgba(100,160,80,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, this.groundY);
    ctx.lineTo(this.canvasW, this.groundY);
    ctx.stroke();

    this.drawBase(ALLY_BASE_X * this.scale, this.groundY, this.allyBaseHp, this.allyBaseMaxHp, '#44dd66', '自陣');
    this.drawBase(ENEMY_BASE_X * this.scale, this.groundY, this.enemyBaseHp, this.enemyBaseMaxHp, '#ff4466', '敵陣');

    const allUnits = [...this.allyUnits, ...this.enemyUnits].sort((a, b) => a.x - b.x);
    for (const unit of allUnits) {
      this.drawUnit(unit);
    }

    for (const proj of this.projectiles) {
      if (!proj.active) continue;
      ctx.save();
      ctx.fillStyle = proj.color;
      ctx.shadowColor = proj.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const d of this.dmgNums) {
      if (!d.active) continue;
      ctx.save();
      ctx.globalAlpha = Math.min(d.life / 0.3, 1);
      ctx.font = `bold ${14 * this.scale}px 'Outfit', sans-serif`;
      ctx.fillStyle = d.color;
      ctx.shadowColor = d.color;
      ctx.shadowBlur = 4;
      ctx.textAlign = 'center';
      ctx.fillText(d.value.toString(), d.x, d.y);
      ctx.restore();
    }
  }

  private drawBase(x: number, y: number, hp: number, _maxHp: number, color: string, label: string) {
    const w = 36 * this.scale;
    const h = 60 * this.scale;
    const ctx = this.ctx;
    ctx.save();

    ctx.fillStyle = hp > 0 ? color : '#333';
    ctx.globalAlpha = hp > 0 ? 0.8 : 0.3;
    ctx.fillRect(x - w / 2, y - h, w, h);

    if (hp > 0) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y - h);
      ctx.lineTo(x, y - h - 15 * this.scale);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, y - h - 15 * this.scale);
      ctx.lineTo(x + 12 * this.scale, y - h - 10 * this.scale);
      ctx.lineTo(x, y - h - 5 * this.scale);
      ctx.fill();
    }

    ctx.globalAlpha = 0.6;
    ctx.font = `bold ${8 * this.scale}px 'Outfit', sans-serif`;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y + 12 * this.scale);
    ctx.restore();
  }

  private drawUnit(unit: Unit) {
    const ctx = this.ctx;
    const x = unit.x * this.scale;
    const rank = unit.rank ?? 0;
    const rankScale = 1 - rank * 0.12;
    const rankYOffset = -rank * 10 * this.scale;
    const unitSize = 42 * this.scale * rankScale;
    const bobY = Math.sin(unit.animTimer / 300 + unit.bobOffset) * 3 * this.scale;
    const y = this.groundY - unitSize / 2 + bobY + rankYOffset;

    ctx.save();

    if (unit.state === 'dead') {
      const deathProgress = Math.min(unit.animTimer / 500, 1);
      ctx.globalAlpha = 1 - deathProgress;
      ctx.translate(x, y);
      ctx.scale(1, 1 - deathProgress * 0.5);
      ctx.translate(-x, -y);
    }

    const imgKey = unit.side === 'ally' ? `ranger_${unit.color}` : (unit.imgKey || '');
    const img = this.charImages[imgKey];

    if (img) {
      ctx.save();
      if (unit.side === 'enemy') {
        ctx.translate(x, 0);
        ctx.scale(-1, 1);
        ctx.translate(-x, 0);
      }
      ctx.drawImage(img, x - unitSize / 2, y - unitSize / 2, unitSize, unitSize);
      ctx.restore();
    } else {
      const color = unit.side === 'ally' && unit.color
        ? { red: '#ff4466', blue: '#4488ff', green: '#44dd66', yellow: '#ffcc22', pink: '#ff88cc' }[unit.color]
        : '#888';
      ctx.fillStyle = color || '#888';
      ctx.shadowColor = color || '#888';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(x, y, unitSize / 2 * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x - 4 * this.scale, y - 3 * this.scale, 3 * this.scale, 0, Math.PI * 2);
      ctx.arc(x + 4 * this.scale, y - 3 * this.scale, 3 * this.scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(x - 3 * this.scale, y - 3 * this.scale, 1.5 * this.scale, 0, Math.PI * 2);
      ctx.arc(x + 5 * this.scale, y - 3 * this.scale, 1.5 * this.scale, 0, Math.PI * 2);
      ctx.fill();
    }

    if (unit.state !== 'dead') {
      const hpW = unitSize * 0.8;
      const hpH = 3 * this.scale;
      const hpX = x - hpW / 2;
      const hpY = y - unitSize / 2 - 5 * this.scale;
      const hpRatio = Math.max(0, unit.hp / unit.maxHp);

      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(hpX, hpY, hpW, hpH);

      const hpColor = hpRatio > 0.5 ? '#44dd66' : hpRatio > 0.25 ? '#ffcc22' : '#ff4466';
      ctx.fillStyle = hpColor;
      ctx.fillRect(hpX, hpY, hpW * hpRatio, hpH);
    }

    if (unit.state === 'attacking' && unit.atkTimer > unit.atkSpeed - 100) {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      const dir = unit.side === 'ally' ? 1 : -1;
      ctx.arc(x + dir * unitSize / 2, y, 5 * this.scale, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
