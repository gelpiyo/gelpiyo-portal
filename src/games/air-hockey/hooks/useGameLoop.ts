/**
 * useGameLoop.ts — requestAnimationFrame ベースのゲームループ
 * rules-game.md §1 準拠: deltaTime上限＋visibilitychange停止
 */
import { useRef, useEffect, useCallback } from 'react';
import { FIXED_DT, MAX_DT } from '../core/types';

interface GameLoopCallbacks {
  onUpdate: (dt: number) => void;
  onRender: (dt: number, elapsed: number) => void;
}

export function useGameLoop(callbacks: GameLoopCallbacks, active: boolean): void {
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const accumulatorRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const loop = useCallback((time: number) => {
    if (lastTimeRef.current === 0) {
      lastTimeRef.current = time;
    }
    let rawDt = (time - lastTimeRef.current) / 1000;
    lastTimeRef.current = time;

    // deltaTime上限（バックグラウンド復帰時の暴走防止）
    if (rawDt > MAX_DT) rawDt = MAX_DT;

    elapsedRef.current += rawDt;
    accumulatorRef.current += rawDt;

    // 固定タイムステップで物理更新
    while (accumulatorRef.current >= FIXED_DT) {
      callbacksRef.current.onUpdate(FIXED_DT);
      accumulatorRef.current -= FIXED_DT;
    }

    // 描画
    callbacksRef.current.onRender(rawDt, elapsedRef.current);

    rafRef.current = requestAnimationFrame(loop);
  }, []);

  useEffect(() => {
    if (!active) {
      lastTimeRef.current = 0;
      accumulatorRef.current = 0;
      return;
    }

    rafRef.current = requestAnimationFrame(loop);

    // visibilitychange で停止/再開
    const handleVisibility = (): void => {
      if (document.hidden) {
        cancelAnimationFrame(rafRef.current);
      } else {
        lastTimeRef.current = 0; // リセットして暴走防止
        accumulatorRef.current = 0;
        rafRef.current = requestAnimationFrame(loop);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [active, loop]);
}
