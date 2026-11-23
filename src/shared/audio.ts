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

// ---------- Sound effects (synthesised, apart from the recorded cat sounds) ----------

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

/** How one cat call is shaped: its pitch path (Hz), length (s), vibrato and loudness. */
export interface CatCall {
  /** Pitch at the start, at the peak and at the end (Hz). */
  pitches: [number, number, number];
  duration: number;
  /** Where the pitch and the open mouth peak, as a fraction of the call. */
  peakAt: number;
  vibratoHz: number;
  /** Vibrato depth as a fraction of the pitch. */
  vibratoDepth: number;
  volume: number;
}

/** Curve samples per second for the pitch, mouth and loudness paths. */
const CAT_CURVE_RATE = 200;

const ease = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(Math.max(x, 0), 1));

/**
 * The paths of one cat call, sampled `CAT_CURVE_RATE` times a second: the pitch (Hz, with
 * vibrato and a little wobble from `random`), how open the mouth is (0 shut for the "m", 1 wide
 * for the "a", back to almost shut for the "ow") and the loudness (0 to 1).
 */
export function catCallCurves(
  call: CatCall,
  random: () => number = Math.random,
): { pitch: Float32Array; mouth: Float32Array; loud: Float32Array } {
  const n = Math.max(Math.ceil(call.duration * CAT_CURVE_RATE), 8);
  const pitch = new Float32Array(n);
  const mouth = new Float32Array(n);
  const loud = new Float32Array(n);
  const [p0, p1, p2] = call.pitches;
  // A slow random wobble so no two calls are quite the same (a real voice is never steady).
  let wobble = 0;
  let wobbleTarget = 0;
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1);
    const t = x * call.duration;
    const rise = x < call.peakAt ? ease(x / call.peakAt) : 1;
    const fall = x < call.peakAt ? 0 : ease((x - call.peakAt) / (1 - call.peakAt));
    const base = x < call.peakAt ? p0 + (p1 - p0) * rise : p1 + (p2 - p1) * fall;
    if (i % 10 === 0) wobbleTarget = (random() * 2 - 1) * 0.025;
    wobble += (wobbleTarget - wobble) * 0.12;
    // The vibrato grows in after the onset, as a cat's does when it holds a note.
    const vib = call.vibratoDepth * Math.sin(2 * Math.PI * call.vibratoHz * t) * ease(x * 3);
    pitch[i] = base * (1 + wobble + vib);
    // The mouth opens quickly a little after the "m" and closes slowly into the "ow".
    const open = ease((x - 0.04) / (call.peakAt * 0.9));
    const close = ease((x - call.peakAt) / (1 - call.peakAt));
    mouth[i] = open * (1 - 0.85 * close);
    // Loud as the mouth opens, a soft hum before it, and a tail that fades out.
    const attack = ease(x / 0.12);
    const release = 1 - ease((x - 0.7) / 0.3);
    loud[i] = attack * release * (0.35 + 0.65 * open);
  }
  return { pitch, mouth, loud };
}

/** A glottal-like buzz: every harmonic, each a little quieter than the last. */
function catSource(ctx: AudioContext): PeriodicWave {
  const count = 40;
  const real = new Float32Array(count + 1);
  const imag = new Float32Array(count + 1);
  for (let k = 1; k <= count; k++) imag[k] = 1 / k ** 1.15;
  return ctx.createPeriodicWave(real, imag);
}

/** The formants of a cat's mouth (Hz) when shut (`mouth` 0) and wide open (1), and their gain. */
const CAT_FORMANTS = [
  { shut: 650, open: 1400, q: 5, gain: 1 },
  { shut: 1700, open: 2700, q: 7, gain: 0.55 },
  { shut: 3400, open: 4300, q: 9, gain: 0.25 },
];

/**
 * A cat's voice: a buzz with a wobbling pitch through three formants that sweep as the mouth
 * opens and closes ("mi-a-ow"), a lowpass that muffles the "m", and a breath of noise.
 */
function catVoice(ctx: AudioContext, start: number, call: CatCall): void {
  const { pitch, mouth, loud } = catCallCurves(call);
  const end = start + call.duration;
  const osc = ctx.createOscillator();
  osc.setPeriodicWave(catSource(ctx));
  osc.frequency.setValueCurveAtTime(pitch, start, call.duration);
  const amp = ctx.createGain();
  amp.gain.value = 0;
  amp.gain.setValueCurveAtTime(
    loud.map((v) => v * call.volume),
    start,
    call.duration,
  );
  // The lips: shut they let only the low hum through, open they let the bright harmonics out.
  const lips = ctx.createBiquadFilter();
  lips.type = 'lowpass';
  lips.Q.value = 0.7;
  lips.frequency.value = 900;
  lips.frequency.setValueCurveAtTime(
    mouth.map((m) => 900 + 5100 * m),
    start,
    call.duration,
  );
  osc.connect(lips);
  const mix = ctx.createGain();
  mix.gain.value = 2.4;
  for (const f of CAT_FORMANTS) {
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = f.q;
    band.frequency.value = f.shut;
    band.frequency.setValueCurveAtTime(
      mouth.map((m) => f.shut + (f.open - f.shut) * m),
      start,
      call.duration,
    );
    const level = ctx.createGain();
    level.gain.value = f.gain;
    lips.connect(band).connect(level).connect(mix);
  }
  // A little of the plain buzz keeps the body of the voice under the formants.
  const body = ctx.createGain();
  body.gain.value = 0.12;
  lips.connect(body).connect(mix);
  // Breath: soft high noise that rides the loudness.
  const length = Math.floor(ctx.sampleRate * call.duration);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  const breath = ctx.createBufferSource();
  breath.buffer = buffer;
  const hiss = ctx.createBiquadFilter();
  hiss.type = 'bandpass';
  hiss.frequency.value = 3500;
  hiss.Q.value = 0.8;
  const breathLevel = ctx.createGain();
  breathLevel.gain.value = 0.05;
  breath.connect(hiss).connect(breathLevel).connect(mix);
  mix.connect(amp).connect(ctx.destination);
  osc.start(start);
  breath.start(start);
  osc.stop(end + 0.02);
  breath.stop(end + 0.02);
}

/** A cat call `base` with its pitch and length nudged at random so each one sounds a bit new. */
function varied(base: CatCall): CatCall {
  const tune = 0.92 + Math.random() * 0.16;
  return {
    ...base,
    pitches: base.pitches.map((p) => p * tune) as [number, number, number],
    duration: base.duration * (0.9 + Math.random() * 0.2),
  };
}

/** A friendly meow: "mi-a-ow" rising to about 780 Hz and falling, 0.55 s. */
export const MEOW: CatCall = {
  pitches: [560, 780, 520],
  duration: 0.55,
  peakAt: 0.35,
  vibratoHz: 0,
  vibratoDepth: 0,
  volume: 0.35,
};

/** A yowl of pain: a long wavering "mrrraaow", higher and with a wide vibrato, 0.95 s. */
export const YOWL: CatCall = {
  pitches: [480, 980, 420],
  duration: 0.95,
  peakAt: 0.45,
  vibratoHz: 6.5,
  vibratoDepth: 0.05,
  volume: 0.4,
};

/** A purr's breaths: out (louder, faster pulses), a pause, then in (softer, slower). */
export const PURR_BREATHS = [
  { from: 0, to: 0.5, rate: 26, level: 1 },
  { from: 0.56, to: 0.86, rate: 22, level: 0.55 },
];
/** How long a purr lasts (s). */
export const PURR_SECONDS = 0.9;

/**
 * The raw samples of a purr: a train of short rattles about 25 a second (a cat's larynx
 * snapping open and shut), each a decaying burst of noise and a low hum, swelling and fading
 * over each breath. `random` gives values in [0, 1).
 */
export function purrSamples(sampleRate: number, random: () => number = Math.random): Float32Array {
  const out = new Float32Array(Math.ceil(PURR_SECONDS * sampleRate));
  const decay = 0.007 * sampleRate;
  const burst = Math.ceil(decay * 5);
  for (const breath of PURR_BREATHS) {
    const span = breath.to - breath.from;
    let t = breath.from;
    while (t < breath.to) {
      const x = (t - breath.from) / span;
      // Each breath swells in and fades out; each pulse is a little louder or softer.
      const level = breath.level * Math.sin(Math.PI * x) ** 0.6 * (0.75 + 0.5 * random());
      const hum = 90 + random() * 40;
      const at = Math.floor(t * sampleRate);
      for (let j = 0; j < burst && at + j < out.length; j++) {
        const env = Math.exp(-j / decay);
        const tone = Math.sin((2 * Math.PI * hum * j) / sampleRate);
        out[at + j] += level * env * (0.6 * (random() * 2 - 1) + 0.5 * tone);
      }
      // The pulses are never quite even.
      t += (1 / breath.rate) * (0.9 + 0.2 * random());
    }
  }
  return out;
}

/** How long a hiss lasts (s). */
export const HISS_SECONDS = 0.75;

/**
 * The raw samples of a hiss: a sharp spit, then rough breathy noise that holds and fades.
 * The roughness is a loudness that flutters at random, as air rushing past teeth does.
 */
export function hissSamples(sampleRate: number, random: () => number = Math.random): Float32Array {
  const n = Math.ceil(HISS_SECONDS * sampleRate);
  const out = new Float32Array(n);
  let flutter = 1;
  let target = 1;
  const step = Math.floor(sampleRate / 60);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    if (i % step === 0) target = 0.55 + 0.45 * random();
    flutter += (target - flutter) * 0.004;
    // The spit: a loud crack in the first 40 ms.
    const spit = t < 0.04 ? 1.6 * Math.exp(-t / 0.012) : 0;
    // The breath rises fast, holds and fades out over the last half.
    const rise = Math.min(t / 0.05, 1);
    const fade =
      t < HISS_SECONDS * 0.45 ? 1 : 1 - (t - HISS_SECONDS * 0.45) / (HISS_SECONDS * 0.55);
    out[i] = (random() * 2 - 1) * (spit + 0.8 * rise * fade ** 1.5 * flutter);
  }
  return out;
}

/** Plays `samples` through `filters` (made fresh for this sound) at `volume`. */
function playSamples(
  ctx: AudioContext,
  start: number,
  samples: Float32Array,
  filters: BiquadFilterNode[],
  volume: number,
): void {
  const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
  buffer.getChannelData(0).set(samples);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = volume;
  let node: AudioNode = source;
  for (const f of filters) node = node.connect(f);
  node.connect(gain).connect(ctx.destination);
  source.start(start);
}

/** A biquad filter of `type` at `frequency` Hz with quality `q` (and `gain` dB for a peak). */
function biquad(
  ctx: BaseAudioContext,
  type: BiquadFilterType,
  frequency: number,
  q: number,
  gain = 0,
): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = frequency;
  f.Q.value = q;
  f.gain.value = gain;
  return f;
}

/** A purr (see `purrSamples`): the chest rumble kept, the top rolled off. */
function playPurr(ctx: AudioContext, t: number): void {
  playSamples(
    ctx,
    t,
    purrSamples(ctx.sampleRate),
    [biquad(ctx, 'lowpass', 1200, 0.7), biquad(ctx, 'peaking', 220, 1.2, 6)],
    0.9,
  );
}

/** A hiss (see `hissSamples`): bright, with the sharp edges of a cat's mouth at 3 and 6 kHz. */
function playHiss(ctx: AudioContext, t: number): void {
  playSamples(
    ctx,
    t,
    hissSamples(ctx.sampleRate),
    [
      biquad(ctx, 'highpass', 1400, 0.7),
      biquad(ctx, 'peaking', 3000, 2, 7),
      biquad(ctx, 'peaking', 6000, 2, 5),
    ],
    0.3,
  );
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

// ---------- Recorded sound effects ----------

/**
 * Real cat recordings in `public/sfx/cat/` (CC0, see its SOURCES.md), by sound. A sound plays
 * one of its files at random; until they load (or if they can't) the synthesised one plays.
 */
export const CAT_CLIPS = {
  meow: ['meow-1', 'meow-2', 'meow-3'],
  yowl: ['yowl'],
  hiss: ['hiss'],
} as const;

/** How loud the recordings play (they are loudness-normalised). */
const RECORDED_VOLUME = 0.8;

/** Each recording once it has loaded; null if it failed. */
const recordings = new Map<string, AudioBuffer | null>();
const recordingLoads = new Set<string>();

function loadRecording(file: string, ctx: AudioContext): void {
  if (recordingLoads.has(file)) return;
  recordingLoads.add(file);
  void fetch(`${import.meta.env.BASE_URL}sfx/cat/${file}.mp3`)
    .then((response) => (response.ok ? response.arrayBuffer() : null))
    .then((data) => (data ? ctx.decodeAudioData(data) : null))
    .catch(() => null)
    .then((buffer) => recordings.set(file, buffer));
}

/** Starts fetching the cat recordings so the first meow is a real one. */
export function preloadCatSounds(): void {
  const ctx = audioContext();
  if (!ctx) return;
  for (const files of Object.values(CAT_CLIPS)) for (const f of files) loadRecording(f, ctx);
}

/** The file each sound played last, so a meow doesn't repeat straight away. */
const lastRecording = new Map<readonly string[], string>();

/** Plays one of `files` at a slightly random speed, or `fallback` while none has loaded. */
function playRecording(files: readonly string[], fallback: () => void): void {
  if (muted) return;
  const ctx = audioContext();
  if (!ctx) return;
  for (const f of files) loadRecording(f, ctx);
  if (ctx.state !== 'running') return;
  const ready = files.filter((f) => recordings.get(f));
  if (ready.length === 0) return fallback();
  const fresh = ready.length > 1 ? ready.filter((f) => f !== lastRecording.get(files)) : ready;
  const file = fresh[Math.floor(Math.random() * fresh.length)];
  lastRecording.set(files, file);
  const source = ctx.createBufferSource();
  source.buffer = recordings.get(file) ?? null;
  source.playbackRate.value = 0.94 + Math.random() * 0.12;
  const gain = ctx.createGain();
  gain.gain.value = RECORDED_VOLUME;
  source.connect(gain).connect(ctx.destination);
  source.start();
}

/** The four low notes of the invaders' march (Hz). */
const MARCH_NOTES = [98, 87, 78, 73];

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
  /** A right key in a typing game: a short, soft blip. */
  key: () => play((ctx, t) => tone(ctx, 'sine', 900, 900, t, 0.03, 0.06)),
  /** The march of an invader formation: one of four low square notes, by `step % 4`. */
  march: (step: number) =>
    play((ctx, t) => {
      const f = MARCH_NOTES[((Math.floor(step) % 4) + 4) % 4];
      tone(ctx, 'square', f, f, t, 0.09, 0.14);
    }),
  /** A bolt leaving the cannon: a very short, quiet square blip sliding down. */
  zap: () => play((ctx, t) => tone(ctx, 'square', 1400, 600, t, 0.06, 0.05)),
  /** A flying saucer: a sine warble between 600 and 900 Hz. */
  ufo: () =>
    play((ctx, t) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      for (let i = 0; i < 6; i++) {
        osc.frequency.setValueAtTime(i % 2 === 0 ? 600 : 900, t + i * 0.075);
      }
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.1, t + 0.04);
      gain.gain.setValueAtTime(0.1, t + 0.4);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.46);
    }),
  /** A wrong key: a short low buzz. */
  wrongKey: () => play((ctx, t) => tone(ctx, 'square', 180, 140, t, 0.12, 0.12)),
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
  /** A big splash into water: a low rushing hiss, then a bright spatter on top. */
  splash: () =>
    play((ctx, t) => {
      noise(ctx, 'lowpass', 2600, 380, t, 0.6, 0.8);
      noise(ctx, 'bandpass', 1400, 3200, t + 0.04, 0.35, 0.35);
    }),
  /** A cartoon fall: a whistle sliding from high to low. */
  slideWhistle: () => play((ctx, t) => tone(ctx, 'sine', 1500, 250, t, 0.9, 0.2)),
  /** A rubbery balloon squeak: two quick chirps, the first sliding up and the second down. */
  squeak: () =>
    play((ctx, t) => {
      tone(ctx, 'sawtooth', 900, 1400, t, 0.08, 0.12);
      tone(ctx, 'sawtooth', 1300, 800, t + 0.09, 0.08, 0.12);
    }),
  /** A clown horn: two short square-wave honks, the second a fourth lower. */
  honk: () =>
    play((ctx, t) => {
      tone(ctx, 'square', 330, 330, t, 0.18, 0.18);
      tone(ctx, 'square', 247, 247, t + 0.18, 0.18, 0.18);
    }),
  /** Jelly wobbling: a low sine with a fast, deep vibrato that fades over 0.7 s. */
  wobble: () =>
    play((ctx, t) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 140;
      lfo.frequency.value = 9;
      depth.gain.value = 40;
      lfo.connect(depth).connect(osc.frequency);
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.7);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      lfo.start(t);
      osc.stop(t + 0.72);
      lfo.stop(t + 0.72);
    }),
  /** A T. rex roar: a low sawtooth sliding down through a lowpass, with a rumble of noise. */
  roar: () =>
    play((ctx, t) => {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, t);
      osc.frequency.linearRampToValueAtTime(70, t + 1.2);
      filter.type = 'lowpass';
      filter.frequency.value = 700;
      lfo.frequency.value = 6;
      depth.gain.value = 10;
      lfo.connect(depth).connect(osc.frequency);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.3, t + 0.06);
      gain.gain.linearRampToValueAtTime(0, t + 1.2);
      osc.connect(filter).connect(gain).connect(ctx.destination);
      osc.start(t);
      lfo.start(t);
      osc.stop(t + 1.22);
      lfo.stop(t + 1.22);
      noise(ctx, 'lowpass', 600, 200, t, 1.2, 0.3);
    }),
  /** A monkey's ooh-ooh-ah-ah: two rising chirps, then two falling ones. */
  monkey: () =>
    play((ctx, t) => {
      tone(ctx, 'triangle', 700, 1000, t, 0.11, 0.14);
      tone(ctx, 'triangle', 700, 1000, t + 0.14, 0.11, 0.14);
      tone(ctx, 'triangle', 1150, 800, t + 0.3, 0.11, 0.14);
      tone(ctx, 'triangle', 1150, 800, t + 0.42, 0.11, 0.14);
    }),
  /** A kitten's meow: one of three real recordings (`CAT_CLIPS`), synthesised until they load. */
  meow: () => playRecording(CAT_CLIPS.meow, () => play((ctx, t) => catVoice(ctx, t, varied(MEOW)))),
  /** A yowl: a long real meow (`CAT_CLIPS`), synthesised (see `YOWL`) until it loads. */
  yowl: () => playRecording(CAT_CLIPS.yowl, () => play((ctx, t) => catVoice(ctx, t, varied(YOWL)))),
  /** A purr: about 25 soft rattles a second, breathing out then in, 0.9 s (see `purrSamples`). */
  purr: () => play(playPurr),
  /** An angry hiss: a real recording (`CAT_CLIPS`), synthesised (`hissSamples`) until it loads. */
  hiss: () => playRecording(CAT_CLIPS.hiss, () => play(playHiss)),
  /** A school bell ringing for 1.6 s. */
  bell: () =>
    play((ctx, t) => {
      for (let i = 0; i < 20; i++) {
        tone(ctx, 'triangle', 2100, 2100, t + i * 0.08, 0.12, 0.18);
        tone(ctx, 'sine', 2650, 2650, t + i * 0.08, 0.1, 0.1);
      }
    }),
};
