// ゲーム内で使用する共通型定義

/** 2Dベクトル */
export interface Vec2 {
  x: number;
  y: number;
}

/** 円形オブジェクト */
export interface Circle {
  pos: Vec2;
  radius: number;
}

/** パック（ゲーム中に複数存在しうる） */
export interface Puck extends Circle {
  id: number;
  vel: Vec2;
  /** true のとき、このパックはゴールに入って消えた */
  scored: boolean;
  /** どちらのゴールに入ったか */
  scoredSide: 'player' | 'cpu' | null;
}

/** マレット */
export interface Mallet extends Circle {
  vel: Vec2;
  prevPos: Vec2;
}

/** 分裂アイテム */
export interface SplitItem extends Circle {
  active: boolean;
  /** 出現アニメーション用タイマー (0→1) */
  spawnTimer: number;
}

/** ラウンドの状態 */
export interface RoundState {
  /** フィールド上のパック群 */
  pucks: Puck[];
  /** プレイヤーのマレット */
  playerMallet: Mallet;
  /** CPUのマレット */
  cpuMallet: Mallet;
  /** 分裂アイテム（フィールド上に最大1個） */
  splitItem: SplitItem | null;
  /** このラウンドでのプレイヤーゴール数 */
  playerGoals: number;
  /** このラウンドでのCPUゴール数 */
  cpuGoals: number;
  /** 分裂が発動中か（全パックがゴールするまで判定を待つ） */
  isSplitActive: boolean;
  /** ラウンド終了フラグ */
  roundOver: boolean;
  /** ラウンド終了後のクールダウンタイマー */
  roundCooldown: number;
  /** 次のパックID */
  nextPuckId: number;
  /** アイテム出現までのタイマー（秒） */
  itemSpawnTimer: number;
}

/** ゲーム全体の状態 */
export interface GameState {
  /** 現在のシーン */
  scene: 'title' | 'playing' | 'result';
  /** プレイヤーのラウンド獲得数 */
  playerRounds: number;
  /** CPUのラウンド獲得数 */
  cpuRounds: number;
  /** 勝者 */
  matchWinner: 'player' | 'cpu' | null;
  /** ラウンド内の状態 */
  round: RoundState;
}

// =====================
// ゲーム定数
// =====================

/** テーブルのサイズ（論理ピクセル） */
export const TABLE_W = 340;
export const TABLE_H = 600;

/** ゴール幅 */
export const GOAL_W = 110;

/** パック */
export const PUCK_RADIUS = 14;
export const PUCK_MAX_SPEED = 900;
export const PUCK_FRICTION = 0.997;

/** マレット */
export const MALLET_RADIUS = 28;

/** アイテム */
export const ITEM_RADIUS = 18;

/** 勝利に必要なラウンド数 */
export const ROUNDS_TO_WIN = 3;

/** ゴール後のクールダウン秒数 */
export const ROUND_COOLDOWN = 1.5;

/** アイテム出現間隔（秒）の基準値 */
export const ITEM_SPAWN_INTERVAL_BASE = 8;
export const ITEM_SPAWN_INTERVAL_RAND = 5;

/** 分裂時のパック数 */
export const SPLIT_COUNT = 3;

/** 壁の太さ（描画用） */
export const WALL_THICKNESS = 8;

/** ゴールの深さ（描画用） */
export const GOAL_DEPTH = 20;

/** 固定タイムステップ */
export const FIXED_DT = 1 / 60;
export const MAX_DT = 0.1;
