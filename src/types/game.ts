/** ゲーム識別子 */
export type GameId = 'air-hockey' | 'factory' | 'bounce' | 'puzzle-ranger' | 'agent' | 'hammer-jump';

/** ポータルに表示するゲーム情報 */
export interface GameInfo {
  id: GameId;
  title: string;
  subtitle: string;
  description: string;
  emoji: string;
  gradient: string;
  available: boolean;
}

/** 画面の状態 */
export type ScreenState = 'portal' | GameId;
