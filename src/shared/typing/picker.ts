/**
 * The start screen of a typing game: the 40 level chips, the level chosen with what it scores,
 * "Show me the keys again" and the prompt to press the space bar. A level that is not open yet
 * can be tested out of.
 */
import './typing.css';
import { LEVEL_COUNT, levelOf, multiplier, TYPING_LEVELS, type TypingLevel } from './course';
import { button, el, overlay } from './dom';
import { onTypingKey } from './keys';
import { SPACE_LINE } from './lines';
import type { TypingProgress } from './progress';

export interface PickerOptions {
  typing: TypingProgress;
  /** The level chosen now (an open one). */
  selected: number;
  /** A passed or open level was tapped. */
  onPick(n: number): void;
  /** The player agreed to test out of a locked level. */
  onTestOut(n: number): void;
  /** "Show me the keys again" for the chosen level. */
  onLesson(n: number): void;
  /** The space bar was pressed. */
  onStart(): void;
  container?: HTMLElement;
  /** The prompt to start (default 'Press the space bar to ride!'). */
  spaceLine?: string;
}

export interface LevelPicker {
  readonly element: HTMLElement;
  /** Chooses a level and redraws (call it after the player opened more levels, too). */
  select(n: number): void;
  dispose(): void;
}

/** A chip's title: the level's keys, cut to three and an ellipsis when there are more. */
export function chipTitle(level: TypingLevel): string {
  if (level.kind === 'speed' || level.skills[0].startsWith('shift')) return level.title;
  const keys = level.title.split(' ');
  return keys.length > 3 ? `${keys.slice(0, 3).join(' ')}…` : level.title;
}

export const testOutAsk = (n: number): string =>
  `Test out of level ${n}? Type one block of its keys. 90% right opens it.`;

export function showLevelPicker(o: PickerOptions): LevelPicker {
  const { root, card } = overlay('tp', o.container ?? document.body);
  const header = el('h1', 'tp-header', card);
  el('p', 'tp-headline', card, 'Higher levels score more points!');
  const grid = el('div', 'tp-grid', card);
  const actions = el('div', 'tp-actions', card);
  const lessonButton = button('tp-lesson', 'Show me the keys again', actions, () =>
    o.onLesson(selected),
  );
  el('p', 'tp-space', card, o.spaceLine ?? SPACE_LINE);
  let selected = o.selected;
  let ask: HTMLElement | null = null;
  let disposed = false;

  function closeAsk(): void {
    ask?.remove();
    ask = null;
  }

  function openAsk(n: number): void {
    closeAsk();
    ask = el('div', 'tp-ask', root);
    const box = el('div', 'tx-card tp-ask-box', ask);
    el('p', 'tp-ask-text', box, testOutAsk(n));
    const row = el('div', 'tp-ask-row', box);
    button('tp-test', 'Test', row, () => {
      closeAsk();
      o.onTestOut(n);
    });
    button('tp-cancel', 'Cancel', row, closeAsk);
  }

  function draw(): void {
    const level = levelOf(selected);
    header.textContent = `Level ${selected} · ${level.title} · ×${multiplier(selected)}`;
    lessonButton.hidden = level.kind !== 'keys';
    grid.replaceChildren();
    for (const l of TYPING_LEVELS) {
      const state = l.n < o.typing.open ? 'passed' : l.n === o.typing.open ? 'open' : 'locked';
      const chip = el('button', `tp-chip tp-${state}`, grid);
      chip.type = 'button';
      chip.classList.toggle('tp-sel', l.n === selected);
      chip.setAttribute('aria-label', `Level ${l.n}, ${l.title}, ${state}`);
      const top = el('span', 'tp-top', chip);
      el('span', 'tp-n', top, String(l.n));
      el('span', 'tp-mark', top, state === 'passed' ? '✓' : state === 'locked' ? '🔒' : 'NEXT');
      el('span', 'tp-t', chip, chipTitle(l));
      el('span', 'tp-x', chip, `×${multiplier(l.n)}`);
      chip.addEventListener('click', () => {
        if (state === 'locked') {
          openAsk(l.n);
          return;
        }
        selected = l.n;
        draw();
        o.onPick(l.n);
      });
    }
  }
  draw();
  grid.querySelector<HTMLElement>('.tp-sel')?.scrollIntoView?.({ block: 'nearest' });

  const stopKeys = onTypingKey((char) => {
    if (char === ' ' && !ask) o.onStart();
  });

  return {
    element: root,
    select(n) {
      selected = Math.min(Math.max(n, 1), LEVEL_COUNT);
      draw();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stopKeys();
      root.remove();
    },
  };
}
