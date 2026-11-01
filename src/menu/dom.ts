/** Small DOM helpers the menu shares. */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function textButton(label: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', 'text-button', label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

/** An input at least 16px tall text (no iOS zoom) that scrolls itself into view on focus. */
export function field(
  type: 'email' | 'password' | 'text',
  label: string,
  autocomplete: string,
): HTMLInputElement {
  const input = el('input');
  input.type = type;
  input.required = true;
  input.autocomplete = autocomplete as AutoFill;
  input.placeholder = label;
  input.setAttribute('aria-label', label);
  input.addEventListener('focus', () => input.scrollIntoView({ block: 'center' }));
  return input;
}

/** A `p.error[role=alert]`. */
export function errorLine(text: string): HTMLParagraphElement {
  const p = el('p', 'error', text);
  p.setAttribute('role', 'alert');
  return p;
}

/** Keeps Tab inside the dialog and lets Escape cancel it. */
export function trapFocus(dialog: HTMLElement, cancel: () => void): void {
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = [...dialog.querySelectorAll<HTMLElement>('button, input')].filter(
      (n) => !(n as HTMLButtonElement).disabled && !n.hidden,
    );
    if (items.length === 0) return;
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next = (i + (e.shiftKey ? -1 : 1) + items.length) % items.length;
    e.preventDefault();
    items[next].focus();
  });
}
