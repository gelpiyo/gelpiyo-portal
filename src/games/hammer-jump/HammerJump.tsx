import React, { useEffect, useRef, useState } from 'react';
import { usePortalStore } from '@/stores/portalStore';
import type { GamePhase, GameData, BgObject } from './core/types';
import { blendColors } from './core/types';
import { useSaveDataStore } from '@/stores/saveDataStore';
import './hammer-jump.css';

export function HammerJump(): React.JSX.Element {
  const navigateToPortal = usePortalStore((state) => state.navigateToPortal);

  const [phase, setPhase] = useState<GamePhase>('title');
  const storeHighScore = useSaveDataStore(s => s.games['hammer-jump']?.highScore || 0);
  const updateHighScore = useSaveDataStore(s => s.updateHighScore);
  const [highScore, setHighScore] = useState(storeHighScore);

  useEffect(() => {
    setHighScore(storeHighScore);
  }, [storeHighScore]);
  const [timeLeft, setTimeLeft] = useState(10);
  const [tapCount, setTapCount] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [reachingTarget, setReachingTarget] = useState('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number>(0);
  const gelpiyoImgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new window.Image();
    const baseUrl = import.meta.env.BASE_URL;
    img.src = `${baseUrl}assets/bounce/characters/gelpiyo.jpg`;
    img.onload = () => {
      const canvas = window.document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240) {
            data[i + 3] = 0;
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

  const gameData = useRef<GameData>({
    taps: 0,
    startTime: 0,
    piyoY: 0,
    piyoScaleY: 1,
    piyoScaleX: 1,
    altitude: 0,
    targetAltitude: 0,
    velocity: 0,
    stars: [],
    hammerAngle: Math.PI / 3,
    targetHammerAngle: Math.PI / 3,
    hammerTimer: 0,
    popTexts: [],
    fireParticles: [],
    bgObjects: [],
    chargeParticles: [],
    auraParticles: [],
    preLaunchTimer: 0.0,
    isLaunching: false,
  });

  // useEffect(() => {
  //   const saved = localStorage.getItem('hammerJumpHighScore');
  //   if (saved) {
  //     setHighScore(parseInt(saved, 10));
  //   }
  // }, []);

  const startGame = () => {
    setPhase('playing');
    setTimeLeft(10);
    setTapCount(0);
    setFinalScore(0);
    setIsNewRecord(false);
    setReachingTarget('');
    gameData.current = {
      taps: 0,
      startTime: performance.now(),
      piyoY: 0,
      piyoScaleY: 1,
      piyoScaleX: 1,
      altitude: 0,
      targetAltitude: 0,
      velocity: 0,
      stars: Array.from({ length: 120 }).map(() => ({
        x: Math.random(),
        y: Math.random(),
        size: Math.random() * 2.2 + 0.8,
        speed: Math.random() * 0.45 + 0.15,
      })),
      hammerAngle: Math.PI / 3,
      targetHammerAngle: Math.PI / 3,
      hammerTimer: 0,
      popTexts: [],
      fireParticles: [],
      bgObjects: [],
      chargeParticles: [],
      auraParticles: [],
      preLaunchTimer: 0.0,
      isLaunching: false,
    };
  };

  const handleTap = (e: React.TouchEvent | React.MouseEvent) => {
    if (e.cancelable) {
      e.preventDefault();
    }
    if (phase !== 'playing') return;

    setTapCount((prev) => {
      const next = prev + 1;
      gameData.current.taps = next;
      
      gameData.current.piyoScaleY = 0.45; // 潰れ強化
      gameData.current.piyoScaleX = 1.38; // 横に伸びる反動
      
      gameData.current.hammerAngle = Math.PI / 3.2;
      gameData.current.targetHammerAngle = -Math.PI / 5;
      gameData.current.hammerTimer = 0.09;

      // タップ擬音ポップアップ
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const w = rect.width;
        const texts = ['ピコッ！', 'HIT!', 'BOUNCE!', 'CHARGE!', 'POWER UP!'];
        const text = texts[Math.floor(Math.random() * texts.length)];
        gameData.current.popTexts.push({
          x: w / 2 - 25 + Math.random() * 50,
          y: gameData.current.piyoY - 80 + Math.random() * 25,
          text,
          life: 1.0,
          angle: (Math.random() - 0.5) * 0.45,
          scale: 0.85 + Math.random() * 0.4,
        });

        // ぴよの中心へ吸い込まれるチャージ粒子を生成
        const pX = w / 2;
        const pY = gameData.current.piyoY - 30;
        const pColors = ['#00f2fe', '#00ffcc', '#ff007f'];
        const pColor = pColors[Math.floor(Math.random() * pColors.length)];
        for (let i = 0; i < 8; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = 60 + Math.random() * 60;
          gameData.current.chargeParticles.push({
            sx: pX + Math.cos(angle) * dist,
            sy: pY + Math.sin(angle) * dist,
            x: pX + Math.cos(angle) * dist,
            y: pY + Math.sin(angle) * dist,
            tx: pX,
            ty: pY,
            age: 0,
            life: 0.35 + Math.random() * 0.2,
            color: pColor,
            size: 2.0 + Math.random() * 3.0
          });
        }
      }
      return next;
    });
  };

  useEffect(() => {
    if (phase !== 'playing') return;

    const interval = setInterval(() => {
      const elapsed = (performance.now() - gameData.current.startTime) / 1000;
      const remain = Math.max(10 - elapsed, 0);
      setTimeLeft(Math.ceil(remain));

      if (remain <= 0) {
        clearInterval(interval);
        const target = Math.floor(Math.pow(gameData.current.taps, 1.85) * 22);
        gameData.current.targetAltitude = target;
        gameData.current.velocity = Math.max(target * 0.13, 240); // 速度を抑えフライト時間延長

        // 打ち上げ前の「ため」を設定 (0.8秒)
        gameData.current.preLaunchTimer = 0.8;
        gameData.current.isLaunching = false;

        setPhase('flying');
      }
    }, 100);

    return () => clearInterval(interval);
  }, [phase]);

  const getTargetMessage = (alt: number) => {
    if (alt > 200000) return '🚀 ぴよぴよ銀河系外へ到達！';
    if (alt > 120000) return '🪐 土星軌道突破！';
    if (alt > 70000) return '☄️ 火星軌道へ到達！';
    if (alt > 35000) return '🌕 月面着陸！';
    if (alt > 15000) return '🛰️ 人工衛星の軌道へ突入！';
    if (alt > 6000) return '🌤️ 成層圏突破！';
    if (alt > 2000) return '☁️ 雲の上に到達！';
    return '';
  };

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

    const drawPiyo = (cx: number, cy: number, scaleX: number, scaleY: number) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scaleX, scaleY);

      if (gelpiyoImgRef.current) {
        const img = gelpiyoImgRef.current;
        const targetW = 82;
        const imgAspect = img.width / img.height;
        const targetH = targetW / imgAspect;

        ctx.drawImage(img, -targetW / 2, -targetH, targetW, targetH);
      } else {
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        const width = 40 + (1 - scaleY) * 20;
        ctx.ellipse(0, -30, width, 30, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(-15, -40, 4, 0, Math.PI * 2);
        ctx.arc(15, -40, 4, 0, Math.PI * 2);
        ctx.fill();

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
      ctx.translate(cx + 65, cy - 40);
      ctx.rotate(angle);

      // 黄色い持ち手 (グラデーション)
      const handleGrad = ctx.createLinearGradient(-3, -40, 3, 0);
      handleGrad.addColorStop(0, '#FFE875');
      handleGrad.addColorStop(0.5, '#FFD700');
      handleGrad.addColorStop(1, '#B88600');
      ctx.fillStyle = handleGrad;
      ctx.fillRect(-3, -40, 6, 40);

      // ハンマーの頭
      const headX = 0;
      const headY = -40;
      const headR = 24;
      const headH = 15;
      
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 8;
      const headGrad = ctx.createRadialGradient(headX - 6, headY - 6, 2, headX, headY, headR);
      headGrad.addColorStop(0, '#FFB6C1');
      headGrad.addColorStop(0.3, '#FF69B4');
      headGrad.addColorStop(1, '#C71585');
      ctx.fillStyle = headGrad;
      ctx.beginPath();
      ctx.ellipse(headX, headY, headR, headH, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // ピコピコハンマーの縞模様
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.6;
      const stripes = [-12, -6, 0, 6, 12];
      for (const dx of stripes) {
        ctx.beginPath();
        ctx.arc(dx, headY, headH, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();
      }
      ctx.strokeStyle = '#8B008B';
      ctx.lineWidth = 1.2;
      for (const dx of stripes) {
        ctx.beginPath();
        ctx.arc(dx + 1.5, headY, headH, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();
      }

      ctx.restore();
    };

    const drawSwingTrail = (cx: number, cy: number, angle: number, targetAngle: number) => {
      if (gameData.current.hammerTimer > 0) {
        ctx.save();
        ctx.translate(cx + 65, cy - 40);
        ctx.strokeStyle = 'rgba(255, 105, 180, 0.22)';
        ctx.lineWidth = 15;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, 0, 40, angle, targetAngle, angle > targetAngle);
        ctx.stroke();
        ctx.restore();
      }
    };

    const loop = (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const deltaTime = Math.min((time - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = time;

      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      // 1. 地面設置状態のY座標
      const groundLevelY = h - 50;

      // ── 状態更新 ──
      if (phase === 'playing') {
        gameData.current.piyoScaleY += (1 - gameData.current.piyoScaleY) * 11 * deltaTime;
        gameData.current.piyoScaleX += (1 - gameData.current.piyoScaleX) * 11 * deltaTime;
        gameData.current.piyoY = groundLevelY; // 地面設置

        if (gameData.current.hammerTimer > 0) {
          gameData.current.hammerTimer -= deltaTime;
        } else {
          gameData.current.targetHammerAngle = Math.PI / 3;
        }
        gameData.current.hammerAngle += (gameData.current.targetHammerAngle - gameData.current.hammerAngle) * 30 * deltaTime;

        // 常時立ち上るチャージオーラ (タップ数に応じて量と速度が増加)
        const taps = gameData.current.taps;
        const spawnProb = Math.min(taps * 0.025, 0.7);
        if (Math.random() < spawnProb) {
          const auraColors = ['rgba(0, 255, 204, 0.45)', 'rgba(0, 242, 254, 0.45)', 'rgba(255, 0, 127, 0.35)'];
          gameData.current.auraParticles.push({
            x: w / 2 + (Math.random() - 0.5) * 56,
            y: groundLevelY - 10,
            vx: (Math.random() - 0.5) * 1.5,
            vy: -1.2 - Math.random() * (1.5 + taps * 0.06),
            life: 0.6 + Math.random() * 0.5,
            color: auraColors[Math.floor(Math.random() * auraColors.length)],
            size: 2.5 + Math.random() * (3.0 + taps * 0.08)
          });
        }
      } else if (phase === 'flying') {
        // ため（Pre-Launch）状態の更新
        if (gameData.current.preLaunchTimer > 0) {
          gameData.current.preLaunchTimer -= deltaTime;
          gameData.current.piyoY = groundLevelY;
          gameData.current.piyoScaleY = 1.0;
          gameData.current.piyoScaleX = 1.0;

          // ための間、超高速でエネルギー粒子を吸い込む
          const pX = w / 2;
          const pY = groundLevelY - 30;
          if (Math.random() < 0.45) {
            for (let i = 0; i < 12; i++) {
              const angle = Math.random() * Math.PI * 2;
              const dist = 90 + Math.random() * 100;
              gameData.current.chargeParticles.push({
                sx: pX + Math.cos(angle) * dist,
                sy: pY + Math.sin(angle) * dist,
                x: pX + Math.cos(angle) * dist,
                y: pY + Math.sin(angle) * dist,
                tx: pX,
                ty: pY,
                age: 0,
                life: 0.18 + Math.random() * 0.18,
                color: '#ffea00',
                size: 2.0 + Math.random() * 4.0
              });
            }
          }

          if (gameData.current.preLaunchTimer <= 0) {
            // ため終了：大ジャンプ開始！
            gameData.current.isLaunching = true;
            // 爆発的スパーク
            const pX = w / 2;
            const pY = groundLevelY - 20;
            for (let i = 0; i < 35; i++) {
              const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
              const speed = 4 + Math.random() * 9;
              gameData.current.fireParticles.push({
                x: pX + (Math.random() - 0.5) * 25,
                y: pY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 4.5 + Math.random() * 5.5,
                life: 0.9 + Math.random() * 0.4,
                color: '#ffea00'
              });
            }
          }
        } else {
          // 打ち上げ上昇中
          const speedRatio = gameData.current.velocity / 3000;
          const targetScaleY = 1.0 + Math.min(speedRatio * 0.45, 0.6);
          const targetScaleX = 1.0 - Math.min(speedRatio * 0.25, 0.3);
          
          gameData.current.piyoScaleY += (targetScaleY - gameData.current.piyoScaleY) * 10 * deltaTime;
          gameData.current.piyoScaleX += (targetScaleX - gameData.current.piyoScaleX) * 10 * deltaTime;
          
          if (gameData.current.piyoY > h / 2.2) {
            gameData.current.piyoY -= 480 * deltaTime;
          }

          gameData.current.altitude += gameData.current.velocity * deltaTime;
          // 低速になると急激に減速してピタッと気持ちよく止まる
          if (gameData.current.velocity < 75) {
            gameData.current.velocity *= 0.93;
          } else {
            gameData.current.velocity *= 0.9935;
          }

          const msg = getTargetMessage(gameData.current.altitude);
          if (msg) setReachingTarget(msg);
        }

        // 飛行中背景流しアセット生成
        if (gameData.current.isLaunching && Math.random() < 0.025) {
          const alt = gameData.current.altitude;
          let type: BgObject['type'] = 'cloud';
          let size = 25 + Math.random() * 40;
          if (alt < 4500) {
            type = Math.random() < 0.6 ? 'cloud' : (Math.random() < 0.5 ? 'bird' : 'balloon');
          } else if (alt < 12000) {
            type = Math.random() < 0.85 ? 'cloud' : 'balloon';
            size = 40 + Math.random() * 50;
          } else if (alt < 28000) {
            type = 'satellite';
            size = 18 + Math.random() * 18;
          } else {
            type = Math.random() < 0.6 ? 'meteor' : 'ufo';
            size = 15 + Math.random() * 22;
          }

          gameData.current.bgObjects.push({
            type,
            x: Math.random() * w,
            y: -50,
            speed: 150 + Math.random() * 200,
            size,
            angle: Math.random() * Math.PI * 2
          });
        }

        // 飛行中ジェット粒子
        if (gameData.current.isLaunching && gameData.current.velocity > 50) {
          const pX = w / 2;
          const pY = gameData.current.piyoY;
          const count = Math.min(Math.floor(gameData.current.velocity / 320) + 1, 6);
          for (let i = 0; i < count; i++) {
            const angle = Math.PI / 2 + (Math.random() - 0.5) * 0.25;
            const speed = 2 + Math.random() * 5;
            const colors = ['#FF3300', '#FF9900', '#FFEA00', '#FFFFFF'];
            gameData.current.fireParticles.push({
              x: pX + (Math.random() - 0.5) * 20,
              y: pY + 8,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed + gameData.current.velocity * 0.015,
              size: 4 + Math.random() * 5,
              life: 1.0,
              color: colors[Math.floor(Math.random() * colors.length)]
            });
          }
        }

        if (gameData.current.isLaunching && (gameData.current.altitude >= gameData.current.targetAltitude || gameData.current.velocity < 18)) {
          gameData.current.altitude = gameData.current.targetAltitude;

          if (phase === 'flying') {
            setFinalScore(gameData.current.targetAltitude);
            if (gameData.current.targetAltitude > highScore) {
              updateHighScore('hammer-jump', gameData.current.targetAltitude);
              setHighScore(gameData.current.targetAltitude);
              setIsNewRecord(true);
            }
            setPhase('result');
          }
        }
      }

      // ── パーティクル配列等の更新 ──
      gameData.current.popTexts.forEach(pt => pt.life -= deltaTime * 1.5);
      gameData.current.popTexts = gameData.current.popTexts.filter(pt => pt.life > 0);

      // チャージ吸い込み
      gameData.current.chargeParticles.forEach(cp => {
        cp.age += deltaTime;
        const t = Math.min(cp.age / cp.life, 1.0);
        const tEase = t * t * t; // 加速吸い込み
        cp.x = cp.sx + (cp.tx - cp.sx) * tEase;
        cp.y = cp.sy + (cp.ty - cp.sy) * tEase;
      });
      gameData.current.chargeParticles = gameData.current.chargeParticles.filter(cp => cp.age < cp.life);

      // チャージオーラ
      gameData.current.auraParticles.forEach(ap => {
        ap.x += ap.vx;
        ap.y += ap.vy;
        ap.life -= deltaTime * 1.6;
      });
      gameData.current.auraParticles = gameData.current.auraParticles.filter(ap => ap.life > 0);

      // ジェット炎
      gameData.current.fireParticles.forEach(fp => {
        fp.x += fp.vx;
        fp.y -= fp.vy * 0.15;
        fp.life -= deltaTime * 2.2;
      });
      gameData.current.fireParticles = gameData.current.fireParticles.filter(fp => fp.life > 0);

      // 背景流れる物
      gameData.current.bgObjects.forEach(obj => {
        const flowSpeed = (obj.speed + gameData.current.velocity * 0.8) * deltaTime;
        obj.y += flowSpeed;
      });
      gameData.current.bgObjects = gameData.current.bgObjects.filter(obj => obj.y < h + 100);

      // 背景色ブレンド
      let bgColor = '#87CEEB';
      const alt = gameData.current.altitude;
      if (alt > 0) {
        if (alt < 4500) {
          bgColor = '#87CEEB';
        } else if (alt < 12000) {
          const ratio = (alt - 4500) / 7500;
          bgColor = blendColors('#87CEEB', '#182b49', ratio);
        } else if (alt < 28000) {
          const ratio = (alt - 12000) / 16000;
          bgColor = blendColors('#182b49', '#080812', ratio);
        } else if (alt < 65000) {
          const ratio = (alt - 28000) / 37000;
          bgColor = blendColors('#080812', '#020106', ratio);
        } else {
          bgColor = '#010003';
        }
      }
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, w, h);

      // 宇宙星雲
      if (alt > 40000) {
        ctx.save();
        const nebGrad1 = ctx.createRadialGradient(w * 0.3, h * 0.3, 50, w * 0.3, h * 0.3, w * 0.7);
        nebGrad1.addColorStop(0, 'rgba(100, 50, 180, 0.13)');
        nebGrad1.addColorStop(0.6, 'rgba(255, 0, 128, 0.06)');
        nebGrad1.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = nebGrad1;
        ctx.fillRect(0, 0, w, h);

        const nebGrad2 = ctx.createRadialGradient(w * 0.75, h * 0.65, 30, w * 0.75, h * 0.65, w * 0.65);
        nebGrad2.addColorStop(0, 'rgba(0, 242, 254, 0.1)');
        nebGrad2.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = nebGrad2;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }

      // 星々
      if (alt > 8000) {
        const opacity = Math.min((alt - 8000) / 8000, 1);
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        gameData.current.stars.forEach((star) => {
          if (phase === 'flying') {
            star.y += star.speed * (gameData.current.velocity / 120) * deltaTime;
            if (star.y > 1) star.y -= 1;
          }
          ctx.beginPath();
          ctx.arc(star.x * w, star.y * h, star.size, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // スピードオブジェクト描画
      gameData.current.bgObjects.forEach((obj) => {
        ctx.save();
        ctx.globalAlpha = 0.85;
        if (obj.type === 'cloud') {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.beginPath();
          ctx.ellipse(obj.x, obj.y, obj.size, obj.size * 0.38, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (obj.type === 'bird') {
          ctx.strokeStyle = '#4a5568';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(obj.x - obj.size / 2, obj.y);
          ctx.quadraticCurveTo(obj.x - obj.size / 4, obj.y - obj.size / 4, obj.x, obj.y);
          ctx.quadraticCurveTo(obj.x + obj.size / 4, obj.y - obj.size / 4, obj.x + obj.size / 2, obj.y);
          ctx.stroke();
        } else if (obj.type === 'balloon') {
          ctx.fillStyle = '#ff2a55';
          ctx.beginPath();
          ctx.arc(obj.x, obj.y, obj.size / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffea00';
          ctx.fillRect(obj.x - 2, obj.y + obj.size / 2, 4, 5);
        } else if (obj.type === 'satellite') {
          ctx.fillStyle = '#cbd5e0';
          ctx.fillRect(obj.x - obj.size / 2, obj.y - 3, obj.size, 6);
          ctx.fillStyle = '#4a5568';
          ctx.fillRect(obj.x - 4, obj.y - 4, 8, 8);
        } else if (obj.type === 'ufo') {
          ctx.fillStyle = '#00f2fe';
          ctx.beginPath();
          ctx.ellipse(obj.x, obj.y, obj.size, obj.size * 0.35, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(obj.x, obj.y - obj.size * 0.18, obj.size * 0.28, 0, Math.PI * 2);
          ctx.fill();
        } else if (obj.type === 'meteor') {
          ctx.fillStyle = '#718096';
          ctx.beginPath();
          ctx.arc(obj.x, obj.y, obj.size / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 90, 0, 0.4)';
          ctx.lineWidth = obj.size / 2.5;
          ctx.beginPath();
          ctx.moveTo(obj.x, obj.y);
          ctx.lineTo(obj.x, obj.y - obj.size * 1.5);
          ctx.stroke();
        }
        ctx.restore();
      });

      // 地面描画 (飛行が始まってもしばらくは下に見える、遠ざかる速度をゆっくりに)
      if (alt < 3000) {
        const groundY = h - 50 + (alt * 0.85);
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(0, groundY, w, h);
        ctx.fillStyle = '#228B22';
        ctx.fillRect(0, groundY, w, 20);
      }

      // チャージ粒子描画 (吸い込み)
      ctx.save();
      gameData.current.chargeParticles.forEach(cp => {
        ctx.save();
        ctx.globalAlpha = 1.0 - (cp.age / cp.life);
        ctx.fillStyle = cp.color;
        ctx.shadowColor = cp.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(cp.x, cp.y, cp.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      ctx.restore();

      // オーラ粒子描画 (常時)
      ctx.save();
      gameData.current.auraParticles.forEach(ap => {
        ctx.save();
        ctx.globalAlpha = ap.life;
        ctx.fillStyle = ap.color;
        ctx.shadowColor = ap.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(ap.x, ap.y, ap.size * ap.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      ctx.restore();

      // ジェット粒子描画
      gameData.current.fireParticles.forEach((fp) => {
        ctx.save();
        ctx.globalAlpha = fp.life;
        ctx.fillStyle = fp.color;
        ctx.shadowColor = fp.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(fp.x, fp.y, fp.size * fp.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // ぴよ＆ハンマー描画
      if (phase !== 'title') {
        const pX = w / 2;
        const pY = gameData.current.piyoY;
        
        ctx.save();
        // 打ち上げ前の「ため」時の小刻み振動
        if (phase === 'flying' && gameData.current.preLaunchTimer > 0) {
          const shakeVal = Math.min((0.8 - gameData.current.preLaunchTimer) * 16, 12);
          const dx = (Math.random() - 0.5) * shakeVal;
          const dy = (Math.random() - 0.5) * shakeVal;
          ctx.translate(dx, dy);
        }

        drawPiyo(pX, pY, gameData.current.piyoScaleX, gameData.current.piyoScaleY);
        ctx.restore();

        if (phase === 'playing') {
          drawSwingTrail(pX, pY, gameData.current.hammerAngle, gameData.current.targetHammerAngle);
          drawHammer(pX, pY, gameData.current.hammerAngle);
        }
      }

      // ポップ擬音テキスト
      gameData.current.popTexts.forEach((pt) => {
        ctx.save();
        ctx.globalAlpha = pt.life;
        ctx.font = `bold ${Math.round(22 * pt.scale)}px "Outfit", "Arial Black", sans-serif`;
        ctx.fillStyle = '#ffea00';
        ctx.strokeStyle = '#ff0055';
        ctx.lineWidth = 4;
        ctx.textAlign = 'center';
        ctx.translate(pt.x, pt.y);
        ctx.rotate(pt.angle);
        ctx.strokeText(pt.text, 0, 0);
        ctx.fillText(pt.text, 0, 0);
        ctx.restore();
      });

      requestRef.current = requestAnimationFrame(loop);
    };

    requestRef.current = requestAnimationFrame(loop);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [phase, highScore]);

  const getDestinationLabel = (score: number) => {
    if (score > 150000) return '💫 ぴよ銀河系の彼方';
    if (score > 90000) return '🪐 魅惑 of 土星リング';
    if (score > 50000) return '🔴 赤い火星の荒野';
    if (score > 25000) return '🌕 月のうさぎの巣';
    if (score > 10000) return '🛰️ 人工衛星の軌道';
    if (score > 4000) return '🌥️ 涼しい成層圏';
    if (score > 1000) return '☁️ もこもこの雲の上';
    return '🌱 ゲルぴよの芝生';
  };

  return (
    <div className="hammer-jump-container">
      <button className="hammer-jump-back-btn" onClick={navigateToPortal}>
        &#8592; もどる
      </button>

      <canvas ref={canvasRef} className="hammer-jump-canvas" />

      {phase === 'playing' && (
        <div
          className="hammer-jump-tap-area"
          onTouchStart={handleTap}
          onMouseDown={handleTap}
        />
      )}

      <div className="hammer-jump-ui">
        {phase === 'title' && (
          <div className="hammer-jump-glass-panel">
            <h1 className="hammer-jump-title">ハンマー<br />ぴよ飛ばし</h1>
            {highScore > 0 && (
              <div className="hammer-jump-highscore">
                ハイスコア: {highScore.toLocaleString()} m
              </div>
            )}
            <button className="hammer-jump-btn" onClick={startGame}>
              スタート！
            </button>
          </div>
        )}

        {phase === 'playing' && (
          <div className="hammer-jump-hud">
            <div className="hammer-jump-timer">残り: {timeLeft}秒</div>
            
            {/* エネルギーチャージゲージ */}
            <div className="hammer-jump-gauge-wrapper">
              <span className="hammer-jump-gauge-label">PIYO BOUNCE POWER</span>
              <div className="hammer-jump-gauge-track">
                <div 
                  className={`hammer-jump-gauge-fill ${tapCount >= 100 ? 'overcharge' : ''}`}
                  style={{ width: `${Math.min((tapCount / 100) * 100, 100)}%` }} 
                />
              </div>
            </div>

            <div className="hammer-jump-counter">{tapCount} タップ</div>
          </div>
        )}

        {phase === 'flying' && (
          <div className="hammer-jump-flight-hud">
            <div className="hammer-jump-alt">{Math.floor(gameData.current.altitude).toLocaleString()} m</div>
            <div className="hammer-jump-target-msg">{reachingTarget}</div>
          </div>
        )}

        {phase === 'result' && (
          <div className="hammer-jump-result-box">
            <div className="hammer-jump-result-label">飛行距離</div>
            <div className="hammer-jump-result-score">
              {finalScore.toLocaleString()} m
            </div>
            <div className="hammer-jump-destination">
              到達点: <span className="hammer-jump-dest-val">{getDestinationLabel(finalScore)}</span>
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
