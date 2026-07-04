// ============================================
// types.ts - Shared Types & Constants for Gelpiyo Factory
// ============================================

export type GelpiyoId = 'yellow' | 'pink' | 'green';

export interface GelpiyoType {
  id: GelpiyoId;
  name: string;
  color: string;
  ingredient: string;
  ingredientEmoji: string;
  ingredientColor: string;
}

export const GELPIYO_TYPES: GelpiyoType[] = [
  {
    id: 'yellow',
    name: 'ゲルぴよ',
    color: 'hsl(45, 90%, 55%)',
    ingredient: 'バナナ',
    ingredientEmoji: '🍌',
    ingredientColor: 'hsl(50, 85%, 55%)'
  },
  {
    id: 'pink',
    name: 'モモぴよ',
    color: 'hsl(340, 75%, 65%)',
    ingredient: 'イチゴ',
    ingredientEmoji: '🍓',
    ingredientColor: 'hsl(350, 80%, 60%)'
  },
  {
    id: 'green',
    name: 'みどぴよ',
    color: 'hsl(150, 65%, 50%)',
    ingredient: 'ミント',
    ingredientEmoji: '🌿',
    ingredientColor: 'hsl(150, 70%, 45%)'
  }
];

export const POT_STATE = {
  EMPTY: 'empty',
  MELTING: 'melting',
  MELTED: 'melted'
} as const;

export type PotState = typeof POT_STATE[keyof typeof POT_STATE];

export const MOLD_STATE = {
  EMPTY: 'empty',
  FILLED: 'filled',
  SETTING: 'setting',
  DONE: 'done'
} as const;

export type MoldState = typeof MOLD_STATE[keyof typeof MOLD_STATE];

export const CUSTOMER_STATE = {
  ENTERING: 'entering',
  WAITING: 'waiting',
  SERVED: 'served',
  LEFT: 'left'
} as const;

export type CustomerState = typeof CUSTOMER_STATE[keyof typeof CUSTOMER_STATE];

export type DragType = 'pellet' | 'ladle' | 'topping' | 'gelpiyo';

export interface DragState {
  active: boolean;
  type: DragType | null;
  payload: GelpiyoType | null;
  sourceIndex: number;
  x: number;
  y: number;
}

export interface HitAreas {
  customers: Array<{ x: number; y: number; w: number; h: number; slotIndex: number }>;
  pots: Array<{ x: number; y: number; w: number; h: number }>;
  molds: Array<{ x: number; y: number; w: number; h: number }>;
  pellet: { x: number; y: number; w: number; h: number } | null;
  ladle: { x: number; y: number; w: number; h: number } | null;
  toppings: Array<{ x: number; y: number; w: number; h: number }>;
}

export type SceneType = 'title' | 'playing' | 'result';

export interface LadleAnim {
  active: boolean;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  progress: number;
  duration: number;
  targetMoldIndex: number;
  sourcePotIndex: number;
}
