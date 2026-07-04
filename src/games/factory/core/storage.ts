// ============================================
// storage.ts - Local Storage Management
// ============================================

const STORAGE_KEY = 'gelpiyo_factory_save';
const CURRENT_VERSION = 1;

interface SaveData {
  version: number;
  highScores: Array<{ score: number; date: string }>;
  settings: {
    muted: boolean;
  };
  totalGamesPlayed: number;
}

function getDefaultData(): SaveData {
  return {
    version: CURRENT_VERSION,
    highScores: [],
    settings: {
      muted: false
    },
    totalGamesPlayed: 0
  };
}

let storageAvailable = false;
try {
  const testKey = '__gelpiyo_test__';
  localStorage.setItem(testKey, '1');
  localStorage.removeItem(testKey);
  storageAvailable = true;
} catch (e) {
  console.warn('localStorage is not available. Using in-memory fallback.');
  storageAvailable = false;
}

let memoryStore: SaveData | null = null;

export function loadData(): SaveData {
  if (!storageAvailable) {
    if (!memoryStore) {
      memoryStore = getDefaultData();
    }
    return memoryStore;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const data = getDefaultData();
      saveData(data);
      return data;
    }
    const parsed = JSON.parse(raw);
    return migrate(parsed);
  } catch (e) {
    console.error('Failed to parse save data, resetting:', e);
    const data = getDefaultData();
    saveData(data);
    return data;
  }
}

export function saveData(data: SaveData): void {
  if (!storageAvailable) {
    memoryStore = data;
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save data:', e);
  }
}

export function addHighScore(score: number): number {
  const data = loadData();
  const entry = {
    score,
    date: new Date().toISOString()
  };
  data.highScores.push(entry);
  data.highScores.sort((a, b) => b.score - a.score);
  data.highScores = data.highScores.slice(0, 10);
  data.totalGamesPlayed++;
  saveData(data);

  const rank = data.highScores.findIndex(e => e === entry) + 1;
  return rank > 0 ? rank : data.highScores.length;
}

export function getHighScores(): Array<{ score: number; date: string }> {
  return loadData().highScores;
}

export function getMuted(): boolean {
  return loadData().settings.muted;
}

export function setMuted(muted: boolean): void {
  const data = loadData();
  data.settings.muted = muted;
  saveData(data);
}

function migrate(data: any): SaveData {
  if (!data || typeof data.version !== 'number') {
    return getDefaultData();
  }
  data.version = CURRENT_VERSION;
  return data;
}
