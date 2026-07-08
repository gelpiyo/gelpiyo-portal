import React from 'react';
import { useRPGStore, SHOP_ITEMS } from '../stores/useRPGStore';
import type { ShopItem } from '../stores/useRPGStore';

export const ShopScreen: React.FC = () => {
  const { player, buyItem, setScene } = useRPGStore();

  const handleBuy = (item: ShopItem) => {
    if (player.equipment[item.type] === item.id) {
      alert('すでに このそうびを つけている！');
      return;
    }
    if (player.gold < item.price) {
      alert('ゴールドが たりない！');
      return;
    }
    
    const success = buyItem(item);
    if (success) {
      alert(`${item.name} を そうびした！`);
    }
  };

  return (
    <div className="rpg-shop-screen">
      <div className="rpg-shop-header">
        <h2>よろずや</h2>
        <div className="rpg-shop-gold">所持ゴールド: {player.gold}G</div>
      </div>
      
      <div className="rpg-shop-list">
        {SHOP_ITEMS.map((item) => {
          const isEquipped = player.equipment[item.type] === item.id;
          const canAfford = player.gold >= item.price;
          
          return (
            <div key={item.id} className={`rpg-shop-item ${isEquipped ? 'owned' : ''}`}>
              <div className="rpg-shop-item-info">
                <div className="rpg-shop-item-name">{item.name}</div>
                <div className="rpg-shop-item-desc">{item.description}</div>
              </div>
              <div className="rpg-shop-item-action">
                <div className="rpg-shop-item-price">{item.price}G</div>
                <button 
                  className="rpg-command-btn" 
                  onClick={() => handleBuy(item)}
                  disabled={isEquipped || !canAfford}
                >
                  {isEquipped ? 'そうび中' : 'かう'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rpg-shop-footer">
        <button className="rpg-command-btn" onClick={() => setScene('field')}>
          おみせをでる
        </button>
      </div>
    </div>
  );
};
