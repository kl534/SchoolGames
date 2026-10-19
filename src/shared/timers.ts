export interface Timers {
  /** Runs `fn` once `seconds` of game time have passed. */
  after(seconds: number, fn: () => void): void;
  /**
   * Advances by the game's own `delta` (0 or not called while paused) and runs the timers that are
   * due. They come off the list first: a timer may clear the list or add new ones, and those stay.
   */
  update(delta: number): void;
  /** Drops every timer that has not run yet. */
  clear(): void;
}

/** Delayed calls that run on game time, so they hold while the game is paused. */
export function createTimers(): Timers {
  let now = 0;
  let pending: { at: number; fn: () => void }[] = [];

  return {
    after(seconds, fn) {
      pending.push({ at: now + seconds, fn });
    },
    update(delta) {
      now += delta;
      const due = pending.filter((p) => p.at <= now);
      if (!due.length) return;
      pending = pending.filter((p) => p.at > now);
      due.forEach((p) => p.fn());
    },
    clear() {
      pending = [];
    },
  };
}
