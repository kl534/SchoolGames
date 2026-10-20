import { fillAnswers, lockAnswers, markAnswers } from '../../shared/answers';
import type { Rect } from './layout';
import type { Puck, Zone } from './rules';
import type { Team } from './teams';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  parent: HTMLElement,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  parent.appendChild(node);
  return node;
}

const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

/** White or dark text, whichever shows against a colour. */
function inkFor(color: number): string {
  const luma = ((color >> 16) & 255) * 0.3 + ((color >> 8) & 255) * 0.59 + (color & 255) * 0.11;
  return luma > 150 ? '#14213d' : '#ffffff';
}

export interface BugInfo {
  us: Team;
  them: Team;
  usGoals: number;
  themGoals: number;
  /** "1ST", "2ND", "3RD", "OT", "SO". */
  period: string;
  /** "12:24". */
  clock: string;
  puck: Puck;
  /** In the shootout: the shots so far (true = goal), 3 dots a side or more. */
  shots: { us: boolean[]; them: boolean[] } | null;
}

export type BannerKind = 'good' | 'miss' | 'info';

export interface Hud {
  hideQuestion(hidden: boolean): void;
  setQuestion(text: string): void;
  setOptions(options: string[]): void;
  lock(): void;
  mark(chosen: number, correct: number, right: boolean): void;
  renderBug(info: BugInfo): void;
  /** The answer clock: a ring that empties; `null` hides it. */
  setClock(clock: { left: number; total: number } | null): void;
  /** Shows a call in the question panel: the call over the fact. */
  showCall(title: string, detail: string): void;
  /** Puts the question back after a call. */
  restoreQuestion(): void;
  /** The screen rows the question's panel ends at, and the answers begin at, as laid out now. */
  measureBand(): { top: number; bottom: number };
  bugRect(): Rect;
  bugBottom(): number;
  /** A banner in the middle of the play band (`y` in px from the top). */
  showBanner(title: string, kind: BannerKind, y: number, detail?: string): void;
  hideBanner(): void;
  /** Makes a side's goals jump. */
  flashGoals(side: 'us' | 'them'): void;
  readonly buttons: HTMLButtonElement[];
  readonly hear: HTMLButtonElement;
  /** What the finger and caption that point at the green answer keep off. */
  readonly avoid: readonly HTMLElement[];
}

const ZONES: { zone: Zone; label: string }[] = [
  { zone: 'our-end', label: 'OUR END' },
  { zone: 'neutral', label: 'NEUTRAL' },
  { zone: 'their-end', label: 'THEIR END' },
];

export function createHud(): Hud {
  const bug = el('div', 'ss-bug', document.body);
  const board = el('div', 'ss-board', bug);
  const usBox = el('span', 'ss-team', board);
  const usChip = el('i', 'ss-chip', usBox);
  const usName = el('span', 'ss-abbr', usBox);
  const usPts = el('b', 'ss-pts', usBox);
  const themBox = el('span', 'ss-team', board);
  const themChip = el('i', 'ss-chip', themBox);
  const themName = el('span', 'ss-abbr', themBox);
  const themPts = el('b', 'ss-pts', themBox);
  const periodText = el('span', 'ss-period', board);
  const clockText = el('span', 'ss-clock', board);
  const strip = el('div', 'ss-strip', bug);
  const cells = ZONES.map(({ label }) => {
    const cell = el('div', 'ss-cell', strip);
    el('span', 'ss-cell-text', cell).textContent = label;
    return cell;
  });
  const shootout = el('div', 'ss-shootout', bug);
  shootout.hidden = true;

  const hudBox = el('div', 'ss-hud', document.body);
  const problem = el('div', 'ss-problem', hudBox);
  problem.setAttribute('aria-live', 'polite');
  const ring = el('div', 'ss-ring', problem);
  ring.setAttribute('role', 'timer');
  ring.setAttribute('aria-label', 'Answer clock');
  const ringText = el('span', 'ss-ring-text', ring);
  ring.hidden = true;
  const problemText = el('span', 'ss-problem-text', problem);
  const hear = el('button', 'ss-hear', problem);
  hear.type = 'button';
  hear.textContent = '🔊';
  hear.setAttribute('aria-label', 'Hear the question');

  const answers = el('div', 'ss-answers', document.body);
  const buttons = Array.from({ length: 4 }, () => {
    const button = el('button', 'ss-answer', answers);
    button.type = 'button';
    return button;
  });

  const banner = el('div', 'ss-banner', document.body);
  banner.setAttribute('role', 'status');
  const bannerTitle = el('div', 'ss-banner-title', banner);
  const bannerDetail = el('div', 'ss-banner-detail', banner);
  banner.hidden = true;

  let options: string[] = [];
  let questionText = '';
  let calling = false;
  hudBox.hidden = true;
  answers.hidden = true;

  const replay = (node: HTMLElement) => {
    node.classList.remove('on');
    void node.offsetWidth;
    node.classList.add('on');
  };

  const rectOf = (node: HTMLElement): Rect => {
    const r = node.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  };

  const restore = () => {
    if (!calling) return;
    calling = false;
    hudBox.classList.remove('calling');
    problemText.textContent = questionText;
    hear.setAttribute('aria-label', 'Hear the question');
  };

  return {
    buttons,
    hear,
    avoid: [bug, hudBox, banner],
    hideQuestion(hidden) {
      hudBox.hidden = hidden;
      answers.hidden = hidden;
      buttons.forEach((b, i) => (b.hidden = options[i] === undefined));
    },
    setQuestion(text) {
      questionText = text;
      calling = false;
      hudBox.classList.remove('calling');
      problemText.textContent = text;
      hear.setAttribute('aria-label', 'Hear the question');
    },
    setOptions(next) {
      options = next;
      fillAnswers(buttons, next, 'ss-answer');
    },
    lock() {
      lockAnswers(buttons);
    },
    mark(chosen, correct, right) {
      markAnswers(buttons, chosen, correct, right);
    },
    renderBug(info) {
      usName.textContent = info.us.abbr;
      themName.textContent = info.them.abbr;
      usChip.style.background = hex(info.us.jersey);
      themChip.style.background = hex(info.them.jersey);
      usChip.style.borderColor = hex(info.us.trim);
      themChip.style.borderColor = hex(info.them.trim);
      usPts.textContent = String(info.usGoals);
      themPts.textContent = String(info.themGoals);
      periodText.textContent = info.period;
      clockText.textContent = info.clock;
      const inShootout = info.shots !== null;
      strip.hidden = inShootout;
      shootout.hidden = !inShootout;
      if (info.shots) {
        const total = Math.max(3, info.shots.us.length, info.shots.them.length);
        const row = (team: Team, shots: boolean[]) => {
          const line = el('div', 'ss-so-row', shootout);
          el('span', 'ss-so-name', line).textContent = team.abbr;
          for (let i = 0; i < total; i++) {
            const dot = el('span', 'ss-so-dot', line);
            dot.textContent = i >= shots.length ? '○' : shots[i] ? '●' : '○';
            dot.classList.toggle('goal', i < shots.length && shots[i]);
            dot.classList.toggle('miss', i < shots.length && !shots[i]);
          }
        };
        shootout.replaceChildren();
        row(info.us, info.shots.us);
        row(info.them, info.shots.them);
      } else {
        const faceoff = info.puck.kind === 'faceoff';
        ZONES.forEach(({ zone, label }, i) => {
          const cell = cells[i];
          const here = info.puck.zone === zone;
          const owner =
            info.puck.kind === 'held' ? (info.puck.side === 'us' ? info.us : info.them) : null;
          cell.classList.toggle('on', here && !faceoff);
          cell.classList.toggle('faceoff', here && faceoff);
          cell.style.background = here && owner ? hex(owner.jersey) : '';
          cell.style.color = here && owner ? inkFor(owner.jersey) : '';
          const text = cell.querySelector('.ss-cell-text');
          if (text) text.textContent = here && faceoff ? 'FACEOFF' : label;
          cell.querySelector('.ss-puckdot')?.remove();
          if (here) el('i', 'ss-puckdot', cell);
        });
      }
      bug.setAttribute(
        'aria-label',
        `${info.us.abbr} ${info.usGoals}, ${info.them.abbr} ${info.themGoals}, ${info.period}, ${info.clock}`,
      );
    },
    setClock(clock) {
      if (!clock) {
        ring.hidden = true;
        ring.classList.remove('urgent');
        return;
      }
      ring.hidden = false;
      const left = Math.max(0, clock.left);
      const text = String(Math.ceil(left));
      if (ringText.textContent !== text) ringText.textContent = text;
      ring.style.setProperty('--p', `${(left / Math.max(clock.total, 0.001)) * 360}deg`);
      ring.classList.toggle('urgent', left <= 3);
    },
    showCall(title, detail) {
      calling = true;
      hudBox.classList.add('calling');
      ring.hidden = true;
      problemText.replaceChildren();
      el('span', 'ss-call-title', problemText).textContent = title;
      el('span', 'ss-call-statement', problemText).textContent = detail;
      hear.setAttribute('aria-label', 'Hear the answer');
    },
    restoreQuestion: restore,
    measureBand() {
      const hidden = [hudBox.hidden, answers.hidden, ...buttons.map((b) => b.hidden)];
      hudBox.hidden = false;
      answers.hidden = false;
      buttons.forEach((b) => (b.hidden = false));
      const band = {
        top: hudBox.getBoundingClientRect().bottom,
        bottom: answers.getBoundingClientRect().top,
      };
      [hudBox.hidden, answers.hidden] = [hidden[0], hidden[1]];
      buttons.forEach((b, i) => (b.hidden = hidden[i + 2]));
      return band;
    },
    bugRect() {
      return rectOf(bug);
    },
    bugBottom() {
      return bug.getBoundingClientRect().bottom;
    },
    showBanner(title, kind, y, detail) {
      bannerTitle.textContent = title;
      bannerDetail.textContent = detail ?? '';
      bannerDetail.hidden = !detail;
      banner.className = `ss-banner ${kind}`;
      banner.hidden = false;
      banner.style.top = `${y}px`;
      replay(banner);
    },
    hideBanner() {
      banner.hidden = true;
    },
    flashGoals(side) {
      replay(side === 'us' ? usPts : themPts);
    },
  };
}
