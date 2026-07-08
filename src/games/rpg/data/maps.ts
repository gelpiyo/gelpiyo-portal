export type TileType = 0 | 1 | 2 | 3;
// 0: 床 (歩ける)
// 1: 木 (歩けない)
// 2: 岩 (歩けない)
// 3: 水 (歩けない)

export interface DialogChoice {
  label: string;
  action: 'close' | 'shop' | 'heal' | string;
  nextMessageIndex?: number;
}

export interface DialogMessage {
  text: string;
  question?: string;
  choices?: DialogChoice[];
}

export interface MapEvent {
  id: string;
  type: 'npc' | 'stairs' | 'chest' | 'boss';
  x: number;
  y: number;
  // NPC用
  name?: string;
  emoji?: string;
  messages?: DialogMessage[];
  // 階段用
  toMapId?: string;
  toX?: number;
  toY?: number;
  // 宝箱用
  exp?: number;
  gold?: number;
}

export interface MapData {
  id: string;
  name: string;
  grid: TileType[][];
  events: MapEvent[];
  encounterRate: number; // 0〜1 (0ならエンカウントなし)
}

// ユーザーが自由に編集するマップデータ
export const MAPS: Record<string, MapData> = {
  'floor1': {
    id: 'floor1',
    name: 'はじまりのそうげん',
    encounterRate: 0.05, // 1歩ごとに5%の確率で敵出現
    grid: [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 3, 3, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 3, 3, 3, 3, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 3, 3, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0, 0, 0, 1],
      [1, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    ],
    events: [
      {
        id: 'npc1', type: 'npc', x: 5, y: 5, name: '村人', emoji: '🧑‍🌾',
        messages: [
          { text: 'ここは「はじまりのそうげん」だよ。' },
          { text: '南のほうに、ボスのいる洞窟への階段があるらしい。' },
          { 
            text: '準備はいいかい？',
            question: 'どうする？',
            choices: [
              { label: 'はい', action: 'close' },
              { label: 'よろずやに行く', action: 'shop' }
            ]
          }
        ]
      },
      { id: 'chest1', type: 'chest', x: 2, y: 2, exp: 50, gold: 100 },
      { id: 'chest2', type: 'chest', x: 18, y: 18, exp: 200, gold: 500 },
      { id: 'stairs1', type: 'stairs', x: 10, y: 18, toMapId: 'floor2', toX: 2, toY: 2 }
    ]
  },
  'floor2': {
    id: 'floor2',
    name: 'ボスのどうくつ B1F',
    encounterRate: 0.1, // 敵が多い（10%）
    grid: [
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 2],
      [2, 0, 2, 2, 2, 2, 2, 2, 0, 2],
      [2, 0, 2, 0, 0, 0, 0, 2, 0, 2],
      [2, 0, 2, 0, 0, 0, 0, 2, 0, 2],
      [2, 0, 2, 0, 0, 0, 0, 2, 0, 2],
      [2, 0, 2, 2, 2, 0, 2, 2, 0, 2],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 2],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 2],
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2]
    ],
    events: [
      { id: 'stairs2', type: 'stairs', x: 2, y: 2, toMapId: 'floor1', toX: 10, toY: 17 }, // 戻る階段
      { id: 'boss1', type: 'boss', x: 5, y: 4 } // ボス
    ]
  }
};
