/** ゲーム識別子 */
export type GameId = 'air-hockey' | 'factory' | 'bounce' | 'puzzle-ranger' | 'agent' | 'hammer-jump' | 'speed-gunman' | 'heian-alien' | 'invader' | 'rpg' | 'gelpiyo-viewer' | 'stone-skipping' | 'gelpiyo-race' | 'breeding';

/** カテゴリ識別子 */
export type GameCategoryId = 'rpg' | 'puzzle' | 'mini-game' | 'factory' | 'other';

/** ポータルに表示するゲーム情報 */
export interface GameInfo {
  id: GameId;
  categoryId: GameCategoryId;
  title: string;
  subtitle: string;
  description: string;
  emoji: string;
  gradient: string;
  available: boolean;
}

/** 画面の状態 */
export type ScreenState = 'portal' | GameId;
