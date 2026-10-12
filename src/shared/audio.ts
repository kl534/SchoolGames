import { getSetting, setSetting } from './progress';

/** Speech and sound effects share one device-wide mute setting. */
let muted = getSetting('muted') === '1';
const muteListeners = new Set<(muted: boolean) => void>();

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  setSetting('muted', value ? '1' : '0');
  if (value) stopSpeaking();
  muteListeners.forEach((listener) => listener(value));
}

export function onMuteChange(listener: (muted: boolean) => void): () => void {
  muteListeners.add(listener);
  return () => muteListeners.delete(listener);
}

// ---------- Speech ----------

const synth = (): SpeechSynthesis | undefined =>
  typeof speechSynthesis === 'undefined' ? undefined : speechSynthesis;

let voice: SpeechSynthesisVoice | null | undefined;

function pickVoice(s: SpeechSynthesis): SpeechSynthesisVoice | null {
  if (voice !== undefined) return voice;
  const voices = s.getVoices();
  if (voices.length === 0) return null; // Not loaded yet; try again next time.
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  voice =
    english.find((v) => v.lang === 'en-US' && v.localService) ??
    english.find((v) => v.lang === 'en-US') ??
    english[0] ??
    null;
  return voice;
}

/** Rough speaking time, used when the browser never fires `end`. */
const estimateMs = (text: string) => Math.min(800 + text.length * 80, 8000);

/**
 * Reads `text` aloud, interrupting anything already being said. `onEnd` runs once
 * when speech finishes, straight away when muted or unsupported.
 */
export function speak(text: string, onEnd?: () => void): void {
  let finished = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(timeout);
    onEnd?.();
  };
  const s = synth();
  if (muted || !s || !text) {
    timeout = setTimeout(finish, 0);
    return;
  }
  s.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const v = pickVoice(s);
  if (v) utterance.voice = v;
  utterance.lang = v?.lang ?? 'en-US';
  utterance.rate = 0.9;
  utterance.onend = finish;
  utterance.onerror = finish;
  timeout = setTimeout(finish, estimateMs(text));
  s.speak(utterance);
}

export function stopSpeaking(): void {
  synth()?.cancel();
}

// ---------- Sound effects (synthesised, no files) ----------

let context: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (context) return context;
  const Ctor = globalThis.AudioContext;
  if (!Ctor) return null;
  context = new Ctor();
  return context;
}

/**
 * Call from a tap handler before the first sound. iOS only allows audio and
 * speech that start inside a user gesture.
 */
export function unlockAudio(): void {
  const ctx = audioContext();
  if (ctx?.state === 'suspended') void ctx.resume();
  const s = synth();
  if (s && !muted) {
    const silent = new SpeechSynthesisUtterance(' ');
    silent.volume = 0;
    s.speak(silent);
  }
}

function tone(
  ctx: AudioContext,
  type: OscillatorType,
  from: number,
  to: number,
  start: number,
  duration: number,
  volume: number,
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  osc.frequency.exponentialRampToValueAtTime(to, start + duration);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function crowd(ctx: AudioContext, start: number, duration: number): void {
  const length = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 900;
  filter.Q.value = 0.7;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.001, start);
  gain.gain.exponentialRampToValueAtTime(0.35, start + 0.15);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start(start);
}

function play(fn: (ctx: AudioContext, now: number) => void): void {
  if (muted) return;
  const ctx = audioContext();
  if (!ctx || ctx.state !== 'running') return;
  fn(ctx, ctx.currentTime);
}

export const sfx = {
  kick: () => play((ctx, t) => tone(ctx, 'sine', 160, 45, t, 0.15, 0.9)),
  goal: () =>
    play((ctx, t) => {
      crowd(ctx, t, 1.6);
      [523, 659, 784, 1047].forEach((f, i) => tone(ctx, 'triangle', f, f, t + i * 0.1, 0.25, 0.25));
    }),
  miss: () =>
    play((ctx, t) => {
      tone(ctx, 'triangle', 392, 370, t, 0.25, 0.3);
      tone(ctx, 'triangle', 330, 220, t + 0.25, 0.45, 0.3);
    }),
  tick: () => play((ctx, t) => tone(ctx, 'square', 1200, 1200, t, 0.05, 0.08)),
};
