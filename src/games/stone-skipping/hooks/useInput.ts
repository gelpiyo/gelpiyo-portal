import { useEffect } from 'react';
import { Engine } from '../core/engine';

export function useInput(engine: Engine, elementRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;

    const handleAction = (e: Event) => {
      e.preventDefault();
      engine.triggerAction();
    };

    // スマホでのズームやスクロールを防ぐため、passive: false で登録
    el.addEventListener('touchstart', handleAction, { passive: false });
    el.addEventListener('mousedown', handleAction);

    return () => {
      el.removeEventListener('touchstart', handleAction);
      el.removeEventListener('mousedown', handleAction);
    };
  }, [engine, elementRef]);
}
