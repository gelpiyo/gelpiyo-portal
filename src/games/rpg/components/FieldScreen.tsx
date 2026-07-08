import React, { useState, useRef, useEffect } from 'react';
import { useRPGStore } from '../stores/useRPGStore';
import { MAPS } from '../data/maps';
import type { MapEvent } from '../data/maps';

const ENEMIES = [
  { name: 'バグ', hp: 10, maxHp: 10, attack: 3, exp: 5, gold: 10, emoji: '🐛' },
  { name: 'ウイルス', hp: 15, maxHp: 15, attack: 5, exp: 10, gold: 20, emoji: '🦠' },
  { name: '悪いゲルぴよ', hp: 25, maxHp: 25, attack: 8, exp: 20, gold: 50, emoji: '👿' },
];

const BOSS_ENEMY = {
  name: 'まおう ゲルぴよ',
  hp: 250,
  maxHp: 250,
  attack: 20,
  exp: 1000,
  gold: 1000,
  emoji: '👹',
  isBoss: true
};

export const FieldScreen: React.FC = () => {
  const { playerPos, player, currentMapId, openedChestIds, move, changeMap, encounter, rest, openChest, setScene } = useRPGStore();
  const [isMoving, setIsMoving] = useState(false);
  const [isFading, setIsFading] = useState(false);
  
  // ダイアログ・イベント状態
  const [dialogMessage, setDialogMessage] = useState<string | null>(null);
  const [activeNpc, setActiveNpc] = useState<MapEvent | null>(null);
  const [msgIndex, setMsgIndex] = useState(0);

  const TILE_SIZE = 32;
  const moveIntervalRef = useRef<number | null>(null);

  const mapData = MAPS[currentMapId];

  const handleMove = (dx: number, dy: number) => {
    const state = useRPGStore.getState();
    if (state.scene !== 'field' || dialogMessage || activeNpc || isFading) {
      stopMoving();
      return;
    }

    const nextX = state.playerPos.x + dx;
    const nextY = state.playerPos.y + dy;
    const eventAtNext = mapData.events.find(e => e.x === nextX && e.y === nextY);

    // ブロックするイベント（NPC, ボス）
    if (eventAtNext) {
      if (eventAtNext.type === 'npc') {
        stopMoving();
        setActiveNpc(eventAtNext);
        setMsgIndex(0);
        return;
      }
      if (eventAtNext.type === 'boss') {
        stopMoving();
        encounter({ ...BOSS_ENEMY });
        return;
      }
    }

    setIsMoving(true);
    move(dx, dy);
    
    setTimeout(() => {
      setIsMoving(false);
      
      const currentScene = useRPGStore.getState().scene;
      if (currentScene !== 'field') {
        stopMoving();
        return;
      }

      const newX = useRPGStore.getState().playerPos.x;
      const newY = useRPGStore.getState().playerPos.y;

      if (newX === state.playerPos.x && newY === state.playerPos.y) {
        // 移動しなかった（壁などにぶつかった）
        return;
      }

      // 移動先のイベント判定（階段、宝箱）
      const movedEvent = mapData.events.find(e => e.x === newX && e.y === newY);
      
      if (movedEvent) {
        if (movedEvent.type === 'chest' && !useRPGStore.getState().openedChestIds.includes(movedEvent.id)) {
          stopMoving();
          openChest(movedEvent.id, movedEvent.exp || 0, movedEvent.gold || 0);
          setDialogMessage(`たからばこ を あけた！\n${movedEvent.exp} けいけんち と ${movedEvent.gold} ゴールド を てにいれた！`);
          return;
        }
        else if (movedEvent.type === 'stairs') {
          stopMoving();
          setIsFading(true);
          setTimeout(() => {
            changeMap(movedEvent.toMapId!, movedEvent.toX!, movedEvent.toY!);
            setIsFading(false);
          }, 500); // 0.5秒の暗転
          return;
        }
      }

      // 歩数の加算とエンカウント判定
      if (mapData.encounterRate > 0) {
        const currentSteps = useRPGStore.getState().incrementSteps();
        
        if (currentSteps >= 20) {
          // 20歩目で強制エンカウント
          stopMoving();
          const randomEnemy = ENEMIES[Math.floor(Math.random() * ENEMIES.length)];
          encounter({ ...randomEnemy });
        } else if (currentSteps >= 10) {
          // 10歩〜19歩はランダムエンカウント (確率はマップに依存)
          if (Math.random() < mapData.encounterRate) {
            stopMoving();
            const randomEnemy = ENEMIES[Math.floor(Math.random() * ENEMIES.length)];
            encounter({ ...randomEnemy });
          }
        }
      }
    }, 200);
  };

  const startMoving = (dx: number, dy: number) => {
    if (dialogMessage || activeNpc || isFading || moveIntervalRef.current !== null) return;
    handleMove(dx, dy);
    moveIntervalRef.current = window.setInterval(() => {
      handleMove(dx, dy);
    }, 250);
  };

  const stopMoving = () => {
    if (moveIntervalRef.current !== null) {
      clearInterval(moveIntervalRef.current);
      moveIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopMoving();
  }, []);

  // NPC会話の進行処理
  const handleNextNpcMessage = () => {
    if (!activeNpc || !activeNpc.messages) return;
    if (msgIndex < activeNpc.messages.length - 1) {
      setMsgIndex(msgIndex + 1);
    } else {
      setActiveNpc(null);
    }
  };

  const handleNpcChoice = (action: string) => {
    setActiveNpc(null);
    if (action === 'shop') {
      setScene('shop');
    } else if (action === 'heal') {
      rest();
    }
    // 'close' は何もせず閉じる
  };

  const mapOffsetX = `-${(playerPos.x * TILE_SIZE) + (TILE_SIZE / 2)}px`;
  const mapOffsetY = `-${(playerPos.y * TILE_SIZE) + (TILE_SIZE / 2)}px`;

  // 画面全体タップ時の処理（メッセージ送り）
  const handleScreenClick = () => {
    if (dialogMessage) {
      setDialogMessage(null);
      return;
    }
    if (activeNpc && activeNpc.messages && !activeNpc.messages[msgIndex].question) {
      handleNextNpcMessage();
    }
  };

  return (
    <div className="rpg-field-screen" onClick={handleScreenClick}>
      {/* マップ領域 (上部) */}
      <div className="rpg-map-viewport">
        {isFading && <div className="rpg-fading-overlay" />}
        <div 
          className="rpg-map-world"
          style={{ 
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: `translate(${mapOffsetX}, ${mapOffsetY})`,
            width: `${mapData.grid[0].length * TILE_SIZE}px`,
            height: `${mapData.grid.length * TILE_SIZE}px`
          }}
        >
          {/* 地形描画 */}
          {mapData.grid.map((row, y) => 
            row.map((tile, x) => {
              if (tile === 0) return null; // 床は背景に任せるか、省略
              let emoji = '';
              if (tile === 1) emoji = '🌲';
              if (tile === 2) emoji = '⛰️';
              if (tile === 3) emoji = '💧';
              return (
                <div key={`tile-${x}-${y}`} style={{
                  position: 'absolute', left: `${x * TILE_SIZE}px`, top: `${y * TILE_SIZE}px`,
                  width: `${TILE_SIZE}px`, height: `${TILE_SIZE}px`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px'
                }}>
                  {emoji}
                </div>
              );
            })
          )}

          {/* イベント描画 */}
          {mapData.events.map(event => {
            let emoji = '';
            let isVisible = true;
            if (event.type === 'npc') emoji = event.emoji || '🧑‍🌾';
            if (event.type === 'boss') emoji = '👹';
            if (event.type === 'stairs') emoji = '🪜';
            if (event.type === 'chest') {
              emoji = openedChestIds.includes(event.id) ? '🧳' : '🎁';
            }

            if (!isVisible) return null;
            return (
              <div key={`evt-${event.id}`} style={{
                position: 'absolute', left: `${event.x * TILE_SIZE}px`, top: `${event.y * TILE_SIZE}px`,
                width: `${TILE_SIZE}px`, height: `${TILE_SIZE}px`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px'
              }}>
                {emoji}
              </div>
            );
          })}

          {/* プレイヤー */}
          <div 
            className={`rpg-player-sprite ${isMoving ? 'moving' : ''}`}
            style={{ 
              left: `${playerPos.x * TILE_SIZE}px`, 
              top: `${playerPos.y * TILE_SIZE}px` 
            }}
          >
            🐥
          </div>
        </div>

        {/* マップ名表示 */}
        <div className="rpg-map-name-plate">
          {mapData.name}
        </div>

        {/* 単純なメッセージダイアログ（宝箱など） */}
        {dialogMessage && (
          <div className="rpg-dialog-overlay">
            <div className="rpg-window rpg-dialog-window" onClick={(e) => e.stopPropagation()}>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{dialogMessage}</div>
              <button 
                className="rpg-command-btn" 
                style={{ marginTop: '16px', alignSelf: 'flex-end', padding: '8px 24px', fontSize: '16px' }}
                onClick={(e) => { e.stopPropagation(); setDialogMessage(null); }}
              >
                OK
              </button>
            </div>
          </div>
        )}

        {/* NPC会話ダイアログ */}
        {activeNpc && activeNpc.messages && (
          <div className="rpg-dialog-overlay">
            <div 
              className="rpg-window rpg-dialog-window" 
              onClick={(e) => {
                // 選択肢（質問）が出ている時はウィンドウ内クリックで進まないようにブロック
                if (activeNpc.messages?.[msgIndex]?.question) {
                  e.stopPropagation();
                }
              }}
            >
              <div style={{ color: '#88ccff', marginBottom: '8px', fontSize: '14px' }}>{activeNpc.name}</div>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '18px' }}>
                {activeNpc.messages?.[msgIndex]?.text}
              </div>
              
              {/* 質問と選択肢がある場合 */}
              {activeNpc.messages[msgIndex].question && (
                <div style={{ marginTop: '16px' }}>
                  <div style={{ marginBottom: '12px' }}>{activeNpc.messages[msgIndex].question}</div>
                  <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                    {activeNpc.messages[msgIndex].choices?.map((choice, idx) => (
                      <button 
                        key={idx}
                        className="rpg-command-btn" 
                        onClick={() => handleNpcChoice(choice.action)}
                      >
                        {choice.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 次へボタン (質問がない場合のみ) */}
              {!activeNpc.messages[msgIndex].question && (
                <div style={{ textAlign: 'right', marginTop: '12px' }}>
                  <button className="rpg-command-btn" style={{ padding: '4px 16px', fontSize: '14px' }} onClick={handleNextNpcMessage}>
                    ▼ 次へ (A)
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* UI領域 (下部) */}
      <div className="rpg-ui-area">
        {/* 左側: 十字キー */}
        <div className="rpg-dpad-container">
          <div className="rpg-dpad">
            <button 
              className="rpg-dbtn up" 
              onPointerDown={(e) => { e.preventDefault(); startMoving(0, -1); }} 
              onPointerUp={stopMoving} 
              onPointerLeave={stopMoving}
              onPointerCancel={stopMoving}
              onContextMenu={(e) => e.preventDefault()}
            >▲</button>
            <button 
              className="rpg-dbtn left" 
              onPointerDown={(e) => { e.preventDefault(); startMoving(-1, 0); }} 
              onPointerUp={stopMoving} 
              onPointerLeave={stopMoving}
              onPointerCancel={stopMoving}
              onContextMenu={(e) => e.preventDefault()}
            >◀</button>
            <button 
              className="rpg-dbtn right" 
              onPointerDown={(e) => { e.preventDefault(); startMoving(1, 0); }} 
              onPointerUp={stopMoving} 
              onPointerLeave={stopMoving}
              onPointerCancel={stopMoving}
              onContextMenu={(e) => e.preventDefault()}
            >▶</button>
            <button 
              className="rpg-dbtn down" 
              onPointerDown={(e) => { e.preventDefault(); startMoving(0, 1); }} 
              onPointerUp={stopMoving} 
              onPointerLeave={stopMoving}
              onPointerCancel={stopMoving}
              onContextMenu={(e) => e.preventDefault()}
            >▼</button>
          </div>
        </div>

        {/* 右側: ステータス */}
        <div className="rpg-status-container">
          <div className="rpg-window rpg-status-window">
            <div className="rpg-status-label">LV</div><div>{player.level}</div>
            <div className="rpg-status-label">HP</div><div>{player.hp}/{player.maxHp}</div>
            <div className="rpg-status-label">MP</div><div>{player.mp ?? 10}/{player.maxMp ?? 10}</div>
            <div className="rpg-status-label">ATK</div><div>{player.attack}</div>
            <div className="rpg-status-label">DEF</div><div>{player.defense ?? 0}%</div>
            <div className="rpg-status-label">EXP</div><div>{player.exp}</div>
            <div className="rpg-status-label">GOLD</div><div>{player.gold}</div>
          </div>
          
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button 
              className="rpg-command-btn" 
              style={{ fontSize: '14px', padding: '8px' }}
              onClick={rest}
              disabled={player.gold < 10 || (player.hp >= player.maxHp && player.mp >= (player.maxMp ?? 10))}
            >
              やすむ(10G)
            </button>
            <button 
              className="rpg-command-btn" 
              style={{ fontSize: '14px', padding: '8px' }}
              onClick={() => setScene('shop')}
            >
              よろずや
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
