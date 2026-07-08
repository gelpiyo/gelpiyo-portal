import React, { useState, useEffect, useRef } from 'react';
import { useRPGStore } from '../stores/useRPGStore';

// スリープ用ユーティリティ
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type SkillType = 'attack' | 'heal';
interface Skill {
  id: string;
  name: string;
  levelRequired: number;
  mpCost: number;
  type: SkillType;
  multiplier?: number;
}

const SKILLS: Skill[] = [
  { id: 's1', name: 'ヒール', levelRequired: 1, mpCost: 3, type: 'heal' },
  { id: 's2', name: 'つよめにつつく', levelRequired: 3, mpCost: 5, type: 'attack', multiplier: 1.5 },
  { id: 's3', name: 'ゲルブラスター', levelRequired: 5, mpCost: 10, type: 'attack', multiplier: 3.0 },
];

export const BattleScreen: React.FC = () => {
  const { player, currentEnemy, takeDamage, damageEnemy, flee, winBattle, die } = useRPGStore();
  const [displayedMessage, setDisplayedMessage] = useState('');
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [isActionRunning, setIsActionRunning] = useState(false);
  const [isSkillMenuOpen, setIsSkillMenuOpen] = useState(false);
  
  const [enemyShake, setEnemyShake] = useState(false);
  const [flash, setFlash] = useState(false);
  const [deathScreen, setDeathScreen] = useState(false);

  const initialized = useRef(false);

  const availableSkills = SKILLS.filter(s => player.level >= s.levelRequired);

  const showMessage = async (msg: string, waitAfter = 800) => {
    setDisplayedMessage('');
    let current = '';
    for (let i = 0; i < msg.length; i++) {
      current += msg[i];
      setDisplayedMessage(current);
      await sleep(30);
    }
    await sleep(waitAfter);
  };

  const triggerDamageEffect = () => {
    setEnemyShake(true);
    setFlash(true);
    setTimeout(() => {
      setEnemyShake(false);
      setFlash(false);
    }, 400);
  };

  useEffect(() => {
    if (initialized.current || !currentEnemy) return;
    initialized.current = true;
    
    const initBattle = async () => {
      setIsActionRunning(true);
      await showMessage(`${currentEnemy.name} が あらわれた！`, 500);
      setIsActionRunning(false);
    };
    initBattle();
  }, [currentEnemy]);

  const enemyTurn = async () => {
    const currentEnemyObj = useRPGStore.getState().currentEnemy;
    if (!currentEnemyObj) return;

    await showMessage(`${currentEnemyObj.name} の こうげき！`, 500);
    
    const damage = Math.max(1, currentEnemyObj.attack - Math.floor(Math.random() * 2));
    
    setFlash(true);
    setTimeout(() => setFlash(false), 200);
    takeDamage(damage);
    
    await showMessage(`ゲルぴよ は ${damage} の ダメージ を うけた！`);
    
    const updatedPlayerHp = useRPGStore.getState().player.hp;
    if (updatedPlayerHp <= 0) {
      await showMessage(`ゲルぴよ は しんでしまった...`, 1000);
      setDeathScreen(true);
      await showMessage(`ゴールド が はんぶん に なってしまった...`, 2000);
      die(); 
    } else {
      setIsPlayerTurn(true);
    }
  };

  const checkEnemyDeathOrNextTurn = async () => {
    const updatedEnemyHp = useRPGStore.getState().currentEnemy?.hp ?? 0;
    const currentEnemyObj = useRPGStore.getState().currentEnemy;
    if (!currentEnemyObj) return;

    if (updatedEnemyHp <= 0) {
      await showMessage(`${currentEnemyObj.name} を たおした！`);
      await showMessage(`${currentEnemyObj.exp} の けいけんち を てにいれた！`);
      await showMessage(`${currentEnemyObj.gold} ゴールド を てにいれた！`);
      
      const currentExp = player.exp + currentEnemyObj.exp;
      let nextLevel = player.level;
      while (currentExp >= nextLevel * 20) {
        nextLevel++;
      }
      
      if (nextLevel > player.level) {
        await showMessage(`ゲルぴよ は レベル${nextLevel} に あがった！`, 1500);
      }
      
      if (currentEnemyObj.isBoss) {
        useRPGStore.getState().gameClear();
      } else {
        winBattle();
      }
    } else {
      await enemyTurn();
    }
  };

  const handleAttack = async () => {
    if (isActionRunning || !currentEnemy) return;
    setIsActionRunning(true);
    setIsPlayerTurn(false);
    setIsSkillMenuOpen(false);
    
    await showMessage(`ゲルぴよ の こうげき！`, 500);
    
    const damage = Math.max(1, player.attack - Math.floor(Math.random() * 3));
    triggerDamageEffect();
    damageEnemy(damage);
    
    await showMessage(`${currentEnemy.name} に ${damage} の ダメージ！`);
    
    await checkEnemyDeathOrNextTurn();
    setIsActionRunning(false);
  };

  const handleSkill = async (skill: Skill) => {
    if (isActionRunning || !currentEnemy) return;
    setIsSkillMenuOpen(false);
    setIsActionRunning(true);
    setIsPlayerTurn(false);

    const success = useRPGStore.getState().consumeMp(skill.mpCost);
    if (!success) {
      await showMessage(`MP が たりない！`, 1000);
      setIsPlayerTurn(true);
      setIsActionRunning(false);
      return;
    }

    await showMessage(`ゲルぴよ は ${skill.name} を つかった！`, 500);

    if (skill.type === 'heal') {
      const healAmount = player.attack * 2;
      useRPGStore.getState().recoverHp(healAmount);
      await showMessage(`ゲルぴよ の HP が ${healAmount} かいふくした！`);
      await enemyTurn();
    } else if (skill.type === 'attack') {
      const damage = Math.max(1, Math.floor(player.attack * (skill.multiplier || 1)) - Math.floor(Math.random() * 3));
      triggerDamageEffect();
      damageEnemy(damage);
      await showMessage(`${currentEnemy.name} に ${damage} の ダメージ！`);
      await checkEnemyDeathOrNextTurn();
    }

    setIsActionRunning(false);
  };

  const handleFlee = async () => {
    if (isActionRunning || !currentEnemy) return;
    setIsActionRunning(true);
    setIsPlayerTurn(false);
    setIsSkillMenuOpen(false);
    
    await showMessage(`ゲルぴよ は にげだした！`);
    
    if (Math.random() < 0.7) {
      await showMessage(`うまく にげきれた！`);
      flee();
    } else {
      await showMessage(`しかし まわりこまれてしまった！`);
      await enemyTurn();
    }
    setIsActionRunning(false);
  };

  if (!currentEnemy) return null;

  return (
    <div className="rpg-battle-screen">
      <div className={`rpg-flash-effect ${flash ? 'active' : ''}`}></div>
      {deathScreen && <div className="rpg-dead-screen"></div>}

      {/* ステータスヘッダー */}
      <div className="rpg-battle-status-header">
        <div className="rpg-battle-status-box">
          <div className="name">ゲルぴよ LV{player.level}</div>
          <div className="bar-container">
            <div className="bar-label">HP: {player.hp}/{player.maxHp}</div>
            <div className="bar-bg"><div className="bar-fill hp" style={{ width: `${(player.hp / player.maxHp) * 100}%` }}></div></div>
          </div>
          <div className="bar-container">
            <div className="bar-label">MP: {player.mp ?? 10}/{player.maxMp ?? 10}</div>
            <div className="bar-bg"><div className="bar-fill mp" style={{ width: `${((player.mp ?? 10) / (player.maxMp ?? 10)) * 100}%` }}></div></div>
          </div>
        </div>
        
        <div className="rpg-battle-status-box enemy">
          <div className="name">{currentEnemy.name}</div>
          <div className="bar-container">
            <div className="bar-label">HP: {currentEnemy.hp}/{currentEnemy.maxHp}</div>
            <div className="bar-bg"><div className="bar-fill hp" style={{ width: `${(currentEnemy.hp / currentEnemy.maxHp) * 100}%` }}></div></div>
          </div>
        </div>
      </div>

      <div className="rpg-battle-enemy-area">
        <div className={`rpg-enemy-sprite ${enemyShake ? 'shake' : ''}`}>
          {currentEnemy.emoji}
        </div>
      </div>

      <div className="rpg-battle-ui-area">
        <div className="rpg-window rpg-message-window">
          {displayedMessage}
        </div>
        
        <div className="rpg-window rpg-command-window" style={{ position: 'relative' }}>
          {!isSkillMenuOpen ? (
            <>
              <button 
                className="rpg-command-btn" 
                onClick={handleAttack}
                disabled={!isPlayerTurn || isActionRunning || deathScreen}
              >
                たたかう
              </button>
              <button 
                className="rpg-command-btn" 
                onClick={() => setIsSkillMenuOpen(true)}
                disabled={!isPlayerTurn || isActionRunning || deathScreen}
              >
                わざ
              </button>
              <button 
                className="rpg-command-btn" 
                onClick={handleFlee}
                disabled={!isPlayerTurn || isActionRunning || deathScreen}
              >
                にげる
              </button>
            </>
          ) : (
            <div className="rpg-skill-menu">
              <div className="rpg-skill-menu-header">
                <button className="rpg-command-btn back" onClick={() => setIsSkillMenuOpen(false)}>もどる</button>
              </div>
              <div className="rpg-skill-list">
                {availableSkills.map(s => (
                  <button 
                    key={s.id} 
                    className="rpg-command-btn skill" 
                    onClick={() => handleSkill(s)}
                    disabled={player.mp < s.mpCost}
                  >
                    {s.name} (MP{s.mpCost})
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
