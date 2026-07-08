import type { GameState } from './types';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, PLAYER_W, PLAYER_H,
  ENEMY_W, ENEMY_H, BULLET_W, BULLET_H, UFO_W, UFO_H,
  BLOCK_SIZE,
} from './types';

/** Canvas描画処理 */
export function draw(ctx: CanvasRenderingContext2D, s: GameState): void {
  // 背景クリア
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  if (s.mode === 'title') {
    ctx.fillStyle = '#0f0';
    ctx.font = '24px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('INVADER', CANVAS_WIDTH / 2, 150);
    ctx.font = '12px "Courier New", monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText(`HI-SCORE: ${s.highScore}`, CANVAS_WIDTH / 2, 200);
    
    // 點滅
    if (Math.floor(Date.now() / 500) % 2 === 0) {
      ctx.fillText('TAP [FIRE] TO START', CANVAS_WIDTH / 2, 300);
    }
    return;
  }

  // --- ゲーム描画 ---
  
  // 星空エフェクト（簡易）
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 20; i++) {
    const sx = (Math.sin(i * 123 + Date.now() * 0.001) * 0.5 + 0.5) * CANVAS_WIDTH;
    const sy = (Math.cos(i * 321 + Date.now() * 0.001) * 0.5 + 0.5) * CANVAS_HEIGHT;
    ctx.fillRect(sx, sy, 1, 1);
  }

  // プレイヤー（ゲルぴよ）
  if (s.player.isAlive) {
    ctx.fillStyle = '#ffff00';
    ctx.fillRect(s.player.x - PLAYER_W / 2, s.player.y - PLAYER_H / 2, PLAYER_W, PLAYER_H);
    
    // 目
    ctx.fillStyle = '#000';
    ctx.fillRect(s.player.x - 6, s.player.y - 2, 3, 3);
    ctx.fillRect(s.player.x + 3, s.player.y - 2, 3, 3);
    
    // クチバシ
    ctx.fillStyle = '#ff8800';
    ctx.fillRect(s.player.x - 2, s.player.y + 1, 4, 3);

    // 砲台（頭の上）
    ctx.fillStyle = '#888';
    ctx.fillRect(s.player.x - 2, s.player.y - PLAYER_H / 2 - 4, 4, 4);
  } else if (s.lives >= 0 && s.mode !== 'gameover') {
    // 爆発エフェクト
    ctx.fillStyle = '#f80';
    ctx.beginPath();
    ctx.arc(s.player.x, s.player.y, (120 - s.player.respawnTimer) / 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // 敵（ワルぴよ軍団）
  s.enemies.forEach(e => {
    if (!e.isAlive) return;
    const isFrame2 = s.enemyMoveTimer > s.enemyMoveInterval / 2;
    
    ctx.fillStyle = e.type === 3 ? '#f0f' : e.type === 2 ? '#0ff' : '#0f0';
    
    const ex = e.x;
    const ey = e.y;
    ctx.fillRect(ex, ey, ENEMY_W, ENEMY_H);
    
    // 黒で抜いて足のバタバタを作る
    ctx.fillStyle = '#000';
    if (isFrame2) {
      ctx.fillRect(ex + 2, ey + ENEMY_H - 2, 4, 2);
      ctx.fillRect(ex + ENEMY_W - 6, ey + ENEMY_H - 2, 4, 2);
    } else {
      ctx.fillRect(ex, ey + ENEMY_H - 2, 4, 2);
      ctx.fillRect(ex + ENEMY_W - 4, ey + ENEMY_H - 2, 4, 2);
    }
    
    // 悪い目
    ctx.fillRect(ex + 2, ey + 3, 4, 2);
    ctx.fillRect(ex + ENEMY_W - 6, ey + 3, 4, 2);

    // クチバシ
    ctx.fillStyle = '#ff8800';
    ctx.fillRect(ex + ENEMY_W / 2 - 2, ey + 6, 4, 2);
  });

  // UFO
  if (s.ufo.isAlive) {
    ctx.fillStyle = '#f00';
    ctx.fillRect(s.ufo.x, s.ufo.y, UFO_W, UFO_H);
    ctx.fillStyle = '#000';
    ctx.fillRect(s.ufo.x + 4, s.ufo.y + 4, UFO_W - 8, 4);
    ctx.fillStyle = '#ff0';
    ctx.fillRect(s.ufo.x + 12, s.ufo.y - 4, 8, 4);
  }

  // 弾
  ctx.fillStyle = '#fff';
  s.playerBullets.forEach(b => {
    if (b.isAlive) ctx.fillRect(b.x - BULLET_W / 2, b.y, BULLET_W, BULLET_H);
  });
  ctx.fillStyle = '#ff0';
  s.enemyBullets.forEach(b => {
    if (b.isAlive) ctx.fillRect(b.x - BULLET_W / 2, b.y, BULLET_W, BULLET_H);
  });

  // 防空壕
  ctx.fillStyle = '#0f0';
  s.bunkers.forEach(bunker => {
    bunker.blocks.forEach(block => {
      if (block.isAlive) {
        ctx.fillRect(block.x, block.y, BLOCK_SIZE, BLOCK_SIZE);
      }
    });
  });

  // HUD
  ctx.fillStyle = '#fff';
  ctx.font = '12px "Courier New", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`SCORE: ${s.score}`, 10, 20);
  ctx.textAlign = 'center';
  ctx.fillText(`WAVE: ${s.wave}`, CANVAS_WIDTH / 2, 20);
  ctx.textAlign = 'right';
  ctx.fillText(`LIVES: ${s.lives}`, CANVAS_WIDTH - 10, 20);

  // 状態メッセージ
  if (s.mode === 'gameover') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = '#f00';
    ctx.font = '24px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    ctx.font = '12px "Courier New", monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText('TAP [FIRE] TO TITLE', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40);
  } else if (s.mode === 'clear') {
    ctx.fillStyle = '#0f0';
    ctx.font = '24px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('WAVE CLEAR!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
  }
}
