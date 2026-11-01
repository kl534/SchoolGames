import { preloadSpeech, speak, stopSpeaking } from './audio';
import { hideFactMap, showFactMap } from './maps';
import { createMissPicture, type MissPicture } from './pictures';
import { createTapGate, TAP_SPEECH } from './tapgate';
import { createTapMarks } from './tapmarks';
import { missSpeech, type Fact } from './topics';

export interface RevealOptions {
  /** What the finger and caption keep off besides the other answers (the banner, the question). */
  avoid?: readonly HTMLElement[];
  /** The question shown beside the finger, e.g. '5 + 5 = ?'; else a tap hint. Used only when there is no picture. */
  problem?: string;
  /**
   * A math fact is shown as a picture of the sum, counted aloud, before the fact is read (default
   * true). False keeps the plain caption.
   */
  picture?: boolean;
  /** Said before the fact, e.g. the umpire's call. */
  lead?: string;
  /** Game seconds before the reading starts (it holds while paused). */
  delay?: number;
  /** The wrong answer the player picked; undefined after a time-out. Picks the fact's wrong-answer line. */
  chosen?: string;
  /** The reading has ended and the flow is still waiting on this miss. */
  onRead?: () => void;
}

export interface TapFlow {
  readonly armed: boolean;
  /**
   * Marks the right answer and starts waiting for a tap on it. Call where the game shows the miss.
   * `avoid` lists what the finger and caption should keep off besides the other answers (the
   * banner with the fact, the question). `problem` is the question shown beside the finger; a
   * `Fact` shows its picture instead (a fact without one shows its prompt). With a picture the
   * game reads its own lines and calls `readFinished()`, which starts the counting.
   */
  arm(
    buttons: readonly HTMLElement[],
    correctIndex: number,
    avoid?: readonly HTMLElement[],
    problem?: string | Fact,
  ): void;
  /**
   * A miss on `fact`: arms on its answer among `options` and reads the fact out (`lead` first,
   * after `delay`, then the line for the wrong answer `chosen` if the fact has one; a math fact is
   * counted out in a picture between those and the fact). The
   * reminders start once the reading ends. A reading cut off by a disarm or a
   * new arm counts for nothing, so the game needs no turn checks of its own.
   */
  reveal(
    buttons: readonly HTMLElement[],
    options: readonly string[],
    fact: Fact,
    reveal?: RevealOptions,
  ): void;
  /**
   * The fact has been read out, for a game that reads it itself (call in the `speak` callback).
   * With a picture (`arm(..., fact)`) this starts the counting, and the reminders wait for it.
   */
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
  /** The picture of the current miss, and whether its counting has started. */
  let picture: MissPicture | null = null;
  let counting = false;
  /** Whether this flow put a map up, so it takes down only that one. */
  let mapShown = false;

  const dropPicture = () => {
    picture?.stop();
    picture = null;
    counting = false;
  };

  const armWith = (
    buttons: readonly HTMLElement[],
    correctIndex: number,
    avoid: readonly HTMLElement[] | undefined,
    problem: string | undefined,
    next: MissPicture | null,
  ) => {
    armId++;
    reading = null;
    dropPicture();
    // A map of an earlier miss goes; the new one, if any, is shown by the caller.
    if (mapShown) hideFactMap();
    mapShown = false;
    picture = next;
    gate.arm(correctIndex);
    marks.show(buttons, correctIndex, avoid, problem, next?.card);
  };

  const arm: TapFlow['arm'] = (buttons, correctIndex, avoid, problem) => {
    const fact = typeof problem === 'object' ? problem : undefined;
    const next = fact ? createMissPicture(fact) : null;
    armWith(
      buttons,
      correctIndex,
      avoid,
      typeof problem === 'object' ? problem.prompt : problem,
      next,
    );
    // Arming with a fact is a miss: the right state in green.
    if (fact?.map) mapShown = showFactMap(fact, {});
  };

  const stop = () => {
    armId++;
    reading = null;
    dropPicture();
    gate.disarm();
    if (mapShown) hideFactMap();
    mapShown = false;
  };

  return {
    get armed() {
      return gate.armed;
    },
    arm,
    reveal(
      buttons,
      options,
      fact,
      { avoid, problem, lead, chosen, delay = 0, onRead, picture: show = true } = {},
    ) {
      armWith(
        buttons,
        options.indexOf(fact.answer),
        avoid,
        problem,
        show ? createMissPicture(fact) : null,
      );
      if (fact.map) mapShown = showFactMap(fact, { wrong: chosen });
      const id = armId;
      const parts: ((next: () => void) => void)[] = [];
      const lines = missSpeech(fact, chosen);
      const statement = lines[lines.length - 1];
      if (lead) parts.push((next) => speak(lead, next));
      for (const line of lines.slice(0, -1)) parts.push((next) => speak(line, next));
      if (picture) {
        const shown = picture;
        parts.push((next) => {
          counting = true;
          shown.start(next);
        });
      }
      parts.push((next) => speak(statement, next));
      const say = (i: number) => {
        if (id !== armId) return;
        if (i < parts.length) {
          parts[i](() => say(i + 1));
          return;
        }
        gate.readFinished();
        onRead?.();
      };
      if (delay > 0) reading = { at: delay, start: () => say(0) };
      else say(0);
    },
    readFinished() {
      if (!picture) {
        gate.readFinished();
        return;
      }
      // The game has read its lines: now the picture counts, and the reminders wait for it.
      if (counting) return;
      counting = true;
      const id = armId;
      picture.start(() => {
        if (id === armId) gate.readFinished();
      });
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
      picture?.update(delta);
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
