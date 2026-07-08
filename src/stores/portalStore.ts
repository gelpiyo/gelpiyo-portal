import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
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

export const usePortalStore = create<PortalState>()(
  persist(
    (set) => ({
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
    }),
    {
      name: 'gelpiyo-portal-storage',
      storage: createJSONStorage(() => sessionStorage),
      // 遷移状態は保存せず、現在の画面情報のみを永続化する
      partialize: (state) => ({ currentScreen: state.currentScreen }),
    }
  )
);
