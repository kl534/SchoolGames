/**
 * Test out of a locked level: one block of 30 keys with no clock. Pass with at least 90% of the
 * keys right first time (a speed level also needs its words a minute, first key to last).
 */
import './typing.css';
import { sfx } from '../audio';
import type { Random } from '../random';
import { createBlockView } from './block';
import { planBlock, TEST_KEYS } from './blocks';
import { levelOf } from './course';
import { button, el, overlay } from './dom';
import { createKeyboard } from './keyboard';
import { onTypingKey } from './keys';
import { TEST_FAIL, TEST_PASS } from './lines';
import { TEST_PASS_SHARE, wpm } from './progress';

export interface TestOutOptions {
  level: number;
  onDone(passed: boolean): void;
  random?: Random;
  container?: HTMLElement;
  /** Lab only: keys already typed (all right). */
  typed?: number;
}

export interface TestOut {
  readonly element: HTMLElement;
  dispose(): void;
}

/** Whether a test-out block passes: enough right first time and, on a speed level, fast enough. */
export function testPassed(level: number, right: number, keys: number, seconds: number): boolean {
  if (right / keys < TEST_PASS_SHARE) return false;
  const goal = levelOf(level).wpm;
  return goal === undefined || wpm(keys, seconds) >= goal;
}

export function showTestOut(o: TestOutOptions): TestOut {
  const { root, card } = overlay('tt', o.container ?? document.body);
  const level = levelOf(o.level);
  el('h1', 'tt-title', card, `Test out of level ${o.level}`);
  el(
    'p',
    'tt-sub',
    card,
    level.kind === 'speed' ? `Type it at ${level.wpm} words a minute.` : `Keys: ${level.title}`,
  );
  const block = createBlockView();
  block.element.classList.add('tt-block');
  card.appendChild(block.element);
  const result = el('p', 'tt-result', card);
  result.hidden = true;
  const keyboard = createKeyboard({ hands: false });
  keyboard.element.classList.add('tt-kb');
  card.appendChild(keyboard.element);
  const actions = el('div', 'tt-actions', card);
  let passed = false;
  const continueButton = button('tt-continue', 'Continue', actions, () => finish());
  continueButton.hidden = true;

  const random = o.random ?? Math.random;
  const text = planBlock({ level: o.level, length: TEST_KEYS, random });
  block.set(text);
  keyboard.light(block.current);

  /** Positions that were typed wrong at least once. */
  const missed = new Set<number>();
  let startedAt: number | null = null;
  let over = false;
  let disposed = false;

  function finish(): void {
    dispose();
    o.onDone(passed);
  }

  function onKey(char: string): void {
    if (over) {
      if (char === ' ') finish();
      return;
    }
    const expected = block.current;
    if (expected === null) return;
    startedAt ??= performance.now();
    if (char === expected) {
      keyboard.flash(char, 'right');
      sfx.key();
      block.advance();
      keyboard.light(block.current);
      if (block.current === null) {
        const seconds = (performance.now() - startedAt) / 1000;
        const right = text.length - missed.size;
        passed = testPassed(o.level, right, text.length, seconds);
        over = true;
        result.hidden = false;
        result.textContent = passed ? TEST_PASS : TEST_FAIL;
        result.classList.add(passed ? 'tt-pass' : 'tt-fail');
        continueButton.hidden = false;
      }
    } else {
      missed.add(block.position);
      keyboard.flash(char, 'wrong');
      sfx.wrongKey();
      block.wrong();
    }
  }

  const stopKeys = onTypingKey(onKey, { onCaps: (on) => keyboard.setCaps(on) });
  for (let i = 0; i < (o.typed ?? 0) && block.current !== null; i++) {
    block.advance();
    keyboard.light(block.current);
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    stopKeys();
    keyboard.dispose();
    block.dispose();
    root.remove();
  }
  return { element: root, dispose };
}
