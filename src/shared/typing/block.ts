/**
 * The row of keys to type: done keys green, the current one on yellow, the rest white. It shrinks
 * to fit the box it is put in.
 */
import './typing.css';

const FLASH_MS = 250;

export interface BlockView {
  /** Put this where the block goes (the HUD's prompt panel, a lesson card). */
  readonly element: HTMLElement;
  /** Shows a new block with the first key current. */
  set(text: string): void;
  /** The current key is done; the next one is current. */
  advance(): void;
  /** Flashes the current key red and shakes it (until the next `set` or `advance` with `hold`). */
  wrong(hold?: boolean): void;
  /** The block's text. */
  readonly text: string;
  /** How many keys are done. */
  readonly position: number;
  /** The char to type now, or null when the block is done. */
  readonly current: string | null;
  /** Shrinks the row to fit its box again (after the box changed size). */
  fit(): void;
  dispose(): void;
}

export function createBlockView(): BlockView {
  const root = document.createElement('div');
  root.className = 'tb';
  const row = document.createElement('div');
  row.className = 'tb-row';
  root.appendChild(row);
  let text = '';
  let position = 0;
  let cells: HTMLElement[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;

  function fit(): void {
    row.style.transform = '';
    const room = root.clientWidth;
    const need = row.scrollWidth;
    if (room > 0 && need > room) row.style.transform = `scale(${room / need})`;
  }

  function paint(): void {
    cells.forEach((cell, i) => {
      cell.classList.toggle('tb-done', i < position);
      cell.classList.toggle('tb-now', i === position);
    });
  }

  const clearWrong = () => {
    clearTimeout(timer);
    cells[position]?.classList.remove('tb-wrong');
  };
  const onResize = () => fit();
  window.addEventListener('resize', onResize);

  return {
    element: root,
    set(next) {
      clearWrong();
      text = next;
      position = 0;
      row.replaceChildren();
      cells = [...next].map((char) => {
        const cell = document.createElement('span');
        cell.className = char === ' ' ? 'tb-key tb-space' : 'tb-key';
        cell.textContent = char === ' ' ? '␣' : char;
        row.appendChild(cell);
        return cell;
      });
      paint();
      fit();
    },
    advance() {
      clearWrong();
      if (position < cells.length) position++;
      paint();
    },
    wrong(hold = false) {
      const cell = cells[position];
      if (!cell) return;
      clearTimeout(timer);
      // Restart the shake when it is hit twice in a row.
      cell.classList.remove('tb-wrong');
      void cell.offsetWidth;
      cell.classList.add('tb-wrong');
      if (!hold) timer = setTimeout(() => cell.classList.remove('tb-wrong'), FLASH_MS);
    },
    get text() {
      return text;
    },
    get position() {
      return position;
    },
    get current() {
      return position < text.length ? text[position] : null;
    },
    fit,
    dispose() {
      clearTimeout(timer);
      window.removeEventListener('resize', onResize);
      root.remove();
    },
  };
}
