export type GelpiyoState = 'idle' | 'feeding' | 'playing' | 'slip';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  type: 'heart' | 'sparkle' | 'food' | 'note';
  scale: number;
}

export interface FlyingItem {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  angularVelocity: number;
  emoji: string;
  type: 'food' | 'toy';
  isHit: boolean;
  scale: number;
  actionType?: 'head' | 'kick' | 'slip'; // 事前に決めたアクション
  isRolling?: boolean; // 転ぶ時のボールの横転がり用
  onHit: (isSlip?: boolean) => void;
}

export class GelpiyoPhysics {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animationId: number = 0;
  
  // 基本状態
  public size: number = 1.0;
  public bounce: number = 0.5; // 0.1 ~ 0.9
  public hue: number = 50;

  // アニメーションステート
  public currentState: GelpiyoState = 'idle';
  private stateTimer: number = 0;
  private animationVariant: number = 0; // バリエーション用


  // ばねモデル用変数 (Scale Y)
  private scaleY: number = 1.0;
  private velocityY: number = 0.0;
  private targetScaleY: number = 1.0;

  // ばねモデル用変数 (Scale X)
  private scaleX: number = 1.0;
  private velocityX: number = 0.0;
  private targetScaleX: number = 1.0;

  // 位置 (中心)
  private x: number = 0;
  private y: number = 0;
  private offsetX: number = 0; // アニメーション用オフセット
  private offsetY: number = 0; 

  // 画像
  private image: HTMLImageElement;
  private imageLoaded: boolean = false;

  // パーティクルとアイテム
  private particles: Particle[] = [];
  private flyingItems: FlyingItem[] = [];
  private itemIdCounter: number = 0;
  
  // 経過時間（呼吸アニメーション等に使用）
  private timeElapsed: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    
    this.image = new Image();
    this.image.src = `${import.meta.env.BASE_URL}assets/factory/characters/gelpiyo_transparent.png`;
    this.image.onload = () => {
      this.imageLoaded = true;
    };

    this.resize();
    window.addEventListener('resize', this.resize);
  }

  private resize = () => {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.parentElement!.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    this.ctx.scale(dpr, dpr);
    
    this.x = rect.width / 2;
    this.y = rect.height / 2 + 50;
  };

  public start() {
    let lastTime = performance.now();
    const loop = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;
      this.update(dt);
      this.draw();
      this.animationId = requestAnimationFrame(loop);
    };
    this.animationId = requestAnimationFrame(loop);
  }

  public stop() {
    cancelAnimationFrame(this.animationId);
    window.removeEventListener('resize', this.resize);
  }

  public poke() {
    const force = 0.3 + (this.bounce * 0.5);
    this.velocityY += force;
    this.velocityX -= force;
  }

  public setState(state: GelpiyoState, duration: number = 2.0, variant: number = 0) {
    this.currentState = state;
    this.stateTimer = duration;
    this.animationVariant = variant;
    this.poke(); // ステート切り替え時に一回跳ねさせる
  }

  public emitParticles(type: Particle['type'], count: number = 5) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: this.x + (Math.random() - 0.5) * 80 * this.size,
        y: this.y - 70 * this.size + (Math.random() - 0.5) * 80 * this.size,
        vx: (Math.random() - 0.5) * 150,
        vy: -Math.random() * 150 - 100,
        life: 1.0,
        maxLife: 1.0 + Math.random() * 0.5,
        type,
        scale: 0.6 + Math.random() * 0.4,
      });
    }
  }

  public throwItem(emoji: string, type: 'food' | 'toy', onHit: (isSlip?: boolean) => void) {
    // 画面中央下（手元）から投げる
    const w = this.canvas.width / (window.devicePixelRatio || 1);
    const h = this.canvas.height / (window.devicePixelRatio || 1);
    const startX = w / 2;
    const startY = h + 20; // 画面一番下より少し下から

    let targetX = this.x;
    let targetY = this.y - 30 * this.size; // デフォルト（食べ物）
    let actionType: 'head' | 'kick' | 'slip' | undefined;

    if (type === 'toy') {
      const r = Math.random();
      if (r < 0.15) {
        actionType = 'slip';
        targetY = this.y - 30 * this.size; // ミス時は中間
      } else if (r < 0.575) { // 約42.5%
        actionType = 'head';
        targetY = this.y - 70 * this.size; // 頭を狙う高め
      } else { // 約42.5%
        actionType = 'kick';
        targetY = this.y + 10 * this.size; // 足元を狙う低め
      }
    }
    
    // 放物線の時間（秒）。手元からなので少し早めに到達させる
    const flightTime = 0.4 + Math.random() * 0.1;
    
    const vx = (targetX - startX) / flightTime;
    // 等加速度直線運動の公式: y = v0*t + 1/2*g*t^2 => v0 = (y - 1/2*g*t^2) / t
    const gravity = 800; // 重力加速度
    const vy = (targetY - startY - 0.5 * gravity * flightTime * flightTime) / flightTime;

    this.flyingItems.push({
      id: this.itemIdCounter++,
      x: startX,
      y: startY,
      vx,
      vy,
      rotation: Math.random() * Math.PI * 2,
      angularVelocity: (Math.random() - 0.5) * 15,
      emoji,
      type,
      isHit: false,
      scale: 1.0,
      actionType,
      isRolling: false,
      onHit
    });
  }

  private update(dt: number) {
    this.timeElapsed += dt;

    // ステートタイマーの更新
    if (this.stateTimer > 0) {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.currentState = 'idle';
      }
    }

    // ステートごとの目標値やオフセットの計算
    this.targetScaleX = 1.0;
    this.targetScaleY = 1.0;
    
    if (this.currentState === 'idle') {
      // 呼吸アニメーション (ゆっくり拡大縮小)
      const breath = Math.sin(this.timeElapsed * 2) * 0.03;
      this.targetScaleY = 1.0 + breath;
      this.targetScaleX = 1.0 - breath * 0.5;
      
      // 弾性で揺れつつオフセットを0に戻す
      this.offsetX += (0 - this.offsetX) * dt * 5;
      this.offsetY += (0 - this.offsetY) * dt * 5;
    } 
    else if (this.currentState === 'feeding') {
      // ごはんのバリエーション
      if (this.animationVariant === 0) {
        // もぐもぐジャンプ (ノーマル)
        const jump = Math.abs(Math.sin(this.timeElapsed * 10)) * 20;
        this.offsetY = -jump * this.size;
        this.targetScaleY = 1.0 + (jump / 100);
        this.targetScaleX = 1.0 - (jump / 150);
      } else if (this.animationVariant === 1) {
        // 高速もぐもぐ
        const jump = Math.abs(Math.sin(this.timeElapsed * 25)) * 15;
        this.offsetY = -jump * this.size;
        this.targetScaleY = 1.0 + (jump / 100);
      } else if (this.animationVariant === 2) {
        // 左右に揺れながら味わう
        this.offsetX = Math.sin(this.timeElapsed * 8) * 20 * this.size;
        this.offsetY = -Math.abs(Math.cos(this.timeElapsed * 8)) * 10 * this.size;
      } else {
        // 大きく1回跳ねてあとは味わう
        const jump = Math.max(0, Math.sin(this.timeElapsed * 5)) * 40;
        this.offsetY = -jump * this.size;
      }
      if (this.animationVariant !== 2) {
        this.offsetX += (0 - this.offsetX) * dt * 5;
      }
    }
    else if (this.currentState === 'playing') {
      // 遊びのバリエーション (速度と横揺れ幅を落としてマイルドに)
      if (this.animationVariant === 0) {
        // はしゃぐ (左右に小さく揺れる)
        const sway = Math.sin(this.timeElapsed * 6) * 15;
        this.offsetX = sway * this.size;
        this.offsetY = -Math.abs(Math.cos(this.timeElapsed * 6)) * 10 * this.size;
      } else if (this.animationVariant === 1) {
        // 回転するようにはしゃぐ（横揺れを抑える）
        const sway = Math.sin(this.timeElapsed * 8) * 20;
        this.offsetX = sway * this.size;
        this.offsetY = -15 * this.size; // 少し浮いてる
      } else if (this.animationVariant === 2) {
        // 縦にバウンド
        const jump = Math.abs(Math.sin(this.timeElapsed * 7)) * 30;
        this.offsetY = -jump * this.size;
        this.offsetX += (0 - this.offsetX) * dt * 5;
      } else {
        // まったり揺れる
        const sway = Math.sin(this.timeElapsed * 4) * 20;
        this.offsetX = sway * this.size;
        this.offsetY = -5 * this.size;
      }
    }
    else if (this.currentState === 'slip') {
      // 転ぶアニメーション（横に倒れる・震える）
      this.offsetX += (0 - this.offsetX) * dt * 3; // オフセットは徐々に戻す
      
      // 目が回っているパーティクルをたまに出す
      if (Math.random() < 0.05) {
        this.emitParticles('note', 1); // 代替でnote等。文字を💫にするためtypeはなんでもよいが、専用なら増やせる
      }
    }

    // 物理ばねの更新
    const k = 60 + (this.bounce * 150); 
    const damping = 0.85;

    const forceY = -k * (this.scaleY - this.targetScaleY);
    this.velocityY += forceY * dt;
    this.scaleY += this.velocityY * dt;
    this.velocityY *= damping;

    const forceX = -k * (this.scaleX - this.targetScaleX);
    this.velocityX += forceX * dt;
    this.scaleX += this.velocityX * dt;
    this.velocityX *= damping;

    // 投擲アイテムの更新
    for (let i = this.flyingItems.length - 1; i >= 0; i--) {
      const item = this.flyingItems[i];
      
      if (item.isRolling) {
        // 地面を横にコロコロ転がる（重力無視）
        item.x += item.vx * dt;
        item.rotation += item.vx * 0.05 * dt;
        item.vx *= 0.98; // 少しずつ減速
      } else {
        // 通常の放物線
        item.vy += 800 * dt; // 重力
        item.x += item.vx * dt;
        item.y += item.vy * dt;
        item.rotation += item.angularVelocity * dt;
      }

      // あたり判定 (半径約50px)
      if (!item.isHit) {
        const dx = item.x - this.x;
        // ゲルぴよの頭（上部）付近であたり判定を取るように少し調整
        const dy = item.y - (this.y - 60 * this.size);
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 60 * this.size) {
          item.isHit = true;
          
          if (item.type === 'food') {
            item.onHit(false); // UI側のコールバック発火
            // 食べ物は当たったら消滅
            this.flyingItems.splice(i, 1);
            continue;
          } else if (item.type === 'toy') {
            // おもちゃ（サッカーボール等）の反発
            if (item.actionType === 'slip') {
              item.onHit(true);
              this.setState('slip', 2.0);
              
              // 【ミス】ボールは地面をゆっくり横にコロコロ転がる
              item.isRolling = true;
              item.y = this.y + 30 * this.size; // ゲルぴよの足元あたり
              item.vx = (Math.random() > 0.5 ? 1 : -1) * (80 + Math.random() * 50);
              item.vy = 0; 
              item.angularVelocity = 0;
              
              this.velocityY += 1.5; // 激しく沈む（転ぶ反動）
            } else {
              item.onHit(false);
              
              if (item.actionType === 'kick') {
                // 【キック】画面手前（下方向）へ蹴り返す
                item.y = this.y + 10 * this.size; // 足元から
                item.vx = (Math.random() > 0.5 ? 1 : -1) * (50 + Math.random() * 100);
                item.vy = 500 + Math.random() * 300; // 下方向に高速で飛ぶ
                item.angularVelocity = (Math.random() > 0.5 ? 1 : -1) * 20;
                
                this.velocityY += 1.0; // 蹴った反動
                this.offsetX += (Math.random() > 0.5 ? 1 : -1) * 30 * this.size; // 足を出したような横揺れ
              } else {
                // 【ヘディング】上方向へ打ち上げる
                item.y = this.y - 70 * this.size; // 頭から
                item.vx = (Math.random() > 0.5 ? 1 : -1) * (100 + Math.random() * 100);
                item.vy = -600 - Math.random() * 200;
                item.angularVelocity = (Math.random() > 0.5 ? 1 : -1) * 20;
                
                this.velocityY += 1.2;
                this.offsetY = -10 * this.size;
              }
            }
          }
        }
      } else {
        // ヒット済みで、下方向（手前）に飛んでいるボールはだんだん大きくする（手前に向かってくる表現）
        if (item.type === 'toy' && item.vy > 0 && !item.isRolling) {
          item.scale += dt * 3.5; // スケールを急速に拡大
        }
      }

      // 画面外に出たら消去（横方向の画面外も考慮）
      if (
        item.y > this.canvas.height / (window.devicePixelRatio || 1) + 100 ||
        item.x < -100 || 
        item.x > this.canvas.width / (window.devicePixelRatio || 1) + 100
      ) {
        this.flyingItems.splice(i, 1);
      }
    }

    // パーティクルの更新
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      // 重力
      p.vy += 300 * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  private draw() {
    const w = this.canvas.width / (window.devicePixelRatio || 1);
    const h = this.canvas.height / (window.devicePixelRatio || 1);
    
    this.ctx.clearRect(0, 0, w, h);

    const drawX = this.x + this.offsetX;
    const drawY = this.y + this.offsetY;

    // ドロップシャドウ
    this.ctx.save();
    this.ctx.translate(this.x, this.y); // 影はオフセット(ジャンプ)に追従させないが、Y位置は少し変える
    const shadowScale = Math.max(0.2, 1.0 - (-this.offsetY / 100)); // ジャンプすると影が小さくなる
    this.ctx.scale(this.size * this.scaleX * shadowScale, this.size * 0.25 * shadowScale);
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 60, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();

    // ゲルぴよ本体
    this.ctx.save();
    this.ctx.translate(drawX, drawY);
    
    const currentScaleY = this.size * this.scaleY;
    const currentScaleX = this.size * this.scaleX;
    
    const baseYOffset = 50; 
    this.ctx.translate(0, baseYOffset);
    
    // 左右の揺れや転倒の回転
    if (this.currentState === 'slip') {
      // 転んだ時は大きく傾ける（90度近く）
      const tiltDirection = this.offsetX >= 0 ? 1 : -1;
      this.ctx.rotate(tiltDirection * (Math.PI / 2.2));
    } else if (this.currentState === 'playing') {
      // バリエーション1の時は激しく回転させる
      if (this.animationVariant === 1) {
        this.ctx.rotate((this.offsetX / 100) * 0.8);
      } else {
        this.ctx.rotate((this.offsetX / 100) * 0.3);
      }
    } else if (this.currentState === 'feeding' && this.animationVariant === 2) {
      this.ctx.rotate((this.offsetX / 100) * 0.2);
    }
    
    this.ctx.scale(currentScaleX, currentScaleY);
    this.ctx.translate(0, -baseYOffset);

    if (this.imageLoaded) {
      const hueDiff = this.hue - 50;
      this.ctx.filter = `hue-rotate(${hueDiff}deg) saturate(1.2)`;
      
      const imgW = 120;
      const imgH = 120;
      this.ctx.drawImage(this.image, -imgW/2, -imgH/2, imgW, imgH);
    }
    this.ctx.restore();

    // パーティクル描画
    this.particles.forEach(p => {
      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.scale(p.scale, p.scale);
      this.ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      
      this.ctx.font = '28px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      
      let emoji = '✨';
      if (p.type === 'heart') emoji = '💖';
      if (p.type === 'food') emoji = '🍔';
      if (p.type === 'note') emoji = '🎵';

      this.ctx.fillText(emoji, 0, 0);
      this.ctx.restore();
    });

    // 投擲アイテム描画
    this.flyingItems.forEach(item => {
      this.ctx.save();
      this.ctx.translate(item.x, item.y);
      this.ctx.rotate(item.rotation);
      this.ctx.scale(item.scale, item.scale);
      
      this.ctx.font = '40px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(item.emoji, 0, 0);
      this.ctx.restore();
    });
  }
}
