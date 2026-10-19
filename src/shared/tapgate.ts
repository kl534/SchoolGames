/** Seconds after a miss before a tap on the green answer is taken (stops accidental skips). */
export const TAP_GUARD = 0.6;
/** Seconds after the fact has been read before the first reminder. */
export const NUDGE_FIRST = 6;
/** Seconds between reminders after the first. */
export const NUDGE_EVERY = 10;
/** Shown on screen next to the green answer. */
export const TAP_CAPTION = 'Tap the green answer to go on';
/** Spoken as a reminder. Recorded clip: listed in `sharedLines()` in scripts/voice/lines.ts. */
export const TAP_SPEECH = 'Tap the green answer to go on.';

/** Absorbs the rounding of summed frame deltas (5.99 + 0.01 must count as 6). */
const EPSILON = 1e-9;

export type TapOutcome = 'go' | 'nope' | 'early' | 'idle';

export interface TapGate {
  readonly armed: boolean;
  /** -1 when not armed. */
  readonly correctIndex: number;
  /** Game seconds since `arm`. */
  readonly sinceArmed: number;
  /** Reminders given since `arm`. */
  readonly nudges: number;
  /** Starts waiting for a tap on `correctIndex`. Re-arming resets everything. */
  arm(correctIndex: number): void;
  /** Stops waiting. */
  disarm(): void;
  /** The fact has been read out: the idle count starts now (once per arm; later calls do nothing). */
  readFinished(): void;
  /** Advances by `delta` game seconds; returns 'nudge' on the frame a reminder is due, else null. */
  update(delta: number): 'nudge' | null;
  /** What a tap on answer `index` means. */
  tap(index: number): TapOutcome;
}

/**
 * The rules for "tap the green answer to go on", with no DOM and no audio: a short guard
 * against accidental taps, then the one right tap, and reminders while nobody taps.
 */
export function createTapGate(): TapGate {
  let armed = false;
  let correctIndex = -1;
  let sinceArmed = 0;
  let nudges = 0;
  let read = false;
  /** Seconds since the reading ended (or since the last wrong tap). */
  let idle = 0;
  /** `idle` at which the next reminder is due. */
  let nextAt = NUDGE_FIRST;

  return {
    get armed() {
      return armed;
    },
    get correctIndex() {
      return correctIndex;
    },
    get sinceArmed() {
      return sinceArmed;
    },
    get nudges() {
      return nudges;
    },
    arm(index) {
      armed = true;
      correctIndex = index;
      sinceArmed = 0;
      nudges = 0;
      read = false;
      idle = 0;
      nextAt = NUDGE_FIRST;
    },
    disarm() {
      armed = false;
      correctIndex = -1;
    },
    readFinished() {
      if (!armed || read) return;
      read = true;
      idle = 0;
      nextAt = NUDGE_FIRST;
    },
    update(delta) {
      if (!armed) return null;
      sinceArmed += delta;
      if (!read) return null;
      idle += delta;
      if (idle < nextAt - EPSILON) return null;
      nudges++;
      nextAt = idle + NUDGE_EVERY;
      return 'nudge';
    },
    tap(index) {
      if (!armed) return 'idle';
      if (sinceArmed < TAP_GUARD - EPSILON) return 'early';
      if (index === correctIndex) {
        armed = false;
        correctIndex = -1;
        return 'go';
      }
      idle = 0;
      nextAt = NUDGE_FIRST;
      return 'nope';
    },
  };
}
