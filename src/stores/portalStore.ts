import { create } from 'zustand';
import type { ScreenState } from '@/types/game';

interface PortalState {
  /** 現在の画面 */
  currentScreen: ScreenState;
  /** 画面遷移アニメーション中かどうか */
  isTransitioning: boolean;
  /** ゲーム画面へ遷移 */
  navigateToGame: (gameId: ScreenState) => void;
  /** ポータルへ戻る */
  navigateToPortal: () => void;
}

export const usePortalStore = create<PortalState>((set) => ({
  currentScreen: 'portal',
  isTransitioning: false,

  navigateToGame: (gameId) => {
    set({ isTransitioning: true });
    // フェードアウト後に遷移
    setTimeout(() => {
      set({ currentScreen: gameId, isTransitioning: false });
    }, 300);
  },

  navigateToPortal: () => {
    set({ isTransitioning: true });
    setTimeout(() => {
      set({ currentScreen: 'portal', isTransitioning: false });
    }, 300);
  },
}));
