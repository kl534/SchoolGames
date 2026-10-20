import { countSpeech, MOVE, type Picture } from './plan';

export { MOVE };
/** Seconds: the shortest step (also a silent step's length). */
export const STEP_MIN = 0.4;
/** Seconds: the answer pop and confetti. */
export const FINALE = 0.4;

export interface PlayerState {
  phase: 'waiting' | 'counting' | 'finale' | 'done';
  /** Steps finished. */
  done: number;
  /** How far the next step's move has gone (0 to 1). */
  p: number;
  /** Seconds since the player was made; always advances (for the wiggle and the intro). */
  t: number;
  /** The latest count said. */
  count: number | null;
  caption?: string;
}

export interface PicturePlayer {
  readonly state: PlayerState;
  /** waiting to counting. `onDone` runs once, after the finale. */
  start(onDone: () => void): void;
  /** Game seconds; 0 holds everything. */
  update(delta: number): void;
  /** No more `say` or `onDone` calls. */
  stop(): void;
}

/**
 * Plays a picture's steps: each count is said aloud as its move starts (voice and move overlap);
 * the next step starts when the move has landed, the count has been said and the step has lasted
 * `STEP_MIN`. The state says what to draw.
 */
export function createPicturePlayer(
  picture: Picture,
  say: (text: string, onEnd: () => void) => void,
): PicturePlayer {
  const state: PlayerState = { phase: 'waiting', done: 0, p: 0, t: 0, count: null };
  let stopped = false;
  let onDone: (() => void) | undefined;
  /** Seconds into the current step, or into the finale. */
  let local = 0;
  let landed = false;
  let spoken = false;
  /** The current step's count has been handed to `say`. */
  let started = false;

  const begin = (count: number | null) => {
    started = true;
    if (count === null) {
      spoken = true;
      return;
    }
    say(countSpeech(count), () => {
      if (!stopped) spoken = true;
    });
  };

  const land = () => {
    const step = picture.steps[state.done];
    landed = true;
    state.p = 1;
    state.caption = step.caption;
    if (step.count !== null) state.count = step.count;
  };

  return {
    state,
    start(done) {
      if (state.phase !== 'waiting' || stopped) return;
      onDone = done;
      state.phase = 'counting';
      local = 0;
    },
    update(delta) {
      if (stopped || delta <= 0) return;
      state.t += delta;
      if (state.phase === 'counting') {
        local += delta;
        const step = picture.steps[state.done];
        if (!started) begin(step.count);
        if (!landed) {
          state.p = Math.min(1, local / (step.move ?? MOVE));
          if (state.p >= 1) land();
        }
        if (landed && spoken && local >= STEP_MIN) {
          state.done++;
          state.p = 0;
          local = 0;
          landed = false;
          spoken = false;
          started = false;
          if (state.done >= picture.steps.length) state.phase = 'finale';
        }
      } else if (state.phase === 'finale') {
        local += delta;
        if (local >= FINALE) {
          state.phase = 'done';
          const finish = onDone;
          onDone = undefined;
          finish?.();
        }
      }
    },
    stop() {
      stopped = true;
      onDone = undefined;
    },
  };
}
