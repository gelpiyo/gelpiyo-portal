import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ============================================
// Types
// ============================================

export type SimpleScoreData = { highScore: number };

export interface BounceSaveData {
  highScores: Record<string, number>;
  stageStars: Record<string, number>;
  unlockedStages: Record<string, boolean>;
  unlockedCharacters: string[];
  settings: { muted: boolean };
  totalPlayCount: number;
  endlessBest: { score: number; wave: number };
}

export interface FactorySaveData {
  highScores: Array<{ score: number; date: string }>;
  settings: { muted: boolean };
  totalGamesPlayed: number;
}

export interface PuzzleRangerSaveData {
  highScore: number;
  maxWave: number;
  settings: { muted: boolean };
}

export interface GelpiyoRaceSaveData {
  easy: number | null;
  normal: number | null;
  hard: number | null;
}

export interface SpeedGunmanSaveData {
  bestAverageTime: number | null;
  playCount: number;
}

export interface GlobalSaveData {
  version: number;
  globalSettings: {
    muted: boolean;
    volume: number;
  };
  games: {
    'invader'?: SimpleScoreData;
    'heian-alien'?: SimpleScoreData;
    'speed-gunman'?: SpeedGunmanSaveData;
    'hammer-jump'?: SimpleScoreData;
    'stone-skipping'?: SimpleScoreData;
    'gelpiyo-race'?: GelpiyoRaceSaveData;
    'bounce'?: BounceSaveData;
    'factory'?: FactorySaveData;
    'puzzle-ranger'?: PuzzleRangerSaveData;
    'agent'?: Record<string, unknown>;
    'air-hockey'?: Record<string, unknown>;
    'gelpiyo-viewer'?: Record<string, unknown>;
    'rpg'?: Record<string, unknown>;
  };
}

interface SaveDataState extends GlobalSaveData {
  // Actions
  updateHighScore: (gameId: 'invader' | 'heian-alien' | 'hammer-jump' | 'stone-skipping', score: number) => void;
  updateSpeedGunmanData: (avgTime: number) => void;
  updateGelpiyoRaceRecord: (diff: 'easy' | 'normal' | 'hard', timeMs: number) => void;
  updateBounceData: (updater: (data: BounceSaveData) => BounceSaveData) => void;
  updateFactoryData: (updater: (data: FactorySaveData) => FactorySaveData) => void;
  updatePuzzleRangerData: (updater: (data: PuzzleRangerSaveData) => PuzzleRangerSaveData) => void;
  setGlobalMuted: (muted: boolean) => void;
}

// ============================================
// Defaults
// ============================================

const DEFAULT_BOUNCE: BounceSaveData = {
  highScores: {},
  stageStars: {},
  unlockedStages: { '1-1': true },
  unlockedCharacters: ['gelpiyo'],
  settings: { muted: false },
  totalPlayCount: 0,
  endlessBest: { score: 0, wave: 0 },
};

const DEFAULT_FACTORY: FactorySaveData = {
  highScores: [],
  settings: { muted: false },
  totalGamesPlayed: 0
};

const DEFAULT_PUZZLE_RANGER: PuzzleRangerSaveData = {
  highScore: 0,
  maxWave: 1,
  settings: { muted: false }
};

const DEFAULT_RACE: GelpiyoRaceSaveData = {
  easy: null,
  normal: null,
  hard: null
};

const INITIAL_STATE: GlobalSaveData = {
  version: 1,
  globalSettings: { muted: false, volume: 1.0 },
  games: {
    'gelpiyo-race': DEFAULT_RACE,
    'bounce': DEFAULT_BOUNCE,
    'factory': DEFAULT_FACTORY,
    'puzzle-ranger': DEFAULT_PUZZLE_RANGER
  }
};

// ============================================
// Migration Logic
// ============================================

/** マイグレーション対象の旧 localStorage キー一覧 */
const LEGACY_KEYS = [
  'invaderHighScore',
  'gelpiyo_heian_alien_data',
  'speed-gunman-score',
  'hammerJumpHighScore',
  'stone-skipping-highscore',
  'gelpiyo-race-records',
  'gelpiyo_bounce_save',
  'gelpiyo_factory_save',
  'puzzle_ranger_save_data',
] as const;

function migrateLegacyData(state: GlobalSaveData) {
  let migrated = false;

  try {
    // Invader
    const invader = localStorage.getItem('invaderHighScore');
    if (invader && !state.games['invader']) {
      state.games['invader'] = { highScore: parseInt(invader, 10) || 0 };
      migrated = true;
    }

    // Heian Alien
    const alien = localStorage.getItem('gelpiyo_heian_alien_data');
    if (alien && !state.games['heian-alien']) {
      const parsed = JSON.parse(alien);
      state.games['heian-alien'] = { highScore: parsed.highScore || 0 };
      migrated = true;
    }

    // Speed Gunman
    const speed = localStorage.getItem('speed-gunman-score');
    if (speed && !state.games['speed-gunman']) {
      const parsed = JSON.parse(speed);
      state.games['speed-gunman'] = { 
        bestAverageTime: parsed.bestAverageTime ?? null,
        playCount: parsed.playCount ?? 0
      };
      migrated = true;
    }

    // Hammer Jump
    const hammer = localStorage.getItem('hammerJumpHighScore');
    if (hammer && !state.games['hammer-jump']) {
      state.games['hammer-jump'] = { highScore: parseInt(hammer, 10) || 0 };
      migrated = true;
    }

    // Stone Skipping
    const stone = localStorage.getItem('stone-skipping-highscore');
    if (stone && !state.games['stone-skipping']) {
      const parsed = JSON.parse(stone);
      state.games['stone-skipping'] = { highScore: parsed.highScore || 0 };
      migrated = true;
    }

    // Gelpiyo Race
    const race = localStorage.getItem('gelpiyo-race-records');
    if (race) {
      const parsed = JSON.parse(race);
      state.games['gelpiyo-race'] = { ...DEFAULT_RACE, ...parsed };
      migrated = true;
    }

    // Bounce
    const bounce = localStorage.getItem('gelpiyo_bounce_save');
    if (bounce) {
      const parsed = JSON.parse(bounce);
      state.games['bounce'] = { ...DEFAULT_BOUNCE, ...parsed };
      migrated = true;
    }

    // Factory
    const factory = localStorage.getItem('gelpiyo_factory_save');
    if (factory) {
      const parsed = JSON.parse(factory);
      state.games['factory'] = { ...DEFAULT_FACTORY, ...parsed };
      migrated = true;
    }

    // Puzzle Ranger
    const ranger = localStorage.getItem('puzzle_ranger_save_data');
    if (ranger) {
      const parsed = JSON.parse(ranger);
      state.games['puzzle-ranger'] = { ...DEFAULT_PUZZLE_RANGER, ...parsed };
      migrated = true;
    }

    // マイグレーション成功後、旧キーを削除
    if (migrated) {
      for (const key of LEGACY_KEYS) {
        localStorage.removeItem(key);
      }
      console.info('[SaveDataStore] Legacy data migrated and old keys cleaned up.');
    }
  } catch (e) {
    console.warn('Failed to migrate some legacy data', e);
  }
}

// ============================================
// Store
// ============================================

export const useSaveDataStore = create<SaveDataState>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,

      updateHighScore: (gameId, score) => set((state) => {
        const current = state.games[gameId]?.highScore || 0;
        if (score > current) {
          return {
            games: {
              ...state.games,
              [gameId]: { highScore: score }
            }
          };
        }
        return state;
      }),

      updateSpeedGunmanData: (avgTime) => set((state) => {
        const currentData = state.games['speed-gunman'] || { bestAverageTime: null, playCount: 0 };
        const newPlayCount = currentData.playCount + 1;
        let newBest = currentData.bestAverageTime;
        if (newBest === null || avgTime < newBest) {
          newBest = avgTime;
        }
        return {
          games: {
            ...state.games,
            'speed-gunman': {
              bestAverageTime: newBest,
              playCount: newPlayCount
            }
          }
        };
      }),

      updateGelpiyoRaceRecord: (diff, timeMs) => set((state) => {
        const currentData = state.games['gelpiyo-race'] || DEFAULT_RACE;
        const currentRecord = currentData[diff];
        if (currentRecord === null || timeMs < currentRecord) {
          return {
            games: {
              ...state.games,
              'gelpiyo-race': {
                ...currentData,
                [diff]: timeMs
              }
            }
          };
        }
        return state;
      }),

      updateBounceData: (updater) => set((state) => {
        const current = state.games['bounce'] ?? { ...DEFAULT_BOUNCE };
        const updated = updater(current);
        return { games: { ...state.games, bounce: updated } };
      }),

      updateFactoryData: (updater) => set((state) => {
        const current = state.games['factory'] ?? { ...DEFAULT_FACTORY };
        const updated = updater(current);
        return { games: { ...state.games, factory: updated } };
      }),

      updatePuzzleRangerData: (updater) => set((state) => {
        const current = state.games['puzzle-ranger'] ?? { ...DEFAULT_PUZZLE_RANGER };
        const updated = updater(current);
        return { games: { ...state.games, 'puzzle-ranger': updated } };
      }),

      setGlobalMuted: (muted) => set((state) => ({
        globalSettings: { ...state.globalSettings, muted }
      })),
    }),
    {
      name: 'gelpiyo-save-data-store',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (state) {
          migrateLegacyData(state);
        }
      },
    }
  )
);
