/**
 * The rules of the shootout: three shooters a side take turns, it ends early when a side cannot
 * catch up, then sudden death with full rounds. Pure: no three.js, no DOM. Every random choice
 * takes its number as an argument.
 */
import type { Side } from '../../shared/hockey/geometry';
import { ROLE_NUMBER, type Role, type Team } from '../../shared/hockey/teams';

export type { Role, Side };

export const ROUNDS = 3;
/** Shooting order; the numbers are `ROLE_NUMBER` (19, 9, 4). The order repeats in sudden death. */
export const SHOOTERS: readonly Role[] = ['C', 'W', 'D'];

export type ShootoutPlay = 'so-goal' | 'so-saved' | 'so-stopped' | 'so-goal-against';
export interface Shot {
  side: Side;
  role: Role;
  scored: boolean;
}
export interface State {
  /** Who shoots first (the coin toss). */
  first: Side;
  /** Every shot so far, in order. */
  shots: Shot[];
  us: number;
  them: number;
  over: boolean;
  winner: Side | null;
}
export interface NextShot {
  side: Side;
  role: Role;
  round: number;
  suddenDeath: boolean;
}
export interface StepResult {
  state: State;
  shot: Shot;
  play: ShootoutPlay;
  goal: Side | null;
}

const otherSide = (side: Side): Side => (side === 'us' ? 'them' : 'us');

/** A fresh shootout: 0-0 and no shots. */
export function newShootout(first: Side): State {
  return { first, shots: [], us: 0, them: 0, over: false, winner: null };
}

/** Who shoots next, which shooter, and in which round. */
export function nextShot(state: State): NextShot {
  const i = state.shots.length;
  const round = Math.floor(i / 2) + 1;
  return {
    side: i % 2 === 0 ? state.first : otherSide(state.first),
    role: SHOOTERS[(round - 1) % SHOOTERS.length],
    round,
    suddenDeath: round > ROUNDS,
  };
}

/** The winner, once the shots so far settle it. */
export function shootoutDecided(state: State): Side | null {
  const usShots = state.shots.filter((s) => s.side === 'us').length;
  const themShots = state.shots.length - usShots;
  const usLeft = Math.max(0, ROUNDS - usShots);
  const themLeft = Math.max(0, ROUNDS - themShots);
  // The guard is essential: in sudden death the side that shot first must not win before the
  // other side has shot.
  if (Math.max(usShots, themShots) <= ROUNDS) {
    if (state.us > state.them + themLeft) return 'us';
    if (state.them > state.us + usLeft) return 'them';
  }
  if (usShots === themShots && usShots >= ROUNDS && state.us !== state.them) {
    return state.us > state.them ? 'us' : 'them';
  }
  return null;
}

/** One shot: ours scores on a right answer, theirs scores on a wrong one. */
export function step(state: State, right: boolean): StepResult {
  const ns = nextShot(state);
  const ours = ns.side === 'us';
  const scored = ours ? right : !right;
  const play: ShootoutPlay = ours
    ? scored
      ? 'so-goal'
      : 'so-saved'
    : scored
      ? 'so-goal-against'
      : 'so-stopped';
  const shot: Shot = { side: ns.side, role: ns.role, scored };
  const goal: Side | null = scored ? ns.side : null;
  const next: State = {
    ...state,
    shots: [...state.shots, shot],
    us: state.us + (goal === 'us' ? 1 : 0),
    them: state.them + (goal === 'them' ? 1 : 0),
  };
  const winner = shootoutDecided(next);
  return { state: { ...next, over: winner !== null, winner }, shot, play, goal };
}

/** The coin toss: under 0.5 we shoot first. */
export function coinToss(random: number): Side {
  return random < 0.5 ? 'us' : 'them';
}

/** The goals shown as dots on the scorebug (true = goal). */
export function dotsOf(state: State): { us: boolean[]; them: boolean[] } {
  const dots = { us: [] as boolean[], them: [] as boolean[] };
  for (const shot of state.shots) dots[shot.side].push(shot.scored);
  return dots;
}

/** The scorebug's clock slot: `R1` to `R3`, then `SD`. */
export function roundText(next: NextShot): string {
  return next.suddenDeath ? 'SD' : `R${next.round}`;
}

// ---------- Calls (all fixed, all recorded) ----------

export const SHOOTOUT_SPEECH = 'Shootout!';
export const COIN_TOSS_SPEECH = 'Coin toss!';
export const FIRST_US_SPEECH = 'We shoot first!';
export const SUDDEN_DEATH_SPEECH = 'Sudden death!';
export const YOU_WIN_SPEECH = 'You win!';
/** "Wolves shoot first.". */
export const firstThemSpeech = (team: Team): string => `${team.nickname} shoot first.`;

/** What is said after our shots and their stopped ones; their goals say the rival's name. */
export const SHOT_CALL = {
  'so-goal': 'Shoots, scores!',
  'so-saved': 'Saved!',
  'so-stopped': 'Our goalie stops it!',
} as const;

/** "Home Team, number 19." or "Wolves, number 9.". */
export function shooterSpeech(team: Team, role: Role): string {
  return `${team.nickname}, number ${ROLE_NUMBER[role]}.`;
}

// ---------- On-screen words (not spoken) ----------

export const COIN_TOSS_BANNER = 'COIN TOSS';
export const SUDDEN_DEATH_BANNER = 'SUDDEN DEATH';

export const SHOT_LABEL: Record<Exclude<ShootoutPlay, 'so-goal-against'>, string> = {
  'so-goal': 'GOAL!',
  'so-saved': 'SAVED!',
  'so-stopped': 'STOPPED!',
};

/** The banner for a shot's result: `'<ABBR> GOAL'` for their goals. */
export function shotBanner(play: ShootoutPlay, rival: Team): string {
  return play === 'so-goal-against' ? `${rival.abbr} GOAL` : SHOT_LABEL[play];
}

/** "WE SHOOT FIRST" or "WLV SHOOT FIRST". */
export function firstBanner(first: Side, rival: Team): string {
  return first === 'us' ? 'WE SHOOT FIRST' : `${rival.abbr} SHOOT FIRST`;
}

/** The banner before a shot: "WLV #19", over "ROUND 2" (or "SUDDEN DEATH"). */
export function shooterBanner(team: Team, next: NextShot): { title: string; detail: string } {
  return {
    title: `${team.abbr} #${ROLE_NUMBER[next.role]}`,
    detail: next.suddenDeath ? SUDDEN_DEATH_BANNER : `ROUND ${next.round}`,
  };
}

/** How the shootout went, for the results screen (on screen only). */
export function outcomeText(team: Team, us: number, them: number): string {
  return us > them
    ? `You won the shootout ${us}–${them}!`
    : `The ${team.nickname} won the shootout ${them}–${us}.`;
}
