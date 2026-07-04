// ============================================
// audio.ts - Audio management for Puzzle Ranger
// ============================================

const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
let _muted = false;

// Base configuration
const MASTER_VOL = 0.5;

function playOscillator(type: OscillatorType, freqs: number[], durations: number[], vols: number[]) {
  if (_muted || audioCtx.state === 'suspended') return;
  const t = audioCtx.currentTime;
  
  freqs.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t + (i > 0 ? durations[i-1] : 0));
    gain.gain.setValueAtTime(vols[i] * MASTER_VOL, t + (i > 0 ? durations[i-1] : 0));
    gain.gain.exponentialRampToValueAtTime(0.01, t + durations[i]);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t + (i > 0 ? durations[i-1] : 0));
    osc.stop(t + durations[i]);
  });
}

// Play match-3 clear sound
export function playClearSound() {
  playOscillator('sine', [880, 1100], [0.1, 0.2], [0.3, 0.3]);
}

// Play block swap sound
export function playSwapSound() {
  playOscillator('triangle', [440], [0.1], [0.1]);
}

// Play combo sound (pitch increases with combo)
export function playComboSound(combo: number) {
  const baseFreq = 440;
  const freq = baseFreq + (combo * 50);
  playOscillator('square', [freq, freq * 1.5], [0.1, 0.15], [0.2, 0.2]);
}

// Play unit spawn sound
export function playSpawnSound() {
  playOscillator('square', [440, 880], [0.1, 0.2], [0.2, 0.2]);
}

// Play hit sound (enemy attack or ally attack)
export function playHitSound() {
  if (_muted || audioCtx.state === 'suspended') return;
  const t = audioCtx.currentTime;
  const bufferSize = audioCtx.sampleRate * 0.1; 
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.2 * MASTER_VOL, t);
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
  // Simple lowpass filter for hit sound
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1000;
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  noise.start(t);
}

// Play wave clear sound
export function playWaveClearSound() {
  playOscillator('sine', [440, 554, 659, 880], [0.1, 0.1, 0.1, 0.4], [0.3, 0.3, 0.3, 0.3]);
}

// Play game over sound
export function playGameOverSound() {
  playOscillator('sawtooth', [200, 150, 100], [0.3, 0.3, 0.5], [0.3, 0.3, 0.3]);
}

// Initialize audio context (must be called on user interaction)
export function initAudio() {
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// Toggle mute state
export function toggleMute(): boolean {
  _muted = !_muted;
  return _muted;
}

// Get mute state
export function getMuted(): boolean {
  return _muted;
}
