// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TAP_CAPTION } from '../src/shared/tapgate';
import { createTapMarks } from '../src/shared/tapmarks';

function makeButtons(count = 4): HTMLButtonElement[] {
  return Array.from({ length: count }, (_, i) => {
    const button = document.createElement('button');
    button.className = i === 1 ? 'game-answer wrong' : 'game-answer';
    document.body.appendChild(button);
    return button;
  });
}

const classes = (button: HTMLElement) => [...button.classList].sort();

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  };
}

function setViewport(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true });
}

beforeEach(() => {
  setViewport(390, 844);
});

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('show', () => {
  it('pulses the right button and dims the others', () => {
    const buttons = makeButtons();
    const marks = createTapMarks();
    marks.show(buttons, 2);
    expect(buttons[2].classList.contains('sg-tap-correct')).toBe(true);
    expect(buttons.filter((b) => b.classList.contains('sg-tap-correct'))).toHaveLength(1);
    for (const i of [0, 1, 3]) {
      expect(buttons[i].classList.contains('sg-tap-dim')).toBe(true);
      expect(buttons[i].getAttribute('aria-disabled')).toBe('true');
    }
    expect(buttons[2].hasAttribute('aria-disabled')).toBe(false);
    // The game's own red mark stays, dimmed.
    expect(buttons[1].classList.contains('wrong')).toBe(true);
  });

  it('shows a pointer with the caption that never takes taps', () => {
    const marks = createTapMarks();
    const pointer = document.querySelector<HTMLElement>('.sg-tap-pointer')!;
    expect(pointer.hidden).toBe(true);
    marks.show(makeButtons(), 0);
    expect(pointer.hidden).toBe(false);
    expect(pointer.textContent).toContain(TAP_CAPTION);
    const caption = pointer.querySelector('[role="status"]')!;
    expect(caption.getAttribute('aria-live')).toBe('polite');
    expect(caption.textContent).toBe(TAP_CAPTION);
    expect(pointer.querySelector('[aria-hidden="true"]')?.textContent).toMatch(/👇|👆/);
    expect(pointer.style.pointerEvents).toBe('none');
  });

  it('puts the pointer in the container it is given', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    createTapMarks(host);
    expect(host.querySelector('.sg-tap-pointer')).not.toBeNull();
  });

  it('twice does not double up', () => {
    const buttons = makeButtons();
    const original = buttons.map(classes);
    const marks = createTapMarks();
    marks.show(buttons, 0);
    marks.show(buttons, 3);
    expect(document.querySelectorAll('.sg-tap-pointer')).toHaveLength(1);
    expect(buttons[0].classList.contains('sg-tap-correct')).toBe(false);
    expect(buttons[0].classList.contains('sg-tap-dim')).toBe(true);
    expect(buttons[3].classList.contains('sg-tap-correct')).toBe(true);
    expect(buttons[3].classList.contains('sg-tap-dim')).toBe(false);
    marks.clear();
    expect(buttons.map(classes)).toEqual(original);
  });
});

describe('aria-disabled', () => {
  it('is restored exactly as the game had it', () => {
    const buttons = makeButtons();
    buttons[0].setAttribute('aria-disabled', 'true');
    buttons[1].setAttribute('aria-disabled', 'false');
    const marks = createTapMarks();
    marks.show(buttons, 0);
    expect(buttons[0].hasAttribute('aria-disabled')).toBe(false);
    expect(buttons[1].getAttribute('aria-disabled')).toBe('true');
    marks.clear();
    expect(buttons[0].getAttribute('aria-disabled')).toBe('true');
    expect(buttons[1].getAttribute('aria-disabled')).toBe('false');
    expect(buttons[2].hasAttribute('aria-disabled')).toBe(false);
    expect(buttons[3].hasAttribute('aria-disabled')).toBe(false);
  });
});

describe('nope', () => {
  it('shakes the dim button and hints at the green one, then lets go', () => {
    vi.useFakeTimers();
    const buttons = makeButtons();
    const marks = createTapMarks();
    marks.show(buttons, 2);
    marks.nope(0);
    expect(buttons[0].classList.contains('sg-tap-nope')).toBe(true);
    expect(buttons[2].classList.contains('sg-tap-hint')).toBe(true);
    vi.advanceTimersByTime(299);
    expect(buttons[0].classList.contains('sg-tap-nope')).toBe(true);
    vi.advanceTimersByTime(1);
    expect(buttons[0].classList.contains('sg-tap-nope')).toBe(false);
    expect(buttons[2].classList.contains('sg-tap-hint')).toBe(true);
    vi.advanceTimersByTime(700);
    expect(buttons[2].classList.contains('sg-tap-hint')).toBe(false);
    expect(buttons[2].classList.contains('sg-tap-correct')).toBe(true);
  });

  it('moves the shake when another dim button is tapped', () => {
    vi.useFakeTimers();
    const buttons = makeButtons();
    const marks = createTapMarks();
    marks.show(buttons, 2);
    marks.nope(0);
    marks.nope(3);
    expect(buttons[0].classList.contains('sg-tap-nope')).toBe(false);
    expect(buttons[3].classList.contains('sg-tap-nope')).toBe(true);
  });

  it('ignores the green button and unknown indexes', () => {
    const buttons = makeButtons();
    const marks = createTapMarks();
    marks.show(buttons, 2);
    marks.nope(2);
    marks.nope(9);
    expect(buttons[2].classList.contains('sg-tap-nope')).toBe(false);
    expect(buttons[2].classList.contains('sg-tap-hint')).toBe(false);
  });
});

describe('nudge', () => {
  it('grows the pulse one step at a time', () => {
    const buttons = makeButtons();
    const marks = createTapMarks();
    marks.show(buttons, 1);
    marks.nudge(1);
    expect(buttons[1].classList.contains('sg-tap-step-1')).toBe(true);
    marks.nudge(2);
    expect(buttons[1].classList.contains('sg-tap-step-2')).toBe(true);
    expect(buttons[1].classList.contains('sg-tap-step-1')).toBe(false);
    marks.nudge(7);
    expect(buttons[1].classList.contains('sg-tap-step-3')).toBe(true);
    expect(buttons[1].classList.contains('sg-tap-step-2')).toBe(false);
  });
});

describe('clear and dispose', () => {
  it('leaves every button with the classes it started with', () => {
    vi.useFakeTimers();
    const buttons = makeButtons();
    const original = buttons.map(classes);
    const marks = createTapMarks();
    marks.show(buttons, 3);
    marks.nudge(2);
    marks.nope(0);
    marks.clear();
    expect(buttons.map(classes)).toEqual(original);
    expect(document.querySelector<HTMLElement>('.sg-tap-pointer')!.hidden).toBe(true);
    // The timers of the shake must not touch anything after the clear.
    vi.advanceTimersByTime(2000);
    expect(buttons.map(classes)).toEqual(original);
  });

  it('removes the pointer on dispose', () => {
    const marks = createTapMarks();
    marks.show(makeButtons(), 0);
    marks.dispose();
    expect(document.querySelector('.sg-tap-pointer')).toBeNull();
  });
});

describe('placement', () => {
  /** Stubs where the first button and the pointer are, then lays the pointer out. */
  function place(buttonRect: DOMRect, pointerSize = { width: 240, height: 100 }) {
    const buttons = makeButtons();
    vi.spyOn(buttons[0], 'getBoundingClientRect').mockReturnValue(buttonRect);
    const marks = createTapMarks();
    const pointer = document.querySelector<HTMLElement>('.sg-tap-pointer')!;
    vi.spyOn(pointer, 'getBoundingClientRect').mockReturnValue(
      rect(0, 0, pointerSize.width, pointerSize.height),
    );
    marks.show(buttons, 0);
    return {
      marks,
      pointer,
      x: parseFloat(pointer.style.left),
      y: parseFloat(pointer.style.top),
      finger: pointer.querySelector('[aria-hidden="true"]')!.textContent,
    };
  }

  it('sits above a button at the bottom, pointing down, centred on it', () => {
    const { x, y, finger, pointer } = place(rect(150, 700, 90, 72));
    expect(y).toBe(700 - 6 - 100);
    expect(x).toBe(150 + 45 - 120);
    expect(finger).toBe('👇');
    expect(pointer.classList.contains('sg-tap-below')).toBe(false);
  });

  it('goes below a button near the top, pointing up', () => {
    const { y, finger, pointer } = place(rect(150, 150, 90, 72));
    expect(y).toBe(222 + 6);
    expect(finger).toBe('👆');
    expect(pointer.classList.contains('sg-tap-below')).toBe(true);
  });

  it('stays above when below would leave the screen', () => {
    const { y, finger } = place(rect(150, 100, 90, 740));
    expect(y).toBe(100 - 6 - 100);
    expect(finger).toBe('👇');
  });

  it('keeps the whole pointer inside the screen sideways', () => {
    expect(place(rect(0, 700, 60, 72)).x).toBe(8);
    document.body.replaceChildren();
    expect(place(rect(340, 700, 50, 72)).x).toBe(390 - 240 - 8);
  });

  it('follows a button that moves', () => {
    const buttons = makeButtons();
    const spy = vi.spyOn(buttons[0], 'getBoundingClientRect');
    spy.mockReturnValue(rect(150, 700, 90, 72));
    const marks = createTapMarks();
    const pointer = document.querySelector<HTMLElement>('.sg-tap-pointer')!;
    vi.spyOn(pointer, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 240, 100));
    marks.show(buttons, 0);
    expect(parseFloat(pointer.style.top)).toBe(594);
    spy.mockReturnValue(rect(150, 600, 90, 72));
    marks.update();
    expect(parseFloat(pointer.style.top)).toBe(494);
  });
});
