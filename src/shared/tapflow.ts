import { speak, stopSpeaking } from './audio';
import { createTapGate, TAP_SPEECH } from './tapgate';
import { createTapMarks } from './tapmarks';

export interface TapFlow {
  readonly armed: boolean;
  /** Marks the right answer and starts waiting for a tap on it. Call where the game shows the miss. */
  arm(buttons: readonly HTMLElement[], correctIndex: number): void;
  /** The fact has been read out (call in the `speak(...)` callback). */
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

  return {
    get armed() {
      return gate.armed;
    },
    arm(buttons, correctIndex) {
      gate.arm(correctIndex);
      marks.show(buttons, correctIndex);
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
      marks.update();
    },
    tap(index) {
      const outcome = gate.tap(index);
      if (outcome === 'nope') marks.nope(index);
      if (outcome !== 'go') return false;
      stopSpeaking();
      marks.clear();
      return true;
    },
    disarm() {
      gate.disarm();
      marks.clear();
    },
    dispose() {
      gate.disarm();
      marks.dispose();
    },
  };
}
