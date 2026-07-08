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

// ── 多重スクロール背景 ──
interface TDStar {
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
}
const starLayers: TDStar[][] = [];

interface TDCloud {
  x: number;
  y: number;
  w: number;
  h: number;
  speed: number;
  opacity: number;
}
const tdClouds: TDCloud[] = [];

function initStarsAndClouds(w: number, h: number) {
  if (starLayers.length > 0) return;
  // 3つのレイヤーで奥行きを表現
  for (let l = 0; l < 3; l++) {
    const layer: TDStar[] = [];
    const count = 12 + l * 8;
    const speed = 0.015 + l * 0.025;
    for (let i = 0; i < count; i++) {
      layer.push({
        x: Math.random() * w,
        y: Math.random() * h * 0.7,
        size: 0.5 + l * 0.6,
        speed: speed,
        opacity: 0.25 + l * 0.25,
      });
    }
    starLayers.push(layer);
  }

  // 雲の初期化
  for (let i = 0; i < 4; i++) {
    tdClouds.push({
      x: Math.random() * w,
      y: 10 + Math.random() * 70,
      w: 70 + Math.random() * 50,
      h: 16 + Math.random() * 10,
      speed: 0.03 + Math.random() * 0.04,
      opacity: 0.06 + Math.random() * 0.06,
    });
  }
}

function updateStarsAndClouds(w: number, dt: number) {
  // 星スクロール（左へ）
  for (const layer of starLayers) {
    for (const star of layer) {
      star.x -= star.speed * dt * 0.3;
      if (star.x < 0) star.x = w;
    }
  }

  // 雲スクロール（右へ）
  for (const cloud of tdClouds) {
    cloud.x += cloud.speed * dt * 0.3;
    if (cloud.x > w) cloud.x = -cloud.w;
  }
}

/** 星形パスを描画 */
function drawStarShape(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, points = 5, innerRatio = 0.5) {
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

    initStarsAndClouds(this.canvasW, this.canvasH);
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
        this.spawnDmgNum(unit.x * this.scale, this.groundY - 60, bombDmg, '#ffaa00');
        if (unit.hp <= 0) {
          unit.state = 'dead';
          unit.animTimer = 0;
        }
      }
      const baseDmg = 30;
      this.enemyBaseHp = Math.max(0, this.enemyBaseHp - baseDmg);
      this.spawnDmgNum(ENEMY_BASE_X * this.scale, this.groundY - 80, baseDmg, '#ffaa00');
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
      this.spawnDmgNum(ALLY_BASE_X * this.scale, this.groundY - 80, actual, '#00ffff');
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

    updateStarsAndClouds(this.canvasW, dt);

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
      if (dist < 6) {
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
    p.speed = 8.5;
    p.color = color;
    p.dmg = dmg;
    p.targetSide = targetSide;
  }

  public render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvasW, this.canvasH);

    // ── 空のファンタジーグラデーション ──
    const skyGrad = ctx.createLinearGradient(0, 0, 0, this.groundY);
    skyGrad.addColorStop(0, '#04051a');
    skyGrad.addColorStop(0.5, '#0c0f32');
    skyGrad.addColorStop(1, '#1b143e');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, this.canvasW, this.groundY);

    // ── 多重スクロール星空 ──
    for (let l = 0; l < starLayers.length; l++) {
      ctx.fillStyle = `rgba(255, 255, 255, ${l * 0.25 + 0.3})`;
      for (const star of starLayers[l]) {
        ctx.fillRect(star.x, star.y, star.size, star.size);
      }
    }

    // ── ふんわり流れる雲 ──
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    for (const cloud of tdClouds) {
      ctx.beginPath();
      ctx.ellipse(cloud.x + cloud.w / 2, cloud.y + cloud.h / 2, cloud.w / 2, cloud.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── 地面のグラデーション ──
    const groundGrad = ctx.createLinearGradient(0, this.groundY, 0, this.canvasH);
    groundGrad.addColorStop(0, '#1d2c14');
    groundGrad.addColorStop(0.3, '#141e0e');
    groundGrad.addColorStop(1, '#090c06');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, this.groundY, this.canvasW, this.canvasH - this.groundY);

    // 地面の境界線（光るネオンライン風）
    ctx.strokeStyle = 'rgba(68, 221, 102, 0.4)';
    ctx.shadowColor = 'rgba(68, 221, 102, 0.3)';
    ctx.shadowBlur = 8;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, this.groundY);
    ctx.lineTo(this.canvasW, this.groundY);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 自陣・敵陣の描画 (お城風)
    this.drawBase(ALLY_BASE_X * this.scale, this.groundY, this.allyBaseHp, this.allyBaseMaxHp, '#44dd66', '自陣');
    this.drawBase(ENEMY_BASE_X * this.scale, this.groundY, this.enemyBaseHp, this.enemyBaseMaxHp, '#ff4466', '敵陣');

    // ユニットの描画
    const allUnits = [...this.allyUnits, ...this.enemyUnits].sort((a, b) => a.x - b.x);
    for (const unit of allUnits) {
      this.drawUnit(unit);
    }

    // 発射物の描画 (星型・炎型・十字型)
    for (const proj of this.projectiles) {
      if (!proj.active) continue;
      ctx.save();
      ctx.fillStyle = proj.color;
      ctx.shadowColor = proj.color;
      ctx.shadowBlur = 10;
      
      ctx.translate(proj.x, proj.y);
      const angle = (Date.now() / 70) % (Math.PI * 2);
      ctx.rotate(angle);

      if (proj.color === '#88ff88') { // 回復弾
        ctx.fillRect(-2, -6, 4, 12);
        ctx.fillRect(-6, -2, 12, 4);
      } else if (proj.color === '#ff4466') { // 敵弾 (火の玉風)
        ctx.beginPath();
        ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 68, 102, 0.35)';
        ctx.beginPath();
        ctx.moveTo(-4, -2.5);
        ctx.lineTo(-12, 0);
        ctx.lineTo(-4, 2.5);
        ctx.fill();
      } else { // 味方通常弾 (星型)
        drawStarShape(ctx, 0, 0, 6.5, 4, 0.4);
        ctx.fill();
      }
      ctx.restore();
    }

    // ダメージテキストの描画 (ポップアップ・バウンド風)
    for (const d of this.dmgNums) {
      if (!d.active) continue;
      ctx.save();
      ctx.globalAlpha = Math.min(d.life / 0.3, 1);
      
      const angle = Math.sin(d.life * 12) * 0.08;
      ctx.translate(d.x, d.y);
      ctx.rotate(angle);
      
      ctx.font = `bold ${16 * this.scale}px 'Outfit', sans-serif`;
      ctx.fillStyle = d.color;
      ctx.shadowColor = d.color;
      ctx.shadowBlur = 6;
      ctx.textAlign = 'center';
      ctx.fillText(d.value.toString(), 0, 0);
      ctx.restore();
    }
  }

  private drawBase(x: number, y: number, hp: number, _maxHp: number, color: string, label: string) {
    const w = 48 * this.scale;
    const h = 75 * this.scale;
    const ctx = this.ctx;
    ctx.save();

    const isAlly = label === '自陣';

    if (hp > 0) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
    }

    // ベース石壁 (お城風)
    ctx.fillStyle = hp > 0 ? '#3f4257' : '#1f2029';
    ctx.strokeStyle = hp > 0 ? color : '#333';
    ctx.lineWidth = 2 * this.scale;
    
    ctx.beginPath();
    ctx.rect(x - w / 2, y - h, w, h);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // レンガ模様
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      const ly = y - (h / 5) * i;
      ctx.beginPath();
      ctx.moveTo(x - w / 2, ly);
      ctx.lineTo(x + w / 2, ly);
      ctx.stroke();
    }

    // お城の凸凹（銃眼）
    ctx.fillStyle = hp > 0 ? '#2d2f3e' : '#121319';
    const cw = w / 5;
    for (let i = 0; i < 5; i += 2) {
      ctx.fillRect(x - w / 2 + i * cw, y - h - 6 * this.scale, cw, 6 * this.scale);
    }

    // アーチ状の門
    ctx.fillStyle = hp > 0 ? '#ffea00' : '#111';
    if (!isAlly) ctx.fillStyle = hp > 0 ? '#ff4466' : '#111';
    ctx.beginPath();
    ctx.arc(x, y, 12 * this.scale, Math.PI, 0);
    ctx.fill();
    
    ctx.strokeStyle = hp > 0 ? color : '#333';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 12 * this.scale, Math.PI, 0);
    ctx.stroke();

    // 旗の描画
    if (hp > 0) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y - h - 6 * this.scale);
      ctx.lineTo(x, y - h - 22 * this.scale);
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.beginPath();
      const flagDir = isAlly ? -1 : 1;
      ctx.moveTo(x, y - h - 22 * this.scale);
      ctx.lineTo(x + 16 * this.scale * flagDir, y - h - 17 * this.scale);
      ctx.lineTo(x, y - h - 12 * this.scale);
      ctx.fill();

      // 旗のドットマーク
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x + 6 * this.scale * flagDir, y - h - 17 * this.scale, 2.5 * this.scale, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 0.85;
    ctx.font = `bold ${11 * this.scale}px 'Outfit', sans-serif`;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y + 16 * this.scale);
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

    // うっすら影の描画
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(x, this.groundY, unitSize * 0.45, 4 * this.scale, 0, 0, Math.PI * 2);
    ctx.fill();

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
