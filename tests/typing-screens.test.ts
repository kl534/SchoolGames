// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/shared/audio', () => ({
  sfx: { key: vi.fn(), wrongKey: vi.fn() },
  stopSpeaking: vi.fn(),
}));

import { sfx } from '../src/shared/audio';
import { seededRandom } from '../src/shared/random';
import { createBlockView } from '../src/shared/typing/block';
import { levelOf } from '../src/shared/typing/course';
import { createKeyboard } from '../src/shared/typing/keyboard';
import { reachCycle, reachPhase } from '../src/shared/typing/keyboard-layout';
import { isTypingKey, onTypingKey } from '../src/shared/typing/keys';
import {
  knownBefore,
  lessonSteps,
  showKeyLesson,
  tryText,
  type KeyLesson,
} from '../src/shared/typing/lesson';
import { HOME_REST_LINE, HOME_ROW_LINE, TYPING_VOICE_LINES } from '../src/shared/typing/lines';
import { chipTitle, showLevelPicker, testOutAsk } from '../src/shared/typing/picker';
import { emptyTyping } from '../src/shared/typing/progress';
import { showTestOut, testPassed } from '../src/shared/typing/testout';
import { TYPING_LEVELS } from '../src/shared/typing/course';

function press(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  window.dispatchEvent(event);
  return event;
}

const typeText = (text: string) => [...text].forEach((c) => press(c));
const blockText = (root: ParentNode): string =>
  [...root.querySelectorAll('.tb-key')]
    .map((k) => (k.textContent === '␣' ? ' ' : k.textContent))
    .join('');

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
});

/** Screens a test opened: they listen on the window, so each is closed after the test. */
const live: { dispose(): void }[] = [];
const track = <T extends { dispose(): void }>(screen: T): T => {
  live.push(screen);
  return screen;
};

afterEach(() => {
  live.splice(0).forEach((screen) => screen.dispose());
  document.body.replaceChildren();
  vi.mocked(sfx.key).mockClear();
  vi.mocked(sfx.wrongKey).mockClear();
  vi.unstubAllGlobals();
});

describe('onTypingKey', () => {
  it('hands over one-char keys and cancels them', () => {
    const typed: string[] = [];
    const stop = onTypingKey((c) => typed.push(c));
    expect(press('f').defaultPrevented).toBe(true);
    press(' ');
    press('F', { shiftKey: true });
    press('?');
    expect(typed).toEqual(['f', ' ', 'F', '?']);
    stop();
    press('x');
    expect(typed).toHaveLength(4);
  });

  it('ignores repeats, Ctrl, Alt, Meta and keys that are not one char', () => {
    const typed: string[] = [];
    const stop = onTypingKey((c) => typed.push(c));
    press('f', { repeat: true });
    press('f', { ctrlKey: true });
    press('f', { altKey: true });
    press('f', { metaKey: true });
    for (const key of ['Backspace', 'Enter', 'Shift', 'Tab', 'ArrowLeft', 'Dead']) press(key);
    expect(typed).toEqual([]);
    expect(press('Backspace').defaultPrevented).toBe(false);
    expect(
      isTypingKey({ key: 'a', repeat: false, ctrlKey: false, altKey: false, metaKey: false }),
    ).toBe(true);
    stop();
  });

  it('blurs the focused element and reports Caps Lock', () => {
    const focusButton = document.createElement('button');
    document.body.appendChild(focusButton);
    focusButton.focus();
    const caps: boolean[] = [];
    const stop = onTypingKey(() => undefined, { onCaps: (on) => caps.push(on) });
    press('a', { modifierCapsLock: true });
    press('b');
    expect(document.activeElement).not.toBe(focusButton);
    expect(caps).toEqual([true, false]);
    stop();
  });
});

describe('block view', () => {
  it('marks done, current and todo keys, and shows space as a box', () => {
    const view = createBlockView();
    document.body.appendChild(view.element);
    view.set('fj f');
    const keys = () => [...view.element.querySelectorAll('.tb-key')];
    expect(keys()).toHaveLength(4);
    expect(keys()[0].classList.contains('tb-now')).toBe(true);
    expect(keys()[2].classList.contains('tb-space')).toBe(true);
    expect(keys()[2].textContent).toBe('␣');
    expect(view.current).toBe('f');
    view.advance();
    view.advance();
    expect(keys().filter((k) => k.classList.contains('tb-done'))).toHaveLength(2);
    expect(view.current).toBe(' ');
    expect(view.position).toBe(2);
    view.advance();
    view.advance();
    expect(view.current).toBeNull();
    view.advance();
    expect(view.position).toBe(4);
  });

  it('flashes the current key red, and holds it when asked', () => {
    vi.useFakeTimers();
    const view = createBlockView();
    document.body.appendChild(view.element);
    view.set('ab');
    view.wrong();
    const first = view.element.querySelector('.tb-key')!;
    expect(first.classList.contains('tb-wrong')).toBe(true);
    vi.advanceTimersByTime(300);
    expect(first.classList.contains('tb-wrong')).toBe(false);
    view.wrong(true);
    vi.advanceTimersByTime(1000);
    expect(first.classList.contains('tb-wrong')).toBe(true);
    view.advance();
    expect(first.classList.contains('tb-wrong')).toBe(false);
    vi.useRealTimers();
  });
});

describe('keyboard', () => {
  const fill = (kb: ReturnType<typeof createKeyboard>, index: number) =>
    kb.element.querySelectorAll('rect')[index].getAttribute('fill');

  it('lights a key in its finger colour, and the Shift a capital needs', () => {
    const kb = createKeyboard({ hands: false });
    kb.light('F');
    const lit = [...kb.element.querySelectorAll('rect')]
      .map((r) => r.getAttribute('fill'))
      .filter((f) => f === '#f97316' || f === '#a855f7');
    expect(lit.sort()).toEqual(['#a855f7', '#f97316']);
    kb.light(null);
    expect(
      [...kb.element.querySelectorAll('rect')].some((r) => r.getAttribute('fill') === '#f97316'),
    ).toBe(false);
    expect(fill(kb, 0)).toBe('#1e293b');
  });

  it('flashes, fades and shows the Caps Lock pill', () => {
    vi.useFakeTimers();
    const kb = createKeyboard({ hands: false });
    kb.flash('a', 'right');
    const fills = () => [...kb.element.querySelectorAll('rect')].map((r) => r.getAttribute('fill'));
    expect(fills()).toContain('#22c55e');
    vi.advanceTimersByTime(300);
    expect(fills()).not.toContain('#22c55e');
    kb.flash('a', 'wrong', true);
    vi.advanceTimersByTime(1000);
    expect(fills()).toContain('#ef4444');
    kb.setFaint(true);
    expect(kb.element.classList.contains('tk-faint')).toBe(true);
    const pill = kb.element.querySelector<HTMLElement>('.tk-caps')!;
    expect(pill.hidden).toBe(true);
    kb.setCaps(true);
    expect(pill.hidden).toBe(false);
    expect(pill.textContent).toBe('Caps Lock is on');
    kb.flash('é', 'wrong');
    vi.useRealTimers();
  });

  it('moves a finger to the key and back, with and without Shift', () => {
    const kb = createKeyboard({ hands: true });
    const lines = () => [...kb.element.querySelectorAll('line')];
    kb.reach(null, 0);
    const home = lines().map((l) => l.getAttribute('y2'));
    kb.reach('r', 0.5);
    expect(lines().map((l) => l.getAttribute('y2'))).not.toEqual(home);
    kb.reach('r', 1.2);
    expect(lines().map((l) => l.getAttribute('y2'))).toEqual(home);
    kb.reach('F', 0.9);
    expect(lines().filter((l) => l.getAttribute('visibility') === 'visible')).toHaveLength(2);
    kb.reach(' ', 0.5);
    expect(createKeyboard({ hands: false }).element.querySelectorAll('line')).toHaveLength(0);
  });

  it('times the reach: out, hold, back, rest', () => {
    expect(reachCycle('r')).toBe(1.5);
    expect(reachCycle('R')).toBe(2);
    expect(reachPhase('r', 0)).toEqual({ out: 0, pressed: false, shift: 0 });
    expect(reachPhase('r', 0.5)).toMatchObject({ out: 1, pressed: true });
    expect(reachPhase('r', 1.2).out).toBe(0);
    expect(reachPhase('r', 1.5 + 0.5).pressed).toBe(true);
    expect(reachPhase('R', 0.9)).toMatchObject({ out: 1, pressed: true, shift: 1 });
    expect(reachPhase('R', 1.9).shift).toBe(0);
  });
});

describe('lesson steps', () => {
  it('opens level 1 with the home row, then shows, tries and mixes each key', () => {
    const steps = lessonSteps(1);
    expect(steps.slice(0, 2)).toEqual([
      { kind: 'home', line: HOME_ROW_LINE },
      { kind: 'home', line: HOME_REST_LINE },
    ]);
    // f has nothing to mix with; j and the space bar do.
    expect(steps.slice(2).map((s) => s.kind)).toEqual([
      'show',
      'try',
      'show',
      'try',
      'mix',
      'show',
      'try',
      'mix',
      'done',
    ]);
  });

  it('mixes a new key with what is known, in order', () => {
    expect(lessonSteps(2).map((s) => s.kind)).toEqual([
      'show',
      'try',
      'mix',
      'show',
      'try',
      'mix',
      'done',
    ]);
    expect(knownBefore(2, 'k')).toContain('d');
    expect(knownBefore(2, 'd')).not.toContain('d');
    expect(knownBefore(1, 'f')).toEqual([]);
    expect(knownBefore(1, 'j')).toEqual(['f']);
  });

  it('tries five of a key, or alternating capitals of a hand', () => {
    const random = seededRandom(3);
    expect(tryText('r', random)).toBe('rrrrr');
    const caps = tryText('shift-right', random);
    expect(caps).toHaveLength(5);
    expect(caps).toMatch(/^[QWERTASDFGZXCVB]+$/);
    expect(caps).not.toMatch(/(.)\1/);
    expect(tryText('shift-left', random, 'J')[0]).toBe('J');
  });
});

describe('showKeyLesson', () => {
  const start = (level: number) => {
    const said: string[] = [];
    const ends: (() => void)[] = [];
    const onDone = vi.fn();
    const onSkip = vi.fn();
    const lesson: KeyLesson = track(
      showKeyLesson({
        level,
        onDone,
        onSkip,
        speak: (text, onEnd) => {
          said.push(text);
          if (onEnd) ends.push(onEnd);
        },
        random: seededRandom(1),
      }),
    );
    const caption = () => document.querySelector('.tl-caption')!.textContent;
    return { lesson, said, ends, onDone, onSkip, caption };
  };

  it('plays level 2 from the first line to the ride', () => {
    const { lesson, said, ends, onDone, caption } = start(2);
    expect(document.querySelector('.tl-new')!.textContent).toBe('New keys!');
    expect(said).toEqual(['Left middle finger. Press D.']);
    // Nothing moves on until the line ends and 2.4 s have passed.
    lesson.update(10);
    expect(caption()).toBe('Left middle finger. Press D.');
    ends[0]();
    lesson.update(2.3);
    expect(caption()).toBe('Left middle finger. Press D.');
    lesson.update(0.2);
    expect(caption()).toBe('Your turn!');
    typeText('ddddd');
    lesson.update(0.6);
    expect(caption()).toBe('Now mix it up!');
    typeText(blockText(document));
    lesson.update(0.6);
    expect(said).toEqual(['Left middle finger. Press D.', 'Right middle finger. Press K.']);
    // The right key during the line counts as the first key of the try.
    press('k');
    expect(caption()).toBe('Your turn!');
    expect(blockText(document)).toBe('kkkkk');
    expect(document.querySelectorAll('.tb-done')).toHaveLength(1);
    typeText('kkkk');
    lesson.update(0.6);
    typeText(blockText(document));
    lesson.update(0.6);
    expect(document.querySelector('.tl-ready')!.textContent).toBe("You're ready! Let's ride!");
    expect(document.querySelector('.tl-badge')!.textContent).toBe('×4');
    expect(document.querySelector('.tl-mult-line')!.textContent).toBe(
      'Level 2 scores 4 times the points!',
    );
    expect(document.querySelector('.tl-space')!.textContent).toBe('Press the space bar to ride!');
    press('x');
    expect(onDone).not.toHaveBeenCalled();
    press(' ');
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.tx-overlay')).toBeNull();
  });

  it('speaks only the finger explanations', () => {
    const { lesson, said, ends } = start(1);
    expect(said).toEqual([HOME_ROW_LINE]);
    ends[0]();
    lesson.update(2.5);
    ends[1]();
    lesson.update(2.5);
    ends[2]();
    lesson.update(2.5);
    typeText('fffff');
    lesson.update(0.6);
    expect(document.querySelector('.tl-caption')!.textContent).toBe(
      'Right pointer finger. Press J.',
    );
    for (const line of said) expect(TYPING_VOICE_LINES).toContain(line);
    const spoken = vi.fn();
    const full = showKeyLesson({
      level: 7,
      onDone: vi.fn(),
      onSkip: vi.fn(),
      speak: spoken,
      random: seededRandom(2),
    });
    for (let i = 0; i < 12; i++) {
      full.update(3);
      for (const call of spoken.mock.calls) call[1]?.();
    }
    for (const [line] of spoken.mock.calls) expect(TYPING_VOICE_LINES).toContain(line);
    full.dispose();
  });

  it('buzzes a wrong key and keeps the block where it was', () => {
    const { lesson, ends } = start(2);
    ends[0]();
    lesson.update(2.5);
    typeText('dd');
    press('s');
    expect(sfx.wrongKey).toHaveBeenCalledTimes(1);
    expect(sfx.key).toHaveBeenCalledTimes(2);
    expect(document.querySelectorAll('.tb-done')).toHaveLength(2);
    expect(document.querySelectorAll('.tb-wrong')).toHaveLength(1);
    // A capital is a different key from the lower-case one.
    press('D');
    expect(sfx.wrongKey).toHaveBeenCalledTimes(2);
    press('d');
    expect(document.querySelectorAll('.tb-done')).toHaveLength(3);
  });

  it('replays a step with Again and leaves with Skip', () => {
    const { said, onSkip, ends } = start(2);
    const buttons = [...document.querySelectorAll<HTMLButtonElement>('.tx-btn')];
    expect(buttons.map((b) => b.textContent)).toEqual(['🔊 Again', 'Skip lesson ▸']);
    ends[0]();
    buttons[0].click();
    expect(said).toEqual(['Left middle finger. Press D.', 'Left middle finger. Press D.']);
    buttons[1].click();
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.tx-overlay')).toBeNull();
    press('d');
    expect(sfx.key).not.toHaveBeenCalled();
  });

  it('holds while paused and ignores a line that was cut off', () => {
    const said: string[] = [];
    const ends: (() => void)[] = [];
    let paused = true;
    const lesson = showKeyLesson({
      level: 2,
      onDone: vi.fn(),
      onSkip: vi.fn(),
      speak: (text, onEnd) => {
        said.push(text);
        if (onEnd) ends.push(onEnd);
      },
      paused: () => paused,
    });
    expect(lesson.element.isConnected).toBe(true);
    lesson.dispose();
    ends[0]();
    expect(document.querySelector('.tx-overlay')).toBeNull();
    paused = false;
  });

  it('shows a speed level as a card for 2.5 seconds, without a voice', () => {
    const speak = vi.fn();
    const onDone = vi.fn();
    const lesson = showKeyLesson({ level: 31, onDone, onSkip: vi.fn(), speak });
    expect(document.querySelector('.tl-speed')!.textContent).toBe(
      'Speed level! Type 20 words a minute.',
    );
    expect(document.querySelector('.tl-badge')!.textContent).toBe('×961');
    lesson.update(2.4);
    expect(onDone).not.toHaveBeenCalled();
    lesson.update(0.2);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(speak).not.toHaveBeenCalled();
    expect(document.querySelector('.tx-overlay')).toBeNull();
  });
});

describe('level picker', () => {
  const open = (openLevel: number, selected = openLevel) => {
    const handlers = {
      onPick: vi.fn(),
      onTestOut: vi.fn(),
      onLesson: vi.fn(),
      onStart: vi.fn(),
    };
    const picker = track(
      showLevelPicker({
        typing: { ...emptyTyping(), open: openLevel },
        selected,
        ...handlers,
      }),
    );
    const chips = () => [...document.querySelectorAll<HTMLButtonElement>('.tp-chip')];
    return { picker, chips, ...handlers };
  };

  it('shows 40 chips: passed, the open one and locked', () => {
    const { chips } = open(12, 7);
    expect(chips()).toHaveLength(40);
    expect(chips().filter((c) => c.classList.contains('tp-passed'))).toHaveLength(11);
    expect(chips().filter((c) => c.classList.contains('tp-open'))).toHaveLength(1);
    expect(chips().filter((c) => c.classList.contains('tp-locked'))).toHaveLength(28);
    expect(chips()[6].classList.contains('tp-sel')).toBe(true);
    expect(chips()[6].querySelector('.tp-x')!.textContent).toBe('×49');
    expect(chips()[0].querySelector('.tp-mark')!.textContent).toBe('✓');
    expect(chips()[11].querySelector('.tp-mark')!.textContent).toBe('NEXT');
    expect(chips()[12].querySelector('.tp-mark')!.textContent).toBe('🔒');
    expect(document.querySelector('.tp-header')!.textContent).toBe('Level 7 · r u · ×49');
    expect(document.querySelector('.tp-headline')!.textContent).toBe(
      'Higher levels score more points!',
    );
    expect(document.querySelector('.tp-space')!.textContent).toBe('Press the space bar to ride!');
  });

  it('cuts long key sets to three keys', () => {
    expect(chipTitle(levelOf(23))).toBe('! @ #…');
    expect(chipTitle(levelOf(25))).toBe('- = _…');
    expect(chipTitle(levelOf(17))).toBe('\' ? "');
    expect(chipTitle(levelOf(16))).toBe('Shift');
    expect(chipTitle(levelOf(35))).toBe('50 wpm');
    expect(chipTitle(levelOf(1))).toBe('f j');
    expect(TYPING_LEVELS.every((l) => chipTitle(l).length <= 8)).toBe(true);
  });

  it('picks a passed or open level', () => {
    const { chips, onPick, onTestOut } = open(12, 7);
    chips()[2].click();
    expect(onPick).toHaveBeenCalledWith(3);
    expect(document.querySelector('.tp-header')!.textContent).toBe('Level 3 · s l · ×9');
    chips()[11].click();
    expect(onPick).toHaveBeenCalledWith(12);
    expect(onTestOut).not.toHaveBeenCalled();
  });

  it('asks before a test-out, and cancels', () => {
    const { chips, onPick, onTestOut } = open(12, 7);
    chips()[19].click();
    expect(document.querySelector('.tp-ask-text')!.textContent).toBe(testOutAsk(20));
    expect(testOutAsk(12)).toBe(
      'Test out of level 12? Type one block of its keys. 90% right opens it.',
    );
    document.querySelector<HTMLButtonElement>('.tp-cancel')!.click();
    expect(document.querySelector('.tp-ask')).toBeNull();
    chips()[19].click();
    document.querySelector<HTMLButtonElement>('.tp-test')!.click();
    expect(onTestOut).toHaveBeenCalledWith(20);
    expect(onPick).not.toHaveBeenCalled();
    expect(document.querySelector('.tp-ask')).toBeNull();
  });

  it('starts on the space bar, but not over the question', () => {
    const { chips, onStart, picker } = open(3);
    press(' ');
    expect(onStart).toHaveBeenCalledTimes(1);
    chips()[10].click();
    press(' ');
    expect(onStart).toHaveBeenCalledTimes(1);
    picker.dispose();
    press(' ');
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.tx-overlay')).toBeNull();
  });

  it('offers the lesson again for a key level only', () => {
    const { chips, onLesson, picker } = open(40, 7);
    const lessonButton = document.querySelector<HTMLButtonElement>('.tp-lesson')!;
    expect(lessonButton.textContent).toBe('Show me the keys again');
    expect(lessonButton.hidden).toBe(false);
    lessonButton.click();
    expect(onLesson).toHaveBeenCalledWith(7);
    chips()[30].click();
    expect(document.querySelector<HTMLButtonElement>('.tp-lesson')!.hidden).toBe(true);
    picker.select(3);
    expect(document.querySelector('.tp-header')!.textContent).toBe('Level 3 · s l · ×9');
  });
});

describe('ready and space lines', () => {
  const ready = (level: number, extra: { readyLine?: string; spaceLine?: string } = {}) => {
    track(showKeyLesson({ level, onDone: vi.fn(), onSkip: vi.fn(), speak: vi.fn(), ...extra }));
    return [
      document.querySelector('.tl-ready')!.textContent,
      document.querySelector('.tl-space')!.textContent,
    ];
  };
  const picker = (spaceLine?: string) => {
    track(
      showLevelPicker({
        typing: emptyTyping(),
        selected: 1,
        onPick: vi.fn(),
        onTestOut: vi.fn(),
        onLesson: vi.fn(),
        onStart: vi.fn(),
        spaceLine,
      }),
    );
    return document.querySelector('.tp-space')!.textContent;
  };

  it('keeps the ride lines by default on the lesson and the picker', () => {
    expect(ready(2)).toEqual(["You're ready! Let's ride!", 'Press the space bar to ride!']);
    expect(picker()).toBe('Press the space bar to ride!');
  });

  it('takes other lines for the lesson and the picker', () => {
    expect(ready(2, { readyLine: "You're ready! Let's blast!", spaceLine: 'Go!' })).toEqual([
      "You're ready! Let's blast!",
      'Go!',
    ]);
    expect(picker('Press the space bar to play!')).toBe('Press the space bar to play!');
  });
});

describe('test out', () => {
  it('passes with 90% right first time', () => {
    expect(testPassed(20, 27, 30, 10)).toBe(true);
    expect(testPassed(20, 26, 30, 10)).toBe(false);
    // Speed level 31 is 20 wpm: 30 keys in 18 s is 20 wpm.
    expect(testPassed(31, 30, 30, 18)).toBe(true);
    expect(testPassed(31, 30, 30, 19)).toBe(false);
  });

  it('types a block of 30 keys and reports', () => {
    const onDone = vi.fn();
    track(showTestOut({ level: 3, onDone, random: seededRandom(4) }));
    const text = blockText(document);
    expect(text).toHaveLength(30);
    typeText(text);
    expect(document.querySelector('.tt-result')!.textContent).toBe('You tested out!');
    press(' ');
    expect(onDone).toHaveBeenCalledWith(true);
    expect(document.querySelector('.tx-overlay')).toBeNull();
  });

  it('fails with too many wrong keys', () => {
    const onDone = vi.fn();
    track(showTestOut({ level: 3, onDone, random: seededRandom(4) }));
    const text = blockText(document);
    // Miss the first four keys once each, then type them right.
    for (let i = 0; i < 4; i++) {
      press('9');
      press(text[i]);
    }
    typeText(text.slice(4));
    expect(document.querySelector('.tt-result')!.textContent).toBe('Not yet. Keep practicing!');
    expect(sfx.wrongKey).toHaveBeenCalledTimes(4);
    document.querySelector<HTMLButtonElement>('.tt-continue')!.click();
    expect(onDone).toHaveBeenCalledWith(false);
  });
});
