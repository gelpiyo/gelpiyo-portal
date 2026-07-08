export type GamePhase = 'title' | 'playing' | 'flying' | 'result';

export interface PopText {
  x: number;
  y: number;
  text: string;
  life: number;
  angle: number;
  scale: number;
}

export interface FireParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  color: string;
}

export interface BgObject {
  type: 'cloud' | 'satellite' | 'ufo' | 'meteor' | 'bird' | 'balloon';
  x: number;
  y: number;
  speed: number;
  size: number;
  angle: number;
}

export interface ChargeParticle {
  sx: number;
  sy: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  age: number;
  life: number;
  color: string;
  size: number;
}

export interface AuraParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

export interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
}

export interface GameData {
  taps: number;
  startTime: number;
  piyoY: number;
  piyoScaleY: number;
  piyoScaleX: number;
  altitude: number;
  targetAltitude: number;
  velocity: number;
  stars: Star[];
  hammerAngle: number;
  targetHammerAngle: number;
  hammerTimer: number;
  popTexts: PopText[];
  fireParticles: FireParticle[];
  bgObjects: BgObject[];
  chargeParticles: ChargeParticle[];
  auraParticles: AuraParticle[];
  preLaunchTimer: number;
  isLaunching: boolean;
}

/** 色のブレンド */
export function blendColors(c1: string, c2: string, ratio: number): string {
  const r1 = parseInt(c1.substring(1, 3), 16);
  const g1 = parseInt(c1.substring(3, 5), 16);
  const b1 = parseInt(c1.substring(5, 7), 16);

  const r2 = parseInt(c2.substring(1, 3), 16);
  const g2 = parseInt(c2.substring(3, 5), 16);
  const b2 = parseInt(c2.substring(5, 7), 16);

  const r = Math.round(r1 + (r2 - r1) * ratio);
  const g = Math.round(g1 + (g2 - g1) * ratio);
  const b = Math.round(b1 + (b2 - b1) * ratio);

  return `rgb(${r}, ${g}, ${b})`;
}
