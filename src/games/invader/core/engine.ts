import type { GameState, Block, Bunker } from './types';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, PLAYER_W, PLAYER_H,
  ENEMY_W, ENEMY_H, BULLET_W, BULLET_H, UFO_W, UFO_H,
  BUNKER_COUNT, BUNKER_W, BUNKER_H, BLOCK_SIZE,
} from './types';
import { useSaveDataStore } from '@/stores/saveDataStore';

/** トーチカの初期化 */
export function initBunkers(): Bunker[] {
  const bunkers: Bunker[] = [];
  const spacing = CANVAS_WIDTH / BUNKER_COUNT;
  for (let i = 0; i < BUNKER_COUNT; i++) {
    const bx = spacing * i + (spacing - BUNKER_W) / 2;
    const by = CANVAS_HEIGHT - 70;
    const blocks: Block[] = [];
    for (let r = 0; r < BUNKER_H / BLOCK_SIZE; r++) {
      for (let c = 0; c < BUNKER_W / BLOCK_SIZE; c++) {
        if (r < 2 && (c < 2 || c >= BUNKER_W / BLOCK_SIZE - 2)) continue;
        if (r > BUNKER_H / BLOCK_SIZE - 3 && c > 2 && c < BUNKER_W / BLOCK_SIZE - 3) continue;
        blocks.push({ x: bx + c * BLOCK_SIZE, y: by + r * BLOCK_SIZE, isAlive: true });
      }
    }
    bunkers.push({ x: bx, y: by, blocks });
  }
  return bunkers;
}

/** ウェーブの初期化 */
export function initWave(s: GameState, wave: number, isReset: boolean): void {
  if (isReset) {
    s.score = 0;
    s.lives = 3;
    s.bunkers = initBunkers();
  }
  s.wave = wave;
  s.player.isAlive = true;
  s.player.x = CANVAS_WIDTH / 2;
  s.playerBullets = [];
  s.enemyBullets = [];
  s.ufo.isAlive = false;
  s.ufo.timer = 600;

  s.enemies = [];
  const rows = 5;
  const cols = 9;
  const paddingX = 24;
  const paddingY = 20;
  const startX = (CANVAS_WIDTH - (cols * paddingX)) / 2;
  const startY = 50 + (wave > 1 ? 10 : 0);

  for (let r = 0; r < rows; r++) {
    let type = 1;
    if (r < 1) type = 3;
    else if (r < 3) type = 2;
    
    for (let c = 0; c < cols; c++) {
      s.enemies.push({
        x: startX + c * paddingX,
        y: startY + r * paddingY,
        row: r, col: c, isAlive: true, type
      });
    }
  }

  s.enemyDirection = 1;
  s.enemyBaseInterval = Math.max(10, 60 - (wave - 1) * 10);
  s.enemyMoveTimer = s.enemyBaseInterval;
}

/** 矩形の当たり判定 */
function checkCollision(
  r1: { x: number; y: number; w: number; h: number },
  r2: { x: number; y: number; w: number; h: number }
): boolean {
  return r1.x < r2.x + r2.w && r1.x + r1.w > r2.x &&
         r1.y < r2.y + r2.h && r1.y + r1.h > r2.y;
}

/** メインのゲーム更新処理 */
export function update(s: GameState): void {
  if (s.mode === 'title') {
    if (s.keys.fire) {
      s.mode = 'playing';
      initWave(s, 1, true);
      s.keys.fire = false;
    }
    return;
  }

  if (s.mode === 'gameover') {
    if (s.keys.fire) {
      s.mode = 'title';
      s.keys.fire = false;
    }
    return;
  }

  if (s.mode === 'clear') {
    s.waveTransitionTimer--;
    if (s.waveTransitionTimer <= 0) {
      s.mode = 'playing';
      initWave(s, s.wave + 1, false);
    }
    return;
  }

  // --- Playing Update ---

  // プレイヤーリスポーン待機
  if (!s.player.isAlive) {
    s.player.respawnTimer--;
    if (s.player.respawnTimer <= 0) {
      if (s.lives > 0) {
        s.player.isAlive = true;
        s.player.x = CANVAS_WIDTH / 2;
      } else {
        s.mode = 'gameover';
        if (s.score > s.highScore) {
          s.highScore = s.score;
          useSaveDataStore.getState().updateHighScore('invader', s.highScore);
        }
      }
    }
    return;
  }

  // プレイヤーの移動
  if (s.keys.left) s.player.x -= 3;
  if (s.keys.right) s.player.x += 3;
  s.player.x = Math.max(PLAYER_W / 2, Math.min(CANVAS_WIDTH - PLAYER_W / 2, s.player.x));

  // プレイヤーの弾発射
  if (s.fireCooldown > 0) s.fireCooldown--;
  if (s.keys.fire && s.fireCooldown <= 0 && s.playerBullets.length < 3) {
    s.playerBullets.push({ x: s.player.x, y: s.player.y - PLAYER_H / 2, isAlive: true });
    s.fireCooldown = 15;
  }

  // 弾の移動
  s.playerBullets.forEach(b => b.y -= 6);
  s.playerBullets = s.playerBullets.filter(b => b.isAlive && b.y > 0);

  s.enemyBullets.forEach(b => b.y += 3);
  s.enemyBullets = s.enemyBullets.filter(b => b.isAlive && b.y < CANVAS_HEIGHT);

  // UFOの更新
  if (s.ufo.isAlive) {
    s.ufo.x += s.ufo.dx;
    if (s.ufo.x < -UFO_W || s.ufo.x > CANVAS_WIDTH + UFO_W) s.ufo.isAlive = false;
  } else {
    s.ufo.timer--;
    if (s.ufo.timer <= 0) {
      s.ufo.isAlive = true;
      s.ufo.dx = Math.random() > 0.5 ? 2 : -2;
      s.ufo.x = s.ufo.dx > 0 ? -UFO_W : CANVAS_WIDTH + UFO_W;
      s.ufo.y = 30;
      s.ufo.timer = 600 + Math.random() * 600;
    }
  }

  // 敵の移動ロジック
  const aliveEnemies = s.enemies.filter(e => e.isAlive);
  if (aliveEnemies.length === 0) {
    s.mode = 'clear';
    s.waveTransitionTimer = 120;
    return;
  }

  s.enemyMoveTimer--;
  if (s.enemyMoveTimer <= 0) {
    const ratio = aliveEnemies.length / 45;
    s.enemyMoveInterval = Math.max(2, Math.floor(s.enemyBaseInterval * ratio));
    s.enemyMoveTimer = s.enemyMoveInterval;

    let hitEdge = false;
    aliveEnemies.forEach(e => {
      if ((s.enemyDirection === 1 && e.x > CANVAS_WIDTH - ENEMY_W - 5) ||
          (s.enemyDirection === -1 && e.x < 5)) {
        hitEdge = true;
      }
    });

    if (hitEdge) {
      s.enemyDirection *= -1;
      s.enemies.forEach(e => {
        if (e.isAlive) e.y += 10;
      });
    } else {
      s.enemies.forEach(e => {
        if (e.isAlive) e.x += s.enemyDirection * 5;
      });
    }
  }

  // 敵の弾発射
  if (Math.random() < 0.02 + (s.wave * 0.005)) {
    const cols = Array.from(new Set(aliveEnemies.map(e => e.col)));
    const randomCol = cols[Math.floor(Math.random() * cols.length)];
    const bottomEnemy = aliveEnemies.filter(e => e.col === randomCol).reduce((prev, current) => (prev.y > current.y) ? prev : current);
    if (bottomEnemy) {
      s.enemyBullets.push({ x: bottomEnemy.x + ENEMY_W / 2, y: bottomEnemy.y + ENEMY_H, isAlive: true });
    }
  }

  // 当たり判定: プレイヤー弾 -> 敵
  s.playerBullets.forEach(pb => {
    if (!pb.isAlive) return;
    aliveEnemies.forEach(e => {
      if (pb.isAlive && checkCollision({ x: pb.x - BULLET_W / 2, y: pb.y, w: BULLET_W, h: BULLET_H }, { x: e.x, y: e.y, w: ENEMY_W, h: ENEMY_H })) {
        e.isAlive = false;
        pb.isAlive = false;
        if (e.type === 3) s.score += 30;
        else if (e.type === 2) s.score += 20;
        else s.score += 10;
      }
    });

    // プレイヤー弾 -> UFO
    if (s.ufo.isAlive && pb.isAlive && checkCollision({ x: pb.x - BULLET_W / 2, y: pb.y, w: BULLET_W, h: BULLET_H }, { x: s.ufo.x, y: s.ufo.y, w: UFO_W, h: UFO_H })) {
      s.ufo.isAlive = false;
      pb.isAlive = false;
      const ufoScores = [50, 100, 150, 300];
      s.score += ufoScores[Math.floor(Math.random() * ufoScores.length)];
    }
  });

  // 当たり判定: 敵弾 -> プレイヤー
  s.enemyBullets.forEach(eb => {
    if (!eb.isAlive) return;
    if (checkCollision({ x: eb.x - BULLET_W / 2, y: eb.y, w: BULLET_W, h: BULLET_H }, { x: s.player.x - PLAYER_W / 2, y: s.player.y - PLAYER_H / 2, w: PLAYER_W, h: PLAYER_H })) {
      eb.isAlive = false;
      s.player.isAlive = false;
      s.lives--;
      s.player.respawnTimer = 120;
    }
  });

  // 敵が最下段に到達したか
  aliveEnemies.forEach(e => {
    if (e.y + ENEMY_H > CANVAS_HEIGHT - 60) {
      s.player.isAlive = false;
      s.lives = 0;
      s.player.respawnTimer = 60;
    }
  });

  // 当たり判定: 弾 -> 防空壕(ブロック)
  const checkBunkerCollision = (bullet: { x: number; y: number; isAlive: boolean }) => {
    if (!bullet.isAlive) return;
    const bw = BULLET_W;
    const bh = BULLET_H;
    for (const bunker of s.bunkers) {
      if (bullet.x > bunker.x - bw && bullet.x < bunker.x + BUNKER_W + bw &&
        bullet.y > bunker.y - bh && bullet.y < bunker.y + BUNKER_H + bh) {

        for (const block of bunker.blocks) {
          if (block.isAlive && checkCollision({ x: bullet.x - bw / 2, y: bullet.y, w: bw, h: bh }, { x: block.x, y: block.y, w: BLOCK_SIZE, h: BLOCK_SIZE })) {
            block.isAlive = false;
            bullet.isAlive = false;
            bunker.blocks.forEach(otherBlock => {
              if (otherBlock.isAlive) {
                const dx = otherBlock.x - block.x;
                const dy = otherBlock.y - block.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist <= BLOCK_SIZE * 1.5 && Math.random() > 0.3) {
                  otherBlock.isAlive = false;
                }
              }
            });
            break;
          }
        }
      }
      if (!bullet.isAlive) break;
    }
  };

  s.playerBullets.forEach(pb => checkBunkerCollision(pb));
  s.enemyBullets.forEach(eb => checkBunkerCollision(eb));

  // 敵 -> 防空壕の接触判定
  aliveEnemies.forEach(e => {
    for (const bunker of s.bunkers) {
      if (e.y + ENEMY_H > bunker.y) {
        for (const block of bunker.blocks) {
          if (block.isAlive && checkCollision({ x: e.x, y: e.y, w: ENEMY_W, h: ENEMY_H }, { x: block.x, y: block.y, w: BLOCK_SIZE, h: BLOCK_SIZE })) {
            block.isAlive = false;
          }
        }
      }
    }
  });
}
