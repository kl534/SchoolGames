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

  /** A 2x2 grid like a phone game: the green answer is `green`, the pointer is 240x100. */
  function grid(green: number, avoid: HTMLElement[] = []) {
    const buttons = makeButtons();
    const rects = [
      rect(12, 500, 177, 72),
      rect(201, 500, 177, 72),
      rect(12, 582, 177, 72),
      rect(201, 582, 177, 72),
    ];
    buttons.forEach((b, i) => vi.spyOn(b, 'getBoundingClientRect').mockReturnValue(rects[i]));
    const marks = createTapMarks();
    const pointer = document.querySelector<HTMLElement>('.sg-tap-pointer')!;
    vi.spyOn(pointer, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 240, 100));
    marks.show(buttons, green, avoid);
    return {
      y: parseFloat(pointer.style.top),
      finger: pointer.querySelector('[aria-hidden="true"]')!.textContent,
    };
  }

  it('stays above a top-row answer and goes below a bottom-row one, never over another answer', () => {
    const top = grid(0);
    expect(top.y).toBe(500 - 6 - 100);
    expect(top.finger).toBe('👇');
    document.body.replaceChildren();
    // Above the bottom row would sit on the top row (582 - 106 = 476 < 572).
    const bottom = grid(2);
    expect(bottom.y).toBe(654 + 6);
    expect(bottom.finger).toBe('👆');
  });

  it('keeps off the banner and the question too', () => {
    const banner = document.createElement('div');
    document.body.appendChild(banner);
    vi.spyOn(banner, 'getBoundingClientRect').mockReturnValue(rect(60, 380, 270, 110));
    // Above the top row (394 to 494) would cover the banner; below the row is the other answers.
    // Neither is clear, so it stays above, as there is room.
    const blocked = grid(1, [banner]);
    expect(blocked.y).toBe(394);
    expect(blocked.finger).toBe('👇');
    document.body.replaceChildren();
    // A hidden banner has no size and is ignored.
    const hidden = document.createElement('div');
    document.body.appendChild(hidden);
    expect(grid(1, [hidden]).y).toBe(394);
  });

  it('with both sides blocked, goes below when above would run into the top bar', () => {
    const buttons = makeButtons();
    const rects = [rect(10, 130, 177, 60), rect(10, 200, 177, 60)];
    buttons
      .slice(0, 2)
      .forEach((b, i) => vi.spyOn(b, 'getBoundingClientRect').mockReturnValue(rects[i]));
    const marks = createTapMarks();
    const pointer = document.querySelector<HTMLElement>('.sg-tap-pointer')!;
    vi.spyOn(pointer, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 240, 100));
    marks.show(buttons, 0);
    expect(parseFloat(pointer.style.top)).toBe(196);
  });
});

describe('pulse cap', () => {
  const sized = (button: HTMLElement, width: number, height: number) => {
    Object.defineProperty(button, 'offsetWidth', { value: width, configurable: true });
    Object.defineProperty(button, 'offsetHeight', { value: height, configurable: true });
  };

  it('keeps the biggest pulse inside the screen for a button near the edge', () => {
    const buttons = makeButtons();
    sized(buttons[0], 177, 72);
    // Centre 12 + 88.5 from the left edge, 288 from the right: 2 * (100.5 - 4) / 177.
    vi.spyOn(buttons[0], 'getBoundingClientRect').mockReturnValue(rect(12, 700, 177, 72));
    createTapMarks().show(buttons, 0);
    expect(buttons[0].style.getPropertyValue('--sg-tap-cap')).toBe('1.090');
  });

  it('never caps below 1, and is removed again by clear', () => {
    const buttons = makeButtons();
    sized(buttons[0], 100, 72);
    vi.spyOn(buttons[0], 'getBoundingClientRect').mockReturnValue(rect(0, 700, 100, 72));
    const marks = createTapMarks();
    marks.show(buttons, 0);
    expect(buttons[0].style.getPropertyValue('--sg-tap-cap')).toBe('1.000');
    marks.clear();
    expect(buttons[0].style.getPropertyValue('--sg-tap-cap')).toBe('');
  });

  it('is left alone where the button has no layout size', () => {
    const buttons = makeButtons();
    createTapMarks().show(buttons, 0);
    expect(buttons[0].style.getPropertyValue('--sg-tap-cap')).toBe('');
  });
});

describe('card', () => {
  function withCard(
    buttonRect: DOMRect,
    { avoid = [] as HTMLElement[], pointerHeight = 200 } = {},
  ) {
    const buttons = makeButtons();
    vi.spyOn(buttons[0], 'getBoundingClientRect').mockReturnValue(buttonRect);
    const marks = createTapMarks();
    const pointer = document.querySelector<HTMLElement>('.sg-tap-pointer')!;
    vi.spyOn(pointer, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 300, pointerHeight));
    const card = { element: document.createElement('div'), fit: vi.fn() };
    card.element.className = 'test-card';
    marks.show(buttons, 0, avoid, '7 × 3 = ?', card);
    return { marks, pointer, card, buttons };
  }

  it('takes the places of the caption, and the caption comes back after clear', () => {
    const { marks, pointer, card } = withCard(rect(150, 700, 90, 72));
    const caption = pointer.querySelector<HTMLElement>('.sg-tap-caption')!;
    expect(caption.hidden).toBe(true);
    expect(caption.textContent).toBe('');
    expect(pointer.contains(card.element)).toBe(true);
    expect(pointer.classList.contains('sg-tap-has-card')).toBe(true);
    marks.clear();
    expect(pointer.contains(card.element)).toBe(false);
    expect(pointer.classList.contains('sg-tap-has-card')).toBe(false);
    marks.show(makeButtons(), 0, [], '7 × 3 = ?');
    expect(caption.hidden).toBe(false);
    expect(caption.textContent).toBe('7 × 3 = ?');
  });

  it('sits above the answer with the biggest room, finger under it', () => {
    const { pointer, card } = withCard(rect(150, 700, 90, 72));
    // 700 - 6 - 40 (finger) - 76 (top limit) = 578, held to 380.
    expect(card.fit).toHaveBeenCalledWith(374, 380);
    expect(parseFloat(pointer.style.top)).toBe(700 - 6 - 200);
    expect(pointer.classList.contains('sg-tap-below')).toBe(false);
  });

  it('only fits again when the room changes', () => {
    const { marks, card } = withCard(rect(150, 700, 90, 72));
    marks.update();
    marks.update();
    expect(card.fit).toHaveBeenCalledTimes(1);
    setViewport(320, 600);
    marks.update();
    expect(card.fit).toHaveBeenCalledTimes(2);
    expect(card.fit).toHaveBeenLastCalledWith(304, 360);
  });

  it('keeps below a banner that ends above the answer', () => {
    const banner = document.createElement('div');
    document.body.appendChild(banner);
    vi.spyOn(banner, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 390, 300));
    const { card } = withCard(rect(150, 700, 90, 72), { avoid: [banner] });
    // 700 - 6 - 40 - (300 + 6) = 348.
    expect(card.fit).toHaveBeenCalledWith(374, 348);
  });

  it('ignores a banner beside the card or one that is not above the answer', () => {
    const aside = document.createElement('div');
    document.body.appendChild(aside);
    vi.spyOn(aside, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 4, 300));
    const over = document.createElement('div');
    document.body.appendChild(over);
    vi.spyOn(over, 'getBoundingClientRect').mockReturnValue(rect(0, 650, 390, 120));
    const { card } = withCard(rect(150, 700, 90, 72), { avoid: [aside, over] });
    expect(card.fit).toHaveBeenCalledWith(374, 380);
  });

  it('goes below when there is more room there, finger above it', () => {
    const { pointer, card } = withCard(rect(150, 100, 90, 72));
    // Above: 100 - 6 - 40 - 76 = -22. Below: 844 - 8 - (172 + 6 + 40) = 618, held to 380.
    expect(card.fit).toHaveBeenCalledWith(374, 380);
    expect(parseFloat(pointer.style.top)).toBe(172 + 6);
    expect(pointer.classList.contains('sg-tap-below')).toBe(true);
  });

  it('stays above in a short window when that is at least as roomy', () => {
    setViewport(844, 390);
    const { card, pointer } = withCard(rect(300, 300, 120, 60), { pointerHeight: 150 });
    // 300 - 6 - 40 - 76 = 178; below only 390 - 8 - (360 + 46) < 0.
    expect(card.fit).toHaveBeenCalledWith(480, 178);
    expect(parseFloat(pointer.style.top)).toBe(300 - 6 - 150);
  });

  it('slides the card off a banner at its upper right; the finger stays over the button', () => {
    const banner = document.createElement('div');
    document.body.appendChild(banner);
    vi.spyOn(banner, 'getBoundingClientRect').mockReturnValue(rect(280, 520, 100, 70));
    const buttons = makeButtons();
    vi.spyOn(buttons[0], 'getBoundingClientRect').mockReturnValue(rect(150, 700, 90, 72));
    const marks = createTapMarks();
    const pointer = document.querySelector<HTMLElement>('.sg-tap-pointer')!;
    vi.spyOn(pointer, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 240, 200));
    const card = { element: document.createElement('div'), fit: vi.fn() };
    vi.spyOn(card.element, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 240, 160));
    marks.show(buttons, 0, [banner], undefined, card);
    // The pointer stays centred on the button (195), so the finger does too.
    const left = parseFloat(pointer.style.left);
    expect(left + 120).toBe(195);
    const shift = parseFloat(card.element.style.translate);
    expect(shift).toBeLessThan(0);
    // The card (240 wide, 160 tall, above the finger) now ends before the banner starts.
    expect(left + shift + 240).toBeLessThanOrEqual(280);
    expect(left + shift).toBeGreaterThanOrEqual(8);
    // The finger is still well inside the card.
    expect(195).toBeGreaterThanOrEqual(left + shift + 28);
    // A banner that is not in the way leaves the card centred.
    vi.spyOn(banner, 'getBoundingClientRect').mockReturnValue(rect(280, 100, 100, 70));
    marks.update();
    expect(card.element.style.translate).toBe('');
  });

  it('shrinks the card when no slide clears the banner, never below 110', () => {
    const banner = document.createElement('div');
    document.body.appendChild(banner);
    vi.spyOn(banner, 'getBoundingClientRect').mockReturnValue(rect(0, 400, 390, 100));
    const { card } = withCard(rect(150, 700, 90, 72), { avoid: [banner] });
    const heights = card.fit.mock.calls.map((call) => call[1]);
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(110);
  });
});
