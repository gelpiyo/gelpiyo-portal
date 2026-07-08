/** ゲーム画面の状態 */
export type ScreenState = 'loading' | 'title' | 'countdown' | 'playing' | 'result';

/** 各ターンの試行結果 */
export interface TurnResult {
  turnIndex: number;
  type: 'enemy' | 'friendly';
  status: 'hit' | 'miss' | 'safe' | 'bad';
  time?: number;
}

/** キャラクターの状態 */
export interface TargetState {
  type: 'enemy' | 'friendly';
  x: number;
  y: number;
  radius: number;
  spawnTime: number;
  active: boolean;
  scale: number;
  isShot: boolean;
  shotTime?: number;
  fadeOut: number;
}

/** タップ時の銃撃エフェクト */
export interface ShotEffect {
  x: number;
  y: number;
  time: number;
  radius: number;
  opacity: number;
}

/** 撃破時に飛び散る火花/パーティクル */
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

/** ゲームのリアルタイム状態 */
export interface GameRuntimeState {
  screen: ScreenState;
  turn: number;
  turnStartTime: number;
  waitDuration: number;
  phase: 'wait' | 'active' | 'feedback';
  target: TargetState | null;
  shotEffects: ShotEffect[];
  particles: Particle[];
  feedbackText: { text: string; color: string; scale: number; opacity: number } | null;
  feedbackStartTime: number;
  results: TurnResult[];
  shuffledTurnTypes: ('enemy' | 'friendly')[];
}

/** 画像アセット参照 */
export interface ImageAssets {
  bg: HTMLImageElement | null;
  enemy: HTMLImageElement | null;
  friendly: HTMLImageElement | null;
}

// --- 定数 ---
export const LOCAL_STORAGE_KEY = 'gelpiyo_speed_gunman_save_v1';
export const TOTAL_TURNS = 5;
export const ENEMY_TIMEOUT_MS = 2000;
export const FRIENDLY_WAIT_MS = 800;
export const PENALTY_TIME_MS = 2000;
