/** Pure game rules, kept free of three.js and the DOM so they are easy to test. */

/** A half-inning ends at this many outs. */
export const MAX_OUTS = 3;
/** A game is this many innings, and goes on past it only while it is tied. */
export const INNINGS = 6;
/** The mercy rule: a half-inning ends, and scores no more, once the batting side has this many. */
export const MERCY_RUNS = 5;
/**
 * Most runs the announcer reads out in full. Every count up to here is a recorded clip; a bigger
 * score is called "more than" this, so the line stays one that can be recorded. Six innings of
 * five runs is thirty.
 */
export const MAX_SPOKEN_RUNS = 30;
/** Strikes that put a batter out. */
export const STRIKES_OUT = 3;
/** Innings with a recorded "Top of the 3rd" line; later ones are all called "extra innings". */
export const MAX_SPOKEN_INNING = 12;

export type Hit = 'single' | 'double' | 'triple' | 'homer';

/** Bases a hit is worth, and so how far everybody moves. */
export const BASES_FOR: Record<Hit, number> = { single: 1, double: 2, triple: 3, homer: 4 };

/**
 * Answer times, in seconds from the end of the question, under which each better hit is earned.
 * They are the same however long the clock is.
 */
export const HOMER_UNDER_SECONDS = 0.4;
export const TRIPLE_UNDER_SECONDS = 0.6;
export const DOUBLE_UNDER_SECONDS = 1;

/** When we pitch, the answer time in seconds under which a right answer is a pop fly... */
export const POP_OUT_UNDER_SECONDS = 0.5;
/** ...or a ground out; a slower right answer is a strike. */
export const GROUND_OUT_UNDER_SECONDS = 1;

/**
 * How likely each hit is when the rival gets one, as the share of the whole (they add up to 1).
 * Mostly singles: it is a miss that gave them the hit, not a good swing.
 */
export const CPU_HIT_WEIGHTS: Record<Hit, number> = {
  single: 0.65,
  double: 0.25,
  triple: 0.08,
  homer: 0.02,
};

const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);

/** The hit a correct answer earns: the sooner the answer (in seconds), the further the ball goes. */
export function hitFor(seconds: number): Hit {
  if (seconds < HOMER_UNDER_SECONDS) return 'homer';
  if (seconds < TRIPLE_UNDER_SECONDS) return 'triple';
  if (seconds < DOUBLE_UNDER_SECONDS) return 'double';
  return 'single';
}

export type PitchOutcome = 'popout' | 'groundout' | 'strike';

/** What a right answer does when we pitch: the sooner the answer (in seconds), the surer the out. */
export function pitchOutcomeFor(seconds: number): PitchOutcome {
  if (seconds < POP_OUT_UNDER_SECONDS) return 'popout';
  if (seconds < GROUND_OUT_UNDER_SECONDS) return 'groundout';
  return 'strike';
}

/** The hit the rival gets from a wrong answer. `random` is from 0 up to (not including) 1. */
export function cpuHitFor(random: number): Hit {
  const r = clamp01(random);
  let upTo = 0;
  for (const hit of ['single', 'double', 'triple'] as const) {
    upTo += CPU_HIT_WEIGHTS[hit];
    // A hair of slack, so the sums of decimals land exactly on the boundaries.
    if (r < upTo - 1e-9) return hit;
  }
  return 'homer';
}

// ---------- Kinds of hit ----------

export type HitKind =
  | 'single-liner'
  | 'single-grounder'
  | 'single-bloop'
  | 'single-chopper'
  | 'double-gap'
  | 'double-line'
  | 'double-wall'
  | 'triple-corner'
  | 'triple-gap'
  | 'homer-liner'
  | 'homer-moonshot'
  | 'homer-scraper';

/** The hit a kind is (its first word). */
export function hitOfKind(kind: HitKind): Hit {
  return kind.split('-')[0] as Hit;
}

/** Weighted variants for each hit; the weights of a hit add up to 1. */
export const HIT_KINDS: Record<Hit, readonly { kind: HitKind; weight: number }[]> = {
  single: [
    { kind: 'single-liner', weight: 0.3 },
    { kind: 'single-grounder', weight: 0.3 },
    { kind: 'single-bloop', weight: 0.2 },
    { kind: 'single-chopper', weight: 0.2 },
  ],
  double: [
    { kind: 'double-gap', weight: 0.45 },
    { kind: 'double-line', weight: 0.3 },
    { kind: 'double-wall', weight: 0.25 },
  ],
  triple: [
    { kind: 'triple-corner', weight: 0.5 },
    { kind: 'triple-gap', weight: 0.5 },
  ],
  homer: [
    { kind: 'homer-liner', weight: 0.35 },
    { kind: 'homer-moonshot', weight: 0.35 },
    { kind: 'homer-scraper', weight: 0.3 },
  ],
};

/** Picks one of `items` by weight; `random` is from 0 up to (not including) 1. */
export function pickWeighted<T>(items: readonly { value: T; weight: number }[], random: number): T {
  const total = items.reduce((n, item) => n + item.weight, 0);
  const r = clamp01(random) * total;
  let upTo = 0;
  for (const item of items) {
    upTo += item.weight;
    // A hair of slack, so the sums of decimals land exactly on the boundaries.
    if (r < upTo - 1e-9) return item.value;
  }
  return items[items.length - 1].value;
}

/** Picks a kind for a hit; `random` from 0 up to (not including) 1. Like `cpuHitFor`. */
export function pickHitKind(hit: Hit, random: number): HitKind {
  return pickWeighted(
    HIT_KINDS[hit].map((k) => ({ value: k.kind, weight: k.weight })),
    random,
  );
}

// ---------- Field zones ----------

export type FieldZone = 'LL' | 'LF' | 'LC' | 'CF' | 'RC' | 'RF' | 'RL';

/** The zone of the field a ball goes to, from its angle `theta` (radians, + towards right). */
export function zoneOf(theta: number): FieldZone {
  const d = (theta * 180) / Math.PI;
  if (d <= -36) return 'LL';
  if (d < -22) return 'LF';
  if (d < -7) return 'LC';
  if (d <= 7) return 'CF';
  if (d < 22) return 'RC';
  if (d < 36) return 'RF';
  return 'RL';
}

/** Whether a zone is on the right-field side. */
export function isRightSide(zone: FieldZone): boolean {
  return zone === 'RC' || zone === 'RF' || zone === 'RL';
}

/** The big word shown for a hit. */
export function hitLabel(hit: Hit): string {
  return {
    single: 'SINGLE!',
    double: 'DOUBLE!',
    triple: 'TRIPLE!',
    homer: 'HOME RUN!',
  }[hit];
}

/** A hit in words, as in "Mud Hens single!". */
export function hitWord(hit: Hit): string {
  return { single: 'single', double: 'double', triple: 'triple', homer: 'home run' }[hit];
}

/** What the announcer says when the rival gets a hit. */
export function cpuHitSpeech(hit: Hit): string {
  return `They hit a ${hitWord(hit)}!`;
}

/** "+2 runs!", or an empty string when nobody scored. */
export function runsText(runs: number): string {
  if (runs <= 0) return '';
  return `+${runs} ${runs === 1 ? 'run' : 'runs'}!`;
}

/** "2 runs", or "more than 30 runs" for a score too big to have a recorded line. */
function runsSpoken(runs: number): string {
  if (runs > MAX_SPOKEN_RUNS) return `more than ${MAX_SPOKEN_RUNS} runs`;
  return `${runs} ${runs === 1 ? 'run' : 'runs'}`;
}

/** What the announcer says for the final score. */
export function finalSpeech(runs: number): string {
  return `You scored ${runsSpoken(runs)}!`;
}

/** The announcer's first call. */
export const PLAY_BALL = 'Play ball!';
export const EXTRA_INNINGS = 'Extra innings!';
export const YOU_WIN = 'You win!';
export const THREE_OUTS = 'Three outs!';
export const MERCY_SPEECH = `Mercy rule! That's five runs.`;
export const POP_OUT_SPEECH = 'Pop fly! Caught for the out!';
export const GROUND_OUT_SPEECH = 'Ground ball! Out at first!';

/** Who is on first, second and third. */
export type Bases = readonly [boolean, boolean, boolean];

export const EMPTY_BASES: Bases = [false, false, false];

/** One player moving: `from` 0 is the batter, 1 to 3 the bases; `to` 4 is home, a run. */
export interface Move {
  from: number;
  to: number;
}

export interface Advance {
  bases: Bases;
  runs: number;
  moves: Move[];
}

/**
 * Everybody on base, and the batter, move up `count` bases. Whoever goes past third scores,
 * and on a home run that includes the batter.
 */
export function advance(bases: Bases, count: number): Advance {
  const next: [boolean, boolean, boolean] = [false, false, false];
  const moves: Move[] = [];
  let runs = 0;
  // The lead runner first, so the moves read in the order the runners set off.
  for (const from of [3, 2, 1, 0]) {
    if (from > 0 && !bases[from - 1]) continue;
    const to = from + count;
    moves.push({ from, to: Math.min(to, 4) });
    if (to >= 4) runs++;
    else next[to - 1] = true;
  }
  return { bases: next, runs, moves };
}

/**
 * The base (4 is home) a runner on `from` is sent to on a hit of this kind to this zone, beyond
 * what the hit forces. The batter's own base is never stretched.
 */
function extraTarget(from: number, kind: HitKind, zone: FieldZone): number {
  const hit = hitOfKind(kind);
  if (hit === 'triple' || hit === 'homer') return 4;
  if (hit === 'double') {
    if (kind === 'double-wall') return from === 1 ? 3 : 4;
    return 4;
  }
  // Singles.
  if (kind === 'single-chopper' || kind === 'single-bloop') return from + 1;
  if (isRightSide(zone)) return from === 1 ? 3 : 4;
  return from === 1 ? 2 : 4;
}

/**
 * Where each runner ends up on a hit of this kind to this zone, and the runs. `advance` is the
 * least that is forced; here runners also take the extra bases the play gives them. The batter
 * always goes exactly as far as the hit is worth, and a runner never ends up on or past the base
 * of the runner ahead of it unless that one scored.
 */
export function advanceOnHit(bases: Bases, kind: HitKind, zone: FieldZone): Advance {
  const count = BASES_FOR[hitOfKind(kind)];
  const next: [boolean, boolean, boolean] = [false, false, false];
  const moves: Move[] = [];
  let runs = 0;
  // The base the runner ahead stopped on, once it did not score.
  let ahead = 5;
  for (const from of [3, 2, 1, 0]) {
    if (from > 0 && !bases[from - 1]) continue;
    let to = Math.min(from + count, 4);
    if (from > 0) {
      to = Math.min(Math.max(to, extraTarget(from, kind, zone)), 4);
      // Never past the runner ahead, but never short of what the hit forces.
      to = Math.max(Math.min(to, ahead - 1), Math.min(from + count, 4));
    }
    moves.push({ from, to });
    if (to >= 4) runs++;
    else {
      next[to - 1] = true;
      ahead = to;
    }
  }
  return { bases: next, runs, moves };
}

// ---------- The game ----------

/** We are the visitors: we bat in the top of an inning and pitch in the bottom. */
export type Half = 'top' | 'bottom';
export type Side = 'us' | 'them';

export interface GameState {
  /** The inning, from 1, and which half of it. */
  inning: number;
  half: Half;
  /** The batter at the plate, from 1, for each side's own line-up. */
  batter: number;
  rivalBatter: number;
  strikes: number;
  outs: number;
  /** Runs the batting side has scored in this half-inning. */
  runs: number;
  bases: Bases;
  /** Runs in each half-inning started so far, the current one included. */
  us: number[];
  them: number[];
  over: boolean;
  winner: Side | null;
  /** The game ended on the rival's winning run, in the last half-inning. */
  walkOff: boolean;
}

export function newGame(): GameState {
  return {
    inning: 1,
    half: 'top',
    batter: 1,
    rivalBatter: 1,
    strikes: 0,
    outs: 0,
    runs: 0,
    bases: EMPTY_BASES,
    us: [0],
    them: [],
    over: false,
    winner: null,
    walkOff: false,
  };
}

const sum = (runs: readonly number[]) => runs.reduce((a, b) => a + b, 0);

/** Each side's total runs in the game. */
export function totals(state: GameState): { us: number; them: number } {
  return { us: sum(state.us), them: sum(state.them) };
}

/** Whether we are the ones batting. */
export function isBatting(state: GameState): boolean {
  return state.half === 'top';
}

/** The number of the batter at the plate, of whichever side is batting. */
export function batterNumber(state: GameState): number {
  return isBatting(state) ? state.batter : state.rivalBatter;
}

/** What happened when a plate appearance finished. */
export interface Outcome {
  state: GameState;
  /** The batter was put out. */
  out: boolean;
  /** Runs that counted on this pitch (after the mercy rule and the walk-off). */
  runs: number;
  /** Who moved where, for a hit. A cut-short play still shows everybody running. */
  moves: Move[];
}

/** Ends the batter's turn: the next batter of that side steps up, without strikes. */
function nextBatter(state: GameState): GameState {
  return isBatting(state)
    ? { ...state, strikes: 0, batter: state.batter + 1 }
    : { ...state, strikes: 0, rivalBatter: state.rivalBatter + 1 };
}

/** Whether the half-inning has just ended: at three outs, or the mercy rule's runs. */
export function halfOver(state: GameState): 'outs' | 'mercy' | null {
  if (state.outs >= MAX_OUTS) return 'outs';
  if (state.runs >= MERCY_RUNS) return 'mercy';
  return null;
}

/** The last half-inning that must be played: the bottom of the 6th, or of any extra inning. */
function isLastChance(state: GameState): boolean {
  return state.half === 'bottom' && state.inning >= INNINGS;
}

/** Most runs the batting side can still score in this half before it ends. */
function roomToScore(state: GameState): number {
  const room = MERCY_RUNS - state.runs;
  if (!isLastChance(state)) return room;
  // The rival wins on the run that puts them ahead, and no more count.
  const { us, them } = totals(state);
  return Math.min(room, us - them + 1);
}

/** Adds counted runs to the half-inning in play. */
function score(state: GameState, runs: number): GameState {
  const line = isBatting(state) ? 'us' : 'them';
  const inning = [...state[line]];
  inning[inning.length - 1] += runs;
  return { ...state, runs: state.runs + runs, [line]: inning };
}

/**
 * A hit: everybody moves up, the strikes are forgotten and the next batter comes up. The runs
 * that count stop at the mercy rule, and at the rival's winning run in the last half-inning
 * (which ends the game on the spot). With `play` the runners take the extra bases that kind of
 * hit and zone give; without it they move only as far as the hit forces them.
 */
export function applyHit(
  state: GameState,
  hit: Hit,
  play?: { kind: HitKind; zone: FieldZone },
): Outcome {
  const moved = play
    ? advanceOnHit(state.bases, play.kind, play.zone)
    : advance(state.bases, BASES_FOR[hit]);
  const runs = Math.min(moved.runs, roomToScore(state));
  let next = nextBatter({ ...score(state, runs), bases: moved.bases });
  next = walkOffCheck(state, next);
  return { state: next, out: false, runs, moves: moved.moves };
}

/** The game ends on the spot when the rival goes ahead in the last half-inning. */
function walkOffCheck(before: GameState, next: GameState): GameState {
  if (!isLastChance(before)) return next;
  const { us, them } = totals(next);
  return them > us ? { ...next, over: true, winner: 'them', walkOff: true } : next;
}

/** A strike (a miss, a called strike or one thrown past the batter). The third one is an out. */
export function applyStrike(state: GameState): Outcome {
  const strikes = state.strikes + 1;
  if (strikes < STRIKES_OUT) {
    return { state: { ...state, strikes }, out: false, runs: 0, moves: [] };
  }
  return applyFieldOut(state);
}

/** The batter is out in the field (a pop fly or a ground out): the runners hold. */
export function applyFieldOut(state: GameState): Outcome {
  const next = nextBatter({ ...state, outs: state.outs + 1 });
  return { state: next, out: true, runs: 0, moves: [] };
}

// ---------- Outs when we pitch ----------

export type OutKind =
  'pop' | 'foul-pop' | 'fly' | 'liner' | 'diving' | 'ground' | 'double-play' | 'force-second';
export type Position = 'P' | 'C' | '1B' | '2B' | 'SS' | '3B' | 'LF' | 'CF' | 'RF';

export interface OutCall {
  kind: OutKind;
  /** Who fields the ball first. */
  fielder: Position;
  zone: FieldZone;
  /** Ground outs: '6-3', '3U', '3-1', '6-4-3', '6-4'... (for the scorebook-style subtitle). */
  chain?: string;
}

/** A ground ball hit this quickly (seconds) can be turned into two. */
export const DP_UNDER_SECONDS = 0.75;

/** Where a ball goes, from the infielder or pitcher who plays it. */
const INFIELD_ZONE: Partial<Record<Position, FieldZone>> = {
  '3B': 'LF',
  SS: 'LC',
  P: 'CF',
  '2B': 'RC',
  '1B': 'RF',
};
const OUTFIELD_ZONE: Partial<Record<Position, FieldZone>> = { LF: 'LF', CF: 'CF', RF: 'RF' };

export const AIR_OUTS: readonly { value: OutKind; weight: number }[] = [
  { value: 'pop', weight: 0.25 },
  { value: 'foul-pop', weight: 0.1 },
  { value: 'fly', weight: 0.35 },
  { value: 'liner', weight: 0.15 },
  { value: 'diving', weight: 0.15 },
];
export const LINER_FIELDERS: readonly { value: Position; weight: number }[] = [
  { value: '3B', weight: 0.25 },
  { value: 'SS', weight: 0.25 },
  { value: '2B', weight: 0.25 },
  { value: '1B', weight: 0.15 },
  { value: 'P', weight: 0.1 },
];
export const DOUBLE_PLAYS: readonly { value: string; weight: number }[] = [
  { value: '6-4-3', weight: 0.35 },
  { value: '4-6-3', weight: 0.3 },
  { value: '5-4-3', weight: 0.2 },
  { value: '1-6-3', weight: 0.15 },
];
export const FORCE_OUTS: readonly { value: string; weight: number }[] = [
  { value: '6-4', weight: 1 },
  { value: '4-6', weight: 1 },
  { value: '5-4', weight: 1 },
];
export const GROUND_OUTS: readonly { value: string; weight: number }[] = [
  { value: '6-3', weight: 0.3 },
  { value: '4-3', weight: 0.25 },
  { value: '5-3', weight: 0.2 },
  { value: '3U', weight: 0.075 },
  { value: '3-1', weight: 0.075 },
  { value: '1-3', weight: 0.1 },
];

/** The infielder a ground-out chain starts with (its first digit). */
const CHAIN_FIELDER: Record<string, Position> = {
  '1': 'P',
  '3': '1B',
  '4': '2B',
  '5': '3B',
  '6': 'SS',
};

/**
 * The out a right answer gives, from its kind of out, the answer time and the game. `random`
 * is called a few times, each from 0 up to (not including) 1.
 */
export function pickOut(
  outcome: 'popout' | 'groundout',
  seconds: number,
  state: GameState,
  random: () => number,
): OutCall {
  if (outcome === 'popout') {
    const kind = pickWeighted(AIR_OUTS, random());
    const equally = <T>(list: readonly T[]) =>
      list[Math.min(Math.floor(random() * list.length), list.length - 1)];
    switch (kind) {
      case 'pop': {
        const fielder = equally<Position>(['1B', '2B', 'SS', '3B']);
        return { kind, fielder, zone: INFIELD_ZONE[fielder]! };
      }
      case 'foul-pop': {
        return { kind, fielder: 'C', zone: random() < 0.5 ? 'LL' : 'RL' };
      }
      case 'liner': {
        const fielder = pickWeighted(LINER_FIELDERS, random());
        return { kind, fielder, zone: INFIELD_ZONE[fielder]! };
      }
      default: {
        // A fly ball or a diving catch is made by an outfielder.
        const fielder = equally<Position>(['LF', 'CF', 'RF']);
        return { kind, fielder, zone: OUTFIELD_ZONE[fielder]! };
      }
    }
  }
  const runnerOnFirst = state.bases[0];
  let kind: OutKind = 'ground';
  let chain: string;
  if (runnerOnFirst && state.outs < 2 && seconds < DP_UNDER_SECONDS) {
    kind = 'double-play';
    chain = pickWeighted(DOUBLE_PLAYS, random());
  } else if (runnerOnFirst && state.outs >= 2 && random() < 0.5) {
    kind = 'force-second';
    chain = pickWeighted(FORCE_OUTS, random());
  } else {
    chain = pickWeighted(GROUND_OUTS, random());
  }
  const fielder = CHAIN_FIELDER[chain[0]];
  return { kind, fielder, zone: INFIELD_ZONE[fielder]!, chain };
}

export interface OutOutcome extends Outcome {
  /** Who is put out, in order: 0 the batter, 1 to 3 a runner from that base. */
  retired: number[];
  /** A run scored on a fly ball out. */
  sacFly: boolean;
}

/** Everybody on the listed bases moves up one, lead first, only into a base that is free. */
function moveUp(bases: Bases, skip: readonly number[] = []): Advance {
  const next: [boolean, boolean, boolean] = [false, false, false];
  const moves: Move[] = [];
  let runs = 0;
  for (const from of [3, 2, 1]) {
    if (!bases[from - 1]) continue;
    const to = from + 1;
    if (skip.includes(from) || (to < 4 && next[to - 1])) {
      // Held up by the runner ahead, or put out.
      if (!skip.includes(from)) next[from - 1] = true;
      continue;
    }
    moves.push({ from, to });
    if (to >= 4) runs++;
    else next[to - 1] = true;
  }
  return { bases: next, runs, moves };
}

/**
 * Applies an out call: outs, runners moving up or tagging, runs and the walk-off. In the table
 * of the design "outs" are those before the play.
 */
export function applyOut(state: GameState, call: OutCall): OutOutcome {
  const outs0 = state.outs;
  const [on1, on2, on3] = state.bases;
  let retired: number[] = [0];
  let moves: Move[] = [];
  let bases: Bases = state.bases;
  let runs = 0;
  let sacFly = false;
  let added = 1;
  let batterSafe = false;

  const taken = (m: Advance) => {
    moves = m.moves;
    bases = m.bases;
    runs = m.runs;
  };

  switch (call.kind) {
    case 'fly':
      if (outs0 < 2) {
        const next: [boolean, boolean, boolean] = [on1, on2, on3];
        if (on3) {
          moves.push({ from: 3, to: 4 });
          next[2] = false;
          runs++;
          sacFly = true;
        }
        if (on2 && !next[2] && ['CF', 'RC', 'RF', 'RL'].includes(call.zone)) {
          moves.push({ from: 2, to: 3 });
          next[1] = false;
          next[2] = true;
        }
        bases = next;
      }
      break;
    case 'ground':
      if (outs0 < 2) {
        const infieldIn = on3 && !on1;
        if (!infieldIn) taken(moveUp(state.bases));
      }
      break;
    case 'double-play':
      added = 2;
      retired = [1, 0];
      if (outs0 + added < MAX_OUTS) taken(moveUp(state.bases, [1]));
      else bases = state.bases;
      break;
    case 'force-second': {
      retired = [1];
      batterSafe = true;
      // The batter takes first, and anybody forced ahead of him moves up.
      const next: [boolean, boolean, boolean] = [true, false, false];
      // The runner from first is out at second, so the runner on second was forced by him.
      if (on3 && on2 && on1) {
        moves.push({ from: 3, to: 4 });
        runs++;
      } else if (on3) {
        next[2] = true;
      }
      if (on2 && on1) {
        moves.push({ from: 2, to: 3 });
        next[2] = true;
      } else if (on2) {
        next[1] = true;
      }
      moves.push({ from: 0, to: 1 });
      bases = next;
      break;
    }
    default:
      // A pop-up, a foul pop, a line out or a diving catch: the runners hold.
      break;
  }

  const outs = Math.min(outs0 + added, MAX_OUTS);
  if (outs >= MAX_OUTS) {
    // No run counts on a play that makes the third out.
    runs = 0;
    sacFly = false;
    moves = batterSafe ? moves.filter((m) => m.to < 4) : [];
    bases = state.bases;
  }
  const counted = Math.min(runs, roomToScore(state));
  sacFly = sacFly && counted > 0;
  let next = nextBatter({ ...score(state, counted), outs, bases });
  next = walkOffCheck(state, next);
  return {
    state: next,
    out: !batterSafe,
    runs: counted,
    moves,
    retired,
    sacFly,
  };
}

// ---------- Lines and labels ----------

export const HIT_KIND_SPEECH: Record<HitKind, string> = {
  'single-liner': 'Line drive! Base hit!',
  'single-grounder': 'Ground ball, through the hole!',
  'single-bloop': 'Bloop single! It drops in!',
  'single-chopper': 'Chopper! Beats the throw!',
  'double-gap': 'Into the gap! Double!',
  'double-line': 'Down the line! Double!',
  'double-wall': 'Off the wall! Double!',
  'triple-corner': 'Into the corner! Triple!',
  'triple-gap': 'All the way to the wall! Triple!',
  'homer-liner': 'A line drive! Home run!',
  'homer-moonshot': 'Way up, and gone! Home run!',
  'homer-scraper': 'Over the glove! Home run!',
};

/** What the announcer says for one of our hits. */
export function hitKindSpeech(kind: HitKind): string {
  return HIT_KIND_SPEECH[kind];
}

/** A kind of hit in words, as in "Mud Hens bloop single!". */
export function hitKindWord(kind: HitKind): string {
  return {
    'single-liner': 'line-drive single',
    'single-grounder': 'ground-ball single',
    'single-bloop': 'bloop single',
    'single-chopper': 'chopper single',
    'double-gap': 'gap double',
    'double-line': 'double down the line',
    'double-wall': 'double off the wall',
    'triple-corner': 'corner triple',
    'triple-gap': 'triple to the wall',
    'homer-liner': 'line-drive home run',
    'homer-moonshot': 'moonshot home run',
    'homer-scraper': 'wall-scraping home run',
  }[kind];
}

const ZONE_WORDS: Record<FieldZone, string> = {
  LL: 'left field',
  LF: 'left',
  LC: 'left-center',
  CF: 'center',
  RC: 'right-center',
  RF: 'right',
  RL: 'right field',
};

const POSITION_WORDS: Record<Position, string> = {
  P: 'the pitcher',
  C: 'the catcher',
  '1B': 'first',
  '2B': 'second',
  SS: 'short',
  '3B': 'third',
  LF: 'left',
  CF: 'center',
  RF: 'right',
};

/** The small line under a hit's name: where the ball went. On screen only, so it is free-form. */
export function hitSubtitle(kind: HitKind, zone: FieldZone, fielder?: Position): string {
  const where = ZONE_WORDS[zone];
  const rightSide = isRightSide(zone);
  switch (kind) {
    case 'single-liner':
      return `Line drive to ${where}`;
    case 'single-grounder':
      if (zone === 'CF') return 'Up the middle';
      return rightSide ? 'Through the right side' : 'Through the left side';
    case 'single-bloop':
      return `Bloop to ${where}`;
    case 'single-chopper':
      return `Chopper to ${fielder ? POSITION_WORDS[fielder] : 'the infield'}`;
    case 'double-gap':
      return `Into the ${where} gap`;
    case 'double-line':
      return `Down the ${rightSide ? 'right' : 'left'}-field line`;
    case 'double-wall':
      return `Off the wall in ${where}`;
    case 'triple-corner':
      return `Into the ${rightSide ? 'right' : 'left'}-field corner`;
    case 'triple-gap':
      return 'To the deepest part of the park';
    case 'homer-liner':
      return `A line drive over the ${where} wall`;
    case 'homer-moonshot':
      return 'A towering moonshot';
    case 'homer-scraper':
      return 'Just over the wall';
  }
}

export const FOUL_POP_SPEECH = 'Foul pop! The catcher has it!';
export const FLY_OUT_SPEECH = 'Fly ball! Caught for the out!';
export const SAC_FLY_SPEECH = 'Sacrifice fly! The run scores.';
export const LINER_OUT_SPEECH = 'Line drive! Snagged for the out!';
export const DIVING_SPEECH = 'Diving catch! What a grab!';
export const DOUBLE_PLAY_SPEECH = 'Double play!';
export const FORCE_OUT_SPEECH = 'Force out at second!';

/** What the announcer says for an out we pitched. */
export function outSpeech(call: OutCall, sacFly: boolean): string {
  switch (call.kind) {
    case 'pop':
      return POP_OUT_SPEECH;
    case 'foul-pop':
      return FOUL_POP_SPEECH;
    case 'fly':
      return sacFly ? SAC_FLY_SPEECH : FLY_OUT_SPEECH;
    case 'liner':
      return LINER_OUT_SPEECH;
    case 'diving':
      return DIVING_SPEECH;
    case 'ground':
      return GROUND_OUT_SPEECH;
    case 'double-play':
      return DOUBLE_PLAY_SPEECH;
    case 'force-second':
      return FORCE_OUT_SPEECH;
  }
}

/** The word that pops over the plate for an out. */
export function outPopText(call: OutCall, sacFly = false): string {
  switch (call.kind) {
    case 'diving':
      return 'Diving catch!';
    case 'double-play':
      return 'Double play!';
    case 'pop':
    case 'foul-pop':
    case 'liner':
      return 'Caught!';
    case 'fly':
      return sacFly ? 'Out! Run scores' : 'Caught!';
    default:
      return 'Out!';
  }
}

/**
 * The next half-inning, once `halfOver` says this one is done: the other side bats, with the
 * bases, outs and strikes cleared. After the top of the 6th or any later inning the bottom is
 * skipped if the rival leads, and after the bottom the game ends unless it is still tied (then
 * a whole new inning is played). A game that ends has `over` and a `winner`.
 */
export function nextHalf(state: GameState): GameState {
  const clear = { strikes: 0, outs: 0, runs: 0, bases: EMPTY_BASES };
  const { us, them } = totals(state);
  if (state.half === 'top') {
    if (state.inning >= INNINGS && them > us) {
      return { ...state, ...clear, over: true, winner: 'them' };
    }
    return { ...state, ...clear, half: 'bottom', them: [...state.them, 0] };
  }
  if (state.inning >= INNINGS && us !== them) {
    return { ...state, ...clear, over: true, winner: us > them ? 'us' : 'them' };
  }
  return { ...state, ...clear, half: 'top', inning: state.inning + 1, us: [...state.us, 0] };
}

/** "Top of the 3rd" and so on: 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st... */
export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10];
  return `${n}${suffix ?? 'th'}`;
}

/** The banner at the start of a half-inning. */
export function inningBanner(inning: number, half: Half): { title: string; detail: string } {
  return {
    title: `${half === 'top' ? 'Top' : 'Bottom'} of the ${ordinal(inning)}`,
    detail: half === 'top' ? "You're up to bat!" : 'Time to pitch!',
  };
}

/** What the announcer says at the start of a half-inning. */
export function inningSpeech(inning: number, half: Half): string {
  const where =
    inning > MAX_SPOKEN_INNING
      ? 'Extra innings.'
      : `${half === 'top' ? 'Top' : 'Bottom'} of the ${ordinal(inning)}.`;
  return `${where} ${half === 'top' ? "You're up to bat!" : 'Time to pitch!'}`;
}

/** What the announcer says when a half-inning ends. */
export function halfEndSpeech(reason: 'outs' | 'mercy'): string {
  return reason === 'outs' ? THREE_OUTS : MERCY_SPEECH;
}

/** The banner when a half-inning ends. */
export function halfEndTitle(reason: 'outs' | 'mercy'): string {
  return reason === 'outs' ? 'Three outs!' : 'Mercy rule!';
}

/** Who leads, as the announcer says it. `lead` is our runs minus theirs. */
export function leadSpeech(lead: number): string {
  if (lead === 0) return 'All tied up!';
  const by =
    Math.abs(lead) > MAX_SPOKEN_RUNS ? `more than ${MAX_SPOKEN_RUNS}` : String(Math.abs(lead));
  return `${lead > 0 ? 'You' : 'They'} lead by ${by}!`;
}

/** The umpire's call, as shown and as said. */
export function strikeCall(
  strikes: number,
  called: boolean,
): { title: string; spoken: string; out: boolean } {
  const words = ['', 'one', 'two', 'three'];
  const n = Math.min(Math.max(strikes, 1), STRIKES_OUT);
  if (n >= STRIKES_OUT) {
    return called
      ? {
          title: 'Strike 3, looking! Out!',
          spoken: 'Strike three, looking! You are out!',
          out: true,
        }
      : { title: 'Strike 3! Out!', spoken: 'Strike three! You are out!', out: true };
  }
  return called
    ? { title: `Called strike ${n}!`, spoken: `Called strike ${words[n]}!`, out: false }
    : { title: `Strike ${n}!`, spoken: `Strike ${words[n]}!`, out: false };
}

/** The call on a strike we pitched past the rival's batter. */
export function pitchStrikeCall(strikes: number): { title: string; spoken: string; out: boolean } {
  const words = ['', 'one', 'two', 'three'];
  const n = Math.min(Math.max(strikes, 1), STRIKES_OUT);
  if (n >= STRIKES_OUT) {
    return { title: 'Strike 3! Strikeout!', spoken: 'Strike three! Strikeout!', out: true };
  }
  return { title: `Strike ${n}!`, spoken: `Strike ${words[n]}!`, out: false };
}

/** The line score as shown on the big board: one cell per inning, and the totals. */
export interface LineScore {
  /** The innings the columns are for (the last six when the game has gone past the 6th). */
  innings: number[];
  /** Runs in each of those innings: "" when not played yet, "X" when the bottom was not needed. */
  us: string[];
  them: string[];
  usTotal: number;
  themTotal: number;
}

/**
 * The line score for a game. `shown` is the runs to show for the half-inning in play (the board
 * lags the real score while runners are still on their way home); it defaults to the real runs.
 */
export function lineScore(state: GameState, shown: number = state.runs): LineScore {
  const first = Math.max(1, state.inning - INNINGS + 1);
  const innings = Array.from({ length: INNINGS }, (_, i) => first + i);
  // The half-inning in play shows `shown` runs, whatever it has really scored.
  const played = (side: Side) => {
    const runs = side === 'us' ? state.us : state.them;
    const batting = isBatting(state) === (side === 'us');
    if (state.over || !batting || !runs.length) return runs;
    return [...runs.slice(0, -1), shown];
  };
  const cells = (side: Side) => {
    const runs = played(side);
    return innings.map((inning) => {
      if (runs[inning - 1] !== undefined) return String(runs[inning - 1]);
      // The bottom of the last inning is crossed out when it was not needed.
      const skipped = side === 'them' && state.over && inning === state.inning;
      return skipped && state.us[inning - 1] !== undefined ? 'X' : '';
    });
  };
  return {
    innings,
    us: cells('us'),
    them: cells('them'),
    usTotal: sum(played('us')),
    themTotal: sum(played('them')),
  };
}

/** Outs and strikes as filled and empty dots, like "●●○". */
export function dots(filled: number, total: number): string {
  const n = Math.min(Math.max(filled, 0), total);
  return '●'.repeat(n) + '○'.repeat(total - n);
}

/** Eases `current` towards `goal`; frame-rate independent for a given `rate` (1/seconds). */
export function easeToward(current: number, goal: number, rate: number, delta: number): number {
  return current + (goal - current) * (1 - Math.exp(-rate * delta));
}
