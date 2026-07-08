// ============================================
// puzzle.ts - Match-3 Puzzle Engine (Refactored to Class)
// ============================================

import type { ColorType, SkillType, GameCallbacks } from './types';
import { BLOCK_SHAPES, COLOR_MAP, SKILL_PANEL_TYPES } from './types';
import { playClearSound, playSwapSound, playComboSound } from './audio';

const COLS = 6;
const ROWS = 6;
const BLOCK_COLORS: ColorType[] = ['red', 'blue', 'green', 'yellow', 'pink'];

const ANIM_SWAP_DURATION = 150;
const ANIM_CLEAR_DURATION = 300;
const ANIM_DROP_DURATION = 200;

interface CellData {
  color: ColorType;
  skill: SkillType | null;
}

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface AnimData {
  from?: { col: number; row: number };
  to?: { col: number; row: number };
  phase?: 'forward' | 'reverse';
  matches?: Array<{ cells: Array<{ col: number; row: number }>; color: ColorType }>;
}

/** キラキラのスパーク星を描画するヘルパー */
function drawSparkStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI / 4) * i;
    const radius = i % 2 === 0 ? r : r * 0.3;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export class PuzzleEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private grid: (CellData | null)[][] = [];
  
  private cellSize = 0;
  private offsetX = 0;
  private offsetY = 0;
  private canvasW = 0;
  private canvasH = 0;

  private animState: 'idle' | 'swapping' | 'clearing' | 'dropping' | 'spawning' = 'idle';
  private animTimer = 0;
  private animData: AnimData | null = null;
  private comboCount = 0;

  private particles: Particle[] = [];
  private callbacks: GameCallbacks;

  // Input state
  private touchId: number | null = null;
  private startX = 0;
  private startY = 0;
  private startCol = -1;
  private startRow = -1;
  private mouseDown = false;

  constructor(canvas: HTMLCanvasElement, callbacks: GameCallbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.callbacks = callbacks;

    // Initialize particle pool
    const MAX_PARTICLES = 250;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, color: '', size: 0 });
    }

    this.resize();
    this.generateGrid();
    let safety = 0;
    while (this.findMatches().length > 0 && safety < 100) {
      this.generateGrid();
      safety++;
    }

    this.bindInput();
  }

  public destroy() {
    this.unbindInput();
  }

  public resize() {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    if (!rect) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvasW = Math.floor(rect.width * dpr);
    this.canvasH = Math.floor(rect.height * dpr);
    this.canvas.width = this.canvasW;
    this.canvas.height = this.canvasH;

    const padding = this.canvasW * 0.06;
    const availW = this.canvasW - padding * 2;
    const availH = this.canvasH - padding * 2;
    this.cellSize = Math.floor(Math.min(availW / COLS, availH / ROWS));
    this.offsetX = Math.floor((this.canvasW - this.cellSize * COLS) / 2);
    this.offsetY = Math.floor((this.canvasH - this.cellSize * ROWS) / 2);
  }

  private generateGrid() {
    this.grid = [];
    for (let r = 0; r < ROWS; r++) {
      const row: (CellData | null)[] = [];
      for (let c = 0; c < COLS; c++) {
        row.push({ color: this.randomColor(), skill: null });
      }
      this.grid.push(row);
    }
  }

  private randomColor(): ColorType {
    return BLOCK_COLORS[Math.floor(Math.random() * BLOCK_COLORS.length)];
  }

  private cellColor(r: number, c: number): ColorType | null {
    const cell = this.grid[r]?.[c];
    return cell ? cell.color : null;
  }

  // --- Input Handling ---

  private getCanvasPos(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  private posToGrid(x: number, y: number) {
    const col = Math.floor((x - this.offsetX) / this.cellSize);
    const row = Math.floor((y - this.offsetY) / this.cellSize);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
    return { col, row };
  }

  private handleStart = (clientX: number, clientY: number) => {
    const pos = this.getCanvasPos(clientX, clientY);
    const gridPos = this.posToGrid(pos.x, pos.y);
    if (!gridPos) return false;
    this.startX = pos.x;
    this.startY = pos.y;
    this.startCol = gridPos.col;
    this.startRow = gridPos.row;
    return true;
  };

  private handleEnd = (clientX: number, clientY: number) => {
    const pos = this.getCanvasPos(clientX, clientY);
    const dx = pos.x - this.startX;
    const dy = pos.y - this.startY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 20) { // MIN_SWIPE_DIST
      this.handleTap(this.startCol, this.startRow);
      return;
    }

    let dirCol = 0;
    let dirRow = 0;
    if (Math.abs(dx) > Math.abs(dy)) {
      dirCol = dx > 0 ? 1 : -1;
    } else {
      dirRow = dy > 0 ? 1 : -1;
    }

    const toCol = this.startCol + dirCol;
    const toRow = this.startRow + dirRow;

    if (toCol < 0 || toCol >= COLS || toRow < 0 || toRow >= ROWS) return;
    this.handleSwap(this.startCol, this.startRow, toCol, toRow);
  };

  private onTouchStart = (e: TouchEvent) => {
    e.preventDefault();
    if (this.touchId !== null) return;
    const touch = e.changedTouches[0];
    if (this.handleStart(touch.clientX, touch.clientY)) {
      this.touchId = touch.identifier;
    }
  };

  private onTouchEnd = (e: TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === this.touchId) {
        this.handleEnd(touch.clientX, touch.clientY);
        this.touchId = null;
        break;
      }
    }
  };

  private onTouchMove = (e: TouchEvent) => { e.preventDefault(); };

  private onMouseDown = (e: MouseEvent) => {
    if (this.handleStart(e.clientX, e.clientY)) this.mouseDown = true;
  };

  private onMouseUp = (e: MouseEvent) => {
    if (this.mouseDown) {
      this.handleEnd(e.clientX, e.clientY);
      this.mouseDown = false;
    }
  };

  private bindInput() {
    this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
    this.canvas.addEventListener('touchend', this.onTouchEnd, { passive: false });
    this.canvas.addEventListener('touchmove', this.onTouchMove, { passive: false });
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
  }

  private unbindInput() {
    this.canvas.removeEventListener('touchstart', this.onTouchStart);
    this.canvas.removeEventListener('touchend', this.onTouchEnd);
    this.canvas.removeEventListener('touchmove', this.onTouchMove);
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
  }

  // --- Logic ---

  private handleTap(col: number, row: number) {
    if (this.animState !== 'idle') return;
    const cell = this.grid[row]?.[col];
    if (!cell || !cell.skill) return;

    const skillType = cell.skill;
    this.grid[row][col] = null;

    const sm = SKILL_PANEL_TYPES[skillType];
    this.spawnSkillParticles(
      this.offsetX + col * this.cellSize + this.cellSize / 2,
      this.offsetY + row * this.cellSize + this.cellSize / 2,
      sm.fill
    );

    (this.callbacks as any).onSkillActivate?.(skillType);

    this.animState = 'dropping';
    this.animTimer = 0;
    this.dropBlocks();
  }

  private handleSwap(c1: number, r1: number, c2: number, r2: number) {
    if (this.animState !== 'idle') return;
    const fromCell = this.grid[r1]?.[c1];
    const toCell = this.grid[r2]?.[c2];
    if (fromCell?.skill || toCell?.skill) return;

    playSwapSound();
    this.animState = 'swapping';
    this.animTimer = 0;
    this.animData = {
      from: { col: c1, row: r1 },
      to: { col: c2, row: r2 },
      phase: 'forward'
    };
  }

  private findMatches() {
    const matches: Array<{ cells: Array<{ col: number; row: number }>; color: ColorType }> = [];
    const matched = Array.from({ length: ROWS }, () => Array(COLS).fill(false));

    // Horizontal
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c <= COLS - 3; c++) {
        const color = this.cellColor(r, c);
        if (!color || this.grid[r][c]?.skill) continue;
        if (this.cellColor(r, c + 1) === color && !this.grid[r][c + 1]?.skill &&
            this.cellColor(r, c + 2) === color && !this.grid[r][c + 2]?.skill) {
          let end = c + 2;
          while (end + 1 < COLS && this.cellColor(r, end + 1) === color && !this.grid[r][end + 1]?.skill) end++;
          const cells = [];
          for (let i = c; i <= end; i++) {
            matched[r][i] = true;
            cells.push({ col: i, row: r });
          }
          matches.push({ cells, color });
          c = end;
        }
      }
    }

    // Vertical
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r <= ROWS - 3; r++) {
        const color = this.cellColor(r, c);
        if (!color || this.grid[r][c]?.skill) continue;
        if (this.cellColor(r + 1, c) === color && !this.grid[r + 1][c]?.skill &&
            this.cellColor(r + 2, c) === color && !this.grid[r + 2][c]?.skill) {
          let end = r + 2;
          while (end + 1 < ROWS && this.cellColor(end + 1, c) === color && !this.grid[end + 1][c]?.skill) end++;
          const cells = [];
          for (let i = r; i <= end; i++) {
            if (!matched[i][c]) {
              matched[i][c] = true;
              cells.push({ col: c, row: i });
            }
          }
          if (cells.length > 0) matches.push({ cells, color });
          r = end;
        }
      }
    }
    return matches;
  }

  private clearMatches(matches: Array<{ cells: Array<{ col: number; row: number }>; color: ColorType }>) {
    const clearedColors: Partial<Record<ColorType, number>> = {};
    let totalCleared = 0;

    for (const match of matches) {
      if (!clearedColors[match.color]) clearedColors[match.color] = 0;
      const matchSize = match.cells.length;

      let skillType: SkillType | null = null;
      let skillCellIdx: number | null = null;
      if (matchSize >= 5) {
        skillType = 'heal';
        skillCellIdx = Math.floor(matchSize / 2);
      } else if (matchSize === 4) {
        skillType = 'bomb';
        skillCellIdx = Math.floor(matchSize / 2);
      }

      for (let i = 0; i < match.cells.length; i++) {
        const cell = match.cells[i];
        if (this.grid[cell.row][cell.col] !== null) {
          this.spawnParticles(
            this.offsetX + cell.col * this.cellSize + this.cellSize / 2,
            this.offsetY + cell.row * this.cellSize + this.cellSize / 2,
            COLOR_MAP[match.color].fill
          );

          if (skillType && i === skillCellIdx) {
            this.grid[cell.row][cell.col] = { color: match.color, skill: skillType };
          } else {
            this.grid[cell.row][cell.col] = null;
          }
          if (i !== skillCellIdx || !skillType) {
            clearedColors[match.color]!++;
            totalCleared++;
          }
        }
      }
    }

    const baseScore = totalCleared * 10;
    const comboMultiplier = 1 + this.comboCount * 0.5;
    const score = Math.floor(baseScore * comboMultiplier);
    this.callbacks.onScoreUpdate?.(score);

    for (const colorStr of Object.keys(clearedColors)) {
      const color = colorStr as ColorType;
      const count = clearedColors[color]!;
      if (count >= 3) {
        const power = Math.min(count - 2, 3);
        (this.callbacks as any).onUnitSpawn?.(color, this.comboCount, power);
      }
    }

    playClearSound();
    if (this.comboCount > 0) {
      playComboSound(this.comboCount);
    }

    this.comboCount++;
    this.callbacks.onComboUpdate?.(this.comboCount);
  }

  private dropBlocks() {
    let dropped = false;
    for (let c = 0; c < COLS; c++) {
      let writeRow = ROWS - 1;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (this.grid[r][c] !== null) {
          if (writeRow !== r) {
            this.grid[writeRow][c] = this.grid[r][c];
            this.grid[r][c] = null;
            dropped = true;
          }
          writeRow--;
        }
      }
      for (let r = writeRow; r >= 0; r--) {
        this.grid[r][c] = { color: this.randomColor(), skill: null };
        dropped = true;
      }
    }
    return dropped;
  }

  // --- Particles ---

  private spawnParticles(cx: number, cy: number, color: string) {
    const count = 12; // パーティクル数を増加
    for (let i = 0; i < count; i++) {
      const p = this.particles.find(p => !p.active);
      if (!p) break;
      const angle = (Math.PI * 2 / count) * i + Math.random() * 0.4;
      const speed = 1.5 + Math.random() * 5;
      p.active = true;
      p.x = cx;
      p.y = cy;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 1;
      p.maxLife = 0.45 + Math.random() * 0.35;
      p.color = color;
      p.size = 3.5 + Math.random() * 3.5;
    }
  }

  private spawnSkillParticles(cx: number, cy: number, color: string) {
    const count = 30; // 特殊ブロック用
    for (let i = 0; i < count; i++) {
      const p = this.particles.find(p => !p.active);
      if (!p) break;
      const angle = (Math.PI * 2 / count) * i + Math.random() * 0.3;
      const speed = 3.5 + Math.random() * 8.5;
      p.active = true;
      p.x = cx;
      p.y = cy;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 1;
      p.maxLife = 0.55 + Math.random() * 0.45;
      p.color = color;
      p.size = 5.5 + Math.random() * 6.5;
    }
  }

  // --- Update & Render ---

  public update(dt: number) {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life -= dt / 1000 / p.maxLife;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12; // 重力微調整
      p.vx *= 0.97;
    }

    if (this.animState === 'swapping' && this.animData) {
      this.animTimer += dt;
      if (this.animTimer >= ANIM_SWAP_DURATION) {
        if (this.animData.phase === 'forward') {
          const { from, to } = this.animData;
          if (from && to) {
            const temp = this.grid[from.row][from.col];
            this.grid[from.row][from.col] = this.grid[to.row][to.col];
            this.grid[to.row][to.col] = temp;

            const matches = this.findMatches();
            if (matches.length > 0) {
              this.comboCount = 0;
              this.animState = 'clearing';
              this.animTimer = 0;
              this.animData = { matches };
              this.clearMatches(matches);
            } else {
              const temp2 = this.grid[from.row][from.col];
              this.grid[from.row][from.col] = this.grid[to.row][to.col];
              this.grid[to.row][to.col] = temp2;
              this.animState = 'swapping';
              this.animTimer = 0;
              this.animData.phase = 'reverse';
            }
          }
        } else {
          this.animState = 'idle';
          this.animData = null;
        }
      }
    } else if (this.animState === 'clearing') {
      this.animTimer += dt;
      if (this.animTimer >= ANIM_CLEAR_DURATION) {
        this.dropBlocks();
        this.animState = 'dropping';
        this.animTimer = 0;
      }
    } else if (this.animState === 'dropping') {
      this.animTimer += dt;
      if (this.animTimer >= ANIM_DROP_DURATION) {
        const matches = this.findMatches();
        if (matches.length > 0) {
          this.animState = 'clearing';
          this.animTimer = 0;
          this.animData = { matches };
          this.clearMatches(matches);
        } else {
          this.animState = 'idle';
          this.animData = null;
          this.comboCount = 0;
          this.callbacks.onComboUpdate?.(0);
        }
      }
    }
  }

  public render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvasW, this.canvasH);

    // グリッド線
    ctx.strokeStyle = 'rgba(100, 100, 200, 0.12)';
    ctx.lineWidth = 1;
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(this.offsetX, this.offsetY + r * this.cellSize);
      ctx.lineTo(this.offsetX + COLS * this.cellSize, this.offsetY + r * this.cellSize);
      ctx.stroke();
    }
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(this.offsetX + c * this.cellSize, this.offsetY);
      ctx.lineTo(this.offsetX + c * this.cellSize, this.offsetY + ROWS * this.cellSize);
      ctx.stroke();
    }

    const pad = this.cellSize * 0.1;
    const blockSize = this.cellSize - pad * 2;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = this.grid[r][c];
        if (!cell) continue;

        const { color, skill } = cell;

        let drawX = this.offsetX + c * this.cellSize + pad;
        let drawY = this.offsetY + r * this.cellSize + pad;

        if (this.animState === 'swapping' && this.animData) {
          const progress = Math.min(this.animTimer / ANIM_SWAP_DURATION, 1);
          const ease = this.animData.phase === 'reverse' ? (1 - progress) : progress;
          const { from, to } = this.animData;

          if (from && to) {
            if (c === from.col && r === from.row) {
              drawX += (to.col - from.col) * this.cellSize * ease;
              drawY += (to.row - from.row) * this.cellSize * ease;
            } else if (c === to.col && r === to.row) {
              drawX += (from.col - to.col) * this.cellSize * ease;
              drawY += (from.row - to.row) * this.cellSize * ease;
            }
          }
        }

        let scale = 1;
        let alpha = 1;
        if (this.animState === 'clearing' && this.animData?.matches) {
          const isClearing = this.animData.matches.some(m =>
            m.cells.some(cell => cell.col === c && cell.row === r)
          );
          if (isClearing && !skill) {
            const progress = Math.min(this.animTimer / ANIM_CLEAR_DURATION, 1);
            scale = 1 - progress * 0.5;
            alpha = 1 - progress;
          }
        }

        ctx.save();
        ctx.globalAlpha = alpha;

        const cx = drawX + blockSize / 2;
        const cy = drawY + blockSize / 2;

        if (scale !== 1) {
          ctx.translate(cx, cy);
          ctx.scale(scale, scale);
          ctx.translate(-cx, -cy);
        }

        if (skill) {
          const sm = SKILL_PANEL_TYPES[skill];
          const cm = COLOR_MAP[color];
          const pulse = 1 + Math.sin(Date.now() / 250) * 0.07;
          
          ctx.translate(cx, cy);
          ctx.scale(pulse, pulse);
          ctx.translate(-cx, -cy);

          const radius = blockSize * 0.28;
          this.drawRoundRect(ctx, drawX, drawY, blockSize, blockSize, radius);

          ctx.shadowColor = sm.glow;
          ctx.shadowBlur = 18;
          const grad = ctx.createLinearGradient(drawX, drawY, drawX, drawY + blockSize);
          grad.addColorStop(0, sm.light);
          grad.addColorStop(1, sm.fill);
          ctx.fillStyle = grad;
          ctx.fill();
          ctx.strokeStyle = sm.fill;
          ctx.lineWidth = 2.5;
          ctx.stroke();
          ctx.shadowBlur = 0;

          // 3Dシャドウ
          ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
          ctx.fillRect(drawX, drawY + blockSize * 0.85, blockSize, blockSize * 0.15);

          // ツヤハイライト（上部）
          ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
          ctx.beginPath();
          ctx.ellipse(cx, drawY + blockSize * 0.25, blockSize * 0.35, blockSize * 0.12, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = cm.fill;
          ctx.globalAlpha = 0.2;
          ctx.fillRect(drawX + blockSize * 0.6, drawY, blockSize * 0.4, blockSize * 0.4);
          ctx.globalAlpha = alpha;

          const fontSize = blockSize * 0.55;
          ctx.font = `${fontSize}px Outfit, serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#fff';
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = 4;
          ctx.fillText(sm.label, cx, cy);
          ctx.shadowBlur = 0;

        } else {
          const cm = COLOR_MAP[color];
          const radius = blockSize * 0.2;
          this.drawRoundRect(ctx, drawX, drawY, blockSize, blockSize, radius);

          const grad = ctx.createLinearGradient(drawX, drawY, drawX, drawY + blockSize);
          grad.addColorStop(0, cm.light);
          grad.addColorStop(1, cm.fill);
          ctx.fillStyle = grad;
          ctx.fill();

          // 3Dシャドウ
          ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
          ctx.fillRect(drawX, drawY + blockSize * 0.82, blockSize, blockSize * 0.18);

          // ツヤハイライト（上部）
          ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.beginPath();
          ctx.ellipse(cx, drawY + blockSize * 0.24, blockSize * 0.33, blockSize * 0.11, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.shadowColor = cm.glow;
          ctx.shadowBlur = 10;
          ctx.strokeStyle = cm.fill;
          ctx.lineWidth = 1.8;
          ctx.stroke();
          ctx.shadowBlur = 0;

          this.drawBlockShape(ctx, cx, cy, blockSize * 0.28, BLOCK_SHAPES[color]);
        }

        ctx.restore();
      }
    }

    // パーティクル描画 (キラキラ星エフェクト)
    for (const p of this.particles) {
      if (!p.active) continue;
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.life * 4.5);
      drawSparkStar(ctx, 0, 0, p.size * p.life);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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

  private drawBlockShape(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, shape: string) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();

    switch (shape) {
      case 'diamond':
        ctx.moveTo(cx, cy - size);
        ctx.lineTo(cx + size, cy);
        ctx.lineTo(cx, cy + size);
        ctx.lineTo(cx - size, cy);
        break;
      case 'circle':
        ctx.arc(cx, cy, size * 0.8, 0, Math.PI * 2);
        break;
      case 'triangle':
        ctx.moveTo(cx, cy - size);
        ctx.lineTo(cx + size, cy + size * 0.7);
        ctx.lineTo(cx - size, cy + size * 0.7);
        break;
      case 'star': {
        const spikes = 5;
        const outerR = size;
        const innerR = size * 0.45;
        for (let i = 0; i < spikes * 2; i++) {
          const r = i % 2 === 0 ? outerR : innerR;
          const angle = (Math.PI / spikes) * i - Math.PI / 2;
          const px = cx + Math.cos(angle) * r;
          const py = cy + Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        break;
      }
      case 'heart': {
        const s = size * 0.9;
        ctx.moveTo(cx, cy + s * 0.7);
        ctx.bezierCurveTo(cx - s * 1.2, cy - s * 0.2, cx - s * 0.6, cy - s * 1.1, cx, cy - s * 0.4);
        ctx.bezierCurveTo(cx + s * 0.6, cy - s * 1.1, cx + s * 1.2, cy - s * 0.2, cx, cy + s * 0.7);
        break;
      }
    }
    ctx.closePath();
    ctx.fill();
  }
}
