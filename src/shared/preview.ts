import './overlays.css';
import { speak, stopSpeaking, unlockAudio } from './audio';
import { statementSpeech, type Fact, type Topic } from './topics';

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

/** Most facts the preview shows. */
export const MAX_PREVIEW = 10;

export interface PreviewOptions {
  topic: Topic;
  /** Facts coming up, usually the ones in this round; shown with their answers. */
  facts: Fact[];
  onDone: () => void;
  container?: HTMLElement;
}

export interface Preview {
  dispose(): void;
}

/** Facts in first-seen order without repeats. */
export function uniqueFacts(facts: readonly Fact[]): Fact[] {
  return facts.filter((fact, i) => facts.findIndex((f) => f.id === fact.id) === i);
}

/**
 * One page before play: the facts coming up, answers included, as chips that read the fact aloud
 * when tapped, and a big Start button. Nothing is spoken until the player taps, and the Start tap
 * also unlocks audio on iOS.
 */
export function showPreview(options: PreviewOptions): Preview {
  const container = options.container ?? document.body;
  const facts = uniqueFacts(options.facts).slice(0, MAX_PREVIEW);
  const overlay = el('div', 'sg-overlay');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', `Coming up: ${options.topic.title}`);
  const card = el('div', 'sg-card');

  const list = el('div', 'sg-preview');
  for (const fact of facts) {
    const chip = button(fact.statement, 'sg-chip');
    chip.addEventListener('click', () => {
      unlockAudio();
      speak(statementSpeech(fact));
    });
    list.appendChild(chip);
  }
  const start = button('Start game ▶', 'sg-btn sg-btn-primary');
  card.append(
    el('p', 'sg-muted sg-preview-label', 'Coming up'),
    el('h1', undefined, options.topic.title),
    el('p', 'sg-muted', options.topic.description),
    list,
    start,
  );
  overlay.appendChild(card);
  container.appendChild(overlay);

  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    stopSpeaking();
    overlay.remove();
  };
  const finish = () => {
    if (disposed) return;
    unlockAudio();
    dispose();
    options.onDone();
  };

  start.addEventListener('click', finish);
  if (facts.length === 0) {
    queueMicrotask(finish);
  } else {
    // Without scrolling: on a short screen that would hide the heading.
    start.focus({ preventScroll: true });
  }
  return { dispose };
}
