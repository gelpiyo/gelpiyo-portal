import React, { useEffect, useRef, useState } from 'react';
import { usePortalStore } from '@/stores/portalStore';
import './hammer-jump.css';

type GamePhase = 'title' | 'playing' | 'flying' | 'result';

export function HammerJump(): React.JSX.Element {
  const navigateToPortal = usePortalStore((state) => state.navigateToPortal);

  const [phase, setPhase] = useState<GamePhase>('title');
  const [highScore, setHighScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(10);
  const [tapCount, setTapCount] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number>(0);
  const gelpiyoImgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new window.Image();
    img.src = '/assets/bounce/characters/gelpiyo.jpg';
    img.onload = () => {
      // オフスクリーンCanvasで白背景を透過する
      const canvas = window.document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          // 白に近い背景（RGB全てが240以上）を透明にする
          if (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240) {
            data[i + 3] = 0; // Alphaを0に
          }
        }
        ctx.putImageData(imageData, 0, 0);

        const transparentImg = new window.Image();
        transparentImg.src = canvas.toDataURL('image/png');
        transparentImg.onload = () => {
          gelpiyoImgRef.current = transparentImg;
        };
      } else {
        gelpiyoImgRef.current = img;
      }
    };
  }, []);

  // Mutable game state used in requestAnimationFrame
  const gameData = useRef({
    taps: 0,
    startTime: 0,
    piyoY: 0,
    piyoScaleY: 1,
    altitude: 0,
    targetAltitude: 0,
    velocity: 0,
    stars: [] as { x: number; y: number; size: number; speed: number }[],
    hammerAngle: Math.PI / 3,
    targetHammerAngle: Math.PI / 3,
    hammerTimer: 0,
  });

  // Load high score
  useEffect(() => {
    const saved = localStorage.getItem('hammerJumpHighScore');
    if (saved) {
      setHighScore(parseInt(saved, 10));
    }
  }, []);

  const startGame = () => {
    setPhase('playing');
    setTimeLeft(10);
    setTapCount(0);
    setFinalScore(0);
    setIsNewRecord(false);
    gameData.current = {
      taps: 0,
      startTime: performance.now(),
      piyoY: 0,
      piyoScaleY: 1,
      altitude: 0,
      targetAltitude: 0,
      velocity: 0,
      stars: Array.from({ length: 100 }).map(() => ({
        x: Math.random(),
        y: Math.random(),
        size: Math.random() * 2 + 1,
        speed: Math.random() * 0.5 + 0.1,
      })),
      hammerAngle: Math.PI / 3,
      targetHammerAngle: Math.PI / 3,
      hammerTimer: 0,
    };
  };

  const handleTap = (e: React.TouchEvent | React.MouseEvent) => {
    // ズームやスクロールなどのデフォルト動作を防止
    if (e.cancelable) {
      e.preventDefault();
    }
    if (phase !== 'playing') return;

    setTapCount((prev) => {
      const next = prev + 1;
      gameData.current.taps = next;
      // 叩かれた瞬間に高さを半分（0.5）に縮める
      gameData.current.piyoScaleY = 0.5;
      // タップ時に強制的に振り上げ状態に戻してから目標を振り下ろしにする
      gameData.current.hammerAngle = Math.PI / 3;
      gameData.current.targetHammerAngle = -Math.PI / 6;
      gameData.current.hammerTimer = 0.08;
      return next;
    });
  };

  // Playing timer effect
  useEffect(() => {
    if (phase !== 'playing') return;

    const interval = setInterval(() => {
      const elapsed = (performance.now() - gameData.current.startTime) / 1000;
      const remain = Math.max(10 - elapsed, 0);
      setTimeLeft(Math.ceil(remain));

      if (remain <= 0) {
        clearInterval(interval);
        // Calculate target altitude based on exponential formula
        // Example: taps ^ 1.8 * 20. 100 taps -> ~63000m. 150 taps -> ~130000m
        const target = Math.floor(Math.pow(gameData.current.taps, 1.8) * 20);
        gameData.current.targetAltitude = target;
        gameData.current.velocity = Math.max(target / 3, 500); // Reaches target in roughly 3-4 seconds

        setPhase('flying');
      }
    }, 100);

    return () => clearInterval(interval);
  }, [phase]);

  // Main render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    const drawPiyo = (cx: number, cy: number, scaleY: number) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, scaleY);

      if (gelpiyoImgRef.current) {
        const img = gelpiyoImgRef.current;

        // 透過済みの画像を描画（クリッピングなしでアホ毛や羽も表示）
        const targetW = 80;
        const imgAspect = img.width / img.height;
        const targetH = targetW / imgAspect;

        // 底辺を y=0 に合わせる
        ctx.drawImage(img, -targetW / 2, -targetH, targetW, targetH);
      } else {
        // Body (Yellow)
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        const width = 40 + (1 - scaleY) * 20;
        ctx.ellipse(0, -30, width, 30, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(-15, -40, 4, 0, Math.PI * 2);
        ctx.arc(15, -40, 4, 0, Math.PI * 2);
        ctx.fill();

        // Beak
        ctx.fillStyle = '#FF8C00';
        ctx.beginPath();
        ctx.moveTo(-10, -30);
        ctx.lineTo(10, -30);
        ctx.lineTo(0, -20);
        ctx.fill();
      }

      ctx.restore();
    };

    const drawHammer = (cx: number, cy: number, angle: number) => {
      ctx.save();
      // 支点をさらに外側の右上（cx + 65, cy - 40）にする
      ctx.translate(cx + 65, cy - 40);
      ctx.rotate(angle);

      // 持ち手（黄色）
      ctx.fillStyle = '#FFD700';
      ctx.fillRect(-3, -40, 6, 40); // 持ち手を少し短くして被りにくくする

      // ハンマーの頭（ピンク色）
      ctx.fillStyle = '#FF69B4';
      ctx.beginPath();
      ctx.ellipse(0, -40, 24, 15, 0, 0, Math.PI * 2);
      ctx.fill();

      // ピコピコハンマーのじゃばら部分
      ctx.strokeStyle = '#FF1493';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-12, -48);
      ctx.lineTo(-12, -32);
      ctx.moveTo(0, -52);
      ctx.lineTo(0, -28);
      ctx.moveTo(12, -48);
      ctx.lineTo(12, -32);
      ctx.stroke();

      ctx.restore();
    };

    const loop = (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const deltaTime = Math.min((time - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = time;

      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      // Update physics
      if (phase === 'playing') {
        // Recovery of squish (滑らかに1.0に戻る)
        gameData.current.piyoScaleY += (1 - gameData.current.piyoScaleY) * 12 * deltaTime;
        gameData.current.piyoY = h - 100;

        // Hammer animation
        if (gameData.current.hammerTimer > 0) {
          gameData.current.hammerTimer -= deltaTime;
        } else {
          // タイマー切れで目標を振り上げ状態に戻す
          gameData.current.targetHammerAngle = Math.PI / 3;
        }

        // 目標角度に向かってアニメーションさせる
        gameData.current.hammerAngle += (gameData.current.targetHammerAngle - gameData.current.hammerAngle) * 30 * deltaTime;
      } else if (phase === 'flying') {
        // Fly up to center
        gameData.current.piyoScaleY += (1 - gameData.current.piyoScaleY) * 10 * deltaTime;
        if (gameData.current.piyoY > h / 2) {
          gameData.current.piyoY -= 500 * deltaTime;
        }

        // Increase altitude
        gameData.current.altitude += gameData.current.velocity * deltaTime;

        // Slow down velocity
        gameData.current.velocity *= 0.98;

        // Check end condition
        if (gameData.current.altitude >= gameData.current.targetAltitude || gameData.current.velocity < 10) {
          // Finish flying
          gameData.current.altitude = gameData.current.targetAltitude;

          if (phase === 'flying') { // Prevent multiple calls
            setFinalScore(gameData.current.targetAltitude);
            if (gameData.current.targetAltitude > highScore) {
              setHighScore(gameData.current.targetAltitude);
              setIsNewRecord(true);
              localStorage.setItem('hammerJumpHighScore', gameData.current.targetAltitude.toString());
            }
            setPhase('result');
          }
        }
      }

      // Draw Background
      let bgColor = '#87CEEB'; // Sky blue
      if (gameData.current.altitude > 0) {
        // Transition to space (black) around 10000m
        const progress = Math.min(gameData.current.altitude / 10000, 1);
        const r = Math.floor(135 * (1 - progress));
        const g = Math.floor(206 * (1 - progress));
        const b = Math.floor(235 * (1 - progress) + 30 * progress);
        bgColor = `rgb(${r}, ${g}, ${b})`;
      }
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, w, h);

      // Draw Stars if high enough
      if (gameData.current.altitude > 5000) {
        const opacity = Math.min((gameData.current.altitude - 5000) / 5000, 1);
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        gameData.current.stars.forEach((star) => {
          if (phase === 'flying') {
            star.y += star.speed * (gameData.current.velocity / 100) * deltaTime;
            if (star.y > 1) star.y -= 1; // Wrap around
          }
          ctx.beginPath();
          ctx.arc(star.x * w, star.y * h, star.size, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // Draw Ground
      if (gameData.current.altitude < 1000) {
        const groundY = h - 50 + (gameData.current.altitude * 2);
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(0, groundY, w, h);
        ctx.fillStyle = '#228B22';
        ctx.fillRect(0, groundY, w, 20);
      }

      // Draw Piyo
      if (phase !== 'title') {
        const pX = w / 2;
        const pY = gameData.current.piyoY;
        drawPiyo(pX, pY, gameData.current.piyoScaleY);

        if (phase === 'playing') {
          drawHammer(pX, pY, gameData.current.hammerAngle);
        }

        // Draw fire effect if flying fast
        if (phase === 'flying' && gameData.current.velocity > 100) {
          ctx.fillStyle = `rgba(255, 69, 0, ${Math.random()})`;
          ctx.beginPath();
          ctx.moveTo(pX - 20, pY);
          ctx.lineTo(pX + 20, pY);
          ctx.lineTo(pX, pY + 50 + Math.random() * 50);
          ctx.fill();
        }
      }

      requestRef.current = requestAnimationFrame(loop);
    };

    requestRef.current = requestAnimationFrame(loop);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [phase, highScore]);

  return (
    <div className="hammer-jump-container">
      <button className="hammer-jump-back-btn" onClick={navigateToPortal}>
        &#8592; もどる
      </button>

      {/* Canvas Layer */}
      <canvas ref={canvasRef} className="hammer-jump-canvas" />

      {/* Touch Area for playing */}
      {phase === 'playing' && (
        <div
          className="hammer-jump-tap-area"
          onTouchStart={handleTap}
          onMouseDown={handleTap}
        />
      )}

      {/* UI Overlay */}
      <div className="hammer-jump-ui">
        {phase === 'title' && (
          <>
            <h1 className="hammer-jump-title">ハンマー<br />ぴよ飛ばし</h1>
            {highScore > 0 && (
              <div className="hammer-jump-highscore">
                ハイスコア: {highScore.toLocaleString()} m
              </div>
            )}
            <button className="hammer-jump-btn" onClick={startGame}>
              スタート！
            </button>
          </>
        )}

        {phase === 'playing' && (
          <div className="hammer-jump-hud">
            <div className="hammer-jump-timer">残り: {timeLeft}秒</div>
            <div className="hammer-jump-counter">{tapCount} タップ</div>
          </div>
        )}

        {phase === 'result' && (
          <div className="hammer-jump-result-box">
            <div className="hammer-jump-result-label">飛行距離</div>
            <div className="hammer-jump-result-score">
              {finalScore.toLocaleString()} m
            </div>
            {isNewRecord && <div className="hammer-jump-new-record">🎉 宇宙新記録！ 🎉</div>}
            <button className="hammer-jump-btn" onClick={startGame}>
              もう一度遊ぶ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
