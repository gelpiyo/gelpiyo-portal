// ============================================
// storage.ts - Local Storage Management (Migrated to useSaveDataStore)
// ============================================

import { useSaveDataStore } from '@/stores/saveDataStore';
import type { FactorySaveData } from '@/stores/saveDataStore';

export function loadData(): FactorySaveData {
  return useSaveDataStore.getState().games['factory'] || {
    highScores: [],
    settings: { muted: false },
    totalGamesPlayed: 0
  };
}

export function saveData(data: FactorySaveData): void {
  useSaveDataStore.getState().updateFactoryData(() => data);
}

export function addHighScore(score: number): number {
  const data = { ...loadData() };
  const entry = {
    score,
    date: new Date().toISOString()
  };
  data.highScores = [...(data.highScores || [])];
  data.highScores.push(entry);
  data.highScores.sort((a, b) => b.score - a.score);
  data.highScores = data.highScores.slice(0, 10);
  data.totalGamesPlayed++;
  saveData(data);

  const rank = data.highScores.findIndex(e => e.date === entry.date && e.score === entry.score) + 1;
  return rank > 0 ? rank : data.highScores.length;
}

export function getHighScores(): Array<{ score: number; date: string }> {
  return loadData().highScores || [];
}

export function getMuted(): boolean {
  return loadData().settings?.muted || false;
}

export function setMuted(muted: boolean): void {
  const data = { ...loadData() };
  data.settings = { ...data.settings, muted };
  saveData(data);
}
