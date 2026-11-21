/**
 * The HUD panel of Type Brawl: the player's avatar and a health bar, and a row of score, streak
 * badge, level, fight number and best score. Styles are `br-*` in `index.html`.
 */
import { HP_MAX } from './rules';

export interface HudNumbers {
  score: number;
  /** The streak's points multiplier; the badge is hidden at 1. */
  streak: number;
  level: number;
  /** 'Stage 2 · 1/3' or 'Stage 2 · Boss'. */
  fight: string;
  /** Knock-outs the star still makes perfect; the badge is hidden at 0. */
  stars: number;
  best: number;
}

export interface Hud {
  readonly element: HTMLElement;
  /** Shows `hp`; with `ghostFrom` a pale chunk from that value down to `hp` eases off. */
  setHealth(hp: number, ghostFrom?: number): void;
  render(n: HudNumbers): void;
  /** A red flash on the screen's edge (0.25 s) and a shake of the bar. */
  hurt(): void;
  /** Eases the ghost chunk off; `hold` keeps it where it is (dev freeze). */
  update(delta: number, hold?: boolean): void;
  show(shown: boolean): void;
  dispose(): void;
}

/** The colour of the bar for this much health: green, yellow below 50, red below 25. */
export const healthColor = (hp: number): string =>
  hp < 25 ? '#ef4444' : hp < 50 ? '#facc15' : '#4ade80';

const fmt = (n: number): string => n.toLocaleString('en-US');

export function createHud(avatar: string): Hud {
  const element = document.createElement('div');
  element.className = 'br-hud';
  element.hidden = true;

  const top = document.createElement('div');
  top.className = 'br-row br-health';
  const face = document.createElement('span');
  face.className = 'br-avatar';
  face.textContent = avatar;
  const bar = document.createElement('div');
  bar.className = 'br-bar';
  const ghost = document.createElement('div');
  ghost.className = 'br-ghost';
  const fill = document.createElement('div');
  fill.className = 'br-fill';
  const hpText = document.createElement('span');
  hpText.className = 'br-hp';
  bar.append(ghost, fill, hpText);
  top.append(face, bar);

  const row = document.createElement('div');
  row.className = 'br-row br-stats';
  const score = document.createElement('span');
  score.className = 'br-score';
  const streak = document.createElement('span');
  streak.className = 'br-streak';
  const star = document.createElement('span');
  star.className = 'br-star';
  const level = document.createElement('span');
  level.className = 'br-level';
  const fight = document.createElement('span');
  fight.className = 'br-fight';
  const best = document.createElement('span');
  best.className = 'br-best';
  row.append(score, streak, star, level, fight, best);
  element.append(top, row);
  document.body.appendChild(element);

  const flash = document.createElement('div');
  flash.className = 'br-flash';
  document.body.appendChild(flash);

  let hp = HP_MAX;
  let ghostAt = HP_MAX;
  let ghostDelay = 0;
  const paint = () => {
    fill.style.width = `${hp}%`;
    fill.style.background = healthColor(hp);
    ghost.style.width = `${Math.max(ghostAt, hp)}%`;
    hpText.textContent = String(Math.round(hp));
  };
  paint();

  return {
    element,
    setHealth(next, ghostFrom) {
      hp = next;
      if (ghostFrom !== undefined && ghostFrom > next) {
        ghostAt = ghostFrom;
        ghostDelay = 0.5;
      } else ghostAt = Math.min(ghostAt, next);
      paint();
    },
    render(n) {
      score.textContent = fmt(n.score);
      streak.hidden = n.streak <= 1;
      streak.textContent = `🔥×${n.streak}`;
      star.hidden = n.stars <= 0;
      star.textContent = `⭐×${n.stars}`;
      level.textContent = `Lv ${n.level}`;
      fight.textContent = n.fight;
      best.textContent = `Best ${fmt(Math.max(n.best, n.score))}`;
    },
    hurt() {
      flash.classList.remove('go');
      bar.classList.remove('br-shake');
      void flash.offsetWidth;
      flash.classList.add('go');
      bar.classList.add('br-shake');
    },
    update(delta, hold = false) {
      if (hold) return;
      if (ghostAt > hp) {
        if (ghostDelay > 0) ghostDelay -= delta;
        else ghostAt = Math.max(hp, ghostAt - 40 * delta);
        paint();
      }
    },
    show(shown) {
      element.hidden = !shown;
    },
    dispose() {
      element.remove();
      flash.remove();
    },
  };
}
