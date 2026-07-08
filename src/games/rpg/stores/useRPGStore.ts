import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MAPS } from '../data/maps';

export type Scene = 'field' | 'battle' | 'clear' | 'shop';

export interface PlayerStats {
  level: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  attack: number;
  defense: number;
  exp: number;
  gold: number;
  equipment: {
    weapon: string | null;
    armor: string | null;
    shield: string | null;
  };
}

export interface ShopItem {
  id: string;
  name: string;
  price: number;
  type: 'weapon' | 'armor' | 'shield';
  bonus: number;
  description: string;
}

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'wpn_1', name: 'きのえだ', price: 20, type: 'weapon', bonus: 2, description: '攻撃力 +2' },
  { id: 'wpn_2', name: 'ゲルセイバー', price: 100, type: 'weapon', bonus: 10, description: '攻撃力 +10' },
  { id: 'arm_1', name: 'ぬののふく', price: 20, type: 'armor', bonus: 10, description: '最大HP +10' },
  { id: 'arm_2', name: 'ゲルアーマー', price: 100, type: 'armor', bonus: 40, description: '最大HP +40' },
  { id: 'shd_1', name: 'なべのふた', price: 20, type: 'shield', bonus: 10, description: '防御 +10%' },
  { id: 'shd_2', name: 'ゲルシールド', price: 100, type: 'shield', bonus: 30, description: '防御 +30%' },
];

export interface EnemyStats {
  name: string;
  hp: number;
  maxHp: number;
  attack: number;
  exp: number;
  gold: number;
  emoji: string;
  isBoss?: boolean;
}

interface Position {
  x: number;
  y: number;
}

interface RPGState {
  scene: Scene;
  player: PlayerStats;
  playerPos: Position;
  currentMapId: string;
  openedChestIds: string[];
  currentEnemy: EnemyStats | null;
  stepsSinceLastEncounter: number;
  
  // Actions
  setScene: (scene: Scene) => void;
  changeMap: (mapId: string, x: number, y: number) => void;
  move: (dx: number, dy: number) => void;
  encounter: (enemy: EnemyStats) => void;
  takeDamage: (amount: number) => void;
  damageEnemy: (amount: number) => void;
  flee: () => void;
  winBattle: () => void;
  die: () => void;
  resetGame: () => void;
  rest: () => void;
  openChest: (id: string, exp: number, gold: number) => void;
  gameClear: () => void;
  consumeMp: (amount: number) => boolean;
  recoverHp: (amount: number) => void;
  buyItem: (item: ShopItem) => boolean;
  incrementSteps: () => number;
  resetSteps: () => void;
}

const INITIAL_PLAYER: PlayerStats = {
  level: 1,
  hp: 20,
  maxHp: 20,
  mp: 10,
  maxMp: 10,
  attack: 5,
  defense: 0,
  exp: 0,
  gold: 0,
  equipment: { weapon: null, armor: null, shield: null },
};

const START_POSITION: Position = { x: 5, y: 5 };

export const useRPGStore = create<RPGState>()(
  persist(
    (set) => ({
      scene: 'field',
      player: { ...INITIAL_PLAYER },
      playerPos: { ...START_POSITION },
      currentMapId: 'floor1',
      openedChestIds: [],
      currentEnemy: null,
      stepsSinceLastEncounter: 0,

      setScene: (scene) => set({ scene }),
      changeMap: (mapId, x, y) => set({ currentMapId: mapId, playerPos: { x, y } }),

      move: (dx, dy) => set((state) => {
        if (state.scene !== 'field') return state;
        
        let newX = state.playerPos.x + dx;
        let newY = state.playerPos.y + dy;
        
        const mapData = MAPS[state.currentMapId];
        if (!mapData) return state;

        // 境界チェック
        if (newY < 0 || newY >= mapData.grid.length || newX < 0 || newX >= mapData.grid[0].length) {
          return state;
        }
        
        // 障害物タイルチェック
        if (mapData.grid[newY][newX] !== 0) {
          return state;
        }

        // イベント（NPC, ボス）チェック
        const event = mapData.events.find(e => e.x === newX && e.y === newY);
        if (event && (event.type === 'npc' || event.type === 'boss')) {
          // ブロックされて進めない（衝突イベントはFieldScreenで検知させる）
          return state;
        }

        return { playerPos: { x: newX, y: newY } };
      }),

      incrementSteps: () => {
        let currentSteps = 0;
        set((state) => {
          currentSteps = state.stepsSinceLastEncounter + 1;
          return { stepsSinceLastEncounter: currentSteps };
        });
        return currentSteps;
      },

      resetSteps: () => set({ stepsSinceLastEncounter: 0 }),

      encounter: (enemy) => set({ scene: 'battle', currentEnemy: enemy }),

      takeDamage: (amount) => set((state) => {
        // 防御力(%)によるダメージ軽減 (最低1ダメージ)
        const reductionRatio = Math.min(100, state.player.defense) / 100;
        const actualDamage = Math.max(1, Math.floor(amount * (1 - reductionRatio)));
        const newHp = Math.max(0, state.player.hp - actualDamage);
        return { player: { ...state.player, hp: newHp } };
      }),

      damageEnemy: (amount) => set((state) => {
        if (!state.currentEnemy) return state;
        const newHp = Math.max(0, state.currentEnemy.hp - amount);
        return { currentEnemy: { ...state.currentEnemy, hp: newHp } };
      }),

      flee: () => set({ 
        scene: 'field', 
        currentEnemy: null,
        stepsSinceLastEncounter: 0 
      }),
      
      winBattle: () => set((state) => {
        if (!state.currentEnemy) return state;
        
        const newExp = state.player.exp + state.currentEnemy.exp;
        const newGold = state.player.gold + state.currentEnemy.gold;
        
        let newLevel = state.player.level;
        let newMaxHp = state.player.maxHp;
        let newMaxMp = state.player.maxMp;
        let newAttack = state.player.attack;
        let currentHp = state.player.hp;
        let currentMp = state.player.mp;
        
        // 簡易レベルアップ判定 (経験値20, 40, 60... でレベルアップ)
        while (newExp >= newLevel * 20) {
          newLevel++;
          newMaxHp += 5;
          newMaxMp += 3;
          newAttack += 2;
          currentHp = newMaxHp; // レベルアップで全回復
          currentMp = newMaxMp;
        }
        
        return {
          scene: 'field',
          currentEnemy: null,
          player: {
            ...state.player,
            level: newLevel,
            maxHp: newMaxHp,
            hp: currentHp,
            maxMp: newMaxMp,
            mp: currentMp,
            attack: newAttack,
            exp: newExp,
            gold: newGold,
          }
        };
      }),

      die: () => set((state) => ({
        scene: 'field',
        playerPos: { ...START_POSITION },
        player: {
          ...state.player,
          hp: state.player.maxHp,
          mp: state.player.maxMp,
          gold: Math.floor(state.player.gold / 2),
        },
        currentEnemy: null,
      })),
      
      resetGame: () => set({
        scene: 'field',
        player: { ...INITIAL_PLAYER },
        playerPos: { ...START_POSITION },
        currentMapId: 'floor1',
        openedChestIds: [],
        currentEnemy: null,
        stepsSinceLastEncounter: 0,
      }),

      rest: () => set((state) => {
        if (state.player.gold >= 10 && (state.player.hp < state.player.maxHp || state.player.mp < state.player.maxMp)) {
          return {
            player: {
              ...state.player,
              hp: state.player.maxHp,
              mp: state.player.maxMp,
              gold: state.player.gold - 10
            }
          };
        }
        return state;
      }),

      openChest: (id, exp, gold) => set((state) => {
        if (state.openedChestIds.includes(id)) return state;

        const newExp = state.player.exp + exp;
        const newGold = state.player.gold + gold;

        let newLevel = state.player.level;
        let newMaxHp = state.player.maxHp;
        let newMaxMp = state.player.maxMp;
        let newAttack = state.player.attack;
        let currentHp = state.player.hp;
        let currentMp = state.player.mp;
        
        while (newExp >= newLevel * 20) {
          newLevel++;
          newMaxHp += 5;
          newMaxMp += 3;
          newAttack += 2;
          currentHp = newMaxHp; 
          currentMp = newMaxMp;
        }

        return {
          openedChestIds: [...state.openedChestIds, id],
          player: {
            ...state.player,
            level: newLevel,
            maxHp: newMaxHp,
            hp: currentHp,
            maxMp: newMaxMp,
            mp: currentMp,
            attack: newAttack,
            exp: newExp,
            gold: newGold,
          }
        };
      }),

      gameClear: () => set(() => {
        // ボス撃破後のステータス加算などをしても良いが、ここでは単純にシーン遷移
        return {
          scene: 'clear',
          currentEnemy: null,
          stepsSinceLastEncounter: 0,
        };
      }),
      


      buyItem: (item) => {
        let success = false;
        set((state) => {
          const currentEquip = state.player.equipment[item.type];
          if (currentEquip === item.id) {
            // すでに同じものを装備中
            return state;
          }

          if (state.player.gold >= item.price) {
            success = true;
            const newPlayer = { ...state.player };
            newPlayer.gold -= item.price;
            
            // 古い装備のボーナスをマイナスする
            if (currentEquip) {
              const oldItem = SHOP_ITEMS.find(i => i.id === currentEquip);
              if (oldItem) {
                if (oldItem.type === 'weapon') newPlayer.attack -= oldItem.bonus;
                if (oldItem.type === 'armor') {
                  newPlayer.maxHp -= oldItem.bonus;
                  newPlayer.hp = Math.min(newPlayer.hp, newPlayer.maxHp);
                }
                if (oldItem.type === 'shield') newPlayer.defense -= oldItem.bonus;
              }
            }
            
            // 新しい装備のボーナスを加算する
            if (item.type === 'weapon') newPlayer.attack += item.bonus;
            if (item.type === 'armor') {
              newPlayer.maxHp += item.bonus;
              newPlayer.hp += item.bonus;
            }
            if (item.type === 'shield') newPlayer.defense += item.bonus;

            // 装備品を更新
            newPlayer.equipment = { ...newPlayer.equipment, [item.type]: item.id };
            
            return { player: newPlayer };
          }
          return state;
        });
        return success;
      },

      consumeMp: (amount) => {
        // 実際にはget()をストアの外から使うか、stateを使って更新する
        let success = false;
        set((s) => {
          if (s.player.mp >= amount) {
            success = true;
            return { player: { ...s.player, mp: s.player.mp - amount } };
          }
          return s;
        });
        return success;
      },
      
      recoverHp: (amount) => set((state) => {
        const newHp = Math.min(state.player.maxHp, state.player.hp + amount);
        return { player: { ...state.player, hp: newHp } };
      })
    }),
    {
      name: 'gelpiyo-rpg-storage',
      merge: (persistedState: any, currentState) => {
        // 古いデータに mp や equipment がない場合は初期値で補完する
        if (persistedState && persistedState.player) {
          if (persistedState.player.mp === undefined) persistedState.player.mp = 10;
          if (persistedState.player.maxMp === undefined) persistedState.player.maxMp = 10;
          if (persistedState.player.defense === undefined) persistedState.player.defense = 0;
          
          if (!persistedState.player.equipment || Array.isArray(persistedState.player.equipment)) {
            // 旧バージョンの配列形式から新しいオブジェクト形式へリセット
            persistedState.player.equipment = { weapon: null, armor: null, shield: null };
          }
        }
        if (!persistedState.currentMapId) persistedState.currentMapId = 'floor1';
        if (!persistedState.openedChestIds) persistedState.openedChestIds = [];
        if (persistedState.stepsSinceLastEncounter === undefined) persistedState.stepsSinceLastEncounter = 0;
        return { ...currentState, ...persistedState };
      }
    }
  )
);
