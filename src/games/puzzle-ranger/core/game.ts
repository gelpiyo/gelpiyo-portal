// ============================================
// game.ts - GameEngine Orchestrator
// ============================================

import { PuzzleEngine } from './puzzle';
import { TDEngine } from './td';
import type { GameCallbacks, ColorType, SkillType } from './types';

export class GameEngine {
  private puzzleEngine: PuzzleEngine;
  private tdEngine: TDEngine;
  private callbacks: GameCallbacks;

  private isRunning = false;
  private score = 0;
  private lastTime = 0;
  private animationFrameId = 0;

  constructor(
    puzzleCanvas: HTMLCanvasElement,
    tdCanvas: HTMLCanvasElement,
    images: Record<string, HTMLCanvasElement | HTMLImageElement>,
    callbacks: GameCallbacks
  ) {
    this.callbacks = callbacks;

    // We extend callbacks to handle internal communication between Puzzle and TD
    const extendedCallbacks: GameCallbacks & {
      onUnitSpawn?: (color: ColorType, comboLevel: number, power: number) => void;
      onSkillActivate?: (skillType: SkillType) => void;
    } = {
      ...callbacks,
      onUnitSpawn: (color, comboLevel, power) => {
        this.tdEngine.spawnAlly(color, comboLevel, power);
      },
      onSkillActivate: (skillType) => {
        this.tdEngine.activateSkill(skillType);
      },
      onScoreUpdate: (scorePoints) => {
        this.score += scorePoints;
        this.callbacks.onScoreUpdate?.(this.score);
      }
    };

    this.puzzleEngine = new PuzzleEngine(puzzleCanvas, extendedCallbacks);
    this.tdEngine = new TDEngine(tdCanvas, images, extendedCallbacks);

    window.addEventListener('resize', this.handleResize);
  }

  public destroy() {
    this.stop();
    this.puzzleEngine.destroy();
    this.tdEngine.destroy();
    window.removeEventListener('resize', this.handleResize);
  }

  private handleResize = () => {
    this.puzzleEngine.resize();
    this.tdEngine.resize();
  };

  public startGame() {
    this.score = 0;
    this.callbacks.onScoreUpdate?.(0);
    this.tdEngine.reset();
    
    // Start wave 1
    this.tdEngine.startWave(1);
    this.callbacks.onWaveUpdate?.(1);

    if (!this.isRunning) {
      this.isRunning = true;
      this.lastTime = performance.now();
      this.loop(this.lastTime);
    }
  }

  public retryGame() {
    this.startGame();
  }

  public nextWave() {
    // Actually we should track currentWave or get it from TD
    // We can just rely on the Game component tracking the wave and passing it.
    // But since tdEngine tracks currentWave inside, let's keep it simple: we pass wave from outside.
  }

  public startWave(wave: number) {
    this.tdEngine.startWave(wave);
    this.callbacks.onWaveUpdate?.(wave);
    
    if (!this.isRunning) {
      this.isRunning = true;
      this.lastTime = performance.now();
      this.loop(this.lastTime);
    }
  }

  public pause() {
    this.isRunning = false;
  }

  public resume() {
    if (!this.isRunning) {
      this.isRunning = true;
      this.lastTime = performance.now();
      this.loop(this.lastTime);
    }
  }

  public stop() {
    this.isRunning = false;
    cancelAnimationFrame(this.animationFrameId);
  }

  private loop = (timestamp: number) => {
    if (!this.isRunning) return;

    const dt = Math.min(timestamp - this.lastTime, 33);
    this.lastTime = timestamp;

    this.puzzleEngine.update(dt);
    this.tdEngine.update(dt);

    this.puzzleEngine.render();
    this.tdEngine.render();

    // Check if wave is cleared or game over
    const state = this.tdEngine.getWaveState();
    if (state === 'cleared' || state === 'gameover') {
      this.isRunning = false; // pause game loop
    } else {
      this.animationFrameId = requestAnimationFrame(this.loop);
    }
  };
}
