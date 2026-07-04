// ============================================
// game.ts — ゲームループ＆ステージ管理
// ============================================

import { Piyo, GameObject, ParticlePool } from './entities';
import { circleVsRect, resolveCollision } from './physics';
import { Slingshot } from './slingshot';
import { Camera, Renderer } from './renderer';
import { STAGES, WORLDS } from './stages';
import {
  playSfxBounce, playSfxLaunch, playSfxBreak,
  playSfxExplosion, playSfxClear, playSfxFail,
} from './audio';
import {
  STATE, OBJ_TYPE, WORLD_WIDTH, WORLD_HEIGHT, GROUND_Y,
  TNT_EXPLOSION_RADIUS, TNT_EXPLOSION_DAMAGE,
} from './types';
import type { GameState, WorldData, ObjType } from './types';

export interface GameCallbacks {
  onScoreUpdate?: (score: number) => void;
  onPiyoCountUpdate?: (count: number) => void;
  onStageComplete?: (score: number, stars: number) => void;
  onStageFailed?: (score: number) => void;
  onWaveUpdate?: (wave: number) => void;
  onEndlessGameOver?: (score: number, wave: number) => void;
}

export class Game {
  renderer: Renderer;
  camera: Camera;
  particles: ParticlePool;
  slingshot: Slingshot | null = null;

  state: GameState = STATE.READY;
  stageId: string | null = null;
  stageData: (typeof STAGES)[string] | null = null;
  worldData: WorldData | null = null;

  piyos: Piyo[] = [];
  currentPiyoIndex = 0;
  objects: GameObject[] = [];
  enemies: GameObject[] = [];

  score = 0;
  shotsRemaining = 0;
  settleTimer = 0;

  niceLandingX = 0;
  niceLandingY = 0;
  niceLandingTimer = 0;

  callbacks: GameCallbacks = {};

  isEndless = false;
  wave = 0;

  private _prevState: GameState = STATE.READY;
  private _lastTime = 0;
  private _running = false;
  private _rafId: number | null = null;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
    this.camera = new Camera();
    this.particles = new ParticlePool();
  }

  // ── ステージ初期化 ──
  initStage(stageId: string): void {
    this.stageId = stageId;
    this.stageData = STAGES[stageId];
    if (!this.stageData) return;

    this.worldData = WORLDS.find((w) => w.id === this.stageData!.world) || WORLDS[0];
    this.score = 0;
    this.currentPiyoIndex = 0;
    this.isEndless = false;
    this.shotsRemaining = this.stageData.piyoCount;
    this.state = STATE.READY;
    this.settleTimer = 0;
    this.niceLandingTimer = 0;
    this.objects = [];
    this.enemies = [];
    this.piyos = [];
    this.camera.reset();

    const slX = this.stageData.slingshotX;
    const slY = this.stageData.slingshotY;
    this.piyos.push(new Piyo(slX, slY, 22, 'gelpiyo'));
    this.slingshot = new Slingshot(slX, slY);

    this.stageData.objects.forEach((def) => {
      const obj = new GameObject(def.x, def.y, def.w, def.h, def.type, {
        imageKey: def.imageKey || null,
        hp: def.hp,
      });
      this.objects.push(obj);
      if (def.type === OBJ_TYPE.ENEMY) this.enemies.push(obj);
    });

    this.callbacks.onScoreUpdate?.(this.score);
    this.callbacks.onPiyoCountUpdate?.(this.shotsRemaining);
  }

  // ── エンドレスモード ──
  initEndless(): void {
    this.stageId = 'endless';
    this.stageData = null;
    this.isEndless = true;
    this.wave = 0;
    this.worldData = WORLDS[Math.floor(Math.random() * WORLDS.length)];
    this.score = 0;
    this.currentPiyoIndex = 0;
    this.shotsRemaining = 3;
    this.state = STATE.READY;
    this.settleTimer = 0;
    this.niceLandingTimer = 0;
    this.objects = [];
    this.enemies = [];
    this.piyos = [];
    this.camera.reset();

    const slX = WORLD_WIDTH / 2;
    const slY = GROUND_Y - 10;
    this.piyos.push(new Piyo(slX, slY, 22, 'gelpiyo'));
    this.slingshot = new Slingshot(slX, slY);
    this._spawnWave();

    this.callbacks.onScoreUpdate?.(this.score);
    this.callbacks.onPiyoCountUpdate?.(this.shotsRemaining);
    this.callbacks.onWaveUpdate?.(this.wave);
  }

  // ── ウェーブ生成 ──
  private _spawnWave(): void {
    this.wave++;
    this.objects = [];
    this.enemies = [];

    if (this.wave > 1 && this.wave % 5 === 1) {
      this.worldData = WORLDS[Math.floor(Math.random() * WORLDS.length)];
    }

    const difficulty = Math.min(this.wave, 20);
    const enemyCount = 1 + Math.floor(difficulty / 3);
    const blockCount = Math.floor(difficulty / 2);

    const blockTypes: ObjType[] = [OBJ_TYPE.WOOD];
    if (this.wave >= 2) blockTypes.push(OBJ_TYPE.JELLY);
    if (this.wave >= 3) blockTypes.push(OBJ_TYPE.GLASS);
    if (this.wave >= 5) blockTypes.push(OBJ_TYPE.IRON);
    if (this.wave >= 7) blockTypes.push(OBJ_TYPE.TNT);
    if (this.wave >= 10) blockTypes.push(OBJ_TYPE.SPRING);

    const margin = 20;
    const placeMinX = margin;
    const placeMaxX = WORLD_WIDTH - margin;
    const placeMinY = GROUND_Y - 500;
    const placeMaxY = GROUND_Y - 100;

    const piyo = this.piyos[0];
    const safeZoneX = piyo ? piyo.x : WORLD_WIDTH / 2;
    const safeZoneY = piyo ? piyo.y : GROUND_Y - 10;
    const safeRadius = 100;

    // 足場
    const platformCount = Math.min(2 + Math.floor(this.wave / 4), 6);
    for (let i = 0; i < platformCount; i++) {
      const isVertical = Math.random() < 0.25;
      const pw = isVertical ? (18 + Math.random() * 12) : (80 + Math.random() * 120);
      const ph = isVertical ? (80 + Math.random() * 90) : (20 + Math.random() * 10);
      let px = 0, py = 0, validPos = false, attempts = 0;
      while (!validPos && attempts < 10) {
        px = placeMinX + Math.random() * (placeMaxX - placeMinX - pw);
        py = placeMinY + Math.random() * (placeMaxY - placeMinY - 100);
        const dist = Math.hypot((px + pw / 2) - safeZoneX, (py + ph / 2) - safeZoneY);
        if (dist > safeRadius + pw / 2) validPos = true;
        attempts++;
      }
      const type = Math.random() > 0.3 ? OBJ_TYPE.WOOD : OBJ_TYPE.GLASS;
      this.objects.push(new GameObject(px, py, pw, ph, type, {}));
    }

    // ブロック
    for (let i = 0; i < blockCount; i++) {
      const type = blockTypes[Math.floor(Math.random() * blockTypes.length)];
      const shapeRoll = Math.random();
      let w: number, h: number;
      if (shapeRoll < 0.35) { w = 18 + Math.random() * 12; h = 55 + Math.random() * 35; }
      else if (shapeRoll < 0.65) { w = 55 + Math.random() * 35; h = 18 + Math.random() * 12; }
      else { const s = 33 + Math.random() * 18; w = s; h = s; }
      let x = 0, y = 0, validPos = false, attempts = 0;
      while (!validPos && attempts < 10) {
        x = placeMinX + Math.random() * (placeMaxX - placeMinX - w);
        const pc = Math.random();
        if (pc < 0.3) y = GROUND_Y - h;
        else y = placeMinY + Math.random() * (placeMaxY - placeMinY);
        const dist = Math.hypot((x + w / 2) - safeZoneX, (y + h / 2) - safeZoneY);
        if (dist > safeRadius) validPos = true;
        attempts++;
      }
      this.objects.push(new GameObject(x, y, w, h, type, {}));
    }

    // 敵
    for (let i = 0; i < enemyCount; i++) {
      const w = 45, h = 45;
      let x = placeMinX + Math.random() * (placeMaxX - placeMinX - w);
      let y = placeMinY + Math.random() * (placeMaxY - placeMinY);
      const dist = Math.hypot((x + w / 2) - safeZoneX, (y + h / 2) - safeZoneY);
      if (dist < safeRadius) y -= safeRadius;
      let eType: ObjType = OBJ_TYPE.ENEMY;
      if (this.wave >= 3 && Math.random() < 0.15) eType = OBJ_TYPE.ENEMY_BOMB;
      else if (this.wave >= 5 && Math.random() < 0.1) eType = OBJ_TYPE.ENEMY_WARP;
      const enemy = new GameObject(x, y, w, h, eType, { imageKey: 'warpiyo' });
      this.enemies.push(enemy);
      this.objects.push(enemy);
    }

    // お助けアイテム
    if (Math.random() < 0.4) {
      const iType = Math.random() < 0.5 ? OBJ_TYPE.ITEM_GIANT : OBJ_TYPE.ITEM_SPLIT;
      const x = placeMinX + Math.random() * (placeMaxX - placeMinX - 40);
      const y = placeMinY + Math.random() * (placeMaxY - placeMinY - 40);
      const item = new GameObject(x, y, 40, 40, iType, {});
      item.isItem = true;
      this.objects.push(item);
    }

    if (this.wave > 1) {
      this.shotsRemaining = Math.min(this.shotsRemaining + 1, 3);
    }

    this.callbacks.onWaveUpdate?.(this.wave);
    this.callbacks.onPiyoCountUpdate?.(this.shotsRemaining);
  }

  // ── ゲームループ ──
  start(): void {
    this._running = true;
    this._lastTime = performance.now();
    this._rafId = requestAnimationFrame(this._loop);
  }

  stop(): void {
    this._running = false;
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
  }

  pause(): void {
    if (this.state === STATE.PAUSED) return;
    this._prevState = this.state;
    this.state = STATE.PAUSED;
  }

  resume(): void {
    if (this.state !== STATE.PAUSED) return;
    this.state = this._prevState || STATE.READY;
    this._lastTime = performance.now();
  }

  private _loop = (now: number): void => {
    if (!this._running) return;
    this._rafId = requestAnimationFrame(this._loop);
    let dt = (now - this._lastTime) / 1000;
    this._lastTime = now;
    if (dt > 0.05) dt = 0.05;
    if (this.state !== STATE.PAUSED && this.state !== STATE.RESULT) this._update(dt);
    this._render();
  };

  // ── 入力処理 ──
  handleDragStart(screenX: number, screenY: number): void {
    if (this.state !== STATE.READY) return;
    const piyo = this.piyos[0];
    if (!piyo || !this.slingshot) return;
    const worldPos = this._screenToWorld(screenX, screenY);
    if (this.slingshot.startDrag(worldPos.x, worldPos.y, piyo)) {
      this.state = STATE.AIMING;
    }
  }

  handleDragMove(screenX: number, screenY: number): void {
    if (this.state !== STATE.AIMING) return;
    const piyo = this.piyos[0];
    if (!piyo || !this.slingshot) return;
    const worldPos = this._screenToWorld(screenX, screenY);
    this.slingshot.updateDrag(worldPos.x, worldPos.y, piyo);
  }

  handleDragEnd(): void {
    if (this.state !== STATE.AIMING) return;
    const piyo = this.piyos[0];
    if (!piyo || !this.slingshot) return;
    const velocity = this.slingshot.release(piyo);
    if (velocity) {
      this.state = STATE.FLYING;
      playSfxLaunch();
    } else {
      this.state = STATE.READY;
      piyo.x = this.slingshot.anchorX;
      piyo.y = this.slingshot.anchorY;
    }
  }

  private _screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const r = this.renderer;
    const worldX = (screenX - r.offsetX) / r.scale + this.camera.x + this.camera.shakeX;
    const worldY = (screenY - r.offsetY) / r.scale + this.camera.y + this.camera.shakeY;
    return { x: worldX, y: worldY };
  }

  // ── 更新 ──
  private _update(dt: number): void {
    let anyLaunched = false;
    let anyFlying = false;

    for (let i = 0; i < this.piyos.length; i++) {
      const p = this.piyos[i];
      if (p && p.launched) {
        anyLaunched = true;
        p.update(dt, WORLD_WIDTH, GROUND_Y + p.radius);
        this._checkCollisions(p);
        const curSpeed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (!p.stopped) {
          if (curSpeed < 15 && Math.abs(p.vy) < 15) {
            p.restTimer += dt;
            if (p.restTimer > 0.3) {
              this._checkNiceLanding(p);
              p.vx = 0; p.vy = 0; p.stopped = true;
            }
          } else { p.restTimer = 0; }
        }
        if (!p.stopped) anyFlying = true;
      }
    }

    const currentPiyo = this.piyos[0];
    if (currentPiyo && currentPiyo.launched) {
      this.camera.follow(currentPiyo.x, currentPiyo.y, WORLD_WIDTH, WORLD_HEIGHT, dt);
    }

    for (let i = 0; i < this.objects.length; i++) this.objects[i].update(dt);
    this.particles.update(dt);
    if (this.niceLandingTimer > 0) this.niceLandingTimer -= dt;

    if (anyFlying && this.state === STATE.FLYING) {
      const remainingEnemies = this.enemies.filter((e) => e.alive).length;
      if (remainingEnemies === 0) {
        for (const p of this.piyos) { p.vx *= 0.98; p.vy *= 0.98; }
      }
      if (currentPiyo && currentPiyo.bounceCount >= 100 && !currentPiyo.stopped) {
        this._checkNiceLanding(currentPiyo);
        currentPiyo.vx = 0; currentPiyo.vy = 0; currentPiyo.stopped = true;
      }
    }

    switch (this.state) {
      case STATE.FLYING:
        if (!anyFlying && anyLaunched) {
          this.state = STATE.SETTLING;
          const remainingEnemies = this.enemies.filter((e) => e.alive).length;
          this.settleTimer = remainingEnemies === 0 ? 0.2 : 1.5;
        }
        break;
      case STATE.SETTLING:
        this.settleTimer -= dt;
        if (this.settleTimer <= 0) this._onPiyoSettled();
        break;
    }
  }

  // ── 衝突判定 ──
  private _checkCollisions(piyo: Piyo): void {
    for (let i = 0; i < this.objects.length; i++) {
      const obj = this.objects[i];
      if (!obj.alive) continue;
      const aabb = obj.getAABB();
      const collision = circleVsRect(piyo.x, piyo.y, piyo.radius, aabb.x, aabb.y, aabb.w, aabb.h);
      if (!collision) continue;

      if (obj.type === OBJ_TYPE.ITEM_GIANT || obj.type === OBJ_TYPE.ITEM_SPLIT) {
        obj.takeDamage(1);
        this._onObjectDestroyed(obj);
        this._applyItemEffect(piyo, obj.type);
        continue;
      }

      if (obj.type === OBJ_TYPE.ENEMY_WARP) {
        obj.takeDamage(999);
        this._onObjectDestroyed(obj);
        piyo.x = 100 + Math.random() * (WORLD_WIDTH - 200);
        piyo.y = GROUND_Y - 600 - Math.random() * 200;
        const speed = Math.sqrt(piyo.vx * piyo.vx + piyo.vy * piyo.vy);
        const angle = (Math.random() * 90 + 45) * Math.PI / 180;
        piyo.vx = Math.cos(angle) * speed;
        piyo.vy = Math.sin(angle) * speed;
        this.particles.emitExplosion(piyo.x, piyo.y);
        continue;
      }

      if (piyo.isGiant && obj.type !== OBJ_TYPE.IRON && obj.type !== OBJ_TYPE.SPRING) {
        obj.takeDamage(999);
        this._onObjectDestroyed(obj);
        piyo.vx *= 0.95; piyo.vy *= 0.95;
        this.camera.shake(10);
        continue;
      }

      const impact = resolveCollision(piyo, collision, obj.restitution);
      if (impact > 20) {
        piyo.onBounce(impact);
        this.particles.emitBounce(collision.contactX, collision.contactY, impact);
        this.camera.shake(Math.min(impact / 100, 8));
        playSfxBounce(impact);
        if (obj.breakable) {
          const destroyed = obj.takeDamage(1);
          if (destroyed) this._onObjectDestroyed(obj);
        }
        const combo = piyo.bounceCount;
        this.score += 10 * combo;
        this.callbacks.onScoreUpdate?.(this.score);
      }
    }
  }

  private _onObjectDestroyed(obj: GameObject): void {
    this.score += obj.scoreValue;
    this.callbacks.onScoreUpdate?.(this.score);
    const cx = obj.getCenterX();
    const cy = obj.getCenterY();
    this.particles.emitDestroy(cx, cy, obj.color);
    playSfxBreak();
    if (obj.type === OBJ_TYPE.TNT || obj.type === OBJ_TYPE.ENEMY_BOMB) {
      this._triggerExplosion(cx, cy);
    }
  }

  private _applyItemEffect(piyo: Piyo, itemType: string): void {
    if (itemType === OBJ_TYPE.ITEM_GIANT) {
      piyo.isGiant = true;
      piyo.radius *= 1.5;
      this.particles.emitExplosion(piyo.x, piyo.y);
      this.camera.shake(15);
    } else if (itemType === OBJ_TYPE.ITEM_SPLIT) {
      this.particles.emitExplosion(piyo.x, piyo.y);
      const clone1 = new Piyo(piyo.x, piyo.y, piyo.radius, piyo.imageKey);
      clone1.isClone = true;
      clone1.launch(piyo.vx * 0.8 + 1500, piyo.vy - 1500);
      const clone2 = new Piyo(piyo.x, piyo.y, piyo.radius, piyo.imageKey);
      clone2.isClone = true;
      clone2.launch(piyo.vx * 0.8 - 1500, piyo.vy - 1500);
      this.piyos.push(clone1, clone2);
    }
  }

  private _checkNiceLanding(piyo: Piyo): void {
    const absVx = Math.abs(piyo.vx);
    const absVy = Math.abs(piyo.vy);
    if (absVy > absVx * 1.5) {
      this.niceLandingX = piyo.x;
      this.niceLandingY = piyo.y;
      this.niceLandingTimer = 1.5;
    }
  }

  private _triggerExplosion(x: number, y: number): void {
    this.particles.emitExplosion(x, y);
    this.camera.shake(15);
    playSfxExplosion();
    for (let i = 0; i < this.objects.length; i++) {
      const obj = this.objects[i];
      if (!obj.alive) continue;
      const dx = obj.getCenterX() - x;
      const dy = obj.getCenterY() - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < TNT_EXPLOSION_RADIUS) {
        const destroyed = obj.takeDamage(TNT_EXPLOSION_DAMAGE);
        if (destroyed) {
          this.score += obj.scoreValue;
          this.particles.emitDestroy(obj.getCenterX(), obj.getCenterY(), obj.color);
          if (obj.type === OBJ_TYPE.TNT || obj.type === OBJ_TYPE.ENEMY_BOMB) {
            setTimeout(() => this._triggerExplosion(obj.getCenterX(), obj.getCenterY()), 200);
          }
        }
      }
    }
    const currentPiyo = this.piyos[0];
    if (currentPiyo && currentPiyo.launched && !currentPiyo.stopped) {
      const dx = currentPiyo.x - x;
      const dy = currentPiyo.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < TNT_EXPLOSION_RADIUS && dist > 0) {
        const force = (1 - dist / TNT_EXPLOSION_RADIUS) * 800;
        currentPiyo.vx += (dx / dist) * force;
        currentPiyo.vy += (dy / dist) * force;
      }
    }
    this.callbacks.onScoreUpdate?.(this.score);
  }

  private _onPiyoSettled(): void {
    const remainingEnemies = this.enemies.filter((e) => e.alive).length;
    if (remainingEnemies === 0) {
      if (this.isEndless) {
        this.objects = this.objects.filter((o) => o.alive && o.alpha > 0);
        this.enemies = this.enemies.filter((e) => e.alive);
        playSfxClear();
        this._spawnWave();
        this._resetPiyoAtPosition();
        return;
      } else {
        this.state = STATE.RESULT;
        const stars = this._calcStars();
        playSfxClear();
        this.callbacks.onStageComplete?.(this.score, stars);
        return;
      }
    }
    this.shotsRemaining--;
    if (this.shotsRemaining > 0) {
      this._resetPiyoAtPosition();
    } else {
      this.state = STATE.RESULT;
      playSfxFail();
      if (this.isEndless) {
        this.callbacks.onEndlessGameOver?.(this.score, this.wave);
      } else {
        this.callbacks.onStageFailed?.(this.score);
      }
    }
  }

  private _resetPiyoAtPosition(): void {
    this.piyos = [this.piyos[0]];
    const piyo = this.piyos[0];
    if (!piyo || !this.slingshot) return;
    this.slingshot.setAnchor(piyo.x, piyo.y);
    piyo.launched = false;
    piyo.stopped = false;
    piyo.vx = 0; piyo.vy = 0;
    piyo.restTimer = 0;
    if (piyo.isGiant) { piyo.isGiant = false; piyo.radius /= 1.5; }
    piyo.scaleX = 1; piyo.scaleY = 1;
    piyo.rotation = 0; piyo.squashTime = -1;
    piyo.bounceCount = 0; piyo.comboTimer = 0;
    piyo.trailPoints.length = 0;
    piyo.isDragging = false;
    piyo.dragOffsetX = 0; piyo.dragOffsetY = 0;
    piyo._lastHighVx = 0; piyo._lastHighVy = 0;
    this.state = STATE.READY;
    this.camera.follow(piyo.x, piyo.y, WORLD_WIDTH, WORLD_HEIGHT, 1);
    this.callbacks.onPiyoCountUpdate?.(this.shotsRemaining);
  }

  private _calcStars(): number {
    if (!this.stageData) return 0;
    const thresholds = this.stageData.starThresholds;
    let stars = 0;
    if (this.score >= thresholds[0]) stars = 1;
    if (this.score >= thresholds[1]) stars = 2;
    if (this.score >= thresholds[2]) stars = 3;
    return Math.max(1, stars);
  }

  // ── 描画 ──
  private _render(): void {
    const bgColors = this.worldData ? this.worldData.bgGradient : null;
    const groundColor = this.worldData ? this.worldData.groundColor : null;
    this.renderer.beginFrame(this.camera, bgColors);
    this.renderer.drawBackground(bgColors, groundColor);

    for (let i = 0; i < this.objects.length; i++) {
      this.renderer.drawObject(this.objects[i]);
    }

    const currentPiyo = this.piyos[0];
    if (this.slingshot && currentPiyo) {
      this.slingshot.render(this.renderer.ctx, currentPiyo, this.camera);
    }

    if (currentPiyo && currentPiyo.active) {
      this.renderer.drawPiyo(currentPiyo);
      if (currentPiyo.comboTimer > 0) {
        this.renderer.drawComboText(currentPiyo.x, currentPiyo.y, currentPiyo.bounceCount);
      }
    }

    if (this.niceLandingTimer > 0) {
      this.renderer.drawNiceLanding(this.niceLandingX, this.niceLandingY, this.niceLandingTimer);
    }

    this.renderer.drawParticles(this.particles);
    this.renderer.endFrame();
  }
}
