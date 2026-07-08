import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface BreedingState {
  size: number; // 0.5 ~ 2.0 (初期値 1.0)
  bounce: number; // 0.1 ~ 0.9 (初期値 0.5)
  hue: number; // 0 ~ 360 (初期値 50)
  happiness: number; // 0 ~ 100
  fullness: number; // 0 ~ 100
  feed: () => void;
  play: () => void;
  pet: () => void;
}

export const useBreedingState = create<BreedingState>()(
  persist(
    (set) => ({
      size: 1.0,
      bounce: 0.5,
      hue: 50,
      happiness: 50,
      fullness: 50,
      feed: () => set((state) => ({
        fullness: Math.min(100, state.fullness + 20),
        size: Math.min(2.0, state.size + 0.05),
      })),
      play: () => set((state) => ({
        happiness: Math.min(100, state.happiness + 20),
        fullness: Math.max(0, state.fullness - 10),
        bounce: Math.min(0.9, state.bounce + 0.05),
      })),
      pet: () => set((state) => ({
        happiness: Math.min(100, state.happiness + 10),
        hue: (state.hue + Math.random() * 40 - 20 + 360) % 360, // 色が少しランダムに変化
      })),
    }),
    {
      name: 'gelpiyo-breeding-storage',
    }
  )
);
