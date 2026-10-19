import { preloadSpeech, speak, stopSpeaking } from './audio';
import { createTapGate, TAP_SPEECH } from './tapgate';
import { createTapMarks } from './tapmarks';
import { statementSpeech, type Fact } from './topics';

export interface RevealOptions {
  /** What the finger and caption keep off besides the other answers (the banner, the question). */
  avoid?: readonly HTMLElement[];
  /** The question shown beside the finger, e.g. '5 + 5 = ?'; else a tap hint. */
  problem?: string;
  /** Said before the fact, e.g. the umpire's call. */
  lead?: string;
  /** Game seconds before the reading starts (it holds while paused). */
  delay?: number;
  /** The reading has ended and the flow is still waiting on this miss. */
  onRead?: () => void;
}

export interface TapFlow {
  readonly armed: boolean;
  /**
   * Marks the right answer and starts waiting for a tap on it. Call where the game shows the miss.
   * `avoid` lists what the finger and caption should keep off besides the other answers (the
   * banner with the fact, the question). `problem` is the question shown beside the finger.
   */
  arm(
    buttons: readonly HTMLElement[],
    correctIndex: number,
    avoid?: readonly HTMLElement[],
    problem?: string,
  ): void;
  /**
   * A miss on `fact`: arms on its answer among `options` and reads the fact out (`lead` first,
   * after `delay`). The reminders start once the reading ends. A reading cut off by a disarm or a
   * new arm counts for nothing, so the game needs no turn checks of its own.
   */
  reveal(
    buttons: readonly HTMLElement[],
    options: readonly string[],
    fact: Fact,
    reveal?: RevealOptions,
  ): void;
  /** The fact has been read out, for a game that reads it itself (call in the `speak` callback). */
  readFinished(): void;
  /** Per frame, with the game's own delta (0 or not called while paused). Plays the reminder. */
  update(delta: number): void;
  /**
   * Call from the answer buttons' handler while armed. Returns true when the player tapped the
   * green answer after the guard: the flow has already disarmed and cleared the marks, stopped the
   * speech (`stopSpeaking()`), and the game must now move on. Otherwise returns false (and shakes
   * a dim answer).
   */
  tap(index: number): boolean;
  /** Stops waiting without a tap (a new turn, the game ended, a restart). Clears the marks. */
  disarm(): void;
  dispose(): void;
}

/**
 * After a wrong answer or a time-out a game waits for the player to tap the green answer.
 * This is the part games use: it joins the rules (`tapgate`) to the look (`tapmarks`).
 */
export function createTapFlow(container?: HTMLElement): TapFlow {
  const gate = createTapGate();
  const marks = createTapMarks(container);
  // So the first reminder starts the moment it is due.
  preloadSpeech([TAP_SPEECH]);
  /** Bumped by every arm and disarm, so a reading from an earlier miss knows it is stale. */
  let armId = 0;
  /** A reveal's reading waiting for its delay, in `gate.sinceArmed` seconds. */
  let reading: { at: number; start: () => void } | null = null;

  const arm: TapFlow['arm'] = (buttons, correctIndex, avoid, problem) => {
    armId++;
    reading = null;
    gate.arm(correctIndex);
    marks.show(buttons, correctIndex, avoid, problem);
  };

  const stop = () => {
    armId++;
    reading = null;
    gate.disarm();
  };

  return {
    get armed() {
      return gate.armed;
    },
    arm,
    reveal(buttons, options, fact, { avoid, problem, lead, delay = 0, onRead } = {}) {
      arm(buttons, options.indexOf(fact.answer), avoid, problem);
      const id = armId;
      const lines = lead ? [lead, statementSpeech(fact)] : [statementSpeech(fact)];
      const say = (i: number) => {
        if (id !== armId) return;
        if (i < lines.length) {
          speak(lines[i], () => say(i + 1));
          return;
        }
        gate.readFinished();
        onRead?.();
      };
      if (delay > 0) reading = { at: delay, start: () => say(0) };
      else say(0);
    },
    readFinished() {
      gate.readFinished();
    },
    update(delta) {
      if (!gate.armed) return;
      if (gate.update(delta) === 'nudge') {
        marks.nudge(gate.nudges);
        speak(TAP_SPEECH);
      }
      if (reading && gate.sinceArmed >= reading.at) {
        const { start } = reading;
        reading = null;
        start();
      }
      marks.update();
    },
    tap(index) {
      const outcome = gate.tap(index);
      if (outcome === 'nope') marks.nope(index);
      if (outcome !== 'go') return false;
      stop();
      stopSpeaking();
      marks.clear();
      return true;
    },
    disarm() {
      stop();
      marks.clear();
    },
    dispose() {
      stop();
      marks.dispose();
    },
  };
}
