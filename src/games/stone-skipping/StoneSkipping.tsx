import React, { useRef, useState, useEffect } from 'react';
import { usePortalStore } from '@/stores/portalStore';
import { Engine } from './core/engine';
import { GameCanvas } from './components/GameCanvas';
import { GameUI } from './components/GameUI';
import './stone-skipping.css';

export const StoneSkipping: React.FC = () => {
  const navigateToPortal = usePortalStore((state) => state.navigateToPortal);
  const engineRef = useRef<Engine | null>(null);
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_, setTick] = useState(0);

  if (!engineRef.current) {
    engineRef.current = new Engine();
  }
  const engine = engineRef.current;

  // 画面の向きを横向きにロック
  useEffect(() => {
    try {
      if (screen.orientation && (screen.orientation as any).lock) {
        (screen.orientation as any).lock('landscape').catch(() => {});
      }
    } catch {
      console.warn("Orientation lock not supported");
    }
    
    return () => {
      try {
        if (screen.orientation && screen.orientation.unlock) {
          screen.orientation.unlock();
        }
      } catch {}
    };
  }, []);

  const forceRender = () => {
    setTick(t => t + 1);
  };

  const handleAction = (e: React.PointerEvent | React.MouseEvent) => {
    // 伝播を防ぐことでキャンバス側のタッチイベントと重複しないようにする
    e.stopPropagation();
    e.preventDefault();
    engine.triggerAction();
  };

  return (
    <div className="stone-skipping-container">
      <button className="stone-skipping-back-btn" onClick={navigateToPortal}>
        &#8592; もどる
      </button>

      <GameCanvas engine={engine} forceRender={forceRender} />
      <GameUI state={engine.state} onAction={handleAction} />
    </div>
  );
};
