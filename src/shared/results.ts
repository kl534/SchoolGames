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
  /** For games scored in points: shown large in place of the stars. */
  score?: number;
  /** The player's high score, including this run when it set a new one. */
  highScore?: number;
  newHighScore?: boolean;
  /** Label of the play again button; defaults to 'Play again ⚽'. */
  playAgainLabel?: string;
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

export interface ResultsSummary {
  heading: string;
  /** The points score as text, or null for a stars game. */
  score: string | null;
  /** 'High score: 2,400', or null when there is none to show. */
  highScore: string | null;
  /** The badge to show, if any. */
  badge: 'New high score!' | 'New best!' | null;
  /** 'X out of Y right'. */
  right: string;
  /** Whether to show the stars (a game without a score). */
  showStars: boolean;
  playAgainLabel: string;
}

/** What the results screen says, apart from the facts to practice. Pure, so it is easy to test. */
export function resultsSummary(options: ResultsOptions): ResultsSummary {
  const name = options.playerName ? `, ${options.playerName}` : '';
  const scored = options.score !== undefined;
  return {
    heading: `${HEADINGS[options.stars] ?? HEADINGS[0]}${name}!`,
    score: scored ? options.score!.toLocaleString() : null,
    highScore:
      scored && options.highScore !== undefined
        ? `High score: ${options.highScore.toLocaleString()}`
        : null,
    badge: scored
      ? options.newHighScore
        ? 'New high score!'
        : null
      : options.newBest && options.stars > 0
        ? 'New best!'
        : null,
    right: `${options.correct} out of ${options.total} right`,
    showStars: !scored,
    playAgainLabel: options.playAgainLabel ?? 'Play again ⚽',
  };
}

/**
 * End-of-round screen: stars (or the points score), facts to practice, and what to do next.
 * With `score` set it shows the score and high score instead of the stars.
 */
export function showResults(options: ResultsOptions): { dispose(): void } {
  const container = options.container ?? document.body;
  const overlay = document.createElement('div');
  overlay.className = 'sg-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Round results');
  const card = document.createElement('div');
  card.className = 'sg-card';

  const summary = resultsSummary(options);
  const heading = document.createElement('h1');
  heading.textContent = summary.heading;

  const right = document.createElement('p');
  right.className = 'sg-right';
  right.textContent = summary.right;

  const badge = summary.badge ? document.createElement('span') : null;
  if (badge) {
    badge.className = 'sg-badge';
    badge.textContent = summary.badge;
  }

  if (summary.score !== null) {
    const points = document.createElement('div');
    points.className = 'sg-score';
    points.setAttribute('aria-label', `Score ${summary.score}`);
    points.textContent = summary.score;
    card.append(heading, points);
    if (summary.highScore) {
      const best = document.createElement('p');
      best.className = 'sg-muted';
      best.textContent = summary.highScore;
      card.appendChild(best);
    }
    if (badge) card.appendChild(badge);
    card.appendChild(right);
  } else {
    const stars = document.createElement('div');
    stars.className = 'sg-stars';
    stars.setAttribute('aria-label', `${options.stars} of 3 stars`);
    for (let i = 0; i < 3; i++) {
      const star = document.createElement('span');
      star.textContent = '⭐';
      if (i >= options.stars) star.className = 'sg-star-off';
      stars.appendChild(star);
    }
    card.append(heading, stars, right);
    if (badge) card.appendChild(badge);
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

  const again = button(summary.playAgainLabel, 'sg-btn sg-btn-primary');
  const row = document.createElement('div');
  row.className = 'sg-row sg-actions';
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
  // Without scrolling: on a short screen that would hide the heading.
  again.focus({ preventScroll: true });
  return { dispose };
}
