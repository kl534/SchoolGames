import './overlays.css';
import { speak, stopSpeaking, unlockAudio } from './audio';
import type { Fact, FactVisual, Topic } from './topics';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function button(label: string, className = 'sg-btn'): HTMLButtonElement {
  const b = el('button', className, label);
  b.type = 'button';
  return b;
}

function dotGrid(count: number, cols: number, size: number, dotClass = ''): HTMLElement {
  const grid = el('div', 'sg-dots');
  grid.style.setProperty('--cols', String(Math.max(1, Math.min(cols, count))));
  grid.style.setProperty('--dot', `${size}px`);
  for (let i = 0; i < count; i++) grid.appendChild(el('span', `sg-dot ${dotClass}`.trim()));
  return grid;
}

/** Dots to count: two groups to add, some crossed out to subtract, or rows to multiply. */
export function renderVisual(visual: FactVisual): HTMLElement {
  const wrap = el('div', 'sg-visual');
  wrap.setAttribute('aria-hidden', 'true');
  const { kind, a, b } = visual;
  if (kind === 'add') {
    wrap.append(dotGrid(a, 5, 22), el('span', 'sg-visual-sign', '+'), dotGrid(b, 5, 22, 'b'));
  } else if (kind === 'subtract') {
    const grid = dotGrid(a, 5, 22);
    [...grid.children].slice(a - b).forEach((dot) => dot.classList.add('gone'));
    wrap.append(grid);
  } else {
    // a rows of b dots ("a groups of b").
    const size = Math.max(10, Math.min(24, Math.floor(240 / Math.max(a, b))));
    wrap.append(dotGrid(a * b, b, size, 'b'));
  }
  return wrap;
}

export interface LessonOptions {
  topic: Topic;
  /** Facts to teach, usually the ones coming up in this round. */
  facts: Fact[];
  onDone: () => void;
  container?: HTMLElement;
}

export interface Lesson {
  dispose(): void;
}

/** Facts in first-seen order without repeats. */
export function uniqueFacts(facts: readonly Fact[]): Fact[] {
  return facts.filter((fact, i) => facts.findIndex((f) => f.id === fact.id) === i);
}

/**
 * Intro screen, then one card per fact (read aloud) before play starts.
 * The intro tap also unlocks audio on iOS. Skippable at any point.
 */
export function showLesson(options: LessonOptions): Lesson {
  const container = options.container ?? document.body;
  const facts = uniqueFacts(options.facts);
  const overlay = el('div', 'sg-overlay');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', `Lesson: ${options.topic.title}`);
  const card = el('div', 'sg-card');
  card.setAttribute('aria-live', 'polite');
  overlay.appendChild(card);
  container.appendChild(overlay);

  let disposed = false;
  const finish = () => {
    if (disposed) return;
    unlockAudio();
    dispose();
    options.onDone();
  };

  const showIntro = () => {
    const start = button('Start lesson ▶', 'sg-btn sg-btn-primary');
    const skip = button('Skip to game ⚽');
    start.addEventListener('click', () => {
      unlockAudio();
      showFact(0);
    });
    skip.addEventListener('click', finish);
    const row = el('div', 'sg-row');
    row.append(start, skip);
    card.replaceChildren(
      el('p', 'sg-muted', "Today's facts"),
      el('h1', undefined, options.topic.title),
      el('p', undefined, `Let's look at ${facts.length} facts, then play!`),
      row,
    );
    start.focus();
  };

  const showFact = (index: number) => {
    const fact = facts[index];
    const last = index === facts.length - 1;
    const back = button('◀', 'sg-btn');
    back.setAttribute('aria-label', 'Previous fact');
    back.disabled = index === 0;
    const hear = button('🔊', 'sg-btn');
    hear.setAttribute('aria-label', 'Hear it again');
    const next = button(last ? "Let's play! ⚽" : 'Next ▶', 'sg-btn sg-btn-primary');
    const skip = button('Skip to game');

    back.addEventListener('click', () => showFact(index - 1));
    hear.addEventListener('click', () => speak(fact.spokenStatement ?? fact.statement));
    next.addEventListener('click', () => (last ? finish() : showFact(index + 1)));
    skip.addEventListener('click', finish);

    const nav = el('div', 'sg-row');
    nav.append(back, hear, next);
    const extra = el('div', 'sg-row');
    extra.append(skip);

    card.replaceChildren(
      el('p', 'sg-progress-text', `${index + 1} of ${facts.length}`),
      el('div', 'sg-statement', fact.statement),
      ...(fact.visual ? [renderVisual(fact.visual)] : []),
      nav,
      extra,
    );
    next.focus();
    speak(fact.spokenStatement ?? fact.statement);
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    stopSpeaking();
    overlay.remove();
  };

  if (facts.length === 0) {
    queueMicrotask(finish);
  } else {
    showIntro();
  }
  return { dispose };
}
