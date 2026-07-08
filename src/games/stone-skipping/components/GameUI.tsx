import React from 'react';
import type { EngineState } from '../core/engine';

interface Props {
  state: EngineState;
  onAction: (e: React.PointerEvent | React.MouseEvent) => void;
}

export const GameUI: React.FC<Props> = ({ state, onAction }) => {
  return (
    <div className="stone-skipping-ui">
      {/* HUD */}
      <div className="stone-skipping-hud">
        HIGH: {Math.floor(state.highScore)}m
      </div>

      {state.status === 'TITLE' && (
        <div className="stone-skipping-interactive" style={{ textAlign: 'center' }}>
          <h1 className="stone-skipping-title">ゲルぴよ<br/>水切り</h1>
          <button className="stone-skipping-btn" onPointerDown={onAction}>
            START
          </button>
        </div>
      )}

      {state.status === 'AIMING' && (
        <div className="stone-skipping-power-gauge-container">
          <div 
            className="stone-skipping-power-gauge-fill"
            style={{ transform: `scaleX(${state.power})` }}
          />
        </div>
      )}

      {state.status === 'FLYING' && (
        <div style={{ position: 'absolute', top: '15%', fontSize: '2.5rem', color: 'white', fontWeight: 'bold', textShadow: '2px 2px 4px #000' }}>
          {state.bounces} Bounces!
        </div>
      )}

      {state.status === 'RESULT' && (
        <div className="stone-skipping-result stone-skipping-interactive">
          <h2>RESULT</h2>
          <p>飛距離: {Math.floor(state.maxDistance)}m</p>
          <p>バウンド: {state.bounces}回</p>
          {state.maxDistance >= state.highScore && state.highScore > 0 && (
            <p style={{ color: '#ffeb3b', fontWeight: 'bold', fontSize: '1.5rem' }}>NEW RECORD!</p>
          )}
          <button className="stone-skipping-btn" onPointerDown={onAction} style={{ marginTop: '10px' }}>
            RETRY
          </button>
        </div>
      )}
    </div>
  );
};
