/**
 * GameCanvas.tsx — Canvas要素とゲームロジックの接点
 */
import { useRef, useCallback, useEffect } from 'react';
import { TABLE_W, TABLE_H, FIXED_DT } from '../core/types';
import type { GameState } from '../core/types';
import { createInitialGameState, updateGame, setPlayerMalletTarget } from '../core/engine';
import { render, clearTrails } from '../core/renderer';
import { initAudio, playGoal, playSplit, playRoundWin, playRoundLose } from '../core/audio';
import { useGameLoop } from '../hooks/useGameLoop';
import { useInput } from '../hooks/useInput';

interface GameCanvasProps {
  onMatchEnd: (winner: 'player' | 'cpu') => void;
  onRoundEnd: (winner: 'player' | 'cpu' | 'draw', playerRounds: number, cpuRounds: number) => void;
}

export function GameCanvas({ onMatchEnd, onRoundEnd }: GameCanvasProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef<GameState>(createInitialGameState());
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  // ゲーム開始時に状態をリセット
  useEffect(() => {
    const state = createInitialGameState();
    state.scene = 'playing';
    gameStateRef.current = state;
    clearTrails();
  }, []);

  // Canvas初期化（高DPI対応）
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = TABLE_W * dpr;
    canvas.height = TABLE_H * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      alert('Canvas 2Dコンテキストの取得に失敗しました。ブラウザを変更してください。');
      return;
    }
    ctx.scale(dpr, dpr);
    ctxRef.current = ctx;
  }, []);

  // コールバック参照をrefで保持
  const onMatchEndRef = useRef(onMatchEnd);
  onMatchEndRef.current = onMatchEnd;
  const onRoundEndRef = useRef(onRoundEnd);
  onRoundEndRef.current = onRoundEnd;

  // 物理更新
  const onUpdate = useCallback((dt: number) => {
    const state = gameStateRef.current;
    if (state.scene !== 'playing') return;

    const prevScoredCount = state.round.pucks.filter((p) => p.scored).length;
    const prevPuckCount = state.round.pucks.length;

    updateGame(state, dt, (winner) => {
      onRoundEndRef.current(winner, state.playerRounds, state.cpuRounds);
      if (winner === 'player') playRoundWin();
      else if (winner === 'cpu') playRoundLose();
    });

    // 分裂検知
    if (state.round.pucks.length > prevPuckCount) {
      playSplit();
    }

    // ゴール検知
    const newScoredCount = state.round.pucks.filter((p) => p.scored).length;
    if (newScoredCount > prevScoredCount) {
      playGoal();
    }

    // マッチ終了検知
    if (state.matchWinner) {
      onMatchEndRef.current(state.matchWinner);
    }
  }, []);

  // 描画
  const onRender = useCallback((dt: number, elapsed: number) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    render(ctx, gameStateRef.current, dt, elapsed);
  }, []);

  useGameLoop({ onUpdate, onRender }, true);

  // 入力処理
  const onInputDown = useCallback(() => {
    initAudio();
  }, []);

  const onInputMove = useCallback((x: number, y: number) => {
    setPlayerMalletTarget(gameStateRef.current, x, y, FIXED_DT);
  }, []);

  const onInputUp = useCallback(() => {
    // noop
  }, []);

  useInput({
    canvasRef,
    logicalWidth: TABLE_W,
    logicalHeight: TABLE_H,
    onMove: onInputMove,
    onDown: onInputDown,
    onUp: onInputUp,
    active: true,
  });

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        maxWidth: `${TABLE_W}px`,
        height: 'auto',
        aspectRatio: `${TABLE_W} / ${TABLE_H}`,
        display: 'block',
        touchAction: 'none',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      }}
    />
  );
}
