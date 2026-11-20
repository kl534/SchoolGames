/**
 * The lesson that opens a level: a keyboard with two hands, the finger for each new key lit and
 * reaching for it while a voice explains (show), then five of the key to type (try), then a short
 * mix with the keys learned so far. Only the finger explanations are spoken; every other line is
 * text. A speed level has no lesson, only a card.
 */
import './typing.css';
import { sfx, stopSpeaking } from '../audio';
import type { Random } from '../random';
import { createTimers } from '../timers';
import { createBlockView } from './block';
import { planBlock } from './blocks';
import { charsOfSkill, knownChars, levelOf, multiplier, skillOf, type SkillId } from './course';
import { button, el, overlay } from './dom';
import { createKeyboard } from './keyboard';
import { FINGER_COLORS, fingerColor, fingerOf } from './keyboard-layout';
import { onTypingKey } from './keys';
import {
  HOME_REST_LINE,
  HOME_ROW_LINE,
  lessonLine,
  MIX_LINE,
  multiplierLine,
  NEW_KEYS,
  READY_LINE,
  SPACE_LINE,
  speedLine,
  YOUR_TURN,
} from './lines';

/** Seconds after a spoken line ends before the lesson goes on. */
export const NEXT_DELAY = 2.4;
/** Keys of one skill to type in the try step, and keys in the mix. */
export const TRY_KEYS = 5;
export const MIX_KEYS = 10;
/** Seconds the speed card shows. */
export const SPEED_CARD_SECONDS = 2.5;
/** The pause after the last key of a try or mix before the next step. */
const STEP_PAUSE = 0.5;

export type LessonStep =
  | { kind: 'home'; line: string }
  | { kind: 'show' | 'try' | 'mix'; skill: SkillId }
  | { kind: 'done' };

/** Lab only: open on a step, `at` seconds in, with `typed` keys of its block done, and hold still. */
export interface LessonLab {
  step: 'home' | 'show' | 'try' | 'mix' | 'done';
  skill?: SkillId;
  at?: number;
  typed?: number;
}

export interface KeyLessonOptions {
  level: number;
  onDone(): void;
  onSkip(): void;
  /** Reads a line aloud, calling `onEnd` when it ends (the lesson's only spoken lines go through it). */
  speak(text: string, onEnd?: () => void): void;
  /** True while the game is paused: the lesson's clock holds. */
  paused?: () => boolean;
  random?: Random;
  container?: HTMLElement;
  lab?: LessonLab;
  /** The ready card's title (default `READY_LINE`, "You're ready! Let's ride!"). */
  readyLine?: string;
  /** The ready card's prompt to start (default 'Press the space bar to ride!'). */
  spaceLine?: string;
}

export interface KeyLesson {
  readonly element: HTMLElement;
  /** Moves the lesson on by `delta` seconds; its own frame loop calls this, a test can too. */
  update(delta: number): void;
  dispose(): void;
}

/** The char the hands reach for when showing a skill: a capital for a Shift skill. */
export function repChar(skill: SkillId): string {
  if (skill === 'shift-right') return 'F';
  if (skill === 'shift-left') return 'J';
  return skill;
}

/** The chars known before a skill: earlier levels and the skills before it in its level. */
export function knownBefore(level: number, skill: SkillId): string[] {
  const skills = levelOf(level).skills;
  return [
    ...(level > 1 ? knownChars(level - 1) : []),
    ...skills.slice(0, skills.indexOf(skill)).flatMap(charsOfSkill),
  ];
}

/** The steps of a key level's lesson. */
export function lessonSteps(level: number): LessonStep[] {
  const steps: LessonStep[] = [];
  if (level === 1) {
    steps.push({ kind: 'home', line: HOME_ROW_LINE }, { kind: 'home', line: HOME_REST_LINE });
  }
  for (const skill of levelOf(level).skills) {
    steps.push({ kind: 'show', skill }, { kind: 'try', skill });
    // Nothing to mix it with when nothing else is known yet.
    if (knownBefore(level, skill).length > 0) steps.push({ kind: 'mix', skill });
  }
  steps.push({ kind: 'done' });
  return steps;
}

/** The block of the try step: five of the key; a Shift skill alternates capitals of its hand. */
export function tryText(skill: SkillId, random: Random, first?: string): string {
  if (skill.length === 1) return skill.repeat(TRY_KEYS);
  const pool = charsOfSkill(skill);
  const out: string[] = [];
  for (let i = 0; i < TRY_KEYS; i++) {
    const choices = pool.filter((c) => c !== out[i - 1]);
    out.push(i === 0 && first ? first : choices[Math.floor(random() * choices.length)]);
  }
  return out.join('');
}

function keyCap(skill: SkillId): string {
  if (skill === ' ') return '␣';
  if (skill.startsWith('shift')) return '⇧';
  return skill;
}

function showSpeedCard(o: KeyLessonOptions): KeyLesson {
  const level = levelOf(o.level);
  const { root, card } = overlay('tl', o.container ?? document.body);
  card.classList.add('tl-card');
  el('h2', 'tl-speed', card, speedLine(level.wpm ?? 0));
  const mult = el('div', 'tl-mult', card);
  el('span', 'tl-badge', mult, `×${multiplier(o.level)}`);
  el('p', 'tl-mult-line', mult, multiplierLine(o.level));
  const timers = createTimers();
  let disposed = false;
  let last = performance.now();
  let frame = 0;
  const dispose = () => {
    disposed = true;
    cancelAnimationFrame(frame);
    root.remove();
  };
  timers.after(SPEED_CARD_SECONDS, () => {
    dispose();
    o.onDone();
  });
  const loop = (now: number) => {
    if (disposed) return;
    const delta = Math.min((now - last) / 1000, 0.1);
    last = now;
    timers.update(o.paused?.() ? 0 : delta);
    frame = requestAnimationFrame(loop);
  };
  if (!o.lab) frame = requestAnimationFrame(loop);
  return { element: root, update: (delta) => timers.update(delta), dispose };
}

export function showKeyLesson(o: KeyLessonOptions): KeyLesson {
  if (levelOf(o.level).kind === 'speed') return showSpeedCard(o);
  const random = o.random ?? Math.random;
  const level = o.level;
  const steps = lessonSteps(level);
  const frozen = Boolean(o.lab);
  const { root, card } = overlay('tl', o.container ?? document.body);

  // ---------- The card ----------
  const title = el('div', 'tl-title', card);
  el('span', 'tl-new', title, level === 1 ? 'Home row' : NEW_KEYS);
  const caps = el('div', 'tl-caps', title);
  const capEls = new Map<SkillId, HTMLElement>();
  if (level > 1) {
    for (const skill of levelOf(level).skills) {
      capEls.set(skill, el('span', 'tl-cap', caps, keyCap(skill)));
    }
  }
  const caption = el('p', 'tl-caption', card);
  const blockView = createBlockView();
  blockView.element.classList.add('tl-block');
  card.appendChild(blockView.element);
  const keyboard = createKeyboard({ hands: true });
  keyboard.element.classList.add('tl-kb');
  card.appendChild(keyboard.element);
  const doneCard = el('div', 'tl-done', card);
  el('h2', 'tl-ready', doneCard, o.readyLine ?? READY_LINE);
  if (level >= 2) {
    const mult = el('div', 'tl-mult', doneCard);
    el('span', 'tl-badge', mult, `×${multiplier(level)}`);
    el('p', 'tl-mult-line', mult, multiplierLine(level));
  }
  el('p', 'tl-space', doneCard, o.spaceLine ?? SPACE_LINE);
  const buttons = el('div', 'tl-buttons', card);

  // ---------- State ----------
  const timers = createTimers();
  let index = 0;
  let token = 0;
  let clock = 0;
  let lineEnded = false;
  let afterEnd = 0;
  let reaching = true;
  let disposed = false;
  let frame = 0;

  const step = (): LessonStep => steps[index];
  const reachChar = (): string => {
    const s = step();
    if (s.kind === 'show' || s.kind === 'try' || s.kind === 'mix') {
      return (s.kind !== 'show' && blockView.current) || repChar(s.skill);
    }
    return 'f';
  };

  function say(line: string): void {
    if (frozen) return;
    const mine = token;
    o.speak(line, () => {
      if (mine === token && !disposed) lineEnded = true;
    });
  }

  function enter(i: number, first?: string): void {
    index = i;
    token++;
    clock = 0;
    lineEnded = false;
    afterEnd = 0;
    reaching = true;
    timers.clear();
    keyboard.pulse(null);
    keyboard.light(null);
    keyboard.reach(null, 0);
    const s = step();
    const showing = s.kind !== 'done';
    blockView.element.hidden = s.kind !== 'try' && s.kind !== 'mix';
    card.classList.toggle('tl-has-block', !blockView.element.hidden);
    keyboard.element.hidden = !showing;
    caption.hidden = !showing;
    doneCard.hidden = showing;
    buttons.hidden = !showing;
    capEls.forEach((cap, skill) => {
      const now = (s.kind === 'show' || s.kind === 'try' || s.kind === 'mix') && s.skill === skill;
      cap.classList.toggle('tl-cap-now', now);
      cap.style.background = now
        ? skill.startsWith('shift')
          ? FINGER_COLORS.pinky
          : fingerColor(fingerOf(skill))
        : '';
    });
    if (s.kind === 'home') {
      caption.textContent = s.line;
      keyboard.pulse(['f', 'j']);
      say(s.line);
    } else if (s.kind === 'show') {
      caption.textContent = lessonLine(s.skill);
      keyboard.light(repChar(s.skill));
      say(lessonLine(s.skill));
    } else if (s.kind === 'try' || s.kind === 'mix') {
      caption.textContent = s.kind === 'try' ? YOUR_TURN : MIX_LINE;
      blockView.set(
        s.kind === 'try'
          ? tryText(s.skill, random, first)
          : planBlock({
              level,
              length: MIX_KEYS,
              random,
              chars: {
                known: [...knownBefore(level, s.skill), ...charsOfSkill(s.skill)],
                fresh: charsOfSkill(s.skill),
              },
            }),
      );
      blockView.fit();
      keyboard.light(blockView.current);
    }
  }

  const next = () => {
    if (index < steps.length - 1) enter(index + 1);
  };

  function update(delta: number): void {
    timers.update(delta);
    clock += delta;
    const s = step();
    if (s.kind === 'home') {
      keyboard.reach(null, 0);
    } else if (s.kind === 'show') {
      keyboard.reach(repChar(s.skill), clock);
    } else if (s.kind === 'try') {
      // The reach loops at half speed until the first right key.
      keyboard.reach(reaching ? reachChar() : null, clock / 2);
    } else if (s.kind === 'mix') {
      keyboard.reach(null, 0);
    }
    if (lineEnded && (s.kind === 'home' || s.kind === 'show')) {
      afterEnd += delta;
      if (afterEnd >= NEXT_DELAY) next();
    }
  }

  function finish(callback: () => void): void {
    dispose();
    callback();
  }

  function onKey(char: string): void {
    const s = step();
    if (s.kind === 'done') {
      if (char === ' ') finish(o.onDone);
      return;
    }
    if (s.kind === 'home') return;
    if (s.kind === 'show') {
      // A right key while the line is still being read counts: it is the first key of the try.
      if (skillOf(char) === s.skill) {
        stopSpeaking();
        enter(index + 1, char);
        typeRight(char);
      } else {
        typeWrong(char);
      }
      return;
    }
    const expected = blockView.current;
    if (expected === null) return;
    if (char === expected) typeRight(char);
    else typeWrong(char, expected);
  }

  function typeRight(char: string): void {
    keyboard.flash(char, 'right');
    sfx.key();
    blockView.advance();
    reaching = false;
    keyboard.pulse(null);
    keyboard.light(blockView.current);
    if (blockView.current === null) {
      const mine = token;
      timers.after(STEP_PAUSE, () => {
        if (mine === token) next();
      });
    }
  }

  function typeWrong(char: string, expected?: string): void {
    keyboard.flash(char, 'wrong');
    sfx.wrongKey();
    if (expected !== undefined) {
      blockView.wrong();
      keyboard.pulse([expected]);
    }
  }

  const stopKeys = onTypingKey(onKey, { onCaps: (on) => keyboard.setCaps(on) });

  button('tl-again', '🔊 Again', buttons, () => enter(index));
  button('tl-skip', 'Skip lesson ▸', buttons, () => finish(o.onSkip));

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    stopKeys();
    stopSpeaking();
    keyboard.dispose();
    blockView.dispose();
    root.remove();
  }

  // ---------- Go ----------
  const lab = o.lab;
  if (lab) {
    const found = steps.findIndex(
      (s) => s.kind === lab.step && (!lab.skill || !('skill' in s) || s.skill === lab.skill),
    );
    enter(found < 0 ? 0 : found);
    for (let i = 0; i < (lab.typed ?? 0) && blockView.current !== null; i++) {
      typeRight(blockView.current);
    }
    update(0);
    clock = lab.at ?? 0;
    update(0);
  } else {
    enter(0);
    let last = performance.now();
    const loop = (now: number) => {
      if (disposed) return;
      const delta = Math.min((now - last) / 1000, 0.1);
      last = now;
      update(o.paused?.() ? 0 : delta);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
  }
  return { element: root, update, dispose };
}
