import { unlockAudio } from './audio';
import { onPress } from './input';

/** A fitted text never shrinks below this share of its CSS font size. */
export const MIN_FIT_SCALE = 0.6;

/**
 * The font size (px) that makes text `needed` px wide at `base` px fit in `available` px, with a
 * 2% margin, never below `base * minScale`, rounded down to 0.1 px; null when it already fits or
 * nothing can be measured (available <= 0).
 */
export function fittedFontSize(
  base: number,
  available: number,
  needed: number,
  minScale = MIN_FIT_SCALE,
): number | null {
  if (needed <= available || available <= 0) return null;
  return Math.floor(10 * base * Math.max(minScale, (0.98 * available) / needed)) / 10;
}

let measureContext: CanvasRenderingContext2D | null | undefined;
let observer: ResizeObserver | undefined;
/** The width each fitted node was last fitted at, so a font change can't loop the observer. */
const fittedAt = new WeakMap<HTMLElement, number>();
const minScales = new WeakMap<HTMLElement, number>();

function measureText(font: string, text: string): number | null {
  if (measureContext === undefined) {
    measureContext = document.createElement('canvas').getContext('2d');
  }
  if (!measureContext) return null;
  measureContext.font = font;
  return measureContext.measureText(text).width;
}

function fit(node: HTMLElement, minScale: number): void {
  node.style.fontSize = '';
  if (node.clientWidth === 0) {
    fittedAt.delete(node);
    return;
  }
  const style = getComputedStyle(node);
  const base = parseFloat(style.fontSize);
  const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  const available = node.clientWidth - (Number.isNaN(padding) ? 0 : padding);
  const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const needed = measureText(font, node.textContent ?? '');
  if (needed === null || Number.isNaN(base)) return;
  const size = fittedFontSize(base, available, needed, minScale);
  if (size !== null) node.style.fontSize = `${size}px`;
  fittedAt.set(node, node.clientWidth);
}

/** Shrinks `node`'s one-line text to fit its width, and refits when its width changes. */
export function fitText(node: HTMLElement, minScale = MIN_FIT_SCALE): void {
  fit(node, minScale);
  if (typeof ResizeObserver === 'undefined') return;
  observer ??= new ResizeObserver((entries) => {
    for (const { target } of entries) {
      const el = target as HTMLElement;
      if (el.clientWidth !== fittedAt.get(el)) fit(el, minScales.get(el) ?? MIN_FIT_SCALE);
    }
  });
  minScales.set(node, minScale);
  observer.observe(node);
}

/**
 * Puts `options` on the answer buttons: text, label, `className` (which drops last turn's marks)
 * and enabled, or disabled when `locked`. A button with no option is hidden.
 */
export function fillAnswers(
  buttons: readonly HTMLElement[],
  options: readonly string[],
  className: string,
  locked = false,
): void {
  buttons.forEach((button, i) => {
    const text = options[i];
    button.hidden = text === undefined;
    button.textContent = text ?? '';
    button.setAttribute('aria-label', `Answer ${text ?? ''}`);
    button.className = className;
    if (text !== undefined) fitText(button);
    if (locked) button.setAttribute('aria-disabled', 'true');
    else button.removeAttribute('aria-disabled');
  });
}

/**
 * Dims every answer button (an answer is in, or the question is over). They are not `disabled`,
 * so a tap still reaches the game's handler instead of being swallowed.
 */
export function lockAnswers(buttons: readonly HTMLElement[]): void {
  buttons.forEach((button) => button.setAttribute('aria-disabled', 'true'));
}

/**
 * Marks the result on the buttons: the correct one green, the `chosen` one red when it was wrong
 * (or 'chosen' when it was right). `chosen` is -1 when nothing was picked (time ran out).
 */
export function markAnswers(
  buttons: readonly HTMLElement[],
  chosen: number,
  correct: number,
  right: boolean,
): void {
  buttons[correct]?.classList.add('right');
  if (chosen < 0) return;
  buttons[chosen]?.classList.add(right ? 'chosen' : 'wrong');
}

/**
 * Calls `onAnswer(i)` when answer button `i` is pressed. A touch press doesn't count as a user
 * gesture for iOS audio, so the release unlocks audio. Returns a function that unbinds the presses.
 */
export function pressAnswers(
  buttons: readonly HTMLElement[],
  onAnswer: (index: number) => void,
): () => void {
  const unpress = buttons.map((button, i) => {
    button.addEventListener('pointerup', unlockAudio);
    return onPress(button, () => onAnswer(i));
  });
  return () => unpress.forEach((off) => off());
}
