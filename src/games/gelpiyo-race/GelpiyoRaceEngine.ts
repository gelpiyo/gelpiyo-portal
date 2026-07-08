export type Difficulty = 'easy' | 'normal' | 'hard';

/** 2D座標 */
interface Point2D {
  x: number;
  y: number;
}

export interface GameState {
  status: 'TITLE' | 'RACE' | 'RESULT';
  playerProgress: number; // 0 to 10000
  timeMs: number;
  rank: number;
  isPenalty: boolean;
  records: Record<Difficulty, number | null>;
}

export class GelpiyoRaceEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animationFrameId: number = 0;
  

  private startTime: number = 0;
  private goalDistance = 10000;
  
  private hasFinished = false;

  private player = { y: 0, speed: 0, penaltyTimer: 0, lane: 0 };
  private cpus = [
    { y: 0, speed: 0, baseSpeed: 0, lane: -1, color: '#e74c3c' }, // CPU1 (左側)
    { y: 0, speed: 0, baseSpeed: 0, lane: 1, color: '#2ecc71' }   // CPU2 (右側)
  ];
  
  private lastTime: number = 0;
  public status: 'TITLE' | 'RACE' | 'RESULT' = 'TITLE';
  public onFinish?: (rank: number, timeMs: number) => void;
  public onUpdate?: (state: GameState) => void;
  
  private pathData: { x: number, y: number, length: number }[] = [];
  private pathTotalLength: number = 0;
  
  // アセット用変数
  private grassPattern: CanvasPattern | null = null;
  private asphaltPattern: CanvasPattern | null = null;
  private charImg: HTMLImageElement | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', this.resize);
    
    // アセットのロード
    this.loadAssets();
    
    // マウント時から常に描画ループを回す
    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  private resize = () => {
    if (this.canvas.clientWidth > 0) {
      this.canvas.width = this.canvas.clientWidth;
      this.canvas.height = this.canvas.clientHeight;
      this.generatePathPoints(this.canvas.width, this.canvas.height);
    }
  };

  private async loadAssets() {
    const loadImage = (src: string) => {
      return new Promise<HTMLImageElement>((resolve) => {
        const img = new Image();
        img.src = src;
        img.onload = () => resolve(img);
        img.onerror = () => resolve(img); // エラー時も進める（フォールバック用）
      });
    };

    try {
      const baseUrl = import.meta.env.BASE_URL || './';
      const grassImg = await loadImage(`${baseUrl}assets/texture_grass.png`);
      const asphaltImg = await loadImage(`${baseUrl}assets/texture_asphalt.png`);
      this.charImg = await loadImage(`${baseUrl}assets/factory/characters/gelpiyo_transparent.png`);
      
      // パターンの生成（画像が正しく読み込めた場合のみ）
      if (grassImg.width > 0) this.grassPattern = this.ctx.createPattern(grassImg, 'repeat');
      if (asphaltImg.width > 0) this.asphaltPattern = this.ctx.createPattern(asphaltImg, 'repeat');
    } catch (e) {
      console.warn("アセットのロードに失敗しました:", e);
    }
  }

  private generatePathPoints(w: number, h: number) {
    // 添付画像（マリオサーキット風）を模した複雑なループコースの制御点
    const ctrlPoints = [
      { x: w * 0.6,  y: h * 0.85 }, // 1. スタート（下部やや右）
      { x: w * 0.85, y: h * 0.85 }, // 2. 右下カーブ
      { x: w * 0.9,  y: h * 0.4 },  // 3. 右ストレート上昇
      { x: w * 0.8,  y: h * 0.1 },  // 4. 右上の大カーブ入り口
      { x: w * 0.55, y: h * 0.2 },  // 5. 中央へ下りてくる
      { x: w * 0.7,  y: h * 0.5 },  // 6. 再び右へ膨らむ
      { x: w * 0.3,  y: h * 0.5 },  // 7. 中央の長い横断ストレート
      { x: w * 0.15, y: h * 0.3 },  // 8. 左側を上昇
      { x: w * 0.2,  y: h * 0.1 },  // 9. 左上のヘアピン
      { x: w * 0.4,  y: h * 0.15 }, // 10. 下へ向かう
      { x: w * 0.2,  y: h * 0.6 },  // 11. 左下へ大きく斜行
      { x: w * 0.15, y: h * 0.85 }, // 12. 左下カーブ
      { x: w * 0.4,  y: h * 0.9 },  // 13. 右上へ波打つ
      { x: w * 0.55, y: h * 0.75 }, // 14. 
      { x: w * 0.75, y: h * 0.7 },  // 15. 右へ
    ];
    
    // スプラインを完全に閉じたループにするため、配列をラップアラウンドさせる
    const N = ctrlPoints.length;
    const p = [
      ctrlPoints[N - 1], // ダミー始点
      ...ctrlPoints,
      ctrlPoints[0],     // ループを閉じるための点
      ctrlPoints[1],     // ダミー終点
    ];
    
    const points = [];
    const segments = ctrlPoints.length; // ループなので点数と同じ数のセグメント
    for (let i = 0; i < segments; i++) {
      for (let t = 0; t < 1; t += 0.05) { // 1区間を20分割
        points.push(this.catmullRom(p[i], p[i+1], p[i+2], p[i+3], t));
      }
    }
    // 完全に閉じるため、最初の点を最後にも追加
    points.push(points[0]);
    
    let totalLength = 0;
    const pathData = [];
    pathData.push({ ...points[0], length: 0 });
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i-1].x;
      const dy = points[i].y - points[i-1].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      totalLength += dist;
      pathData.push({ ...points[i], length: totalLength });
    }
    this.pathData = pathData;
    this.pathTotalLength = totalLength;
  }

  private catmullRom(p0: Point2D, p1: Point2D, p2: Point2D, p3: Point2D, t: number): Point2D {
    const t2 = t * t;
    const t3 = t2 * t;
    return {
      x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
      y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
    };
  }

  private getPointOnPath(progress: number, laneOffset: number) {
    if (this.pathTotalLength === 0 || this.pathData.length < 2) return { x: 0, y: 0, angle: 0 };
    
    // 5周で10000m (1周2000m)
    const LAPS = 5;
    const lapDistance = this.goalDistance / LAPS;
    
    // progress を 1周の長さにマッピング（無限ループ）
    let targetLen = (progress / lapDistance) * this.pathTotalLength;
    // ループ内でラップさせる
    targetLen = targetLen % this.pathTotalLength;
    if (targetLen < 0) targetLen += this.pathTotalLength; // マイナス対応

    // パス上を探索して補間
    for (let i = 1; i < this.pathData.length; i++) {
      if (targetLen <= this.pathData[i].length) {
        const p0 = this.pathData[i - 1];
        const p1 = this.pathData[i];
        const segLen = p1.length - p0.length;
        const t = segLen === 0 ? 0 : (targetLen - p0.length) / segLen;
        
        const baseX = p0.x + (p1.x - p0.x) * t;
        const baseY = p0.y + (p1.y - p0.y) * t;
        const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
        
        const nx = Math.cos(angle + Math.PI / 2);
        const ny = Math.sin(angle + Math.PI / 2);
        return { x: baseX + nx * laneOffset, y: baseY + ny * laneOffset, angle };
      }
    }
    
    // 万が一見つからなかった場合は最後の点
    const pLast = this.pathData[this.pathData.length - 1];
    const pPrev = this.pathData[this.pathData.length - 2];
    const angle = Math.atan2(pLast.y - pPrev.y, pLast.x - pPrev.x);
    const nx = Math.cos(angle + Math.PI / 2);
    const ny = Math.sin(angle + Math.PI / 2);
    return { x: pLast.x + nx * laneOffset, y: pLast.y + ny * laneOffset, angle };
  }

  public start(difficulty: Difficulty) {
    this.status = 'RACE';
    this.hasFinished = false;
    this.player = { y: 0, speed: 0, penaltyTimer: 0, lane: 0 };
    
    // 短距離走（10〜20秒）のバランス調整
    // 目標が10000、15秒でゴールするには平均速度 約666
    const speedMult = difficulty === 'easy' ? 0.6 : difficulty === 'normal' ? 1.0 : 1.4;
    this.cpus.forEach(cpu => {
      cpu.y = 0;
      cpu.speed = 0;
      cpu.baseSpeed = (600 + Math.random() * 200) * speedMult; 
    });
    
    this.startTime = performance.now();
    this.lastTime = this.startTime;
  }

  public tap(isCorrect: boolean) {
    if (this.status !== 'RACE') return;
    if (this.player.penaltyTimer > 0) return; // ペナルティ中は無視

    if (!isCorrect) {
      // ミス：ペナルティ発生（つまずき）
      this.player.penaltyTimer = 1000; // 1秒間操作不能
      this.player.speed = 0; // 速度ゼロ
    } else {
      // 成功：加速
      this.player.speed += 300; // 1タップでの加速量
      if (this.player.speed > 1500) this.player.speed = 1500; // 最高速度
    }
  }

  private loop = (timestamp: number) => {
    // タイトル画面の時は描画だけ行う
    if (this.status === 'TITLE') {
      this.draw();
      this.animationFrameId = requestAnimationFrame(this.loop);
      return;
    }
    
    const dt = (timestamp - this.lastTime) / 1000; // seconds
    this.lastTime = timestamp;

    this.update(dt);
    this.draw();
    
    // 通知
    if (this.onUpdate) {
      const currentRank = this.calculateRank();
      this.onUpdate({
        status: this.status,
        playerProgress: this.player.y,
        timeMs: timestamp - this.startTime,
        rank: currentRank,
        isPenalty: this.player.penaltyTimer > 0,
        records: { easy: null, normal: null, hard: null }
      });
    }

    if (!this.hasFinished && this.player.y >= this.goalDistance) {
      this.hasFinished = true;
      this.status = 'RESULT';
      const finalTime = timestamp - this.startTime;
      const finalRank = this.calculateRank();
      if (this.onFinish) this.onFinish(finalRank, finalTime);
    }

    // ゴール後もアニメーション継続
    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  private calculateRank() {
    let rank = 1;
    for (const cpu of this.cpus) {
      if (cpu.y > this.player.y) rank++;
    }
    return rank;
  }

  private update(dt: number) {
    const safeDt = Math.min(dt, 0.1);

    // プレイヤーの更新
    if (this.player.y > this.goalDistance + 200) {
      // ゴール後はブレーキ
      this.player.speed -= 1000 * safeDt;
      if (this.player.speed < 0) this.player.speed = 0;
    } else if (this.player.penaltyTimer > 0) {
      this.player.penaltyTimer -= safeDt * 1000;
    } else {
      this.player.speed -= 400 * safeDt; 
      if (this.player.speed < 0) this.player.speed = 0;
    }
    this.player.y += this.player.speed * safeDt;

    // CPUの更新
    this.cpus.forEach(cpu => {
      if (cpu.y > this.goalDistance + 200) {
        // CPUもゴール後はブレーキ
        cpu.speed -= 1000 * safeDt;
        if (cpu.speed < 0) cpu.speed = 0;
      } else {
        const targetSpeed = cpu.baseSpeed + Math.sin(this.lastTime / 500) * 100;
        cpu.speed += (targetSpeed - cpu.speed) * safeDt * 2;
      }
      cpu.y += cpu.speed * safeDt;
    });
  }

  private draw() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    
    if (this.pathData.length === 0) return;

    // トラックの幅を画像に合わせてかなり細くする（画面幅の15%程度）
    const trackWidth = w * 0.15;
    const laneWidth = trackWidth / 3;

    // 背景（芝生テクスチャ または フォールバックのダークグリーン）
    if (this.grassPattern) {
      this.ctx.fillStyle = this.grassPattern;
    } else {
      this.ctx.fillStyle = '#111827';
    }
    this.ctx.fillRect(0, 0, w, h);
    
    // 曲線の描画スタイル設定
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    // トラック（アスファルトテクスチャ または フォールバックのオレンジ）
    if (this.asphaltPattern) {
      this.ctx.strokeStyle = this.asphaltPattern;
    } else {
      this.ctx.strokeStyle = '#d97706';
    }
    this.ctx.lineWidth = trackWidth;
    this.ctx.beginPath();
    this.ctx.moveTo(this.pathData[0].x, this.pathData[0].y);
    for (let i = 1; i < this.pathData.length; i++) {
      this.ctx.lineTo(this.pathData[i].x, this.pathData[i].y);
    }
    this.ctx.closePath();
    this.ctx.stroke();

    // レーンの区切り線（白の破線）
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([10, 10]);
    // 左右の区切り線を描画
    for (const offset of [-laneWidth / 2, laneWidth / 2]) {
      this.ctx.beginPath();
      for (let i = 0; i < this.pathData.length; i++) {
        const p0 = i === 0 ? this.pathData[this.pathData.length - 2] : this.pathData[i - 1];
        const p1 = i === this.pathData.length - 1 ? this.pathData[1] : this.pathData[i + 1];
        const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
        const nx = Math.cos(angle + Math.PI / 2);
        const ny = Math.sin(angle + Math.PI / 2);
        const x = this.pathData[i].x + nx * offset;
        const y = this.pathData[i].y + ny * offset;
        if (i === 0) this.ctx.moveTo(x, y);
        else this.ctx.lineTo(x, y);
      }
      this.ctx.closePath();
      this.ctx.stroke();
    }
    this.ctx.setLineDash([]); // リセット
    
    // スタート＆ゴールライン (progress = 0)
    const linePos = this.getPointOnPath(0, 0);
    this.ctx.translate(linePos.x, linePos.y);
    this.ctx.rotate(linePos.angle);
    
    // チェッカーフラッグ風のスタート/ゴールライン
    const segmentWidth = trackWidth / 8;
    for (let i = 0; i < 8; i++) {
      this.ctx.fillStyle = i % 2 === 0 ? 'white' : 'black';
      this.ctx.fillRect(-5, -trackWidth / 2 + i * segmentWidth, 10, segmentWidth);
    }
    this.ctx.fillStyle = 'white';
    this.ctx.font = 'bold 12px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    
    // 何周目かを表示
    const LAPS = 5;
    const lapDistance = this.goalDistance / LAPS;
    const currentLap = Math.min(LAPS, Math.floor(this.player.y / lapDistance) + 1);
    this.ctx.fillText(`LAP ${currentLap}/${LAPS}`, -20, 0);
    
    this.ctx.resetTransform();

    // キャラクターの描画サイズ
    const charRadius = Math.max(12, Math.min(20, laneWidth * 0.6));

    const drawCharacter = (y: number, lane: number, colorFilter: string) => {
      const pos = this.getPointOnPath(y, lane * laneWidth);
      
      this.ctx.translate(pos.x, pos.y);
      this.ctx.rotate(pos.angle + Math.PI / 2); // 進行方向を上にする
      
      if (this.charImg && this.charImg.width > 0) {
        // 画像を描画（フィルターで色を変える）
        this.ctx.filter = colorFilter;
        // SVGは中心がアンカーになるように描画
        this.ctx.drawImage(this.charImg, -charRadius, -charRadius, charRadius * 2, charRadius * 2);
        this.ctx.filter = 'none'; // リセット
      } else {
        // フォールバック（丸いドット）
        this.ctx.beginPath();
        this.ctx.arc(0, 0, charRadius, 0, Math.PI * 2);
        this.ctx.fillStyle = colorFilter.includes('90deg') ? '#e74c3c' : (colorFilter.includes('270deg') ? '#3498db' : '#f1c40f');
        this.ctx.fill();
      }
      this.ctx.resetTransform();
    };

    // CPU描画
    this.cpus.forEach((cpu, index) => {
      const hue = index === 0 ? 'hue-rotate(90deg)' : 'hue-rotate(270deg)';
      drawCharacter(cpu.y, cpu.lane, hue);
    });

    // プレイヤー描画
    if (this.player.penaltyTimer > 0 && Math.floor(this.lastTime / 100) % 2 === 0) {
      // 点滅時は描画しない
    } else {
      drawCharacter(this.player.y, this.player.lane, 'none');
    }
  }

  public cleanup() {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    window.removeEventListener('resize', this.resize);
  }
}
