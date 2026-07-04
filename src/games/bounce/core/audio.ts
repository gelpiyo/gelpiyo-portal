// ============================================
// audio.ts — Web Audio API 効果音合成
// ============================================

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let isMuted = false;

export function initAudio(): void {
  if (audioCtx) return;
  audioCtx = new AudioContext();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.4;
  masterGain.connect(audioCtx.destination);
}

export function toggleMute(): boolean {
  isMuted = !isMuted;
  if (masterGain) {
    masterGain.gain.value = isMuted ? 0 : 0.4;
  }
  return isMuted;
}

export function getMuted(): boolean {
  return isMuted;
}

function playTone(
  freq: number, duration: number,
  type: OscillatorType = 'sine', gainVal: number = 0.3, detune: number = 0,
): void {
  if (!audioCtx || !masterGain || isMuted) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;
  gain.gain.setValueAtTime(gainVal, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(now);
  osc.stop(now + duration);
}

function playNoise(duration: number, gainVal: number = 0.2): void {
  if (!audioCtx || !masterGain || isMuted) return;
  const now = audioCtx.currentTime;
  const bufferSize = audioCtx.sampleRate * duration;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(gainVal, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  source.connect(gain);
  gain.connect(masterGain);
  source.start(now);
}

export function playSfxLaunch(): void {
  if (!audioCtx || !masterGain || isMuted) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(800, now);
  osc.frequency.exponentialRampToValueAtTime(200, now + 0.3);
  gain.gain.setValueAtTime(0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.3);
  playNoise(0.1, 0.1);
}

export function playSfxBounce(impact: number): void {
  if (!audioCtx || !masterGain || isMuted) return;
  const now = audioCtx.currentTime;
  const baseFreq = 300 + Math.min(impact * 0.5, 400);

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(baseFreq, now);
  osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, now + 0.2);
  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.2);

  const osc2 = audioCtx.createOscillator();
  const gain2 = audioCtx.createGain();
  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(baseFreq * 1.5, now);
  osc2.frequency.exponentialRampToValueAtTime(baseFreq * 0.8, now + 0.15);
  gain2.gain.setValueAtTime(0.1, now);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  osc2.connect(gain2);
  gain2.connect(masterGain);
  osc2.start(now);
  osc2.stop(now + 0.15);
}

export function playSfxBreak(): void {
  playNoise(0.15, 0.3);
  playTone(1200, 0.1, 'square', 0.1);
  playTone(800, 0.05, 'sawtooth', 0.08);
}

export function playSfxExplosion(): void {
  if (!audioCtx || !masterGain || isMuted) return;
  const now = audioCtx.currentTime;
  const bufferSize = audioCtx.sampleRate * 0.6;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
  }
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.5, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(800, now);
  filter.frequency.exponentialRampToValueAtTime(100, now + 0.6);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  source.start(now);
  playTone(60, 0.4, 'sine', 0.4);
  playTone(120, 0.2, 'triangle', 0.2);
}

export function playSfxClear(): void {
  if (!audioCtx || isMuted) return;
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, i) => {
    setTimeout(() => {
      playTone(freq, 0.4, 'sine', 0.2);
      playTone(freq * 0.5, 0.4, 'triangle', 0.1);
    }, i * 120);
  });
}

export function playSfxFail(): void {
  playTone(300, 0.3, 'sine', 0.2);
  setTimeout(() => playTone(200, 0.4, 'sine', 0.2), 200);
}

export function playSfxTap(): void {
  playTone(800, 0.05, 'sine', 0.1);
}
