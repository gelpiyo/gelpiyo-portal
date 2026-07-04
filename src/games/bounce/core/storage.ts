// ============================================
// storage.ts — ローカルストレージ管理
// ============================================

const STORAGE_KEY = 'gelpiyo_bounce_save';
const CURRENT_VERSION = 1;

export interface BounceSaveData {
  version: number;
  highScores: Record<string, number>;
  stageStars: Record<string, number>;
  unlockedStages: Record<string, boolean>;
  unlockedCharacters: string[];
  settings: { muted: boolean };
  totalPlayCount: number;
  endlessBest: { score: number; wave: number };
}

const DEFAULT_DATA: BounceSaveData = {
  version: CURRENT_VERSION,
  highScores: {},
  stageStars: {},
  unlockedStages: { '1-1': true },
  unlockedCharacters: ['gelpiyo'],
  settings: { muted: false },
  totalPlayCount: 0,
  endlessBest: { score: 0, wave: 0 },
};

let memoryFallback: BounceSaveData | null = null;
let storageAvailable = true;

function checkStorage(): boolean {
  try {
    const test = '__gelpiyo_test__';
    localStorage.setItem(test, '1');
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

export function loadData(): BounceSaveData {
  storageAvailable = checkStorage();
  if (!storageAvailable) {
    if (!memoryFallback) memoryFallback = JSON.parse(JSON.stringify(DEFAULT_DATA));
    return memoryFallback!;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const data: BounceSaveData = JSON.parse(JSON.stringify(DEFAULT_DATA));
      saveData(data);
      return data;
    }
    let data: BounceSaveData = JSON.parse(raw);
    if (!data.version || data.version < CURRENT_VERSION) {
      data = migrateData(data);
      saveData(data);
    }
    return data;
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}

export function saveData(data: BounceSaveData): void {
  if (!storageAvailable) { memoryFallback = data; return; }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function saveStageResult(stageId: string, score: number, stars: number): BounceSaveData {
  const data = loadData();
  if (!data.highScores[stageId] || score > data.highScores[stageId]) data.highScores[stageId] = score;
  if (!data.stageStars[stageId] || stars > data.stageStars[stageId]) data.stageStars[stageId] = stars;
  data.totalPlayCount++;
  saveData(data);
  return data;
}

export function unlockStage(stageId: string): void {
  const data = loadData();
  data.unlockedStages[stageId] = true;
  saveData(data);
}

export function saveEndlessResult(score: number, wave: number): { isNewRecord: boolean; best: { score: number; wave: number } } {
  const data = loadData();
  if (!data.endlessBest) data.endlessBest = { score: 0, wave: 0 };
  let isNewRecord = false;
  if (score > data.endlessBest.score) { data.endlessBest.score = score; isNewRecord = true; }
  if (wave > data.endlessBest.wave) { data.endlessBest.wave = wave; isNewRecord = true; }
  data.totalPlayCount++;
  saveData(data);
  return { isNewRecord, best: data.endlessBest };
}

function migrateData(oldData: Partial<BounceSaveData>): BounceSaveData {
  const data: BounceSaveData = JSON.parse(JSON.stringify(DEFAULT_DATA));
  if (oldData.highScores) data.highScores = oldData.highScores;
  if (oldData.stageStars) data.stageStars = oldData.stageStars;
  if (oldData.unlockedStages) data.unlockedStages = oldData.unlockedStages;
  if (oldData.unlockedCharacters) data.unlockedCharacters = oldData.unlockedCharacters;
  if (oldData.settings) data.settings = { ...data.settings, ...oldData.settings };
  if (oldData.totalPlayCount) data.totalPlayCount = oldData.totalPlayCount;
  if (oldData.endlessBest) data.endlessBest = oldData.endlessBest;
  data.version = CURRENT_VERSION;
  return data;
}
