// ============================================
// types.ts — ゲルぴよバウンス 型定義
// ============================================

/** 2Dベクトル */
export interface Vec2 {
  x: number;
  y: number;
}

/** ゲーム状態 */
export const STATE = {
  READY: 'ready',
  AIMING: 'aiming',
  FLYING: 'flying',
  SETTLING: 'settling',
  RESULT: 'result',
  PAUSED: 'paused',
} as const;

export type GameState = typeof STATE[keyof typeof STATE];

/** オブジェクトタイプ */
export const OBJ_TYPE = {
  JELLY: 'jelly',
  WOOD: 'wood',
  IRON: 'iron',
  GLASS: 'glass',
  TNT: 'tnt',
  SPRING: 'spring',
  ENEMY: 'enemy',
  ENEMY_BOMB: 'enemy_bomb',
  ENEMY_WARP: 'enemy_warp',
  ITEM_GIANT: 'item_giant',
  ITEM_SPLIT: 'item_split',
} as const;

export type ObjType = typeof OBJ_TYPE[keyof typeof OBJ_TYPE];

/** オブジェクトのデフォルトプロパティ */
export interface ObjDefaults {
  hp: number;
  restitution: number;
  scoreValue: number;
  color: string;
  breakable: boolean;
}

export const OBJ_DEFAULTS: Record<ObjType, ObjDefaults> = {
  [OBJ_TYPE.JELLY]:      { hp: 1, restitution: 0.95, scoreValue: 50,  color: '#00ff88', breakable: true },
  [OBJ_TYPE.WOOD]:       { hp: 2, restitution: 0.6,  scoreValue: 100, color: '#c8956c', breakable: true },
  [OBJ_TYPE.IRON]:       { hp: Infinity, restitution: 0.85, scoreValue: 0, color: '#8899aa', breakable: false },
  [OBJ_TYPE.GLASS]:      { hp: 1, restitution: 0.4,  scoreValue: 200, color: '#aaddff', breakable: true },
  [OBJ_TYPE.TNT]:        { hp: 1, restitution: 0.3,  scoreValue: 150, color: '#ff4444', breakable: true },
  [OBJ_TYPE.SPRING]:     { hp: Infinity, restitution: 1.5, scoreValue: 0, color: '#ffdd00', breakable: false },
  [OBJ_TYPE.ENEMY]:      { hp: 1, restitution: 0.5,  scoreValue: 500, color: '#ff6b9d', breakable: true },
  [OBJ_TYPE.ENEMY_BOMB]: { hp: 1, restitution: 0.5,  scoreValue: 800, color: '#aa0000', breakable: true },
  [OBJ_TYPE.ENEMY_WARP]: { hp: 1, restitution: 0.5,  scoreValue: 800, color: '#aa00ff', breakable: true },
  [OBJ_TYPE.ITEM_GIANT]: { hp: 1, restitution: 1.0,  scoreValue: 100, color: '#ffffff', breakable: true },
  [OBJ_TYPE.ITEM_SPLIT]: { hp: 1, restitution: 1.0,  scoreValue: 100, color: '#ffffaa', breakable: true },
};

/** トレイルポイント */
export interface TrailPoint {
  x: number;
  y: number;
  alpha: number;
}

/** AABB */
export interface AABB {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 衝突結果 */
export interface CollisionResult {
  hit: boolean;
  penetration: number;
  normalX: number;
  normalY: number;
  contactX: number;
  contactY: number;
}

/** ステージオブジェクト定義 */
export interface StageObjectDef {
  type: ObjType;
  x: number;
  y: number;
  w: number;
  h: number;
  imageKey?: string;
  hp?: number;
}

/** ステージデータ */
export interface StageData {
  world: number;
  name: string;
  piyoCount: number;
  starThresholds: [number, number, number];
  slingshotX: number;
  slingshotY: number;
  objects: StageObjectDef[];
}

/** ワールドテーマ */
export interface WorldData {
  id: number;
  name: string;
  bgGradient: [string, string, string];
  groundColor: string;
  accentColor: string;
}

/** パーティクル */
export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  type: 'circle' | 'star' | 'square';
  rotation: number;
  rotationSpeed: number;
  gravity: boolean;
  alpha: number;
}

/** パーティクルエミットオプション */
export interface ParticleEmitOptions {
  speed?: number;
  life?: number;
  size?: number;
  color?: string;
  colors?: string[];
  type?: 'circle' | 'star' | 'square';
  spread?: number;
  gravity?: boolean;
  angle?: number;
  angleVariance?: number;
}

/** ゲーム全体の画面状態 */
export type BounceScene = 'title' | 'stageSelect' | 'playing' | 'result' | 'failed' | 'endless-over';

// 物理定数
export const GRAVITY = 980;
export const MAX_VELOCITY = 7000;
export const STOP_THRESHOLD = 15;
export const FRICTION = 0.998;
export const GROUND_FRICTION = 0.92;

// ワールドサイズ
export const WORLD_WIDTH = 400;
export const WORLD_HEIGHT = 710;

// 地面
export const GROUND_Y = WORLD_HEIGHT - 60;

// TNT爆発
export const TNT_EXPLOSION_RADIUS = 120;
export const TNT_EXPLOSION_DAMAGE = 3;
