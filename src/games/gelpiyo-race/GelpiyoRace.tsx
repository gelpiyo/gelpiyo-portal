import React, { useEffect, useRef, useState } from 'react';
import { usePortalStore } from '@/stores/portalStore';
import { GelpiyoRaceEngine } from './GelpiyoRaceEngine';
import type { Difficulty } from './GelpiyoRaceEngine';
import { useSaveDataStore } from '@/stores/saveDataStore';
import './gelpiyo-race.css';

export const GelpiyoRace: React.FC = () => {
  const navigateToPortal = usePortalStore((state) => state.navigateToPortal);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GelpiyoRaceEngine | null>(null);
  
  const [status, setStatus] = useState<'TITLE' | 'RACE' | 'RESULT'>('TITLE');
  const [lastTap, setLastTap] = useState<'LEFT' | 'RIGHT' | null>(null);
  const [isPenalty, setIsPenalty] = useState(false);
  
  const storeRecords = useSaveDataStore(s => s.games['gelpiyo-race']) || { easy: null, normal: null, hard: null };
  const updateGelpiyoRaceRecord = useSaveDataStore(s => s.updateGelpiyoRaceRecord);

  const [records, setRecords] = useState<Record<Difficulty, number | null>>(storeRecords);
  const [currentDiff, setCurrentDiff] = useState<Difficulty>('normal');
  const currentDiffRef = useRef<Difficulty>('normal');
  const [result, setResult] = useState<{ rank: number, timeMs: number, isNewRecord: boolean } | null>(null);

  useEffect(() => {
    setRecords(storeRecords);
  }, [storeRecords]);

  useEffect(() => {
    if (canvasRef.current && !engineRef.current) {
      engineRef.current = new GelpiyoRaceEngine(canvasRef.current);
      engineRef.current.onUpdate = (state) => {
        setStatus(state.status);
        setIsPenalty(state.isPenalty);
      };
      engineRef.current.onFinish = (rank, timeMs) => {
        handleFinish(rank, timeMs, currentDiffRef.current);
      };
    }
    return () => {
      if (engineRef.current) {
        engineRef.current.cleanup();
        engineRef.current = null;
      }
    };
  }, []); // 依存配列を空にして、マウント時のみエンジンを生成する

  const handleFinish = (rank: number, timeMs: number, diff: Difficulty) => {
    let isNewRecord = false;
    setRecords(prev => {
      const currentRecord = prev[diff];
      if (currentRecord === null || timeMs < currentRecord) {
        isNewRecord = true;
        updateGelpiyoRaceRecord(diff, timeMs);
        return { ...prev, [diff]: timeMs };
      }
      return prev;
    });
    setResult({ rank, timeMs, isNewRecord });
    setStatus('RESULT');
  };

  const startGame = (diff: Difficulty) => {
    setCurrentDiff(diff);
    currentDiffRef.current = diff;
    setLastTap(null);
    setIsPenalty(false);
    if (engineRef.current) {
      engineRef.current.start(diff);
      setStatus('RACE');
    }
  };

  const handleTap = (side: 'LEFT' | 'RIGHT') => {
    if (status !== 'RACE' || !engineRef.current) return;
    
    if (lastTap === side) {
      // ペナルティ
      engineRef.current.tap(false);
    } else {
      // 成功
      setLastTap(side);
      engineRef.current.tap(true);
    }
  };

  const formatTime = (ms: number) => {
    return (ms / 1000).toFixed(2) + 's';
  };

  return (
    <div className="gelpiyorace-container">
      <button className="gelpiyorace-back-btn" onClick={navigateToPortal}>
        &#8592; もどる
      </button>

      {/* 上画面（ゲーム＆UI） */}
      <div className="gelpiyorace-canvas-container">
        <canvas ref={canvasRef} className="gelpiyorace-canvas" />

        {status === 'TITLE' && (
          <div className="gelpiyorace-overlay">
            <h1 className="gelpiyo-race-title">ゲルぴよ競争</h1>
            <div className="gelpiyorace-menu-buttons">
              <button className="menu-button" onClick={() => startGame('easy')}>
                初級 (Best: {records.easy ? formatTime(records.easy) : '---'})
              </button>
              <button className="menu-button" onClick={() => startGame('normal')}>
                中級 (Best: {records.normal ? formatTime(records.normal) : '---'})
              </button>
              <button className="menu-button" onClick={() => startGame('hard')}>
                上級 (Best: {records.hard ? formatTime(records.hard) : '---'})
              </button>
            </div>
          </div>
        )}

        {status === 'RESULT' && result && (
          <div className="gelpiyorace-overlay">
            <div className="gelpiyorace-result-box">
              <p className="gelpiyorace-result-rank">{result.rank}位</p>
              <p className="gelpiyorace-result-time">Time: {formatTime(result.timeMs)}</p>
              {result.isNewRecord && <p className="gelpiyorace-new-record">NEW RECORD!</p>}
            </div>
            <div className="gelpiyorace-menu-buttons">
              <button className="menu-button" onClick={() => startGame(currentDiff)}>
                もう一度遊ぶ
              </button>
              <button className="menu-button" style={{ background: 'linear-gradient(180deg, #6b7280, #4b5563)' }} onClick={() => setStatus('TITLE')}>
                タイトルへ戻る
              </button>
            </div>
          </div>
        )}

        {status === 'RACE' && isPenalty && <div className="gelpiyorace-penalty-flash" />}
      </div>

      {/* 下画面（コントローラー） */}
      <div className="gelpiyorace-controls">
        <div 
          className="gelpiyorace-tap-area gelpiyorace-tap-left" 
          onTouchStart={(e) => { e.preventDefault(); handleTap('LEFT'); }} 
          onMouseDown={(e) => { e.preventDefault(); handleTap('LEFT'); }}
        >
          LEFT
        </div>
        <div 
          className="gelpiyorace-tap-area gelpiyorace-tap-right" 
          onTouchStart={(e) => { e.preventDefault(); handleTap('RIGHT'); }} 
          onMouseDown={(e) => { e.preventDefault(); handleTap('RIGHT'); }}
        >
          RIGHT
        </div>
      </div>
    </div>
  );
};
