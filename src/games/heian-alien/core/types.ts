// --- 定数 ---
export const MAP_SIZE = 15;
export const CELL_SIZE = 30;
export const CANVAS_WIDTH = MAP_SIZE * CELL_SIZE;
export const CANVAS_HEIGHT = MAP_SIZE * CELL_SIZE;

export const PLAYER_SPEED = 2;
export const ENEMY_BASE_SPEED = 1;
export const DIG_DURATION = 36;
export const FILL_DURATION = 36;
export const ENEMY_FALLEN_DURATION = 240;
export const PLAYER_FALLEN_DURATION = 90;
export const PLAYER_MUTENKI_DURATION = 120;

// マップのセルの値
export const CELL_PATH = 0;
export const CELL_WALL = 1;
export const CELL_DIGGING = 2;
export const CELL_HOLE = 3;
export const CELL_ENEMY_HOLE = 4;

export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'NONE';

export interface Entity {
  x: number;
  y: number;
  gridX: number;
  gridY: number;
  dir: Direction;
  nextDir: Direction;
}

export interface Player extends Entity {
  isMoving: boolean;
  lives: number;
  isFallen: boolean;
  fallenTimer: number;
  isActionActive: boolean;
  actionType: 'DIG' | 'FILL' | 'NONE';
  actionProgress: number;
  actionX: number;
  actionY: number;
  mutenkiTimer: number;
}

export interface Enemy extends Entity {
  id: number;
  speed: number;
  isFallen: boolean;
  fallenTimer: number;
  isAngry: boolean;
  angryTimer: number;
}
