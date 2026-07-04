// ============================================
// types.ts - Shared Types & Constants for Puzzle Ranger
// ============================================

export type ColorType = 'red' | 'blue' | 'green' | 'yellow' | 'pink';
export type SkillType = 'bomb' | 'heal';
export type BlockShape = 'diamond' | 'circle' | 'triangle' | 'star' | 'heart';
export type Role = 'attacker' | 'tank' | 'shooter' | 'speed' | 'healer';

export interface UnitDef {
  name: string;
  hp: number;
  atk: number;
  speed: number;
  range: number;
  atkSpeed: number;
  role: Role;
}

export const UNIT_TYPES: Record<ColorType, UnitDef> = {
  red:    { name: 'レッド',   hp: 80,  atk: 25, speed: 1.8, range: 40,  atkSpeed: 800,  role: 'attacker' },
  blue:   { name: 'ブルー',   hp: 150, atk: 12, speed: 1.2, range: 35,  atkSpeed: 1000, role: 'tank' },
  green:  { name: 'グリーン', hp: 60,  atk: 18, speed: 1.4, range: 150, atkSpeed: 900,  role: 'shooter' },
  yellow: { name: 'イエロー', hp: 65,  atk: 15, speed: 2.8, range: 35,  atkSpeed: 700,  role: 'speed' },
  pink:   { name: 'ピンク',   hp: 70,  atk: 8,  speed: 1.3, range: 100, atkSpeed: 1200, role: 'healer' }
};

export type EnemyType = 'waru' | 'kuro' | 'mecha';

export interface EnemyDef {
  name: string;
  hp: number;
  atk: number;
  speed: number;
  range: number;
  atkSpeed: number;
  imgKey: string;
}

export const ENEMY_TYPES: Record<EnemyType, EnemyDef> = {
  waru:  { name: 'ワルぴよ', hp: 60,  atk: 10, speed: 1.0, range: 35, atkSpeed: 1000, imgKey: 'waru_piyo' },
  kuro:  { name: 'クロぴよ', hp: 120, atk: 18, speed: 0.8, range: 40, atkSpeed: 1200, imgKey: 'kuro_piyo' },
  mecha: { name: 'メカぴよ', hp: 300, atk: 30, speed: 0.5, range: 50, atkSpeed: 1500, imgKey: 'mecha_piyo' }
};

export interface WaveDef {
  enemies: { type: EnemyType; count: number; interval: number }[];
}

export const WAVES: WaveDef[] = [
  { enemies: [{ type: 'waru', count: 4, interval: 2000 }] },
  { enemies: [{ type: 'waru', count: 6, interval: 1800 }] },
  { enemies: [{ type: 'waru', count: 5, interval: 1500 }, { type: 'kuro', count: 1, interval: 3000 }] },
  { enemies: [{ type: 'waru', count: 6, interval: 1200 }, { type: 'kuro', count: 2, interval: 2500 }] },
  { enemies: [{ type: 'waru', count: 8, interval: 1000 }, { type: 'kuro', count: 3, interval: 2000 }] },
  { enemies: [{ type: 'kuro', count: 5, interval: 1500 }, { type: 'mecha', count: 1, interval: 5000 }] },
  { enemies: [{ type: 'waru', count: 10, interval: 800 }, { type: 'kuro', count: 4, interval: 1500 }, { type: 'mecha', count: 1, interval: 4000 }] },
  { enemies: [{ type: 'kuro', count: 6, interval: 1200 }, { type: 'mecha', count: 2, interval: 3000 }] },
  { enemies: [{ type: 'waru', count: 12, interval: 600 }, { type: 'kuro', count: 5, interval: 1000 }, { type: 'mecha', count: 2, interval: 2500 }] },
  { enemies: [{ type: 'mecha', count: 5, interval: 2000 }] },
];

export const COLOR_MAP: Record<ColorType, { fill: string; glow: string; light: string }> = {
  red:    { fill: '#ff4466', glow: 'rgba(255,68,102,0.5)',  light: '#ff8899' },
  blue:   { fill: '#4488ff', glow: 'rgba(68,136,255,0.5)',  light: '#88bbff' },
  green:  { fill: '#44dd66', glow: 'rgba(68,221,102,0.5)',  light: '#88ff99' },
  yellow: { fill: '#ffcc22', glow: 'rgba(255,204,34,0.5)',  light: '#ffdd66' },
  pink:   { fill: '#ff88cc', glow: 'rgba(255,136,204,0.5)', light: '#ffbbdd' }
};

export const SKILL_PANEL_TYPES: Record<SkillType, { fill: string; glow: string; light: string; label: string; name: string }> = {
  bomb: { fill: '#ff6600', glow: 'rgba(255,100,0,0.8)', light: '#ffaa44', label: '💥', name: 'ボム' },
  heal: { fill: '#00dd88', glow: 'rgba(0,221,136,0.8)', light: '#88ffcc', label: '💚', name: 'ヒール' },
};

export const BLOCK_SHAPES: Record<ColorType, BlockShape> = {
  red:    'diamond',
  blue:   'circle',
  green:  'triangle',
  yellow: 'star',
  pink:   'heart'
};

export type GameCallbacks = {
  onScoreUpdate?: (score: number) => void;
  onComboUpdate?: (combo: number) => void;
  onWaveUpdate?: (wave: number) => void;
  onHpUpdate?: (allyHp: number, allyMax: number, enemyHp: number, enemyMax: number) => void;
  onWaveCleared?: (wave: number, score: number) => void;
  onGameOver?: (wave: number, score: number) => void;
};
