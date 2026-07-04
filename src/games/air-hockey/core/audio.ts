/**
 * audio.ts — Web Audio API によるサウンド合成
 * ユーザージェスチャーで初期化し、外部ファイル不要で効果音を鳴らす
 */

let audioCtx: AudioContext | null = null;
let isMuted = false;

/** ユーザージェスチャー時に呼ぶ */
export function initAudio(): void {
  if (audioCtx) {
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return;
  }
  audioCtx = new AudioContext();
}

export function setMuted(muted: boolean): void {
  isMuted = muted;
}

export function getIsMuted(): boolean {
  return isMuted;
}

function playTone(freq: number, duration: number, type: OscillatorType = 'square', volume: number = 0.12): void {
  if (!audioCtx || isMuted) return;
  if (audioCtx.state === 'suspended') return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

/** パックがマレットに当たった音 */
export function playHit(): void {
  playTone(600, 0.08, 'square', 0.1);
}

/** パックが壁に当たった音 */
export function playWallHit(): void {
  playTone(300, 0.05, 'triangle', 0.06);
}

/** ゴール音 */
export function playGoal(): void {
  if (!audioCtx || isMuted) return;
  playTone(523, 0.12, 'sine', 0.15);
  setTimeout(() => playTone(659, 0.12, 'sine', 0.15), 80);
  setTimeout(() => playTone(784, 0.2, 'sine', 0.15), 160);
}

/** 分裂アイテム取得音 */
export function playSplit(): void {
  if (!audioCtx || isMuted) return;
  playTone(880, 0.06, 'sine', 0.12);
  setTimeout(() => playTone(1100, 0.06, 'sine', 0.12), 50);
  setTimeout(() => playTone(1320, 0.1, 'sine', 0.12), 100);
}

/** ラウンド勝利音 */
export function playRoundWin(): void {
  if (!audioCtx || isMuted) return;
  playTone(523, 0.15, 'sine', 0.12);
  setTimeout(() => playTone(659, 0.15, 'sine', 0.12), 120);
  setTimeout(() => playTone(784, 0.15, 'sine', 0.12), 240);
  setTimeout(() => playTone(1047, 0.3, 'sine', 0.15), 360);
}

/** ラウンド敗北音 */
export function playRoundLose(): void {
  if (!audioCtx || isMuted) return;
  playTone(400, 0.15, 'sine', 0.1);
  setTimeout(() => playTone(350, 0.15, 'sine', 0.1), 150);
  setTimeout(() => playTone(300, 0.3, 'sine', 0.1), 300);
}
