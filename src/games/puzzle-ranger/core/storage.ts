// ============================================
// storage.ts - Save data management for Puzzle Ranger (Migrated to useSaveDataStore)
// ============================================

import { useSaveDataStore } from '@/stores/saveDataStore';
import type { PuzzleRangerSaveData } from '@/stores/saveDataStore';
export type { PuzzleRangerSaveData };

const DEFAULT_DATA: PuzzleRangerSaveData = {
  highScore: 0,
  maxWave: 1,
  settings: {
    muted: false
  }
};

export function loadData(): PuzzleRangerSaveData {
  return useSaveDataStore.getState().games['puzzle-ranger'] || DEFAULT_DATA;
}

function saveData(data: PuzzleRangerSaveData) {
  useSaveDataStore.getState().updatePuzzleRangerData(() => data);
}

export function saveSetting(key: keyof PuzzleRangerSaveData['settings'], value: any) {
  const data = JSON.parse(JSON.stringify(loadData()));
  data.settings[key] = value;
  saveData(data);
}

export function updateHighScore(score: number, wave: number): boolean {
  const data = JSON.parse(JSON.stringify(loadData()));
  const prevMaxWave = data.maxWave;
  let isNewRecord = false;
  if (score > data.highScore) {
    data.highScore = score;
    isNewRecord = true;
  }
  if (wave > prevMaxWave) {
    data.maxWave = wave;
  }
  if (isNewRecord || wave > prevMaxWave) {
    saveData(data);
  }
  return isNewRecord;
}
