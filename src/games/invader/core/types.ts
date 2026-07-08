// --- 定数 ---
export const CANVAS_WIDTH = 320;
export const CANVAS_HEIGHT = 480;
export const PLAYER_W = 24;
export const PLAYER_H = 12;
export const ENEMY_W = 16;
export const ENEMY_H = 12;
export const BULLET_W = 2;
export const BULLET_H = 8;
export const UFO_W = 32;
export const UFO_H = 14;

// トーチカの設定
export const BUNKER_COUNT = 4;
export const BUNKER_W = 36;
export const BUNKER_H = 24;
export const BLOCK_SIZE = 4;

export type GameMode = 'title' | 'playing' | 'gameover' | 'clear';

// トーチカの1ブロック
export interface Block {
  x: number;
  y: number;
  isAlive: boolean;
}

// 防空壕
export interface Bunker {
  x: number;
  y: number;
  blocks: Block[];
}

export interface GameState {
  mode: GameMode;
  score: number;
  highScore: number;
  lives: number;
  wave: number;

  player: { x: number; y: number; isAlive: boolean; respawnTimer: number };
  enemies: { x: number; y: number; row: number; col: number; isAlive: boolean; type: number }[];
  playerBullets: { x: number; y: number; isAlive: boolean }[];
  enemyBullets: { x: number; y: number; isAlive: boolean }[];
  ufo: { x: number; y: number; isAlive: boolean; timer: number; dx: number };
  bunkers: Bunker[];

  enemyDirection: number;
  enemyMoveTimer: number;
  enemyMoveInterval: number;
  enemyBaseInterval: number;
  
  fireCooldown: number;
  waveTransitionTimer: number;

  keys: { left: boolean; right: boolean; fire: boolean };
}
