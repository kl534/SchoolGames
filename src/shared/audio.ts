import { getSetting, setSetting } from './progress';
import { voiceKey } from './voice';
import voiceLines from './voice-lines.json';

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

/** Neural voices: Edge "Online (Natural)", Apple "(Enhanced)"/"(Premium)", etc. */
const NATURAL = /natural|neural|premium|enhanced|online/i;
/** Chrome's Google voices are streamed and far smoother than the OS defaults. */
const GOOGLE = /google/i;
/** Apple's better built-in voices, used when no enhanced voice is installed. */
const DECENT = /\b(samantha|ava|allison|alex|susan|tom|karen|daniel|moira|tessa|serena)\b/i;
/** eSpeak and Apple's novelty or formant voices sound robotic; never pick them. */
const ROBOTIC =
  /espeak|\b(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|kathy|ralph|princess|bruce|agnes|vicki|eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley)\b/i;

type VoiceInfo = Pick<SpeechSynthesisVoice, 'name' | 'lang' | 'default'>;

function voiceScore(v: VoiceInfo): number {
  const lang = v.lang.replace('_', '-').toLowerCase();
  if (!lang.startsWith('en') || ROBOTIC.test(v.name)) return -Infinity;
  let score = 0;
  if (NATURAL.test(v.name)) score += 100;
  if (GOOGLE.test(v.name)) score += 60;
  if (DECENT.test(v.name)) score += 20;
  if (lang === 'en-us') score += 5;
  else if (lang === 'en-gb' || lang === 'en-au') score += 3;
  if (v.default) score += 1;
  return score;
}

/** The most natural-sounding English voice, or null if there is none. */
export function bestVoice<V extends VoiceInfo>(voices: readonly V[]): V | null {
  let best: V | null = null;
  let bestScore = -Infinity;
  for (const v of voices) {
    const score = voiceScore(v);
    if (score > bestScore) {
      best = v;
      bestScore = score;
    }
  }
  return best;
}

let voice: SpeechSynthesisVoice | null | undefined;

function pickVoice(s: SpeechSynthesis): SpeechSynthesisVoice | null {
  if (voice !== undefined) return voice;
  const voices = s.getVoices();
  if (voices.length === 0) return null; // Not loaded yet; try again next time.
  voice = bestVoice(voices);
  return voice;
}

// Browsers load voices asynchronously (online voices can arrive late), so re-pick when they change.
synth()?.addEventListener?.('voiceschanged', () => {
  voice = undefined;
});

/** Rough speaking time, used when the browser never fires `end`. */
const estimateMs = (text: string) => Math.min(800 + text.length * 80, 8000);

// ---------- Pre-recorded clips ----------

/** Keys of the lines that have a recorded clip in `public/voice/` (see `npm run voice`). */
const CLIP_KEYS = new Set(Object.keys(voiceLines));
/** Give up on a clip that has not loaded by now and use the browser voice for that line. */
const CLIP_LOAD_MS = 2500;
/** Longest wait for a suspended AudioContext to resume before using the browser voice. */
const CLIP_RESUME_MS = 400;

const clips = new Map<string, Promise<AudioBuffer | null>>();

function loadClip(key: string, ctx: AudioContext): Promise<AudioBuffer | null> {
  let clip = clips.get(key);
  if (!clip) {
    clip = fetch(`${import.meta.env.BASE_URL}voice/${key}.mp3`)
      .then((response) => (response.ok ? response.arrayBuffer() : null))
      .then((data) => (data ? ctx.decodeAudioData(data) : null))
      .catch(() => null);
    clips.set(key, clip);
  }
  return clip;
}

/** Starts fetching the clips for these lines (those that have one) so they play without a wait. */
export function preloadSpeech(texts: string[]): void {
  const ctx = audioContext();
  if (!ctx) return;
  for (const text of texts) {
    const key = voiceKey(text);
    if (CLIP_KEYS.has(key)) void loadClip(key, ctx);
  }
}

/** Resolves with `fallback` if `promise` has not settled after `ms`. */
function within<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    void promise.then((value) => {
      clearTimeout(timer);
      resolve(value);
    });
  });
}

/** Bumped by every `speak` and `stopSpeaking`, so a clip that loads late knows it was replaced. */
let speechToken = 0;
/** Stops the clip that is loading or playing and ends its `speak` call. */
let stopClip: (() => void) | null = null;

/**
 * Reads `text` aloud, interrupting anything already being said. `onEnd` runs once
 * when speech finishes, straight away when muted or unsupported. Lines with a recorded clip
 * play it; anything else, or a clip that can't play, uses the browser's voice.
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
  if (muted || !text) {
    timeout = setTimeout(finish, 0);
    return;
  }
  const token = ++speechToken;
  stopClip?.();
  stopClip = null;
  s?.cancel();

  /** The browser's voice; finishes straight away when there is none. */
  const sayWithBrowser = () => {
    if (!s) {
      timeout = setTimeout(finish, 0);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    const v = pickVoice(s);
    if (v) utterance.voice = v;
    utterance.lang = v?.lang ?? 'en-US';
    utterance.rate = 0.9;
    utterance.onend = finish;
    utterance.onerror = finish;
    timeout = setTimeout(finish, estimateMs(text));
    s.speak(utterance);
  };

  const key = voiceKey(text);
  const ctx = CLIP_KEYS.has(key) ? audioContext() : null;
  if (!ctx) {
    sayWithBrowser();
    return;
  }

  let source: AudioBufferSourceNode | undefined;
  stopClip = () => {
    // Like a cancelled utterance, the interrupted call ends on a later tick.
    try {
      source?.stop();
    } catch {
      // Already stopped.
    }
    timeout = setTimeout(finish, 0);
  };
  void (async () => {
    const buffer = await within(loadClip(key, ctx), CLIP_LOAD_MS, null);
    if (ctx.state !== 'running' && token === speechToken) {
      await within(
        ctx.resume().catch(() => undefined),
        CLIP_RESUME_MS,
        undefined,
      );
    }
    if (token !== speechToken) return finish();
    if (!buffer || ctx.state !== 'running') return sayWithBrowser();
    source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = finish;
    timeout = setTimeout(finish, buffer.duration * 1000 + 1000);
    source.start();
  })();
}

/** Stops the voice, whether a recording or the browser's; the interrupted `speak` still ends. */
export function stopSpeaking(): void {
  speechToken++;
  stopClip?.();
  stopClip = null;
  synth()?.cancel();
}

// ---------- Sound effects (synthesised, no files) ----------

let context: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (context) return context;
  const Ctor = globalThis.AudioContext;
  if (!Ctor) return null;
  // Leave navigator.audioSession alone: on iPad, 'playback' let the browser voice interrupt
  // Web Audio for good, which silenced every clip and sound effect after the first tap.
  context = new Ctor();
  return context;
}

/** Resumes audio that is suspended or, in Safari, 'interrupted' (Siri, a call, the browser voice). */
function resumeAudio(): void {
  if (context && context.state !== 'running') void context.resume().catch(() => undefined);
}

// Any tap can bring audio back after an interruption, even one in a game that never unlocks again.
for (const type of ['pointerup', 'touchend', 'keydown']) {
  globalThis.document?.addEventListener(type, resumeAudio, { capture: true, passive: true });
}

/** The browser voice only needs waking inside a tap once; doing it on every tap disturbs iOS audio. */
let speechUnlocked = false;

/**
 * Call from a tap handler before the first sound. iOS only allows audio and
 * speech that start inside a user gesture.
 */
export function unlockAudio(): void {
  audioContext();
  resumeAudio();
  const s = synth();
  if (s && !muted && !speechUnlocked) {
    speechUnlocked = true;
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

function crowd(ctx: AudioContext, start: number, duration: number, volume = 0.35): void {
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
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.15);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start(start);
}

/** A burst of filtered noise whose filter sweeps from `from` to `to` Hz while it fades out. */
function noise(
  ctx: AudioContext,
  type: BiquadFilterType,
  from: number,
  to: number,
  start: number,
  duration: number,
  volume: number,
): void {
  const length = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(from, start);
  filter.frequency.exponentialRampToValueAtTime(to, start + duration);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start(start);
}

/** A low, wobbly moan: a sawtooth sliding down with a slow vibrato. */
function moan(ctx: AudioContext, start: number, duration: number, volume: number): void {
  const osc = ctx.createOscillator();
  const vibrato = ctx.createOscillator();
  const depth = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(130, start);
  osc.frequency.exponentialRampToValueAtTime(70, start + duration);
  vibrato.frequency.value = 7;
  depth.gain.value = 9;
  filter.type = 'lowpass';
  filter.frequency.value = 600;
  gain.gain.setValueAtTime(0.001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.12);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  vibrato.connect(depth).connect(osc.frequency);
  osc.connect(filter).connect(gain).connect(ctx.destination);
  osc.start(start);
  vibrato.start(start);
  osc.stop(start + duration + 0.02);
  vibrato.stop(start + duration + 0.02);
}

/** Low rumbling noise: it swells in over 0.15 s, holds, and fades out over the last 0.3 s. */
function rumble(ctx: AudioContext, start: number, duration: number, volume: number): void {
  const length = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 180;
  const gain = ctx.createGain();
  const fade = Math.min(0.3, duration / 2);
  gain.gain.setValueAtTime(0.001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + Math.min(0.15, duration / 2));
  gain.gain.setValueAtTime(volume, start + duration - fade);
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
  /** A thrown object whistling through the air. */
  whoosh: () => play((ctx, t) => noise(ctx, 'bandpass', 500, 2600, t, 0.3, 0.5)),
  /** A cartoon explosion: a rumbling noise burst over a deep thump. */
  boom: () =>
    play((ctx, t) => {
      noise(ctx, 'lowpass', 2400, 110, t, 0.9, 1);
      tone(ctx, 'sine', 140, 32, t, 0.6, 0.9);
    }),
  /** A dud: a hiss and a sad slide down. */
  fizz: () =>
    play((ctx, t) => {
      noise(ctx, 'highpass', 3500, 1800, t, 0.8, 0.35);
      tone(ctx, 'triangle', 700, 160, t, 0.7, 0.15);
    }),
  /** Wood splintering and a heavy thump as a zombie smashes through the fence. */
  crash: () =>
    play((ctx, t) => {
      noise(ctx, 'lowpass', 3200, 300, t, 0.45, 0.9);
      tone(ctx, 'sine', 120, 38, t, 0.4, 0.9);
    }),
  /** A silly zombie groan. */
  groan: () => play((ctx, t) => moan(ctx, t, 0.9, 0.22)),
  /** A laser bolt: a quick high "pew" sliding down. */
  laser: () =>
    play((ctx, t) => {
      tone(ctx, 'sawtooth', 1800, 260, t, 0.22, 0.16);
      tone(ctx, 'square', 900, 130, t, 0.18, 0.08);
    }),
  /** The ship's shield taking a hit: an electric zap over a heavy thud. */
  shieldHit: () =>
    play((ctx, t) => {
      noise(ctx, 'bandpass', 4200, 600, t, 0.35, 0.6);
      tone(ctx, 'sawtooth', 220, 60, t, 0.3, 0.3);
      tone(ctx, 'sine', 110, 35, t, 0.45, 0.9);
    }),
  /** A crystal pickup: a short, bright rising arpeggio. */
  chime: () =>
    play((ctx, t) => {
      [784, 988, 1319, 1568].forEach((f, i) => tone(ctx, 'sine', f, f, t + i * 0.055, 0.2, 0.2));
    }),
  /** A boss warning: a two-tone siren, high-low, twice. */
  alarm: () =>
    play((ctx, t) => {
      for (let i = 0; i < 4; i++) {
        const f = i % 2 === 0 ? 880 : 620;
        tone(ctx, 'square', f, f, t + i * 0.28, 0.26, 0.12);
      }
    }),
  /** A bat cracking a ball: a sharp click over a short, woody thump. */
  bat: () =>
    play((ctx, t) => {
      noise(ctx, 'bandpass', 3400, 1100, t, 0.09, 0.9);
      tone(ctx, 'square', 1500, 320, t, 0.07, 0.22);
      tone(ctx, 'sine', 230, 85, t, 0.15, 0.85);
    }),
  /** A ball slapping into a catcher's mitt: a dull pop. */
  glove: () =>
    play((ctx, t) => {
      noise(ctx, 'lowpass', 1800, 260, t, 0.13, 0.9);
      tone(ctx, 'sine', 180, 65, t, 0.16, 0.9);
    }),
  /** A goal horn: two detuned sawtooth tones held for 1.8 s, over a crowd roar. */
  horn: () =>
    play((ctx, t) => {
      tone(ctx, 'sawtooth', 180, 180, t, 1.8, 0.22);
      tone(ctx, 'sawtooth', 183, 183, t, 1.8, 0.22);
      crowd(ctx, t, 2.4, 0.5);
    }),
  /** A stick on a puck: a sharp click and a crack. */
  slap: (volume = 1) =>
    play((ctx, t) => {
      noise(ctx, 'highpass', 3800, 2400, t, 0.05, 0.8 * volume);
      tone(ctx, 'square', 2100, 500, t, 0.05, 0.16 * volume);
      tone(ctx, 'sine', 320, 140, t, 0.08, 0.4 * volume);
    }),
  /** A body check into the boards: low noise over a 90 Hz thump. */
  thud: () =>
    play((ctx, t) => {
      noise(ctx, 'lowpass', 900, 150, t, 0.25, 0.9);
      tone(ctx, 'sine', 90, 50, t, 0.3, 0.9);
    }),
  /** The crowd's let-down when the other side scores: falling crowd noise. */
  aww: () =>
    play((ctx, t) => {
      crowd(ctx, t, 1.2, 0.4);
      tone(ctx, 'triangle', 330, 180, t, 1.0, 0.12);
    }),
  /** A crowd cheering for a hit. */
  cheer: () =>
    play((ctx, t) => {
      crowd(ctx, t, 1.5, 0.45);
      [392, 523, 659].forEach((f, i) => tone(ctx, 'triangle', f, f, t + i * 0.09, 0.2, 0.15));
    }),
  /** A big roar for a home run, with a fanfare on top. */
  bigCheer: () =>
    play((ctx, t) => {
      crowd(ctx, t, 3.2, 0.7);
      crowd(ctx, t + 0.25, 2.6, 0.5);
      [523, 659, 784, 1047, 1319].forEach((f, i) =>
        tone(ctx, 'triangle', f, f, t + i * 0.11, 0.3, 0.22),
      );
    }),
  /** A firework bursting: a boom and a crackle. */
  firework: () =>
    play((ctx, t) => {
      noise(ctx, 'lowpass', 1200, 140, t, 0.5, 0.7);
      tone(ctx, 'sine', 130, 40, t, 0.4, 0.7);
      noise(ctx, 'highpass', 5200, 2600, t + 0.12, 0.5, 0.22);
    }),
  /** A small crash: a bump into a space rock. */
  bump: () =>
    play((ctx, t) => {
      noise(ctx, 'lowpass', 1800, 200, t, 0.3, 0.7);
      tone(ctx, 'sine', 150, 50, t, 0.25, 0.6);
    }),
  /** A bowling ball rumbling down the lane: low noise held for `seconds`, then fading. */
  roll: (seconds: number) => play((ctx, t) => rumble(ctx, t, seconds, 0.35)),
  /** Pins crashing: a burst of short wooden clacks over a low thump. */
  pins: () =>
    play((ctx, t) => {
      for (let i = 0; i < 14; i++) {
        const f = 1800 + Math.random() * 1800;
        noise(ctx, 'bandpass', f, f, t + Math.random() * 0.35, 0.04 + Math.random() * 0.04, 0.5);
      }
      tone(ctx, 'sine', 180, 70, t, 0.25, 0.7);
    }),
  /** A motorbike revving up: a rising engine growl over a rush of low noise. */
  rev: () =>
    play((ctx, t) => {
      tone(ctx, 'sawtooth', 90, 260, t, 0.6, 0.25);
      noise(ctx, 'lowpass', 400, 900, t, 0.6, 0.3);
    }),
  /** A big spring: a sine sliding up and down, with a second tone a few Hz away for the wobble. */
  boing: () =>
    play((ctx, t) => {
      for (const detune of [0, 6]) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(220 + detune, t);
        osc.frequency.exponentialRampToValueAtTime(520 + detune, t + 0.15);
        osc.frequency.exponentialRampToValueAtTime(180 + detune, t + 0.45);
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.47);
      }
    }),
  /** Something wet hitting something hard: a slap of noise over a soft thump. */
  splat: () =>
    play((ctx, t) => {
      noise(ctx, 'lowpass', 1400, 200, t, 0.25, 0.9);
      tone(ctx, 'sine', 150, 50, t, 0.25, 0.8);
    }),
  /** A cartoon fall: a whistle sliding from high to low. */
  slideWhistle: () => play((ctx, t) => tone(ctx, 'sine', 1500, 250, t, 0.9, 0.2)),
  /** A clown horn: two short square-wave honks, the second a fourth lower. */
  honk: () =>
    play((ctx, t) => {
      tone(ctx, 'square', 330, 330, t, 0.18, 0.18);
      tone(ctx, 'square', 247, 247, t + 0.18, 0.18, 0.18);
    }),
};
