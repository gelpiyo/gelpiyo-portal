import type { Player, Enemy } from './types';
import {
  MAP_SIZE, CELL_SIZE, CANVAS_WIDTH, CANVAS_HEIGHT,
  CELL_WALL, CELL_DIGGING, CELL_HOLE, CELL_ENEMY_HOLE,
} from './types';

/** マップの描画 */
function drawMap(ctx: CanvasRenderingContext2D, map: number[][]): void {
  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      const cell = map[y][x];
      const px = x * CELL_SIZE;
      const py = y * CELL_SIZE;

      if (cell === CELL_WALL) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 2, py + 2, CELL_SIZE - 4, CELL_SIZE - 4);
      } else if (cell === CELL_DIGGING) {
        ctx.fillStyle = '#ff8800';
        ctx.fillRect(px + 4, py + 4, CELL_SIZE - 8, CELL_SIZE - 8);
      } else if (cell === CELL_HOLE || cell === CELL_ENEMY_HOLE) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(px + 2, py + 2, CELL_SIZE - 4, CELL_SIZE - 4);
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 2, py + 2, CELL_SIZE - 4, CELL_SIZE - 4);
      }
    }
  }
}

/** プレイヤーの描画 */
function drawPlayer(ctx: CanvasRenderingContext2D, player: Player): void {
  ctx.save();
  if (player.mutenkiTimer > 0 && Math.floor(player.mutenkiTimer / 8) % 2 === 0) {
    ctx.globalAlpha = 0.3;
  }

  const px = player.x + CELL_SIZE / 2;
  const py = player.y + CELL_SIZE / 2;

  if (player.isFallen) {
    ctx.fillStyle = '#ffff00';
    ctx.fillRect(px - CELL_SIZE / 4, py - CELL_SIZE / 4, CELL_SIZE / 2, CELL_SIZE / 2);
  } else {
    ctx.fillStyle = '#ffff00';
    ctx.fillRect(px - CELL_SIZE / 2 + 4, py - CELL_SIZE / 2 + 4, CELL_SIZE - 8, CELL_SIZE - 8);

    ctx.fillStyle = '#000000';
    ctx.fillRect(px - 5, py - 4, 3, 3);
    ctx.fillRect(px + 2, py - 4, 3, 3);

    if (player.isActionActive) {
      ctx.strokeStyle = player.actionType === 'DIG' ? '#63b3ed' : '#fc8181';
      ctx.lineWidth = 3;
      ctx.beginPath();

      let ax = px, ay = py;
      if (player.dir === 'UP') ay -= CELL_SIZE / 2;
      else if (player.dir === 'DOWN') ay += CELL_SIZE / 2;
      else if (player.dir === 'LEFT') ax -= CELL_SIZE / 2;
      else if (player.dir === 'RIGHT') ax += CELL_SIZE / 2;

      ctx.arc(ax, ay, 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** 敵の描画 */
function drawEnemies(ctx: CanvasRenderingContext2D, enemies: Enemy[]): void {
  enemies.forEach(enemy => {
    const ex = enemy.x + CELL_SIZE / 2;
    const ey = enemy.y + CELL_SIZE / 2;

    ctx.save();
    if (enemy.isFallen) {
      ctx.fillStyle = '#ff00ff';
      ctx.fillRect(ex - CELL_SIZE / 4, ey - CELL_SIZE / 4, CELL_SIZE / 2, CELL_SIZE / 2);
    } else {
      if (enemy.isAngry && Math.floor(enemy.angryTimer / 6) % 2 === 0) {
        ctx.fillStyle = '#ff0000';
      } else {
        ctx.fillStyle = '#ff00ff';
      }

      ctx.fillRect(ex - CELL_SIZE / 2 + 4, ey - CELL_SIZE / 2 + 4, CELL_SIZE - 8, CELL_SIZE - 8);

      ctx.fillStyle = '#000000';
      ctx.fillRect(ex - 6, ey - 5, 4, 2);
      ctx.fillRect(ex + 2, ey - 5, 4, 2);

      if (enemy.isAngry) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(ex - 4, ey + 2, 2, 2);
        ctx.fillRect(ex + 2, ey + 2, 2, 2);
      }
    }
    ctx.restore();
  });
}

/** メイン描画関数 */
export function draw(
  ctx: CanvasRenderingContext2D,
  map: number[][],
  player: Player,
  enemies: Enemy[],
): void {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  drawMap(ctx, map);
  drawPlayer(ctx, player);
  drawEnemies(ctx, enemies);
}
