/**
 * Key input for the typing screens: one `keydown` listener on the window that hands over the
 * typed char. Real keyboards only.
 */

export interface TypingKeyOptions {
  /** Called on every keydown with whether Caps Lock is on (the keyboard shows a pill for it). */
  onCaps?: (on: boolean) => void;
}

/** Whether a keydown is one the typing screens handle: a single char, no Ctrl, Alt or Meta, not auto-repeat. */
export function isTypingKey(
  e: Pick<KeyboardEvent, 'key' | 'repeat' | 'ctrlKey' | 'altKey' | 'metaKey'>,
): boolean {
  return !e.repeat && !e.ctrlKey && !e.altKey && !e.metaKey && e.key.length === 1;
}

/**
 * Calls `handler(char)` for each typed char. Handled keys do not scroll, open find or press a
 * focused button: they are cancelled and the focused element is blurred. Backspace and the
 * other keys that are not one char do nothing. Returns the function that stops listening.
 */
export function onTypingKey(
  handler: (char: string, e: KeyboardEvent) => void,
  options: TypingKeyOptions = {},
): () => void {
  const listener = (e: KeyboardEvent) => {
    options.onCaps?.(e.getModifierState('CapsLock'));
    if (!isTypingKey(e)) return;
    e.preventDefault();
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && focused !== document.body) focused.blur();
    handler(e.key, e);
  };
  window.addEventListener('keydown', listener);
  return () => window.removeEventListener('keydown', listener);
}
