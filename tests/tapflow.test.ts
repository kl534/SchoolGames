// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NUDGE_EVERY, NUDGE_FIRST, TAP_GUARD, TAP_SPEECH } from '../src/shared/tapgate';

vi.mock('../src/shared/audio', () => ({
  preloadSpeech: vi.fn(),
  speak: vi.fn(),
  stopSpeaking: vi.fn(),
}));

import { preloadSpeech, speak, stopSpeaking } from '../src/shared/audio';
import { createTapFlow, type TapFlow } from '../src/shared/tapflow';

function makeButtons(): HTMLButtonElement[] {
  return Array.from({ length: 4 }, () => {
    const button = document.createElement('button');
    button.className = 'game-answer';
    document.body.appendChild(button);
    return button;
  });
}

let flow: TapFlow;
let buttons: HTMLButtonElement[];

beforeEach(() => {
  vi.mocked(speak).mockClear();
  vi.mocked(stopSpeaking).mockClear();
  buttons = makeButtons();
  flow = createTapFlow();
});

afterEach(() => {
  flow.dispose();
  document.body.replaceChildren();
});

describe('tapflow', () => {
  it('loads the reminder clip up front', () => {
    expect(preloadSpeech).toHaveBeenCalledWith([TAP_SPEECH]);
  });

  it('arm marks the right answer and waits', () => {
    expect(flow.armed).toBe(false);
    flow.arm(buttons, 2);
    expect(flow.armed).toBe(true);
    expect(buttons[2].classList.contains('sg-tap-correct')).toBe(true);
    expect(buttons[0].classList.contains('sg-tap-dim')).toBe(true);
  });

  it('ignores a tap inside the guard', () => {
    flow.arm(buttons, 2);
    flow.update(TAP_GUARD - 0.1);
    expect(flow.tap(2)).toBe(false);
    expect(flow.armed).toBe(true);
    expect(stopSpeaking).not.toHaveBeenCalled();
    expect(speak).not.toHaveBeenCalled();
  });

  it('goes on the green answer: stops the speech, clears the marks, disarms', () => {
    flow.arm(buttons, 2);
    flow.update(TAP_GUARD);
    expect(flow.tap(2)).toBe(true);
    expect(stopSpeaking).toHaveBeenCalledTimes(1);
    expect(flow.armed).toBe(false);
    expect(buttons.every((b) => b.className === 'game-answer')).toBe(true);
    expect(document.querySelector<HTMLElement>('.sg-tap-pointer')!.hidden).toBe(true);
    // A second tap does nothing.
    expect(flow.tap(2)).toBe(false);
    expect(stopSpeaking).toHaveBeenCalledTimes(1);
  });

  it('shakes a dim answer and keeps waiting', () => {
    flow.arm(buttons, 2);
    flow.update(TAP_GUARD);
    expect(flow.tap(0)).toBe(false);
    expect(flow.armed).toBe(true);
    expect(buttons[0].classList.contains('sg-tap-nope')).toBe(true);
    expect(buttons[2].classList.contains('sg-tap-hint')).toBe(true);
    expect(stopSpeaking).not.toHaveBeenCalled();
  });

  it('does nothing when it is not armed', () => {
    expect(flow.tap(0)).toBe(false);
    flow.update(100);
    flow.readFinished();
    expect(speak).not.toHaveBeenCalled();
    expect(stopSpeaking).not.toHaveBeenCalled();
  });

  it('reminds at 6 s and 16 s after the reading ends, never before', () => {
    flow.arm(buttons, 1);
    for (let i = 0; i < 100; i++) flow.update(1);
    expect(speak).not.toHaveBeenCalled();
    flow.readFinished();
    flow.update(NUDGE_FIRST - 0.01);
    expect(speak).not.toHaveBeenCalled();
    flow.update(0.01);
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenLastCalledWith(TAP_SPEECH);
    expect(buttons[1].classList.contains('sg-tap-step-1')).toBe(true);
    flow.update(NUDGE_EVERY - 0.01);
    expect(speak).toHaveBeenCalledTimes(1);
    flow.update(0.01);
    expect(speak).toHaveBeenCalledTimes(2);
    expect(buttons[1].classList.contains('sg-tap-step-2')).toBe(true);
    expect(buttons[1].classList.contains('sg-tap-step-1')).toBe(false);
  });

  it('disarm clears the marks and stops the reminders', () => {
    flow.arm(buttons, 1);
    flow.readFinished();
    flow.disarm();
    expect(flow.armed).toBe(false);
    expect(buttons.every((b) => b.className === 'game-answer')).toBe(true);
    flow.update(100);
    expect(speak).not.toHaveBeenCalled();
    flow.disarm();
  });

  it('arm again replaces the earlier arm', () => {
    flow.arm(buttons, 1);
    flow.update(5);
    flow.arm(buttons, 3);
    expect(buttons[1].classList.contains('sg-tap-correct')).toBe(false);
    expect(buttons[3].classList.contains('sg-tap-correct')).toBe(true);
    // The guard starts again.
    expect(flow.tap(3)).toBe(false);
    expect(flow.armed).toBe(true);
  });

  const fact = {
    id: 'f',
    prompt: '2 + 2 = ?',
    answer: '4',
    statement: '2 + 2 = 4',
    spokenStatement: '2 plus 2 is 4',
  };

  /** Ends the last `speak` call, as the voice would when the line is over. */
  const endSpeech = () => vi.mocked(speak).mock.lastCall?.[1]?.();

  it('reveal arms on the answer and reads the fact after the delay', () => {
    const onRead = vi.fn();
    flow.reveal(buttons, ['1', '3', '4', '5'], fact, { delay: 0.6, onRead });
    expect(buttons[2].classList.contains('sg-tap-correct')).toBe(true);
    flow.update(0.5);
    expect(speak).not.toHaveBeenCalled();
    flow.update(0.1);
    expect(speak).toHaveBeenLastCalledWith('2 plus 2 is 4', expect.any(Function));
    endSpeech();
    expect(onRead).toHaveBeenCalledTimes(1);
    // The reminders count from the end of the reading.
    flow.update(NUDGE_FIRST);
    expect(speak).toHaveBeenLastCalledWith(TAP_SPEECH);
  });

  it('reveal says the lead line first', () => {
    flow.reveal(buttons, ['4', '3'], fact, { lead: 'Strike three!' });
    expect(speak).toHaveBeenLastCalledWith('Strike three!', expect.any(Function));
    endSpeech();
    expect(speak).toHaveBeenLastCalledWith('2 plus 2 is 4', expect.any(Function));
  });

  it('a reading cut off by a disarm or a new arm counts for nothing', () => {
    const onRead = vi.fn();
    flow.reveal(buttons, ['4', '3'], fact, { lead: 'Out!', onRead });
    const endLead = vi.mocked(speak).mock.lastCall![1]!;
    flow.disarm();
    endLead();
    expect(speak).toHaveBeenCalledTimes(1);

    flow.reveal(buttons, ['4', '3'], fact, { onRead });
    const endFirst = vi.mocked(speak).mock.lastCall![1]!;
    flow.arm(buttons, 1);
    endFirst();
    expect(onRead).not.toHaveBeenCalled();
    // So the new arm's reminders still wait for its own reading.
    flow.update(100);
    expect(speak).toHaveBeenCalledTimes(2);
  });

  it('a delayed reading never starts once the green answer was tapped', () => {
    flow.reveal(buttons, ['4', '3'], fact, { delay: 1 });
    flow.update(TAP_GUARD);
    expect(flow.tap(0)).toBe(true);
    flow.update(5);
    expect(speak).not.toHaveBeenCalled();
  });

  it('dispose removes the pointer', () => {
    flow.arm(buttons, 1);
    flow.dispose();
    expect(document.querySelector('.sg-tap-pointer')).toBeNull();
  });
});
