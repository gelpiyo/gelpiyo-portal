/**
 * AirHockeyGame.tsx — エアホッケー ラッパーコンポーネント
 * ポータルから呼び出される、画面遷移を含む完結したゲーム画面
 */
import { useState, useCallback } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { initAudio, setMuted, getIsMuted } from './core/audio';
import { BackButton } from '@/components/BackButton';
import './air-hockey.css';

type Scene = 'title' | 'playing' | 'result';

interface MatchResult {
  winner: 'player' | 'cpu';
  playerRounds: number;
  cpuRounds: number;
}

export function AirHockeyGame(): React.JSX.Element {
  const [scene, setScene] = useState<Scene>('title');
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [isMuted, setIsMutedState] = useState(false);
  const [playerRounds, setPlayerRounds] = useState(0);
  const [cpuRounds, setCpuRounds] = useState(0);
  const [gameKey, setGameKey] = useState(0);

  const handleStart = useCallback(() => {
    initAudio();
    setPlayerRounds(0);
    setCpuRounds(0);
    setScene('playing');
    setGameKey((k) => k + 1);
  }, []);

  const handleMatchEnd = useCallback((winner: 'player' | 'cpu') => {
    setMatchResult({
      winner,
      playerRounds: winner === 'player' ? 3 : cpuRounds,
      cpuRounds: winner === 'cpu' ? 3 : playerRounds,
    });
    setScene('result');
  }, [playerRounds, cpuRounds]);

  const handleRoundEnd = useCallback((_winner: 'player' | 'cpu' | 'draw', pRounds: number, cRounds: number) => {
    setPlayerRounds(pRounds);
    setCpuRounds(cRounds);
  }, []);

  const handleToggleMute = useCallback(() => {
    const next = !getIsMuted();
    setMuted(next);
    setIsMutedState(next);
  }, []);

  const handleBackToTitle = useCallback(() => {
    setScene('title');
    setMatchResult(null);
  }, []);

  // ── タイトル画面 ──
  if (scene === 'title') {
    return (
      <div className="ah-game">
        <BackButton />
        <div className="ah-title-screen">
          <div className="ah-title-puck-icon">🏒</div>
          <h1 className="ah-title">エアホッケー</h1>
          <p className="ah-title-subtitle">3ラウンド先取で勝利！分裂アイテムに注目⭐</p>
          <button className="ah-start-btn" id="ah-start-button" onClick={handleStart}>
            ゲームスタート
          </button>
        </div>
      </div>
    );
  }

  // ── リザルト画面 ──
  if (scene === 'result' && matchResult) {
    const isWin = matchResult.winner === 'player';
    return (
      <div className="ah-game">
        <div className="ah-result-screen">
          <div className="ah-result-icon">{isWin ? '🎉' : '😢'}</div>
          <div className={`ah-result-title ${isWin ? 'win' : 'lose'}`}>
            {isWin ? 'YOU WIN!' : 'YOU LOSE...'}
          </div>
          <div className="ah-result-score">
            あなた {matchResult.playerRounds} - {matchResult.cpuRounds} CPU
          </div>
          <div className="ah-result-btns">
            <button className="ah-retry-btn" id="ah-retry-button" onClick={handleStart}>
              もう一度
            </button>
            <button className="ah-home-btn" id="ah-home-button" onClick={handleBackToTitle}>
              タイトルへ
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── ゲーム画面 ──
  return (
    <div className="ah-game">
      <BackButton />
      <div className="ah-game-screen">
        <div className="ah-game-header">
          <div className="ah-round-info">
            🩷 {playerRounds} - {cpuRounds} 🩵
          </div>
          <button
            className="ah-sound-btn"
            id="ah-sound-toggle"
            onClick={handleToggleMute}
            aria-label={isMuted ? 'サウンドをオンにする' : 'サウンドをオフにする'}
          >
            {isMuted ? '🔇' : '🔊'}
          </button>
        </div>
        <GameCanvas
          key={gameKey}
          onMatchEnd={handleMatchEnd}
          onRoundEnd={handleRoundEnd}
        />
      </div>
    </div>
  );
}
