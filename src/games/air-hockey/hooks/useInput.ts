/**
 * useInput.ts — タッチ/マウス入力の処理
 * rules-game.md §3 準拠: touch-action:none, preventDefault, 座標補正
 */
import { useEffect, useRef, useCallback } from 'react';

interface InputState {
  isDown: boolean;
  x: number;
  y: number;
}

interface UseInputOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** Canvasの論理幅 */
  logicalWidth: number;
  /** Canvasの論理高さ */
  logicalHeight: number;
  onMove: (x: number, y: number) => void;
  onDown: () => void;
  onUp: () => void;
  active: boolean;
}

/** Canvas座標に変換 */
function getCanvasPos(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  logicalWidth: number,
  logicalHeight: number,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const scaleX = logicalWidth / rect.width;
  const scaleY = logicalHeight / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

export function useInput(options: UseInputOptions): void {
  const { canvasRef, logicalWidth, logicalHeight, onMove, onDown, onUp, active } = options;
  const stateRef = useRef<InputState>({ isDown: false, x: 0, y: 0 });
  const onMoveRef = useRef(onMove);
  const onDownRef = useRef(onDown);
  const onUpRef = useRef(onUp);
  onMoveRef.current = onMove;
  onDownRef.current = onDown;
  onUpRef.current = onUp;

  const handleStart = useCallback((x: number, y: number) => {
    stateRef.current.isDown = true;
    stateRef.current.x = x;
    stateRef.current.y = y;
    onDownRef.current();
    onMoveRef.current(x, y);
  }, []);

  const handleMove = useCallback((x: number, y: number) => {
    if (!stateRef.current.isDown) return;
    stateRef.current.x = x;
    stateRef.current.y = y;
    onMoveRef.current(x, y);
  }, []);

  const handleEnd = useCallback(() => {
    stateRef.current.isDown = false;
    onUpRef.current();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active) return;

    // タッチイベント
    const onTouchStart = (e: TouchEvent): void => {
      e.preventDefault(); // マウスエミュレーション抑制
      const touch = e.touches[0];
      const pos = getCanvasPos(canvas, touch.clientX, touch.clientY, logicalWidth, logicalHeight);
      handleStart(pos.x, pos.y);
    };
    const onTouchMove = (e: TouchEvent): void => {
      e.preventDefault();
      const touch = e.touches[0];
      const pos = getCanvasPos(canvas, touch.clientX, touch.clientY, logicalWidth, logicalHeight);
      handleMove(pos.x, pos.y);
    };
    const onTouchEnd = (e: TouchEvent): void => {
      e.preventDefault();
      handleEnd();
    };

    // マウスイベント（PCデバッグ用）
    const onMouseDown = (e: MouseEvent): void => {
      const pos = getCanvasPos(canvas, e.clientX, e.clientY, logicalWidth, logicalHeight);
      handleStart(pos.x, pos.y);
    };
    const onMouseMove = (e: MouseEvent): void => {
      const pos = getCanvasPos(canvas, e.clientX, e.clientY, logicalWidth, logicalHeight);
      handleMove(pos.x, pos.y);
    };
    const onMouseUp = (): void => {
      handleEnd();
    };

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [canvasRef, logicalWidth, logicalHeight, handleStart, handleMove, handleEnd, active]);
}
