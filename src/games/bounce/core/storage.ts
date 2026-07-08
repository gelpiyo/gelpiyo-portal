// ============================================
// storage.ts — ローカルストレージ管理 (Migrated to useSaveDataStore)
// ============================================

import { useSaveDataStore } from '@/stores/saveDataStore';
import type { BounceSaveData } from '@/stores/saveDataStore';
export type { BounceSaveData };

const DEFAULT_DATA: BounceSaveData = {
  highScores: {},
  stageStars: {},
  unlockedStages: { '1-1': true },
  unlockedCharacters: ['gelpiyo'],
  settings: { muted: false },
  totalPlayCount: 0,
  endlessBest: { score: 0, wave: 0 },
};

export function loadData(): BounceSaveData {
  return useSaveDataStore.getState().games['bounce'] || DEFAULT_DATA;
}

export function saveData(data: BounceSaveData): void {
  useSaveDataStore.getState().updateBounceData(() => data);
}

export function saveStageResult(stageId: string, score: number, stars: number): BounceSaveData {
  const data = JSON.parse(JSON.stringify(loadData()));
  if (!data.highScores[stageId] || score > data.highScores[stageId]) data.highScores[stageId] = score;
  if (!data.stageStars[stageId] || stars > data.stageStars[stageId]) data.stageStars[stageId] = stars;
  data.totalPlayCount++;
  saveData(data);
  return data;
}

export function unlockStage(stageId: string): void {
  const data = JSON.parse(JSON.stringify(loadData()));
  data.unlockedStages[stageId] = true;
  saveData(data);
}

export function saveEndlessResult(score: number, wave: number): { isNewRecord: boolean; best: { score: number; wave: number } } {
  const data = JSON.parse(JSON.stringify(loadData()));
  if (!data.endlessBest) data.endlessBest = { score: 0, wave: 0 };
  let isNewRecord = false;
  if (score > data.endlessBest.score) { data.endlessBest.score = score; isNewRecord = true; }
  if (wave > data.endlessBest.wave) { data.endlessBest.wave = wave; isNewRecord = true; }
  data.totalPlayCount++;
  saveData(data);
  return { isNewRecord, best: data.endlessBest };
}
