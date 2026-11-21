/**
 * The pure rules of Type Brawl: blocks and moves, the pace of the rings, what a lock-on picks, who
 * attacks next, points, the speed levels' groups and the results line. No DOM, no three.js.
 */
import type { Random } from '../../shared/random';
import { levelOf, multiplier } from '../../shared/typing/course';
import {
  SPEED_ACCURACY,
  levelPassed,
  wpm,
  type TypingProgress,
} from '../../shared/typing/progress';

export type Kind = 'thug' | 'bruiser' | 'boss';
export type MoveClass = 'light' | 'medium' | 'heavy' | 'finisher';
export type MoveId =
  | 'jab'
  | 'cross'
  | 'hook'
  | 'kick'
  | 'elbow'
  | 'uppercut'
  | 'roundhouse'
  | 'flying-kick'
  | 'spin-kick'
  | 'throw'
  | 'knee'
  | 'headbutt'
  | 'back-elbow';
export const MOVES_BY_CLASS: Record<MoveClass, MoveId[]> = {
  light: ['jab', 'cross'],
  medium: ['hook', 'kick', 'elbow', 'knee', 'headbutt'],
  heavy: ['uppercut', 'roundhouse', 'back-elbow'],
  finisher: ['flying-kick', 'spin-kick', 'throw'],
};
export type Species = 'robot' | 'monster';
export type Body =
  | 'toy-robot'
  | 'box-robot'
  | 'monster'
  | 'big-monster'
  | 'giga-bot'
  | 'fuzzball-king'
  | 'slime-duke'
  | 'robo-rex';

/** The comic words a hit shows, by what was hit and the class of move. */
export const HIT_WORDS: Record<Species, Record<MoveClass, string[]>> = {
  robot: {
    light: ['DING!', 'TINK!'],
    medium: ['CLANG!', 'BONK!'],
    heavy: ['KLONK!', 'CRASH!'],
    finisher: ['K.O.!', 'ZAP!', 'BOING!'],
  },
  monster: {
    light: ['BOP!', 'POOF!'],
    medium: ['SQUISH!', 'BOING!'],
    heavy: ['SPLAT!', 'SPROING!'],
    finisher: ['K.O.!', 'POOF!', 'WHEE!'],
  },
};

/** A random comic word for a hit on a robot or monster by a move of this class. */
export function pickWord(species: Species, cls: MoveClass, random: Random): string {
  const words = HIT_WORDS[species][cls];
  return words[Math.min(words.length - 1, Math.floor(random() * words.length))];
}

/** The thug and bruiser bodies of each species (a boss has its stage's). */
export const THUG_BODIES: Record<'thug' | 'bruiser', [Body, Body]> = {
  thug: ['toy-robot', 'monster'],
  bruiser: ['box-robot', 'big-monster'],
};

/** Letters before the closing space, one entry per block; the last block is the finisher. */
export const BLOCKS: Record<Kind, number[]> = { thug: [3], bruiser: [3, 4], boss: [2, 3, 3, 4, 5] };
export const KIND_POINTS: Record<Kind, number> = { thug: 30, bruiser: 60, boss: 300 };
/** On screen at once. */
export const MAX_THUGS = 3;
export const HP_MAX = 100;
/** A wrong key. */
export const HIT_WRONG = 8;
/** A full ring, and a boss's. */
export const HIT_RING = 12;
export const HIT_RING_BOSS = 20;
/** Health a cleared stage gives back. */
export const REFILL_STAGE = 40;
/** Ring seconds per key = seconds per key × slack. */
export const SLACK_START = 3.0;
export const SLACK_PER_STEP = 0.92;
export const SLACK_MIN = 1.5;
/** Seconds added to every ring. */
export const RING_BASE = 1.5;
/** A ring is never shorter than this. */
export const RING_MIN = 4;
/** A new block shows this long before its ring starts. */
export const READ_SECONDS = 0.8;
/** All rings freeze this long after any hit on the hero. */
export const HIT_GRACE = 1.0;
export const WAVE_BONUS = 50;
/** The stage-clear bonus is this many scrap bonuses. */
export const STAGE_BONUS_FACTOR = 3;
/** Scraps of a stage before its boss scrap. */
export const STAGE_SCRAPS = 3;
/** Seconds the "Boss: <name>" banner shows before the boss walks in, and between the boss and each thug after. */
export const BOSS_BANNER_SECONDS = 1.0;
export const BOSS_GAP_SECONDS = 2.0;
/** Most thugs a scrap has in total (6 on the first loop, one more each loop up to 8). */
export const SCRAP_SIZE_MAX = 8;
/** Chance a knocked-out thug or bruiser drops an item. */
export const ITEM_DROP_CHANCE = 0.25;
/** Knock-outs the star makes perfect. */
export const STAR_KNOCKOUTS = 3;
/** Knock-outs per speed-level group; 3 groups in a row at the goal pass the level (SPEED_STREAK). */
export const SPEED_GROUP = 6;

/** The letters of each block of a kind, the last one being the finisher's. */
export const blockPlan = (kind: Kind): number[] => BLOCKS[kind];

/** The class of move for block `index` of a plan: the last is the finisher, else by its keys. */
export function moveClassOf(plan: readonly number[], index: number): MoveClass {
  if (index >= plan.length - 1) return 'finisher';
  const keys = plan[index];
  return keys <= 2 ? 'light' : keys === 3 ? 'medium' : 'heavy';
}

/** A random move of the class, never `last` when the class has more than one. */
export function pickMove(cls: MoveClass, last: MoveId | null, random: Random): MoveId {
  const all = MOVES_BY_CLASS[cls];
  const pool = all.length > 1 ? all.filter((m) => m !== last) : all;
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}

/**
 * How many thugs scrap `scrap` (from 1) of a stage has in total: 3, 4, 5 on the first loop; each
 * loop adds one. Never more than 6 on the first loop and 8 at the most.
 */
export const scrapSize = (scrap: number, loop = 0): number =>
  Math.min(2 + scrap + loop, Math.min(6 + loop, SCRAP_SIZE_MAX));

/**
 * The kinds in a scrap: from scrap 3 (from scrap 1 after the first stage) each is a bruiser with
 * probability 1/3. `stage` counts from 1 across loops.
 */
export function scrapKinds(scrap: number, random: Random, loop = 0, stage = 1): Kind[] {
  const out: Kind[] = [];
  const bruisers = scrap >= 3 || stage >= 2;
  for (let i = 0; i < scrapSize(scrap, loop); i++) {
    out.push(bruisers && random() < 1 / 3 ? 'bruiser' : 'thug');
  }
  return out;
}

/** The boss scrap: the boss first, then 2 thugs (one more each loop, 7 at the most). */
export const bossScrapKinds = (loop = 0): Kind[] => [
  'boss',
  ...Array.from({ length: Math.min(2 + loop, SCRAP_SIZE_MAX - 1) }, (): Kind => 'thug'),
];

/** The ring's hit on the hero: a boss hits harder. */
export const ringDamage = (kind: Kind): number => (kind === 'boss' ? HIT_RING_BOSS : HIT_RING);

/** Seconds per key the rings are planned with: on a speed level the goal's, else the player's own. */
export function spkFor(level: number, spk: number): number {
  const goal = levelOf(level).wpm;
  return levelOf(level).kind === 'speed' && goal ? 12 / goal : spk;
}

/** The level counts as mastered: a speed level, an older level, or one whose keys are learned. */
export function mastered(typing: TypingProgress, level: number): boolean {
  return levelOf(level).kind === 'speed' || level < typing.open || levelPassed(typing, level);
}

/** Ring seconds per key: 3.0 at 0 steps, 8% less each step, never below 1.5. */
export const slackFor = (rampSteps: number): number =>
  Math.max(SLACK_MIN, SLACK_START * SLACK_PER_STEP ** rampSteps);

/** Seconds a ring takes for a block of `keys` letters (and its space) at `spkEff` seconds per key. */
export const ringSeconds = (keys: number, spkEff: number, slack: number): number =>
  Math.max(RING_MIN, (keys + 1) * spkEff * slack + RING_BASE);

/** The streak's points multiplier, counted after the knock-out: ×2 from 5, ×3 from 10, ×4 from 20. */
export const streakMultiplier = (streak: number): number =>
  streak >= 20 ? 4 : streak >= 10 ? 3 : streak >= 5 ? 2 : 1;

/** Points for a knock-out: the kind's points × streak multiplier × level multiplier. */
export const killPoints = (kind: Kind, streak: number, level: number): number =>
  KIND_POINTS[kind] * streakMultiplier(streak) * multiplier(level);

/** Points for a block that lands (no streak). */
export const blockPoints = (keys: number, level: number): number => 10 * keys * multiplier(level);

/** The bonus for clearing scrap `scrap`. */
export const scrapBonus = (scrap: number, level: number): number =>
  WAVE_BONUS * scrap * multiplier(level);

/** The bonus for clearing stage `stage` (from 1, counting loops). */
export const stageBonus = (stage: number, level: number): number =>
  STAGE_BONUS_FACTOR * scrapBonus(stage, level);

/** The scrap number the bonus counts: fights run on through the stages (scrap 1 to 3 of each). */
export const fightNumber = (stage: number, scrap: number): number =>
  (stage - 1) * STAGE_SCRAPS + scrap;

export interface Candidate {
  id: string;
  /** An item: a thug is always picked before an item. */
  item?: boolean;
  /** The block showing (keys and closing space). */
  text: string;
  /** World x. */
  x: number;
  engaged: boolean;
}

/** The thug (or else item) a first key locks onto: engaged, text starts with `char`, nearest to the hero, then lowest id. */
export function lockThug(cands: readonly Candidate[], char: string, heroX: number): string | null {
  let best: Candidate | null = null;
  for (const c of cands) {
    if (!c.engaged || c.text[0] !== char) continue;
    if (best === null) {
      best = c;
      continue;
    }
    if (!!c.item !== !!best.item) {
      if (!c.item) best = c;
      continue;
    }
    const d = Math.abs(c.x - heroX);
    const bd = Math.abs(best.x - heroX);
    if (d < bd - 1e-9 || (Math.abs(d - bd) <= 1e-9 && c.id < best.id)) best = c;
  }
  return best ? best.id : null;
}

/** The engaged thug that attacks: the lowest `turn`, ties by id. */
export function attackerOf(
  thugs: readonly { id: string; turn: number; engaged: boolean }[],
): string | null {
  let best: { id: string; turn: number } | null = null;
  for (const t of thugs) {
    if (!t.engaged) continue;
    if (best === null || t.turn < best.turn || (t.turn === best.turn && t.id < best.id)) best = t;
  }
  return best ? best.id : null;
}

export const hitHero = (hp: number, amount: number): number => Math.max(0, hp - amount);
export const refill = (hp: number, amount: number): number => Math.min(HP_MAX, hp + amount);

/** One group of `SPEED_GROUP` knock-outs on a speed level. */
export interface Group {
  keys: number;
  mistakes: number;
  /** Active game seconds of the group's blocks, each from its first key to its space. */
  seconds: number;
}

/** The share of keys right first time, 1 for an empty group. */
export function accuracy(group: Pick<Group, 'keys' | 'mistakes'>): number {
  return group.keys > 0 ? (group.keys - group.mistakes) / group.keys : 1;
}

/** A speed level's group counts when it reaches the goal words a minute with at least 90% right. */
export function speedGroupPasses(level: number, g: Group): boolean {
  const goal = levelOf(level).wpm;
  if (goal === undefined || g.seconds <= 0) return false;
  return wpm(g.keys, g.seconds) >= goal && accuracy(g) >= SPEED_ACCURACY;
}

/** What a run typed, for the results. */
export interface RunStats {
  keys: number;
  right: number;
  fastKeys: number;
  fastSeconds: number;
  knockouts: number;
}

export const emptyStats = (): RunStats => ({
  keys: 0,
  right: 0,
  fastKeys: 0,
  fastSeconds: 0,
  knockouts: 0,
});

/** The words a minute of a run, 0 when no block was finished. */
export function runWpm(stats: RunStats): number {
  return stats.fastSeconds > 0 ? wpm(stats.fastKeys, stats.fastSeconds) : 0;
}

/** 'Stage 4 · 11 knock-outs · 28 words a minute · 94% right · Level 8 opened!'; empty parts are left out. */
export function resultsText(stats: RunStats, stage: number, opened: readonly number[]): string {
  const parts: string[] = [`Stage ${stage}`];
  if (stats.knockouts > 0) {
    parts.push(`${stats.knockouts} knock-out${stats.knockouts === 1 ? '' : 's'}`);
  }
  const speed = Math.round(runWpm(stats));
  if (speed > 0) parts.push(`${speed} words a minute`);
  if (stats.keys > 0) parts.push(`${Math.round((100 * stats.right) / stats.keys)}% right`);
  if (opened.length === 1) parts.push(`Level ${opened[0]} opened!`);
  else if (opened.length > 1) {
    parts.push(`Levels ${opened[0]} to ${opened[opened.length - 1]} opened!`);
  }
  return parts.join(' · ');
}

export type StageId = 'street' | 'docks' | 'dojo' | 'rooftop';
export type PropKind =
  | 'lamp'
  | 'bin'
  | 'tree'
  | 'fence'
  | 'crate'
  | 'barrel'
  | 'bollard'
  | 'lantern'
  | 'pillar'
  | 'bonsai'
  | 'vent'
  | 'antenna'
  | 'tank';

/** Colours of a stage (CSS strings): the sky gradient, the ground, the buildings and the lights. */
export interface StagePalette {
  /** Sky top, middle and bottom. */
  sky: [string, string, string];
  ground: string;
  /** The strip behind the lane: a sidewalk, or water on the docks. */
  walk: string;
  kerb: string;
  paint: string;
  /** [wall, window, lit window] of each building palette. */
  walls: [string, string, string][];
  roof: string;
  /** Hemisphere light from above and below, and the sun. */
  hemi: [string, string];
  sun: string;
  /** The strip behind the lane lies below the ground, like water. */
  sunken?: boolean;
}

export interface StageDef {
  id: StageId;
  title: string;
  /** The boss's name, what they look like, and their colour. */
  boss: string;
  body: Body;
  species: Species;
  bossColor: number;
  palette: StagePalette;
  props: PropKind[];
}

/** The four stages; after the last they loop, each loop harder. */
export const STAGES: readonly StageDef[] = [
  {
    id: 'street',
    title: 'Back Street',
    boss: 'Giga-Bot',
    body: 'giga-bot',
    species: 'robot',
    bossColor: 0x8aa4c8,
    props: ['lamp', 'bin', 'tree', 'fence'],
    palette: {
      sky: ['#4ba3ff', '#bfe3ff', '#ffe6c2'],
      ground: '#3d4048',
      walk: '#9fa5b0',
      kerb: '#c9ced6',
      paint: '#f1f1ea',
      walls: [
        ['#8b5e3c', '#3b2a22', '#ffe9a8'],
        ['#4a6fa5', '#27364f', '#d6ecff'],
        ['#9c9a8f', '#4b4a45', '#fff3b0'],
      ],
      roof: '#555a66',
      hemi: ['#ffffff', '#8a93a6'],
      sun: '#fff1d6',
    },
  },
  {
    id: 'docks',
    title: 'The Docks',
    boss: 'Fuzzball King',
    body: 'fuzzball-king',
    species: 'monster',
    bossColor: 0x9b5de5,
    props: ['crate', 'barrel', 'bollard', 'lamp'],
    palette: {
      sky: ['#ff8a3d', '#ffb870', '#ffe2a8'],
      ground: '#7a5a3a',
      walk: '#2c7da0',
      kerb: '#5b4126',
      paint: '#a98055',
      walls: [
        ['#a4472f', '#4a2018', '#ffd27a'],
        ['#6b7b8c', '#2c3640', '#ffe3a0'],
        ['#7a4a2a', '#33200f', '#ffcf70'],
      ],
      roof: '#4a3a30',
      hemi: ['#ffd9b0', '#6d5a4a'],
      sun: '#ffb070',
      sunken: true,
    },
  },
  {
    id: 'dojo',
    title: 'The Dojo',
    boss: 'Slime Duke',
    body: 'slime-duke',
    species: 'monster',
    bossColor: 0x5fd35f,
    props: ['lantern', 'pillar', 'bonsai'],
    palette: {
      sky: ['#2a2145', '#6b3a5a', '#e08a5a'],
      ground: '#9a6a36',
      walk: '#b8894c',
      kerb: '#6a4220',
      paint: '#c99a5c',
      walls: [
        ['#f4e8c8', '#8a5a2b', '#fff6d6'],
        ['#efe0b8', '#7a4a22', '#fff0c4'],
        ['#f8eed4', '#6a3f1c', '#ffe9b0'],
      ],
      roof: '#4a2f22',
      hemi: ['#ffe9c8', '#7a5a3a'],
      sun: '#ffd9a0',
    },
  },
  {
    id: 'rooftop',
    title: 'The Rooftop',
    boss: 'Robo-Rex',
    body: 'robo-rex',
    species: 'robot',
    bossColor: 0x2ec4b6,
    props: ['vent', 'antenna', 'tank'],
    palette: {
      sky: ['#070b24', '#1b2350', '#3b3f7a'],
      ground: '#2b2e3a',
      walk: '#3d4256',
      kerb: '#5a6078',
      paint: '#7c84a0',
      walls: [
        ['#1f2540', '#0c1022', '#ffd86b'],
        ['#252b4d', '#0e1228', '#9ee7ff'],
        ['#1a2038', '#0a0d1e', '#ffb86b'],
      ],
      roof: '#2a2f48',
      hemi: ['#b8c6ee', '#4a5070'],
      sun: '#c4d2ff',
    },
  },
];

/** Where stage `stage` (from 1, counting loops) is: its definition and how many times the four have looped. */
export function stageInfo(stage: number): { def: StageDef; loop: number } {
  const i = Math.max(0, Math.floor(stage) - 1);
  return { def: STAGES[i % STAGES.length], loop: Math.floor(i / STAGES.length) };
}

export type ItemType = 'cola' | 'pizza' | 'star';
export const ITEM_WEIGHTS: Record<ItemType, number> = { cola: 6, pizza: 3, star: 1 };
/** Health an item gives back (the star gives none). */
export const ITEM_HEAL: Record<ItemType, number> = { cola: 20, pizza: 40, star: 0 };
export const ITEM_EMOJI: Record<ItemType, string> = { cola: '🥤', pizza: '🍕', star: '⭐' };
/** Letters of an item's block before the closing space. */
export const ITEM_KEYS = 2;

/** True when a knocked-out thug or bruiser drops an item (bosses never do). */
export const dropsItem = (kind: Kind, random: Random): boolean =>
  kind !== 'boss' && random() < ITEM_DROP_CHANCE;

/** A random item by weight (6 cola : 3 pizza : 1 star). */
export function pickItem(random: Random): ItemType {
  const total = ITEM_WEIGHTS.cola + ITEM_WEIGHTS.pizza + ITEM_WEIGHTS.star;
  let roll = random() * total;
  for (const type of ['cola', 'pizza', 'star'] as const) {
    roll -= ITEM_WEIGHTS[type];
    if (roll < 0) return type;
  }
  return 'cola';
}
