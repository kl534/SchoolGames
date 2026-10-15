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

/** The fraction of the clock used below which each better hit is earned. */
export const HOMER_BELOW = 0.25;
export const TRIPLE_BELOW = 0.5;
export const DOUBLE_BELOW = 0.75;

/** When we pitch, the fraction of the clock used below which a right answer is a pop fly... */
export const POP_OUT_BELOW = 0.25;
/** ...or a ground out; a slower right answer is a strike. */
export const GROUND_OUT_BELOW = 0.5;

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

/** How much of the clock has run, 0 when the answer came at once and 1 at the buzzer. */
export function clockFraction(elapsed: number, total: number): number {
  return total > 0 ? clamp01(elapsed / total) : 1;
}

/** The hit a correct answer earns: the sooner the answer, the further the ball goes. */
export function hitFor(fraction: number): Hit {
  if (fraction < HOMER_BELOW) return 'homer';
  if (fraction < TRIPLE_BELOW) return 'triple';
  if (fraction < DOUBLE_BELOW) return 'double';
  return 'single';
}

export type PitchOutcome = 'popout' | 'groundout' | 'strike';

/** What a right answer does when we pitch: the sooner the answer, the surer the out. */
export function pitchOutcomeFor(fraction: number): PitchOutcome {
  if (fraction < POP_OUT_BELOW) return 'popout';
  if (fraction < GROUND_OUT_BELOW) return 'groundout';
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

/** The big word shown for a hit. */
export function hitLabel(hit: Hit): string {
  return {
    single: 'SINGLE!',
    double: 'DOUBLE!',
    triple: 'TRIPLE!',
    homer: 'HOME RUN!',
  }[hit];
}

/** What the announcer says for a hit. */
export function hitSpeech(hit: Hit): string {
  return {
    single: 'Single!',
    double: 'Double!',
    triple: 'Triple!',
    homer: 'Home run!',
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
 * (which ends the game on the spot).
 */
export function applyHit(state: GameState, hit: Hit): Outcome {
  const moved = advance(state.bases, BASES_FOR[hit]);
  const runs = Math.min(moved.runs, roomToScore(state));
  let next = nextBatter({ ...score(state, runs), bases: moved.bases });
  if (isLastChance(state)) {
    const { us, them } = totals(next);
    if (them > us) next = { ...next, over: true, winner: 'them', walkOff: true };
  }
  return { state: next, out: false, runs, moves: moved.moves };
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
