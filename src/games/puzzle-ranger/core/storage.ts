// ============================================
// storage.ts - Save data management for Puzzle Ranger
// ============================================

const STORAGE_KEY = 'puzzle_ranger_save_data';

export interface PuzzleRangerSaveData {
  version: number;
  highScore: number;
  maxWave: number;
  settings: {
    muted: boolean;
  };
}

const DEFAULT_DATA: PuzzleRangerSaveData = {
  version: 1,
  highScore: 0,
  maxWave: 1,
  settings: {
    muted: false
  }
};

export function loadData(): PuzzleRangerSaveData {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) return { ...DEFAULT_DATA };
    const data = JSON.parse(json);
    return { ...DEFAULT_DATA, ...data }; // Merge with default data for missing keys
  } catch (e) {
    console.warn('Failed to load save data:', e);
    return { ...DEFAULT_DATA };
  }
}

function saveData(data: PuzzleRangerSaveData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save data:', e);
  }
}

export function saveSetting(key: keyof PuzzleRangerSaveData['settings'], value: any) {
  const data = loadData();
  data.settings[key] = value;
  saveData(data);
}

export function updateHighScore(score: number, wave: number): boolean {
  const data = loadData();
  let isNewRecord = false;
  if (score > data.highScore) {
    data.highScore = score;
    isNewRecord = true;
  }
  if (wave > data.maxWave) {
    data.maxWave = wave;
  }
  if (isNewRecord || wave > data.maxWave) {
    saveData(data);
  }
  return isNewRecord;
}
