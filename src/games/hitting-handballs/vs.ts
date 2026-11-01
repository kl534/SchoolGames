import { CHAMPION_RUNG, PAIRS, TEAMMATE_NAME, vsSubtitle } from './rules';

export interface VsOptions {
  /** The saved ladder place (0 to 5). */
  rung: number;
  /** Index of the pair about to be played. */
  pair: number;
  onPlay: () => void;
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
 * The VS card before a match: the five rungs top-down (done, current, locked), "YOU vs RIVAL",
 * how to win, and a big Play! button. Its class is `hb-vs`, not `sg-overlay`, so the preview that follows
 * is still the one `npm run shots --start` taps.
 */
export function showVs(options: VsOptions): VsCard {
  const crowned = options.rung >= CHAMPION_RUNG;
  const pair = PAIRS[options.pair];
  const overlay = el('div', 'hb-vs', options.container ?? document.body);
  const card = el('div', 'hb-vs-card', overlay);

  el('h1', 'hb-vs-heading', card, crowned ? '👑 Recess Champions' : 'Climb the ladder!');
  const rungs = el('ol', 'hb-rungs', card);
  for (let i = PAIRS.length - 1; i >= 0; i--) {
    const row = el('li', 'hb-rung-row', rungs);
    const done = crowned || i < options.rung;
    const current = crowned ? i === options.pair : i === options.rung;
    row.classList.toggle('done', done);
    row.classList.toggle('current', current);
    row.classList.toggle('locked', !done && !current);
    el('span', 'hb-rung-icon', row, current && !crowned ? '▶' : done ? '✔' : '🔒');
    el('span', 'hb-rung-name', row, PAIRS[i].name);
    const note = current ? (crowned ? 'Rematch' : `smash < ${PAIRS[i].smashUnder} s`) : '';
    el('span', 'hb-rung-note', row, note);
  }

  // On a short landscape screen the ladder sits on the left and these on the right.
  const side = el('div', 'hb-vs-side', card);
  const names = el('div', 'hb-vs-names', side);
  el('span', 'hb-vs-you', names, `YOU & ${TEAMMATE_NAME.toUpperCase()}`);
  el('span', 'hb-vs-vs', names, 'vs');
  el('span', 'hb-vs-rival', names, pair.name);
  el('p', 'hb-vs-sub', side, vsSubtitle(pair));
  const fight = el('button', 'hb-fight', side, 'Play! ✋');
  fight.type = 'button';
  fight.addEventListener('click', () => {
    overlay.remove();
    options.onPlay();
  });
  return { dispose: () => overlay.remove() };
}
