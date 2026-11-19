/** Tiny DOM helpers for the typing screens. */

/** Creates an element with a class, optional text, and appends it to `parent`. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  parent?: HTMLElement,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  parent?.appendChild(node);
  return node;
}

/** A button at least 48px tall. */
export function button(
  className: string,
  text: string,
  parent: HTMLElement,
  onClick: () => void,
): HTMLButtonElement {
  const node = el('button', `tx-btn ${className}`, parent, text);
  node.type = 'button';
  node.addEventListener('click', onClick);
  return node;
}

/** A full-screen overlay holding one centred card. */
export function overlay(
  className: string,
  container: HTMLElement,
): { root: HTMLElement; card: HTMLElement } {
  const root = el('div', `tx-overlay ${className}`, container);
  const card = el('div', 'tx-card', root);
  return { root, card };
}
