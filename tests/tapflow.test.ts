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
import { mathFact } from '../src/shared/topics/math';

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
  localStorage.clear();
  vi.mocked(speak).mockReset();
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

describe('tapflow with a picture', () => {
  const sum = mathFact('add', 8, 5);
  const spoken = () => vi.mocked(speak).mock.calls.map((call) => call[0]);
  /** Runs frames; each line ends right after the frame it was spoken in. */
  const play = (seconds: number, finish = true) => {
    let ended = vi.mocked(speak).mock.calls.length - 1;
    for (let t = 0; t < seconds; t += 0.05) {
      flow.update(0.05);
      const calls = vi.mocked(speak).mock.calls;
      if (finish && calls.length - 1 > ended) {
        ended = calls.length - 1;
        calls[ended][1]?.();
      }
    }
  };

  it('shows the card in place of the caption, and reads lead, counts, then the fact', () => {
    flow.reveal(buttons, ['13', '12', '14', '15'], sum, { lead: 'Out!', problem: 'ignored' });
    const pointer = document.querySelector<HTMLElement>('.sg-tap-pointer')!;
    expect(pointer.querySelector('.sg-pic-card')).not.toBeNull();
    expect(pointer.querySelector('.sg-tap-caption')!.textContent).toBe('');
    // The lead is being said; the counting waits for it.
    expect(spoken()).toEqual(['Out!']);
    vi.mocked(speak).mock.lastCall![1]!();
    play(4);
    expect(spoken()).toEqual([
      'Out!',
      '8.',
      '9.',
      '10.',
      '11.',
      '12.',
      '13.',
      '8 plus 5 equals 13.',
    ]);
  });

  it('starts the reminders only after the statement', () => {
    const onRead = vi.fn();
    flow.reveal(buttons, ['13', '12', '14', '15'], sum, { onRead });
    play(10, true);
    // Counting is over; the last line (the statement) is now being said and has ended.
    expect(onRead).toHaveBeenCalledTimes(1);
    flow.update(NUDGE_FIRST);
    expect(spoken().at(-1)).toBe(TAP_SPEECH);

    flow.disarm();
    vi.mocked(speak).mockClear();
    const late = vi.fn();
    flow.reveal(buttons, ['13', '12', '14', '15'], sum, { onRead: late });
    // The lines never end: no reminder, however long.
    play(30, false);
    expect(late).not.toHaveBeenCalled();
    expect(spoken()).not.toContain(TAP_SPEECH);
  });

  it('shows the next way for the next miss', () => {
    flow.reveal(buttons, ['13', '12', '14', '15'], sum);
    const first = document.querySelector('.sg-pic-card')!.innerHTML;
    flow.disarm();
    flow.reveal(buttons, ['13', '12', '14', '15'], sum);
    expect(document.querySelector('.sg-pic-card')!.innerHTML).not.toBe(first);
  });

  it('a tap on green removes the card and silences the counting', () => {
    flow.reveal(buttons, ['13', '12', '14', '15'], sum);
    play(1);
    const before = spoken().length;
    expect(flow.tap(0)).toBe(true);
    expect(stopSpeaking).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.sg-pic-card')).toBeNull();
    flow.update(5);
    vi.mocked(speak).mock.lastCall?.[1]?.();
    flow.update(5);
    expect(spoken().length).toBe(before);
  });

  it('keeps the plain pill for picture: false and for a fact without a picture', () => {
    flow.reveal(buttons, ['13', '12', '14', '15'], sum, { picture: false, problem: '8 + 5 = ?' });
    expect(document.querySelector('.sg-pic-card')).toBeNull();
    expect(document.querySelector('.sg-tap-caption')!.textContent).toBe('8 + 5 = ?');
    expect(spoken()).toEqual(['8 plus 5 equals 13.']);

    flow.disarm();
    vi.mocked(speak).mockClear();
    const word = { id: 'w', prompt: 'Spell it', answer: 'said', statement: 'said' };
    flow.reveal(buttons, ['said', 'sed'], word, { problem: 'Spell it' });
    expect(document.querySelector('.sg-pic-card')).toBeNull();
    expect(document.querySelector('.sg-tap-caption')!.textContent).toBe('Spell it');
    expect(spoken()).toEqual(['said']);
  });

  it('arm with a fact counts only once the game says it has read its lines', () => {
    flow.arm(buttons, 0, [], sum);
    expect(document.querySelector('.sg-pic-card')).not.toBeNull();
    play(3);
    expect(spoken()).toEqual([]);
    flow.readFinished();
    play(2);
    expect(spoken().slice(0, 2)).toEqual(['8.', '9.']);
    // The reminders wait for the end of the counting.
    play(2, false);
    flow.update(100);
    expect(spoken()).not.toContain(TAP_SPEECH);
    flow.disarm();
    expect(document.querySelector('.sg-pic-card')).toBeNull();
  });

  it('arm with a fact that has no picture shows its prompt', () => {
    const word = { id: 'w', prompt: 'Spell it', answer: 'said', statement: 'said' };
    flow.arm(buttons, 0, [], word);
    expect(document.querySelector('.sg-tap-caption')!.textContent).toBe('Spell it');
    flow.readFinished();
    flow.update(NUDGE_FIRST);
    expect(speak).toHaveBeenLastCalledWith(TAP_SPEECH);
  });

  it('holds while the game passes no time', () => {
    flow.reveal(buttons, ['13', '12', '14', '15'], sum);
    for (let i = 0; i < 100; i++) flow.update(0);
    expect(spoken()).toEqual([]);
  });
});
