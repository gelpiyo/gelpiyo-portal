import React from 'react';
import { usePortalStore } from '@/stores/portalStore';
import { useRPGStore } from './stores/useRPGStore';
import { FieldScreen } from './components/FieldScreen';
import { BattleScreen } from './components/BattleScreen';
import { ShopScreen } from './components/ShopScreen';
import './rpg.css';

const ClearScreen: React.FC = () => {
  const resetGame = useRPGStore((state) => state.resetGame);
  return (
    <div className="rpg-clear-screen">
      <h1>せかい に へいわ が もどった！</h1>
      <p>CONGRATULATIONS!</p>
      <button className="rpg-command-btn" onClick={resetGame} style={{ marginTop: '40px', padding: '16px 32px' }}>
        さいしょから あそぶ
      </button>
    </div>
  );
};

export const RPG: React.FC = () => {
  const navigateToPortal = usePortalStore((state) => state.navigateToPortal);
  const { scene } = useRPGStore();

  const handleBack = () => {
    if (scene !== 'field' && scene !== 'clear') {
      // ショップ等にいる場合は、ポータルではなくフィールドに戻る
      useRPGStore.getState().setScene('field');
    } else {
      // フィールドやクリア画面の場合はポータルに戻る
      navigateToPortal();
    }
  };

  return (
    <div className="rpg-container" onContextMenu={(e) => e.preventDefault()}>
      <button className="rpg-back-btn" onClick={handleBack}>
        &#8592; もどる
      </button>

      {scene === 'field' && <FieldScreen />}
      {scene === 'battle' && <BattleScreen />}
      {scene === 'shop' && <ShopScreen />}
      {scene === 'clear' && <ClearScreen />}
    </div>
  );
};
