import { unlockAudio } from './audio';
import { onPress } from './input';

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
