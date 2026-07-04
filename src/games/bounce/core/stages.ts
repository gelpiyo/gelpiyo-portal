// ============================================
// stages.ts — ステージデータ定義
// ============================================

import type { StageData, WorldData } from './types';
import { OBJ_TYPE } from './types';

export const WORLDS: WorldData[] = [
  { id: 1, name: 'おうちのお庭', bgGradient: ['#0a1628', '#1a3a5c', '#2d5a3d'], groundColor: '#2d5a3d', accentColor: '#00ff88' },
  { id: 2, name: 'おもちゃ箱', bgGradient: ['#1a0a28', '#3a1a5c', '#5a2d4d'], groundColor: '#5a2d4d', accentColor: '#ff6b9d' },
  { id: 3, name: 'メカぴよの工場', bgGradient: ['#0a1a1a', '#1a2a3a', '#2a3a4a'], groundColor: '#3a4a5a', accentColor: '#00d4ff' },
  { id: 4, name: 'ワルぴよの城', bgGradient: ['#1a0a0a', '#2a1020', '#3a1030'], groundColor: '#2a1020', accentColor: '#ff4444' },
];

export const STAGES: Record<string, StageData> = {
  '1-1': {
    world: 1, name: 'はじめてのバウンス', piyoCount: 3, starThresholds: [500, 1500, 3000],
    slingshotX: 80, slingshotY: 620,
    objects: [
      { type: OBJ_TYPE.WOOD, x: 270, y: 590, w: 55, h: 55 },
      { type: OBJ_TYPE.ENEMY, x: 273, y: 535, w: 48, h: 48, imageKey: 'warpiyo' },
    ],
  },
  '1-2': {
    world: 1, name: 'ゼリーでバウンス', piyoCount: 3, starThresholds: [800, 2000, 4000],
    slingshotX: 80, slingshotY: 620,
    objects: [
      { type: OBJ_TYPE.JELLY, x: 160, y: 590, w: 55, h: 55 },
      { type: OBJ_TYPE.WOOD, x: 290, y: 590, w: 55, h: 55 },
      { type: OBJ_TYPE.WOOD, x: 290, y: 535, w: 55, h: 55 },
      { type: OBJ_TYPE.ENEMY, x: 293, y: 480, w: 48, h: 48, imageKey: 'warpiyo' },
    ],
  },
  '1-3': {
    world: 1, name: 'かべを越えて', piyoCount: 3, starThresholds: [1000, 2500, 5000],
    slingshotX: 80, slingshotY: 620,
    objects: [
      { type: OBJ_TYPE.IRON, x: 190, y: 510, w: 35, h: 140 },
      { type: OBJ_TYPE.WOOD, x: 280, y: 590, w: 55, h: 55 },
      { type: OBJ_TYPE.ENEMY, x: 283, y: 535, w: 48, h: 48, imageKey: 'warpiyo' },
      { type: OBJ_TYPE.ENEMY, x: 340, y: 590, w: 48, h: 48, imageKey: 'warpiyo' },
    ],
  },
  '1-4': {
    world: 1, name: 'ガラスのまち', piyoCount: 3, starThresholds: [1200, 3000, 6000],
    slingshotX: 80, slingshotY: 620,
    objects: [
      { type: OBJ_TYPE.GLASS, x: 190, y: 590, w: 48, h: 48 },
      { type: OBJ_TYPE.GLASS, x: 238, y: 590, w: 48, h: 48 },
      { type: OBJ_TYPE.GLASS, x: 214, y: 542, w: 48, h: 48 },
      { type: OBJ_TYPE.WOOD, x: 300, y: 590, w: 55, h: 55 },
      { type: OBJ_TYPE.ENEMY, x: 303, y: 535, w: 48, h: 48, imageKey: 'warpiyo' },
      { type: OBJ_TYPE.ENEMY, x: 218, y: 494, w: 48, h: 48, imageKey: 'warpiyo' },
    ],
  },
  '1-5': {
    world: 1, name: 'どっかーん！', piyoCount: 3, starThresholds: [1500, 4000, 8000],
    slingshotX: 80, slingshotY: 620,
    objects: [
      { type: OBJ_TYPE.WOOD, x: 210, y: 590, w: 55, h: 55 },
      { type: OBJ_TYPE.WOOD, x: 265, y: 590, w: 55, h: 55 },
      { type: OBJ_TYPE.TNT, x: 237, y: 535, w: 48, h: 48 },
      { type: OBJ_TYPE.WOOD, x: 330, y: 590, w: 55, h: 55 },
      { type: OBJ_TYPE.ENEMY, x: 333, y: 535, w: 48, h: 48, imageKey: 'warpiyo' },
      { type: OBJ_TYPE.ENEMY, x: 213, y: 480, w: 48, h: 48, imageKey: 'warpiyo' },
      { type: OBJ_TYPE.ENEMY, x: 268, y: 480, w: 48, h: 48, imageKey: 'warpiyo' },
    ],
  },
};

export function getStageIds(): string[] {
  return Object.keys(STAGES);
}

export function getStagesByWorld(worldId: number): Array<{ id: string } & StageData> {
  return Object.entries(STAGES)
    .filter(([, data]) => data.world === worldId)
    .map(([id, data]) => ({ id, ...data }));
}

export function getNextStageId(currentId: string): string | null {
  const ids = getStageIds();
  const idx = ids.indexOf(currentId);
  if (idx >= 0 && idx < ids.length - 1) return ids[idx + 1];
  return null;
}
