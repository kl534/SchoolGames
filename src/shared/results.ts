import './overlays.css';
import { button } from './lesson';
import type { Fact } from './topics';
import { menuUrl, topicMenuUrl } from './ui';

export interface ResultsOptions {
  topicId: string;
  correct: number;
  total: number;
  stars: number;
  newBest: boolean;
  missed: Fact[];
  playerName?: string;
  onPlayAgain: () => void;
  container?: HTMLElement;
}

const HEADINGS = ['Good try', 'Nice work', 'Great job', 'Amazing'];

function link(label: string, href: string, className = 'sg-btn'): HTMLAnchorElement {
  const a = document.createElement('a');
  a.className = className;
  a.href = href;
  a.textContent = label;
  return a;
}

/** End-of-round screen: stars, score, facts to practice, and what to do next. */
export function showResults(options: ResultsOptions): { dispose(): void } {
  const container = options.container ?? document.body;
  const overlay = document.createElement('div');
  overlay.className = 'sg-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Round results');
  const card = document.createElement('div');
  card.className = 'sg-card';

  const heading = document.createElement('h1');
  const name = options.playerName ? `, ${options.playerName}` : '';
  heading.textContent = `${HEADINGS[options.stars] ?? HEADINGS[0]}${name}!`;

  const stars = document.createElement('div');
  stars.className = 'sg-stars';
  stars.setAttribute('aria-label', `${options.stars} of 3 stars`);
  for (let i = 0; i < 3; i++) {
    const star = document.createElement('span');
    star.textContent = '⭐';
    if (i >= options.stars) star.className = 'sg-star-off';
    stars.appendChild(star);
  }

  const score = document.createElement('p');
  score.textContent = `${options.correct} out of ${options.total} right`;
  score.style.fontSize = '22px';
  score.style.fontWeight = '700';

  card.append(heading, stars, score);

  if (options.newBest && options.stars > 0) {
    const badge = document.createElement('span');
    badge.className = 'sg-badge';
    badge.textContent = 'New best!';
    card.appendChild(badge);
  }

  if (options.missed.length > 0) {
    const label = document.createElement('p');
    label.className = 'sg-muted';
    label.textContent = 'Keep practicing:';
    const list = document.createElement('ul');
    list.className = 'sg-missed';
    for (const fact of options.missed) {
      const li = document.createElement('li');
      li.textContent = fact.statement;
      list.appendChild(li);
    }
    card.append(label, list);
  }

  const again = button('Play again ⚽', 'sg-btn sg-btn-primary');
  const row = document.createElement('div');
  row.className = 'sg-row';
  row.append(
    again,
    link('Other games', topicMenuUrl(options.topicId)),
    link('All topics', menuUrl()),
  );
  card.appendChild(row);
  overlay.appendChild(card);
  container.appendChild(overlay);

  const dispose = () => overlay.remove();
  again.addEventListener('click', () => {
    dispose();
    options.onPlayAgain();
  });
  again.focus();
  return { dispose };
}
