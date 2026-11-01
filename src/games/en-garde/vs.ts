import { CHAMPION_RUNG, RIVALS, vsSubtitle } from './rules';

export interface VsOptions {
  /** The saved ladder place (0 to 5). */
  rung: number;
  /** Index of the rival about to be fought. */
  rival: number;
  onFight: () => void;
  container?: HTMLElement;
}

export interface VsCard {
  dispose(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  parent: HTMLElement,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  parent.appendChild(node);
  return node;
}

/**
 * The VS card before a bout: the five rungs top-down (done, current, locked), "YOU vs RIVAL",
 * how to win, and a big Fight! button. Its class is `eg-vs`, not `sg-overlay`, so the preview that
 * follows is still the one `npm run shots --start` taps.
 */
export function showVs(options: VsOptions): VsCard {
  const crowned = options.rung >= CHAMPION_RUNG;
  const rival = RIVALS[options.rival];
  const overlay = el('div', 'eg-vs', options.container ?? document.body);
  const card = el('div', 'eg-vs-card', overlay);

  el('h1', 'eg-vs-heading', card, crowned ? '👑 Party Champion' : 'Climb the ladder!');
  const rungs = el('ol', 'eg-rungs', card);
  for (let i = RIVALS.length - 1; i >= 0; i--) {
    const row = el('li', 'eg-rung-row', rungs);
    const done = crowned || i < options.rung;
    const current = crowned ? i === options.rival : i === options.rung;
    row.classList.toggle('done', done);
    row.classList.toggle('current', current);
    row.classList.toggle('locked', !done && !current);
    el('span', 'eg-rung-icon', row, current && !crowned ? '▶' : done ? '✔' : '🔒');
    el('span', 'eg-rung-name', row, RIVALS[i].name);
    const note = current ? (crowned ? 'Rematch' : `${RIVALS[i].pokesToWin} pokes`) : '';
    el('span', 'eg-rung-note', row, note);
  }

  // On a short landscape screen the ladder sits on the left and these on the right.
  const side = el('div', 'eg-vs-side', card);
  const names = el('div', 'eg-vs-names', side);
  el('span', 'eg-vs-you', names, 'YOU');
  el('span', 'eg-vs-vs', names, 'vs');
  el('span', 'eg-vs-rival', names, rival.name);
  el('p', 'eg-vs-sub', side, vsSubtitle(rival));
  const fight = el('button', 'eg-fight', side, 'Fight! 🎈');
  fight.type = 'button';
  fight.addEventListener('click', () => {
    overlay.remove();
    options.onFight();
  });
  return { dispose: () => overlay.remove() };
}
