import type { GameRuntimeState, ImageAssets, TurnResult } from './types';
import { TOTAL_TURNS } from './types';

/** Canvas描画メイン関数 */
export function drawGame(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  state: GameRuntimeState,
  images: ImageAssets,
  assetsLoaded: boolean,
): void {
  const now = performance.now();

  // --- 1. 背景描画 ---
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (images.bg && assetsLoaded) {
    ctx.drawImage(images.bg, 0, 0, canvas.width, canvas.height);
  } else {
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#3b1c0a');
    grad.addColorStop(0.5, '#7c3f12');
    grad.addColorStop(1, '#a66023');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (state.screen !== 'playing') return;

  // --- 2. ターゲットの描画 ---
  if (state.target) {
    const target = state.target;

    ctx.save();
    ctx.translate(target.x, target.y);
    ctx.scale(target.scale, target.scale);

    if (target.isShot && target.shotTime) {
      const elapsedShot = now - target.shotTime;
      target.fadeOut = Math.max(0, 1 - elapsedShot / 200);
      ctx.globalAlpha = target.fadeOut;
      ctx.rotate((elapsedShot / 200) * Math.PI * 0.25);
    }

    const img = target.type === 'enemy' ? images.enemy : images.friendly;

    if (img && assetsLoaded && img.complete && img.naturalWidth !== 0) {
      const size = target.radius * 2;
      ctx.drawImage(img, -target.radius, -target.radius, size, size);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, target.radius, 0, Math.PI * 2);
      ctx.fillStyle = target.type === 'enemy' ? '#111' : '#ffcc00';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 4;
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fff';
      if (target.type === 'enemy') {
        ctx.beginPath();
        ctx.moveTo(-15, -10); ctx.lineTo(-5, -5);
        ctx.moveTo(15, -10); ctx.lineTo(5, -5);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = '#000';
        ctx.fillRect(-22, -12, 44, 10);
      } else {
        ctx.beginPath();
        ctx.arc(-10, -5, 3, 0, Math.PI * 2);
        ctx.arc(10, -5, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#000';
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // --- 3. 銃撃エフェクト ---
  state.shotEffects = state.shotEffects.filter((effect) => {
    const elapsed = now - effect.time;
    if (elapsed > 200) return false;

    effect.radius = 5 + (elapsed / 200) * 20;
    effect.opacity = 1 - elapsed / 200;

    ctx.save();
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(212, 175, 55, ${effect.opacity})`;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(effect.x, effect.y, 2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${effect.opacity})`;
    ctx.fill();
    ctx.restore();

    return true;
  });

  // --- 4. パーティクル ---
  state.particles = state.particles.filter((p) => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.1;
    p.life--;

    if (p.life <= 0) return false;

    ctx.save();
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.restore();

    return true;
  });

  // --- 5. フィードバックテキスト ---
  if (state.feedbackText) {
    const textObj = state.feedbackText;
    const elapsed = now - state.feedbackStartTime;

    if (elapsed < 1000) {
      textObj.scale = 0.5 + Math.min(0.5, elapsed / 150) * 0.5;
      if (elapsed > 700) {
        textObj.opacity = 1 - (elapsed - 700) / 300;
      }

      ctx.save();
      ctx.font = "bold 28px 'Press Start 2P', cursive, sans-serif";
      ctx.fillStyle = textObj.color;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 6;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = textObj.opacity;

      ctx.translate(canvas.width / 2, canvas.height * 0.25);
      ctx.scale(textObj.scale, textObj.scale);
      ctx.strokeText(textObj.text, 0, 0);
      ctx.fillText(textObj.text, 0, 0);
      ctx.restore();
    }
  }

  // --- 6. HUD ---
  drawHUD(ctx, canvas, state);
}

/** HUD（ターン進行度等） */
function drawHUD(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  state: GameRuntimeState,
): void {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.fillRect(0, 0, canvas.width, 50);

  ctx.fillStyle = '#ffcc00';
  ctx.font = "bold 14px 'Outfit', sans-serif";
  ctx.textAlign = 'left';
  ctx.fillText(`TURN: ${state.turn + 1} / ${TOTAL_TURNS}`, 20, 30);

  const circleRadius = 6;
  const startX = canvas.width - 120;
  for (let i = 0; i < TOTAL_TURNS; i++) {
    const cx = startX + i * 20;
    const cy = 27;

    ctx.beginPath();
    ctx.arc(cx, cy, circleRadius, 0, Math.PI * 2);

    const result = state.results[i];
    if (result) {
      if (result.status === 'hit' || result.status === 'safe') {
        ctx.fillStyle = '#4caf50';
      } else {
        ctx.fillStyle = '#f44336';
      }
    } else if (i === state.turn) {
      ctx.fillStyle = '#ffcc00';
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
    }
    ctx.fill();
  }
  ctx.restore();
}

/** 平均タイム算出ヘルパー */
export function getAverageTimeStr(gameResults: TurnResult[], penaltyMs: number): string {
  const validResults = gameResults.filter((r) => r.status !== 'safe');
  if (validResults.length === 0) return '--';

  const sum = validResults.reduce((acc, curr) => {
    const time = curr.status === 'hit' ? curr.time || penaltyMs : penaltyMs;
    return acc + time;
  }, 0);
  return `${((sum / validResults.length) / 1000).toFixed(3)}s`;
}
