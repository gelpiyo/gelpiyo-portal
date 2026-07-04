// ============================================
// audio.ts - Web Audio API Sound Effects
// ============================================

let audioCtx: AudioContext | null = null;
let muted = false;

export function initAudio(): void {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  } catch (e) {
    console.error('Web Audio API is not supported:', e);
  }
}

export function resumeAudio(): void {
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

export function setMuted(val: boolean): void {
  muted = val;
}

export function getMuted(): boolean {
  return muted;
}

export function toggleMute(): void {
  muted = !muted;
}

function playTone(freq: number, duration: number, type: OscillatorType = 'square', volume: number = 0.15): void {
  if (!audioCtx || muted) return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

  gain.gain.setValueAtTime(volume, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + duration);
}

export function playTap(): void {
  playTone(800, 0.08, 'square', 0.1);
}

export function playPelletDrop(): void {
  if (!audioCtx || muted) return;
  playTone(200, 0.15, 'sine', 0.12);
  setTimeout(() => playTone(300, 0.1, 'sine', 0.1), 80);
}

export function playTopping(): void {
  if (!audioCtx || muted) return;
  playTone(523, 0.1, 'triangle', 0.12);
  setTimeout(() => playTone(659, 0.1, 'triangle', 0.1), 60);
}

export function playComplete(): void {
  if (!audioCtx || muted) return;
  playTone(523, 0.12, 'square', 0.12);
  setTimeout(() => playTone(659, 0.12, 'square', 0.12), 100);
  setTimeout(() => playTone(784, 0.2, 'square', 0.15), 200);
}

export function playCorrect(): void {
  if (!audioCtx || muted) return;
  playTone(880, 0.1, 'square', 0.12);
  setTimeout(() => playTone(1047, 0.15, 'square', 0.15), 80);
}

export function playCombo(): void {
  if (!audioCtx || muted) return;
  playTone(1047, 0.08, 'sawtooth', 0.1);
  setTimeout(() => playTone(1319, 0.08, 'sawtooth', 0.1), 60);
  setTimeout(() => playTone(1568, 0.12, 'sawtooth', 0.12), 120);
}

export function playMiss(): void {
  if (!audioCtx || muted) return;
  playTone(200, 0.3, 'sawtooth', 0.15);
  setTimeout(() => playTone(150, 0.4, 'sawtooth', 0.12), 150);
}

export function playTimeUp(): void {
  if (!audioCtx || muted) return;
  for (let i = 0; i < 3; i++) {
    setTimeout(() => playTone(440, 0.25, 'square', 0.15), i * 300);
  }
  setTimeout(() => playTone(330, 0.5, 'square', 0.18), 900);
}

export function playCountdown(): void {
  playTone(660, 0.08, 'square', 0.08);
}

export function playGameStart(): void {
  if (!audioCtx || muted) return;
  playTone(523, 0.12, 'square', 0.12);
  setTimeout(() => playTone(659, 0.12, 'square', 0.12), 120);
  setTimeout(() => playTone(784, 0.12, 'square', 0.12), 240);
  setTimeout(() => playTone(1047, 0.25, 'square', 0.18), 360);
}
