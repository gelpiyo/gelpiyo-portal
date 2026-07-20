import React, { useEffect, useRef, useState } from 'react';
import { usePortalStore } from '@/stores/portalStore';
import type { GamePhase, GameData, BgObject } from './core/types';
import { useSaveDataStore } from '@/stores/saveDataStore';
import './hammer-jump.css';

type Difficulty = 'easy' | 'normal' | 'hard';

export function HammerJump(): React.JSX.Element {
  const navigateToPortal = usePortalStore((state) => state.navigateToPortal);
  
  const [phase, setPhase] = useState<GamePhase>('title');
  const storeHighScore = useSaveDataStore(s => s.games['hammer-jump']?.highScore || 0);
  const updateHighScore = useSaveDataStore(s => s.updateHighScore);
  const [highScore, setHighScore] = useState(storeHighScore);
  const [timeLeft, setTimeLeft] = useState(10);
  const [tapCount, setTapCount] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [reachingTarget, setReachingTarget] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number>(0);
  const gelpiyoImgRef = useRef<HTMLImageElement | null>(null);
  const bgImagesRef = useRef<HTMLImageElement[]>([]);

  useEffect(() => {
    const baseUrl = import.meta.env.BASE_URL;

    // Load AI backgrounds
    const bgNames = ['bg_ground.png', 'bg_clouds.png', 'bg_airplane.png', 'bg_orbit.png', 'bg_space.png', 'bg_planets.png', 'bg_galaxy.png'];
    bgNames.forEach((name, i) => {
      const img = new window.Image();
      img.src = `${baseUrl}assets/hammer-jump/bg/${name}`;
      img.onload = () => {
        bgImagesRef.current[i] = img;
      };
    });

    const img = new window.Image();
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
    flightStartTime: 0,
  });

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
      flightStartTime: 0,
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
          y: gameData.current.piyoY - 110 + Math.random() * 25,
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
        
        // 速度と減衰の再計算：50〜100タップを想定。100タップで銀河（約300,000m）へ
        // 難易度に応じた実質タップ数の計算
        // 簡単：60タップで最後まで(約30万m), 普通：100タップ, 難しい：120タップ
        const difficultyMultiplier = difficulty === 'easy' ? (100 / 60) : (difficulty === 'hard' ? (100 / 120) : 1.0);
        const effectiveTaps = gameData.current.taps * difficultyMultiplier;
        
        const targetAltitude = Math.max(12 * Math.pow(effectiveTaps, 2.2), 2000);
        gameData.current.targetAltitude = targetAltitude;
        // 物理減衰は廃止し、アニメーションベースで制御するため初期velocityは仮置き
        gameData.current.velocity = 0; 

        // 打ち上げ前の「ため」を設定 (0.8秒)
        gameData.current.preLaunchTimer = 0.8;
        gameData.current.isLaunching = false;

        setPhase('flying');
      }
    }, 100);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const getTargetMessage = (alt: number) => {
    if (alt > 280000) return '🌌 未知の魔法銀河へ到達！';
    if (alt > 170000) return '🪐 太陽系外縁部を突破！';
    if (alt > 90000) return '☄️ はるか遠くの深宇宙！';
    if (alt > 45000) return '🛰️ 人工衛星の軌道へ突入！';
    if (alt > 15000) return '🌤️ 成層圏突破！';
    if (alt > 4000) return '☁️ 雲の上に到達！';
    return '';
  };

  const altRef = useRef<HTMLDivElement>(null); // DOMを直接更新して60fpsで距離を表示

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
          if (gameData.current.preLaunchTimer <= 0) {
            gameData.current.isLaunching = true;
            gameData.current.flightStartTime = performance.now();
          }
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
          // 打ち上げ上昇中（アニメーションベース制御）
          // ユーザーの要望「風景が移り変わるのを楽しむ」に合わせ、到達ステージ数に関わらず
          // 均等なペースで各背景を通過するように高度を制御する
          // ステージ境界を通過するポイント配列を作成
          const stages = [0, 4000, 15000, 45000, 90000, 170000, 280000];
          let path = [0];
          for (let i = 1; i < stages.length; i++) {
            if (gameData.current.targetAltitude > stages[i]) {
              path.push(stages[i]);
            } else {
              break;
            }
          }
          path.push(gameData.current.targetAltitude);
          
          const segments = path.length - 1;

          // ユーザー要望「余韻を5秒にしよう」
          // イージングカーブ(2.5)の性質を逆算し、通過ステージは1.0秒でサクサク進み、
          // 最後のステージ（余韻）でピッタリ約5.0秒停滞するよう飛行時間を計算する
          const flightDuration = Math.max(0, segments - 1) * 1.0 + 5.0; 
          
          const elapsedFlight = (performance.now() - gameData.current.flightStartTime) / 1000;
          let p = elapsedFlight / flightDuration;
          
          if (p >= 1.0) {
            p = 1.0;
            // 飛行終了
            if (phase === 'flying') {
              const finalScoreVal = Math.floor(gameData.current.targetAltitude);
              setFinalScore(finalScoreVal);
              if (finalScoreVal > highScore) {
                updateHighScore('hammer-jump', finalScoreVal);
                setHighScore(finalScoreVal);
                setIsNewRecord(true);
              } else {
                setIsNewRecord(false);
              }
              setPhase('result');
            }
          }

          // 減速カーブを2.5に戻すことで、フライト後半（最後の5秒間）に美しいブレーキがかかる
          const easeOut = 1 - Math.pow(1 - p, 2.5);
          
          // 飛行時間を到達セグメント数で均等割りし、現在のセグメント内で補間
          const currentSegment = Math.min(Math.floor(easeOut * segments), segments - 1);
          const segmentStart = currentSegment / segments;
          const segmentEnd = (currentSegment + 1) / segments;
          const segmentProgress = (easeOut - segmentStart) / (segmentEnd - segmentStart);
          
          const startAlt = path[currentSegment];
          const endAlt = path[currentSegment + 1];
          const newAltitude = startAlt + (endAlt - startAlt) * segmentProgress;
          
          // 表示やエフェクトのために見かけの速度を計算
          gameData.current.velocity = (newAltitude - gameData.current.altitude) / Math.max(deltaTime, 0.001);
          gameData.current.altitude = newAltitude;

          const speedRatio = gameData.current.velocity / 3000;
          const targetScaleY = 1.0 + Math.min(speedRatio * 0.25, 0.35);
          const targetScaleX = 1.0 - Math.min(speedRatio * 0.15, 0.2);
          
          gameData.current.piyoScaleY += (targetScaleY - gameData.current.piyoScaleY) * 10 * deltaTime;
          gameData.current.piyoScaleX += (targetScaleX - gameData.current.piyoScaleX) * 10 * deltaTime;
          
          if (gameData.current.piyoY > h / 2.2) {
            gameData.current.piyoY -= 480 * deltaTime;
          }

          if (altRef.current) {
            altRef.current.innerText = `${Math.floor(gameData.current.altitude).toLocaleString()} m`;
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
              vy: Math.sin(angle) * speed + 12, // 炎が間延びしないよう固定速度
              size: 4 + Math.random() * 5,
              life: 1.0,
              color: colors[Math.floor(Math.random() * colors.length)]
            });
          }
        }

        // 古い終了判定ブロック（アニメーション制御に移行したため削除）

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
        fp.y += fp.vy;
        fp.life -= deltaTime * 2.2;
      });
      gameData.current.fireParticles = gameData.current.fireParticles.filter(fp => fp.life > 0);

      // AI背景画像のクロスフェードと高速無限スクロール描画
      const alt = gameData.current.altitude;
      const bgs = bgImagesRef.current;
      
      const zones = [
        // 最初の風景遷移が早すぎるため、下層部の高度レンジを広げてゆっくり見せる
        { img: bgs[0], startFadeIn: -1000, startFadeOut: 4000, endFadeOut: 10000 },
        { img: bgs[1], startFadeIn: 4000, startFadeOut: 15000, endFadeOut: 25000 },
        { img: bgs[2], startFadeIn: 15000, startFadeOut: 45000, endFadeOut: 55000 },
        { img: bgs[3], startFadeIn: 45000, startFadeOut: 90000, endFadeOut: 110000 },
        { img: bgs[4], startFadeIn: 90000, startFadeOut: 170000, endFadeOut: 190000 },
        { img: bgs[5], startFadeIn: 170000, startFadeOut: 280000, endFadeOut: 310000 },
        { img: bgs[6], startFadeIn: 280000, startFadeOut: Infinity, endFadeOut: Infinity },
      ];

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);

      zones.forEach((zone, _index) => {
        if (alt >= zone.startFadeIn && alt <= zone.endFadeOut) {
          let alpha = 1.0;
          if (alt < zone.startFadeOut) {
            alpha = (alt - zone.startFadeIn) / (zone.startFadeOut - zone.startFadeIn);
          } else {
            alpha = 1.0 - (alt - zone.startFadeOut) / (zone.endFadeOut - zone.startFadeOut);
          }
          alpha = Math.max(0, Math.min(1, alpha));
          if (zone.img && zone.img.complete && zone.img.naturalWidth > 0 && alpha > 0) {
            ctx.save();
            ctx.globalAlpha = alpha;
            // すべての背景はループさせず、到達高度に合わせてゆっくりとパンさせる（吐き気防止と自然な景色）
            const totalZoneAlt = zone.endFadeOut === Infinity ? 100000 : (zone.endFadeOut - zone.startFadeIn);
            const progress = Math.max(0, Math.min(1, (alt - zone.startFadeIn) / totalZoneAlt));
            let drawH = h * 1.5;
            let drawW = drawH * (zone.img.width / zone.img.height);
            if (drawW < w) {
              drawW = w;
              drawH = w / (zone.img.width / zone.img.height);
            }
            const offsetX = (w - drawW) / 2;
            const offsetY = (h - drawH) + (drawH - h) * progress;
            ctx.drawImage(zone.img, offsetX, offsetY, drawW, drawH);
            ctx.restore();
          }
        }
      });

      // スピードライン（集中線・流線）追加で猛烈な上昇感を演出
      if (phase === 'flying' && gameData.current.velocity > 100) {
        ctx.save();
        ctx.globalAlpha = Math.min(gameData.current.velocity / 300, 0.65);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 1.5;
        const lineCount = Math.min(Math.floor(gameData.current.velocity / 50), 40);
        for (let i = 0; i < lineCount; i++) {
          const lx = Math.random() * w;
          const length = 40 + Math.random() * (gameData.current.velocity * 0.4);
          const ly = Math.random() * h;
          ctx.beginPath();
          ctx.moveTo(lx, ly);
          ctx.lineTo(lx, ly + length);
          ctx.stroke();
        }
        ctx.restore();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, highScore, difficulty]);

  const getDestinationLabel = (score: number) => {
    if (score > 280000) return '🌌 未知の魔法銀河';
    if (score > 170000) return '🪐 太陽系外縁部';
    if (score > 90000) return '☄️ 果てしない深宇宙';
    if (score > 45000) return '🛰️ 人工衛星の軌道';
    if (score > 15000) return '🌤️ 成層圏突破';
    if (score > 4000) return '☁️ もこもこの雲の上';
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
          onPointerDown={handleTap}
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
            
            <div style={{ margin: '15px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '14px', color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>難易度を選択（最後まで到達する目安）</div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button 
                  style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', background: difficulty === 'easy' ? '#ff3366' : 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 'bold' }}
                  onClick={() => setDifficulty('easy')}
                >
                  簡単<br/><span style={{ fontSize: '11px' }}>60タップ</span>
                </button>
                <button 
                  style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', background: difficulty === 'normal' ? '#ff3366' : 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 'bold' }}
                  onClick={() => setDifficulty('normal')}
                >
                  普通<br/><span style={{ fontSize: '11px' }}>100タップ</span>
                </button>
                <button 
                  style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', background: difficulty === 'hard' ? '#ff3366' : 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 'bold' }}
                  onClick={() => setDifficulty('hard')}
                >
                  難しい<br/><span style={{ fontSize: '11px' }}>120タップ</span>
                </button>
              </div>
            </div>

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
                  className={`hammer-jump-gauge-fill ${tapCount >= (difficulty === 'easy' ? 60 : difficulty === 'hard' ? 120 : 100) ? 'overcharge' : ''}`}
                  style={{ width: `${Math.min((tapCount / (difficulty === 'easy' ? 60 : difficulty === 'hard' ? 120 : 100)) * 100, 100)}%` }} 
                />
              </div>
            </div>

            <div className="hammer-jump-counter">{tapCount} タップ</div>
          </div>
        )}

        {phase === 'flying' && (
          <div className="hammer-jump-flight-hud">
            <div className="hammer-jump-alt" ref={altRef}>
              {Math.floor(gameData.current.altitude).toLocaleString()} m
            </div>
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
