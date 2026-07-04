import type { SceneType, HitAreas, DragState, LadleAnim } from './types';
import { GELPIYO_TYPES, POT_STATE, MOLD_STATE, CUSTOMER_STATE } from './types';
import { CustomerPool, Pot, Mold } from './entity';
import { InputManager } from './input';
import { Renderer } from './renderer';
import * as Audio from './audio';
import { addHighScore } from './storage';

const GAME_DURATION = 60;
const CUSTOMER_SLOTS = 3;
const POT_COUNT = 2;
const MOLD_COUNT = 3;
const STUN_DURATION = 2;
const BASE_SCORE = 100;
const COMBO_MULTIPLIER = 0.5;
const SPAWN_INTERVAL_BASE = 4.0;
const SPAWN_INTERVAL_MIN = 2.0;
const DELTA_TIME_MAX = 0.1;
const LADLE_ANIM_DURATION = 0.6;

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private renderer: Renderer;
  private input: InputManager;
  private animationFrameId: number | null = null;
  private lastTimestamp = 0;
  
  private images: Record<string, HTMLCanvasElement> = {};
  
  private scene: SceneType = 'title';
  private elapsedTime = 0;
  
  private pots: Pot[] = [];
  private molds: Mold[] = [];
  private customerPool: CustomerPool;
  
  private gameState = {
    timeLeft: GAME_DURATION,
    score: 0,
    combo: 0,
    maxCombo: 0,
    served: 0,
    missed: 0,
    stunTimer: 0,
    spawnTimer: 2,
    lastCountdownSec: -1
  };
  
  private comboPopup = { combo: 0, bonus: 0, timer: 0 };
  private resultData: any = null;
  
  private dragState: DragState = {
    active: false,
    type: null,
    payload: null,
    sourceIndex: -1,
    x: 0,
    y: 0
  };
  
  private ladleAnims: LadleAnim[] = [];
  
  private hitAreas: HitAreas = {
    customers: [],
    pots: [],
    molds: [],
    pellet: null,
    ladle: null,
    toppings: []
  };

  private logicalW = 390;
  private logicalH = 844;

  constructor(canvas: HTMLCanvasElement, images: Record<string, HTMLCanvasElement>) {
    this.canvas = canvas;
    this.images = images;
    
    this.resizeCanvas();
    window.addEventListener('resize', this.resizeCanvas);
    
    this.renderer = new Renderer(canvas.getContext('2d')!);
    this.input = new InputManager(this.canvas, this.logicalW, this.logicalH);
    
    this.customerPool = new CustomerPool(10);
    for (let i = 0; i < POT_COUNT; i++) this.pots.push(new Pot());
    for (let i = 0; i < MOLD_COUNT; i++) this.molds.push(new Mold());
    
    this.startLoop();
  }

  public destroy() {
    window.removeEventListener('resize', this.resizeCanvas);
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.input.destroy();
  }

  private resizeCanvas = () => {
    const container = this.canvas.parentElement;
    if (!container) return;
    
    const containerW = container.clientWidth;
    const containerH = container.clientHeight;

    const aspect = this.logicalW / this.logicalH;
    let displayW, displayH;

    if (containerW / containerH < aspect) {
      displayW = containerW;
      displayH = containerW / aspect;
    } else {
      displayH = containerH;
      displayW = containerH * aspect;
    }

    this.canvas.style.width = `${displayW}px`;
    this.canvas.style.height = `${displayH}px`;

    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.logicalW * dpr;
    this.canvas.height = this.logicalH * dpr;

    const ctx = this.canvas.getContext('2d');
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  private startLoop() {
    this.lastTimestamp = performance.now();
    const loop = (timestamp: number) => {
      const dt = (timestamp - this.lastTimestamp) / 1000;
      this.lastTimestamp = timestamp;
      this.update(Math.min(dt, DELTA_TIME_MAX));
      this.draw();
      this.animationFrameId = requestAnimationFrame(loop);
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  private startGame() {
    this.scene = 'playing';
    this.gameState.timeLeft = GAME_DURATION;
    this.gameState.score = 0;
    this.gameState.combo = 0;
    this.gameState.maxCombo = 0;
    this.gameState.served = 0;
    this.gameState.missed = 0;
    this.gameState.stunTimer = 0;
    this.gameState.spawnTimer = 1.5;
    this.gameState.lastCountdownSec = -1;
    this.comboPopup = { combo: 0, bonus: 0, timer: 0 };
    this.dragState.active = false;
    this.ladleAnims = [];

    for (const p of this.pots) p.reset();
    for (const m of this.molds) m.reset();
    this.customerPool.resetAll();

    Audio.playGameStart();
  }

  private endGame() {
    this.scene = 'result';
    this.dragState.active = false;
    this.ladleAnims = [];
    Audio.playTimeUp();
    
    const rank = addHighScore(this.gameState.score);
    this.resultData = {
      score: this.gameState.score,
      maxCombo: this.gameState.maxCombo,
      served: this.gameState.served,
      missed: this.gameState.missed,
      rank,
      isNewRecord: rank === 1
    };
  }

  private update(dt: number) {
    this.elapsedTime += dt;
    this.processInput();

    if (this.scene === 'playing') {
      this.updatePlaying(dt);
    }
  }

  private pointInRect(px: number, py: number, rect: { x: number; y: number; w: number; h: number } | null) {
    if (!rect) return false;
    return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
  }

  private processInput() {
    const inputs = this.input.flushInputs();
    
    for (const input of inputs) {
      if (this.scene === 'title' && input.type === 'start') {
        Audio.initAudio();
        Audio.resumeAudio();
        this.startGame();
        return;
      }
      if (this.scene === 'result' && input.type === 'start') {
        Audio.resumeAudio();
        Audio.playTap();
        this.startGame();
        return;
      }
      
      if (this.scene !== 'playing' || this.gameState.stunTimer > 0) continue;

      const x = input.x;
      const y = input.y;

      if (input.type === 'start') {
        this.handleDragStart(x, y);
      } else if (input.type === 'end') {
        if (this.dragState.active) {
          this.handleDragDrop(x, y);
          this.dragState.active = false;
        }
      }
    }
    
    if (this.dragState.active) {
      const ptr = this.input.getCurrentPointer();
      if (ptr) {
        this.dragState.x = ptr.x;
        this.dragState.y = ptr.y;
      } else {
        this.dragState.active = false;
      }
    }
  }

  private handleDragStart(x: number, y: number) {
    if (this.hitAreas.pellet && this.pointInRect(x, y, this.hitAreas.pellet)) {
      this.dragState = { active: true, type: 'pellet', payload: null, sourceIndex: -1, x, y };
      Audio.playTap();
      return;
    }
    
    if (this.hitAreas.ladle && this.pointInRect(x, y, this.hitAreas.ladle)) {
      this.dragState = { active: true, type: 'ladle', payload: null, sourceIndex: -1, x, y };
      Audio.playTap();
      return;
    }
    
    for (let i = 0; i < this.hitAreas.toppings.length; i++) {
      if (this.pointInRect(x, y, this.hitAreas.toppings[i])) {
        this.dragState = { active: true, type: 'topping', payload: GELPIYO_TYPES[i], sourceIndex: -1, x, y };
        Audio.playTap();
        return;
      }
    }
    
    for (let i = 0; i < this.hitAreas.molds.length; i++) {
      if (this.pointInRect(x, y, this.hitAreas.molds[i])) {
        if (this.molds[i].state === MOLD_STATE.DONE) {
          this.dragState = { active: true, type: 'gelpiyo', payload: this.molds[i].gelpiyoType, sourceIndex: i, x, y };
          Audio.playTap();
          return;
        }
      }
    }
  }

  private handleDragDrop(x: number, y: number) {
    const type = this.dragState.type;

    if (type === 'pellet') {
      for (let i = 0; i < this.hitAreas.pots.length; i++) {
        if (this.pointInRect(x, y, this.hitAreas.pots[i]) && this.pots[i].state === POT_STATE.EMPTY) {
          this.pots[i].addPellet();
          Audio.playPelletDrop();
          return;
        }
      }
    }

    if (type === 'ladle') {
      for (let i = 0; i < this.hitAreas.pots.length; i++) {
        if (this.pointInRect(x, y, this.hitAreas.pots[i]) && this.pots[i].state === POT_STATE.MELTED) {
          const animTargets = new Set(this.ladleAnims.map(a => a.targetMoldIndex));
          let targetMoldIndex = -1;
          for (let j = 0; j < this.molds.length; j++) {
            if (this.molds[j].state === MOLD_STATE.EMPTY && !animTargets.has(j)) {
              targetMoldIndex = j;
              break;
            }
          }
          if (targetMoldIndex === -1) return;

          this.pots[i].scoop();
          Audio.playTopping();

          const potArea = this.hitAreas.pots[i];
          const moldArea = this.hitAreas.molds[targetMoldIndex];
          
          this.ladleAnims.push({
            active: true,
            startX: potArea.x + potArea.w / 2,
            startY: potArea.y + potArea.h / 2,
            endX: moldArea.x + moldArea.w / 2,
            endY: moldArea.y + moldArea.h / 2,
            progress: 0,
            duration: LADLE_ANIM_DURATION,
            targetMoldIndex,
            sourcePotIndex: i
          });
          return;
        }
      }
    }

    if (type === 'topping') {
      for (let i = 0; i < this.hitAreas.molds.length; i++) {
        if (this.pointInRect(x, y, this.hitAreas.molds[i]) && this.molds[i].state === MOLD_STATE.FILLED) {
          if (this.dragState.payload) {
            this.molds[i].addTopping(this.dragState.payload);
            Audio.playTopping();
          }
          return;
        }
      }
    }

    if (type === 'gelpiyo') {
      for (let i = 0; i < this.hitAreas.customers.length; i++) {
        const cArea = this.hitAreas.customers[i];
        if (this.pointInRect(x, y, cArea)) {
          const customer = this.customerPool.getActive().find(c => c.slotIndex === cArea.slotIndex);
          if (customer && customer.state === CUSTOMER_STATE.WAITING) {
            if (customer.order && this.dragState.payload && customer.order.id === this.dragState.payload.id) {
              this.molds[this.dragState.sourceIndex].collect();
              customer.serve(this.dragState.payload.id);
              this.addScoreAndCombo();
              return;
            } else {
              this.molds[this.dragState.sourceIndex].collect();
              this.gameState.combo = 0;
              this.gameState.stunTimer = STUN_DURATION;
              Audio.playMiss();
              return;
            }
          }
        }
      }
    }
  }

  private addScoreAndCombo() {
    this.gameState.combo++;
    if (this.gameState.combo > this.gameState.maxCombo) {
      this.gameState.maxCombo = this.gameState.combo;
    }
    const bonus = Math.floor(BASE_SCORE * (1 + this.gameState.combo * COMBO_MULTIPLIER));
    this.gameState.score += bonus;
    this.gameState.served++;
    this.comboPopup = { combo: this.gameState.combo, bonus, timer: 1 };
    
    if (this.gameState.combo >= 3) Audio.playCombo();
    else Audio.playCorrect();
  }

  private updatePlaying(dt: number) {
    if (this.gameState.stunTimer > 0) {
      this.gameState.stunTimer = Math.max(0, this.gameState.stunTimer - dt);
      if (this.gameState.stunTimer === 0) this.dragState.active = false;
    }

    this.gameState.timeLeft -= dt;
    if (this.gameState.timeLeft <= 0) {
      this.gameState.timeLeft = 0;
      this.endGame();
      return;
    }

    const secLeft = Math.ceil(this.gameState.timeLeft);
    if (secLeft <= 10 && secLeft !== this.gameState.lastCountdownSec) {
      this.gameState.lastCountdownSec = secLeft;
      Audio.playCountdown();
    }

    for (const pot of this.pots) {
      const wasMelting = pot.state === POT_STATE.MELTING;
      pot.update(dt);
      if (wasMelting && pot.state === POT_STATE.MELTED) {
        Audio.playComplete();
      }
    }

    for (const mold of this.molds) {
      if (mold.update(dt)) Audio.playComplete();
    }

    const activeCustomers = this.customerPool.getActive();
    for (const customer of activeCustomers) {
      if (customer.update(dt) === 'left') {
        this.gameState.missed++;
        this.gameState.combo = 0;
        Audio.playMiss();
      }
    }

    this.gameState.spawnTimer -= dt;
    if (this.gameState.spawnTimer <= 0) {
      this.spawnCustomer();
      const progress = 1 - this.gameState.timeLeft / GAME_DURATION;
      this.gameState.spawnTimer = SPAWN_INTERVAL_BASE - progress * (SPAWN_INTERVAL_BASE - SPAWN_INTERVAL_MIN) + Math.random();
    }

    if (this.comboPopup.timer > 0) {
      this.comboPopup.timer -= dt;
    }

    for (let i = this.ladleAnims.length - 1; i >= 0; i--) {
      const anim = this.ladleAnims[i];
      anim.progress += dt / anim.duration;
      if (anim.progress >= 1) {
        anim.progress = 1;
        if (anim.targetMoldIndex >= 0 && anim.targetMoldIndex < this.molds.length) {
          this.molds[anim.targetMoldIndex].fillGel();
          Audio.playPelletDrop();
        }
        this.ladleAnims.splice(i, 1);
      }
    }
  }

  private spawnCustomer() {
    const activeCustomers = this.customerPool.getActive();
    if (activeCustomers.length >= CUSTOMER_SLOTS) return;
    
    const usedSlots = new Set(activeCustomers.map(c => c.slotIndex));
    let freeSlot = -1;
    for (let i = 0; i < CUSTOMER_SLOTS; i++) {
      if (!usedSlots.has(i)) { freeSlot = i; break; }
    }
    if (freeSlot === -1) return;

    const customer = this.customerPool.acquire();
    if (!customer) return;

    const orderType = GELPIYO_TYPES[Math.floor(Math.random() * GELPIYO_TYPES.length)];
    const progress = 1 - this.gameState.timeLeft / GAME_DURATION;
    const patience = Math.max(15, 35 - progress * 10);
    customer.spawn(orderType, freeSlot, patience);
  }

  private draw() {
    this.renderer['ctx'].clearRect(0, 0, this.logicalW, this.logicalH);
    
    if (this.scene === 'title') {
      this.renderer.drawTitleScreen(this.logicalW, this.logicalH, this.elapsedTime);
    } else if (this.scene === 'playing') {
      this.renderer['ctx'].fillStyle = 'hsl(240, 30%, 10%)';
      this.renderer['ctx'].fillRect(0, 0, this.logicalW, this.logicalH);
      
      this.renderer.drawHUD(this.logicalW, this.logicalH, this.gameState);
      
      const activeCustomers = this.customerPool.getActive();
      this.hitAreas.customers = this.renderer.drawCustomerArea(this.logicalW, this.logicalH, activeCustomers, CUSTOMER_SLOTS);
      this.hitAreas.pots = this.renderer.drawPotArea(this.logicalW, this.logicalH, this.pots, this.images, this.elapsedTime);
      this.hitAreas.molds = this.renderer.drawMoldArea(this.logicalW, this.logicalH, this.molds, this.images);
      
      const pAreas = this.renderer.drawPaletteArea(this.logicalW, this.logicalH, GELPIYO_TYPES, this.images);
      this.hitAreas.pellet = pAreas.pellet;
      this.hitAreas.ladle = pAreas.ladle;
      this.hitAreas.toppings = pAreas.toppings;

      for (const anim of this.ladleAnims) {
        this.renderer.drawLadleAnimation(anim, this.images);
      }

      if (this.dragState.active) {
        this.renderer.drawDraggedItem(this.dragState, this.images);
      }

      this.renderer.drawComboPopup(this.logicalW, this.logicalH, this.comboPopup);
      this.renderer.drawStunOverlay(this.logicalW, this.logicalH, this.gameState.stunTimer);
      
    } else if (this.scene === 'result') {
      this.renderer.drawResultScreen(this.logicalW, this.logicalH, this.resultData, this.elapsedTime);
    }
  }
}
