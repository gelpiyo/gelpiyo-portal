export type GameState = 'TITLE' | 'AIMING' | 'FLYING' | 'GAMEOVER' | 'RESULT';

export interface PhysicsState {
  x: number; // 距離 (m)
  y: number; // 高さ (m)
  vx: number;
  vy: number;
  angle: number; // ゲルぴよの回転
}

import { useSaveDataStore } from '@/stores/saveDataStore';

export interface EngineState {
  status: GameState;
  physics: PhysicsState;
  power: number; // 0 ~ 1
  powerDir: number; // 1 or -1
  bounces: number;
  maxDistance: number; // 今回の飛距離
  highScore: number;
  waterLevel: number; // 水面のY座標(m)
}

export class Engine {
  public state: EngineState;
  private readonly G = -20.0; // 重力
  private readonly WATER_LEVEL = 0;
  private readonly MAX_POWER_VX = 35.0; // 横への初速を少し強化
  private readonly MAX_POWER_VY = 8.0;  // 縦への初速を抑える（画面半分程度までに収める）
  
  private actionTriggered = false;

  constructor() {
    this.state = this.getInitialState();
    this.loadHighScore();
  }
  
  private getInitialState(): EngineState {
    return {
      status: 'TITLE',
      physics: { x: 0, y: 2.0, vx: 0, vy: 0, angle: 0 },
      power: 0,
      powerDir: 1,
      bounces: 0,
      maxDistance: 0,
      highScore: this.state?.highScore || 0,
      waterLevel: this.WATER_LEVEL,
    };
  }

  private loadHighScore() {
    this.state.highScore = useSaveDataStore.getState().games['stone-skipping']?.highScore || 0;
  }

  private saveHighScore() {
    useSaveDataStore.getState().updateHighScore('stone-skipping', this.state.highScore);
  }

  public triggerAction() {
    this.actionTriggered = true;
  }

  public update(dt: number) {
    if (dt > 0.1) dt = 0.1; // dtの上限

    switch (this.state.status) {
      case 'TITLE':
        if (this.actionTriggered) {
          this.state.status = 'AIMING';
          this.state.power = 0;
        }
        break;
        
      case 'AIMING':
        this.state.power += this.state.powerDir * dt * 1.5;
        if (this.state.power >= 1.0) {
          this.state.power = 1.0;
          this.state.powerDir = -1;
        } else if (this.state.power <= 0.0) {
          this.state.power = 0.0;
          this.state.powerDir = 1;
        }
        
        if (this.actionTriggered) {
          this.state.status = 'FLYING';
          const p = Math.max(0.1, this.state.power);
          this.state.physics.vx = this.MAX_POWER_VX * p;
          this.state.physics.vy = this.MAX_POWER_VY * p;
          this.state.physics.y = 2.0;
          this.state.physics.x = 0;
          this.state.bounces = 0;
        }
        break;

      case 'FLYING':
        this.state.physics.x += this.state.physics.vx * dt;
        this.state.physics.vy += this.G * dt;
        this.state.physics.y += this.state.physics.vy * dt;
        // 回転速度をゆっくり（回っているなー程度）にする
        this.state.physics.angle += this.state.physics.vx * dt * 0.2;

        // 水面（y=0付近）での判定
        // タップ判定の猶予を少し広げるため、水面に触れる少し前（Y=1.8）から受付を開始する
        if (this.state.physics.y <= this.WATER_LEVEL + 1.8 && this.state.physics.vy < 0) {
          if (this.actionTriggered) {
            // タップ成功（Perfect）
            this.state.bounces++;
            // 高く跳ねすぎないよう反発を抑える
            this.state.physics.vy = Math.abs(this.state.physics.vy) * 0.5 + 4.0; 
            this.state.physics.vx *= 0.95; // 減速少なめ（より水切りらしく前へ）
            this.state.physics.y = this.WATER_LEVEL + 1.2;
          } else if (this.state.physics.y <= this.WATER_LEVEL + 0.6) {
            // タップなし（Miss/自動バウンド）
            // 十分な速度(vx)があれば跳ねるが減速が大きい
            if (this.state.physics.vx >= 4.0) {
              this.state.bounces++;
              // 失敗時はかなり低く跳ねる
              this.state.physics.vy = Math.abs(this.state.physics.vy) * 0.3 + 1.5; 
              this.state.physics.vx *= 0.6; // 大きく減速
              this.state.physics.y = this.WATER_LEVEL;
            } else {
              // 速度不足で水没
              this.state.status = 'GAMEOVER';
              this.state.physics.vy = -1.0;
              this.state.physics.vx *= 0.3; // 水の抵抗
            }
          }
          
          // タップ有無に関わらず、跳ねた後（または着水後）に速度が極端に落ちていれば沈む
          if (this.state.status !== 'GAMEOVER' && this.state.physics.vx < 3.0) {
            this.state.status = 'GAMEOVER';
          }
        }
        break;

      case 'GAMEOVER':
        // 沈んでいくアニメーション
        this.state.physics.x += this.state.physics.vx * dt;
        this.state.physics.vy += this.G * dt; // 重力（水中は少し遅くしても良いが今回は簡易に）
        this.state.physics.y += this.state.physics.vy * 0.2 * dt; // 沈む速度を遅く

        if (this.state.physics.y < -5.0) {
          this.state.status = 'RESULT';
          this.state.maxDistance = this.state.physics.x;
          if (this.state.maxDistance > this.state.highScore) {
            this.state.highScore = this.state.maxDistance;
            this.saveHighScore();
          }
        }
        break;

      case 'RESULT':
        if (this.actionTriggered) {
          const hs = this.state.highScore;
          this.state = this.getInitialState();
          this.state.highScore = hs;
          this.state.status = 'AIMING';
        }
        break;
    }

    this.actionTriggered = false; // 1フレームでフラグ消費
  }
}
