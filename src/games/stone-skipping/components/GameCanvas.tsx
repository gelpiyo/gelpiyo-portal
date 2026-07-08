import React, { useRef, useCallback, useEffect } from 'react';
import { Engine } from '../core/engine';
import { useGameLoop } from '../hooks/useGameLoop';
import { useInput } from '../hooks/useInput';

interface Props {
  engine: Engine;
  forceRender: () => void;
}

const GELPIYO_IMG_SRC = `${import.meta.env.BASE_URL}assets/bounce/characters/gelpiyo.jpg`;

export const GameCanvas: React.FC<Props> = ({ engine, forceRender }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.src = GELPIYO_IMG_SRC;
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      // 白背景を完全に消すためのオフスクリーンCanvas処理
      const offCanvas = document.createElement('canvas');
      offCanvas.width = img.width;
      offCanvas.height = img.height;
      const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
      if (offCtx) {
        offCtx.drawImage(img, 0, 0);
        const imageData = offCtx.getImageData(0, 0, img.width, img.height);
        const data = imageData.data;
        // 白（に近い色）を透過
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          // RGBが全て230以上なら白背景とみなして完全に透過（アルファ値を0にする）
          if (r > 230 && g > 230 && b > 230) {
            data[i + 3] = 0;
          }
        }
        offCtx.putImageData(imageData, 0, 0);
        
        const transparentImg = new Image();
        transparentImg.src = offCanvas.toDataURL();
        transparentImg.onload = () => {
          imageRef.current = transparentImg;
        };
      } else {
        imageRef.current = img;
      }
    };
  }, []);
  
  // タップ入力をキャンバス全体で拾う
  useInput(engine, canvasRef);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 高DPI対応
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    
    ctx.clearRect(0, 0, w, h);

    const state = engine.state;
    // Y座標のスケール（1m = 40pxなど）
    const scale = 40; 
    
    // カメラのXオフセット（ゲルぴよが右に進んだらカメラも追従する）
    // 画面の左から20%の位置にゲルぴよを置く
    const offsetX = w * 0.2 - state.physics.x * scale;
    // 水面の位置（画面の下から25%の位置）
    const waterY = h * 0.75;

    // --- 水面の描画 ---
    // CSSのグラデーション背景と馴染むように半透明でグラデーションをかける
    const waterGrad = ctx.createLinearGradient(0, waterY, 0, h);
    waterGrad.addColorStop(0, 'rgba(0, 150, 255, 0.6)');
    waterGrad.addColorStop(1, 'rgba(0, 50, 150, 0.8)');
    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, waterY, w, h - waterY);
    
    // 水面の波線・ハイライト
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, waterY);
    ctx.lineTo(w, waterY);
    ctx.stroke();
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(0, waterY, w, 5);

    // --- ゲルぴよの描画 ---
    const px = state.physics.x * scale + offsetX;
    // yは上を正としているので、描画座標は下方向が正になるよう反転
    const py = waterY - state.physics.y * scale;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(state.physics.angle);
    
    if (imageRef.current) {
      // 3倍のサイズ(96x96)で描画
      const radius = 48;
      ctx.drawImage(imageRef.current, -radius, -radius, radius * 2, radius * 2);
    } else {
      // ロードされるまでのフォールバック
      ctx.fillStyle = '#ffeb3b';
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f57f17';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();

    // 距離マーカーの描画（背景がスクロールしている感を出す）
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = 'bold 16px "Helvetica Neue", Arial, sans-serif';
    // 10mごとに線を描く
    const startM = Math.floor(-offsetX / scale / 10) * 10;
    for (let m = startM; m < startM + (w/scale) + 10; m+=10) {
      if (m < 0) continue;
      const mx = m * scale + offsetX;
      ctx.fillRect(mx, waterY, 2, 10);
      ctx.fillText(`${m}m`, mx + 4, waterY + 14);
    }
    
    // UIを更新するためのトリガー
    forceRender();
  }, [engine, forceRender]);

  useGameLoop(engine, draw);

  return (
    <canvas 
      ref={canvasRef} 
      className="stone-skipping-canvas" 
    />
  );
};
