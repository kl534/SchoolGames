/**
 * The rules of the game: where the puck is, who has it, what each answer does to that, the clock,
 * the periods, overtime and the shootout. Pure: no three.js, no DOM. Every random choice takes
 * its number as an argument.
 */
import type { Band } from '../../shared/hockey/band';
import type { Side } from '../../shared/hockey/geometry';
import type { Team } from '../../shared/hockey/teams';

export {
  FLASHY_UNDER_SECONDS,
  SOLID_UNDER_SECONDS,
  bandFor,
  type Band,
} from '../../shared/hockey/band';
export type { Side };

export const PERIODS = 3;
export const PERIOD_SECONDS = 1200;
export const OT_SECONDS = 300;
export const SECONDS_PER_QUESTION = 36;
export const SHOOTOUT_ROUNDS = 3;
/** Our puck, wrong answer: below this the other side scores straight away. */
export const INSTANT_GOAL_CHANCE = 0.5;
/** Our puck in their end, right answer: below this we score, otherwise their goalie saves it. */
export const SCORE_CHANCE = 0.25;

/** Always from our view: we attack their end. */
export type Zone = 'our-end' | 'neutral' | 'their-end';
export type Puck =
  /** A faceoff at that zone's dot (neutral is the centre dot). */
  { kind: 'faceoff'; zone: Zone } | { kind: 'held'; side: Side; zone: Zone };

export interface Shootout {
  round: number;
  us: number;
  them: number;
  shooter: Side;
}

export interface GameState {
  /** 1 to 3 in regulation, 4 is overtime, 5 is the shootout. */
  period: number;
  /** Seconds left in the period (0 in the shootout). */
  clock: number;
  puck: Puck;
  /** Goals (the shootout winner gets +1 at the end, like the NHL). */
  us: number;
  them: number;
  shootout: Shootout | null;
  over: boolean;
  winner: Side | null;
}

export const OVERTIME_PERIOD = 4;
export const SHOOTOUT_PERIOD = 5;

export function newGame(): GameState {
  return {
    period: 1,
    clock: PERIOD_SECONDS,
    puck: { kind: 'faceoff', zone: 'neutral' },
    us: 0,
    them: 0,
    shootout: null,
    over: false,
    winner: null,
  };
}

// ---------- Plays ----------

/** Our goals. */
export type OurPlay = 'one-timer' | 'wrist-shot' | 'rebound-goal' | 'so-goal';
/** We move the puck up, or win a faceoff. */
export type AdvancePlay =
  | 'faceoff-win'
  | 'stretch-pass'
  | 'tape-to-tape'
  | 'skate-out'
  | 'spin-o-rama'
  | 'toe-drag'
  | 'give-and-go'
  | 'dump-and-chase';
/** We win the puck back or stop a shot. */
export type StopPlay =
  'body-check' | 'poke-check' | 'intercept' | 'shot-block' | 'goalie-save' | 'so-stopped';
/** They get the puck, or we lose a shot. */
export type TurnoverPlay = 'faceoff-loss' | 'picked-off' | 'save' | 'so-saved';
/** They score. */
export type TheirGoalPlay =
  | 'steal-score'
  | 'breakaway-against'
  | 'counter-rush'
  | 'they-score-wrister'
  | 'they-score-deke'
  | 'so-goal-against';

export type PlayKind = OurPlay | AdvancePlay | StopPlay | TurnoverPlay | TheirGoalPlay;

export type PeriodEnd = 'period' | 'regulation-tied' | 'overtime-tied' | 'final';

export interface StepResult {
  state: GameState;
  /** The puck right after the play, before a period end puts it back at the centre dot. */
  after: Puck;
  play: PlayKind;
  goal: Side | null;
  periodEnd: PeriodEnd | null;
}

const OUR_GOAL_PLAYS: readonly PlayKind[] = ['one-timer', 'wrist-shot', 'rebound-goal', 'so-goal'];

export const isOurGoal = (play: PlayKind): boolean => OUR_GOAL_PLAYS.includes(play);

const THEIR_GOAL_PLAYS: readonly PlayKind[] = [
  'steal-score',
  'breakaway-against',
  'counter-rush',
  'they-score-wrister',
  'they-score-deke',
  'so-goal-against',
];

export const isTheirGoal = (play: PlayKind): boolean => THEIR_GOAL_PLAYS.includes(play);

const held = (side: Side, zone: Zone): Puck => ({ kind: 'held', side, zone });
const faceoff = (zone: Zone): Puck => ({ kind: 'faceoff', zone });

interface Outcome {
  puck: Puck;
  play: PlayKind;
  goal: Side | null;
}

/** What one answer does to the puck, before the clock and the period. */
function outcomeOf(puck: Puck, right: boolean, band: Band, r1: number, r2: number): Outcome {
  if (puck.kind === 'faceoff') {
    return right
      ? { puck: held('us', puck.zone), play: 'faceoff-win', goal: null }
      : { puck: held('them', puck.zone), play: 'faceoff-loss', goal: null };
  }
  const instant = r1 < INSTANT_GOAL_CHANCE;
  const goalAgainst = (play: TheirGoalPlay): Outcome => ({
    puck: faceoff('neutral'),
    play,
    goal: 'them',
  });
  if (puck.side === 'us') {
    switch (puck.zone) {
      case 'our-end':
        if (right) {
          const play: AdvancePlay =
            band === 'flashy' ? 'stretch-pass' : band === 'solid' ? 'tape-to-tape' : 'skate-out';
          return { puck: held('us', 'neutral'), play, goal: null };
        }
        return instant
          ? goalAgainst('steal-score')
          : { puck: held('them', 'our-end'), play: 'picked-off', goal: null };
      case 'neutral':
        if (right) {
          const play: AdvancePlay =
            band === 'flashy'
              ? r2 < 0.5
                ? 'spin-o-rama'
                : 'toe-drag'
              : band === 'solid'
                ? 'give-and-go'
                : 'dump-and-chase';
          return { puck: held('us', 'their-end'), play, goal: null };
        }
        return instant
          ? goalAgainst('breakaway-against')
          : { puck: held('them', 'neutral'), play: 'picked-off', goal: null };
      case 'their-end':
        if (right && r1 >= SCORE_CHANCE) {
          return { puck: faceoff('their-end'), play: 'save', goal: null };
        }
        if (right) {
          const play: OurPlay =
            band === 'flashy' ? 'one-timer' : band === 'solid' ? 'wrist-shot' : 'rebound-goal';
          return { puck: faceoff('neutral'), play, goal: 'us' };
        }
        return instant
          ? goalAgainst('counter-rush')
          : { puck: faceoff('their-end'), play: 'save', goal: null };
    }
  }
  // They have the puck, in any zone: a stop in our end, or their goal.
  if (right) {
    const play: StopPlay =
      band === 'flashy'
        ? 'body-check'
        : band === 'solid'
          ? r2 < 0.5
            ? 'poke-check'
            : 'intercept'
          : r2 < 0.5
            ? 'goalie-save'
            : 'shot-block';
    return { puck: held('us', 'our-end'), play, goal: null };
  }
  return goalAgainst(r2 < 0.5 ? 'they-score-wrister' : 'they-score-deke');
}

/** The state after the clock has run `SECONDS_PER_QUESTION` and the period may have ended. */
function endOfPlay(
  state: GameState,
  goal: Side | null,
): { state: GameState; end: PeriodEnd | null } {
  const overtime = state.period === OVERTIME_PERIOD;
  if (overtime && goal) {
    return { state: { ...state, over: true, winner: goal }, end: 'final' };
  }
  if (state.clock > 0) return { state, end: null };
  if (state.period < PERIODS) {
    return {
      state: {
        ...state,
        period: state.period + 1,
        clock: PERIOD_SECONDS,
        puck: faceoff('neutral'),
      },
      end: 'period',
    };
  }
  const tied = state.us === state.them;
  if (state.period === PERIODS) {
    if (!tied) {
      return {
        state: { ...state, over: true, winner: state.us > state.them ? 'us' : 'them' },
        end: 'final',
      };
    }
    return {
      state: { ...state, period: OVERTIME_PERIOD, clock: OT_SECONDS, puck: faceoff('neutral') },
      end: 'regulation-tied',
    };
  }
  // Overtime ran out with nobody scoring.
  return {
    state: {
      ...state,
      period: SHOOTOUT_PERIOD,
      clock: 0,
      puck: faceoff('neutral'),
      shootout: { round: 1, us: 0, them: 0, shooter: 'us' },
    },
    end: 'overtime-tied',
  };
}

/**
 * One answer. `r1` picks the 50/50 on our wrong answers (below `INSTANT_GOAL_CHANCE` the other
 * side scores) and whether our shot goes in (below `SCORE_CHANCE`), `r2` picks between two
 * variants of a play.
 */
export function step(
  state: GameState,
  right: boolean,
  band: Band,
  r1: number,
  r2: number,
): StepResult {
  if (state.period === SHOOTOUT_PERIOD) return shootoutStep(state, right);
  const outcome = outcomeOf(state.puck, right, band, r1, r2);
  const next: GameState = {
    ...state,
    puck: outcome.puck,
    clock: Math.max(0, state.clock - SECONDS_PER_QUESTION),
    us: state.us + (outcome.goal === 'us' ? 1 : 0),
    them: state.them + (outcome.goal === 'them' ? 1 : 0),
  };
  const end = endOfPlay(next, outcome.goal);
  return {
    state: end.state,
    after: outcome.puck,
    play: outcome.play,
    goal: outcome.goal,
    periodEnd: end.end,
  };
}

// ---------- The shootout ----------

/**
 * Who has won the shootout at this point, if anyone. `so` is the state after a shot, with the
 * round and shooter of the NEXT shot. Three rounds each; a side that cannot catch up is done
 * early; after that each full round with different totals decides it.
 */
export function shootoutDecided(so: Shootout): Side | null {
  const themShots = so.round - 1;
  const usShots = so.round - 1 + (so.shooter === 'them' ? 1 : 0);
  if (so.round > SHOOTOUT_ROUNDS) {
    // Sudden death: only a full round counts.
    if (so.shooter !== 'us' || so.us === so.them) return null;
    return so.us > so.them ? 'us' : 'them';
  }
  const usLeft = Math.max(0, SHOOTOUT_ROUNDS - usShots);
  const themLeft = Math.max(0, SHOOTOUT_ROUNDS - themShots);
  if (so.us > so.them + themLeft) return 'us';
  if (so.them > so.us + usLeft) return 'them';
  return null;
}

/** One shot of the shootout: ours (a right answer scores) or theirs (a right answer stops it). */
export function shootoutStep(state: GameState, right: boolean): StepResult {
  const so = state.shootout ?? { round: 1, us: 0, them: 0, shooter: 'us' as Side };
  const ours = so.shooter === 'us';
  const scored = ours ? right : !right;
  const play: PlayKind = ours
    ? scored
      ? 'so-goal'
      : 'so-saved'
    : scored
      ? 'so-goal-against'
      : 'so-stopped';
  const goal: Side | null = scored ? (ours ? 'us' : 'them') : null;
  const after: Shootout = {
    ...so,
    us: so.us + (goal === 'us' ? 1 : 0),
    them: so.them + (goal === 'them' ? 1 : 0),
  };
  // The next shot: them after us, and the next round after them.
  const next: Shootout = ours
    ? { ...after, shooter: 'them' }
    : { ...after, shooter: 'us', round: so.round + 1 };
  const winner = shootoutDecided(next);
  if (!winner) {
    return { state: { ...state, shootout: next }, after: state.puck, play, goal, periodEnd: null };
  }
  return {
    state: {
      ...state,
      shootout: next,
      us: state.us + (winner === 'us' ? 1 : 0),
      them: state.them + (winner === 'them' ? 1 : 0),
      over: true,
      winner,
    },
    after: state.puck,
    play,
    goal,
    periodEnd: 'final',
  };
}

// ---------- Calls (all fixed, all recorded) ----------

export const PLAY_CALL: Record<OurPlay | StopPlay | TurnoverPlay | AdvancePlay, string> = {
  'faceoff-win': 'We win the faceoff!',
  'faceoff-loss': 'They win the faceoff.',
  'stretch-pass': 'Stretch pass!',
  'tape-to-tape': 'Tape to tape!',
  'skate-out': 'Out of the zone!',
  'spin-o-rama': 'Spin-o-rama!',
  'toe-drag': 'What a toe drag!',
  'give-and-go': 'Give and go!',
  'dump-and-chase': 'Dump and chase! We get there first!',
  'one-timer': 'One-timer! Goal!',
  'wrist-shot': 'Wrist shot, top shelf! Goal!',
  'rebound-goal': 'On the rebound! Goal!',
  'body-check': 'Big hit! Our puck!',
  'poke-check': 'Poke check! Our puck!',
  intercept: 'Picked off! Our puck!',
  'shot-block': 'Shot blocked!',
  'goalie-save': 'What a save!',
  'picked-off': 'Turnover!',
  save: 'Saved by the goalie.',
  'so-goal': 'Shoots, scores!',
  'so-saved': 'Saved!',
  'so-stopped': 'Our goalie stops it!',
};

export const DROP_THE_PUCK = 'Drop the puck!';
export const END_OF_PERIOD = ['End of the first period.', 'End of the second period.'];
export const OVERTIME_SPEECH = 'Overtime! Next goal wins!';
export const SHOOTOUT_SPEECH = 'Shootout!';
export const YOU_WIN_SPEECH = 'You win!';

/** The call for a play: the fixed line, or the rival's goal line (`theirGoal`) for their goals. */
export function callFor(play: PlayKind, theirGoal: string): string {
  return isTheirGoal(play) ? theirGoal : PLAY_CALL[play as keyof typeof PLAY_CALL];
}

// ---------- On-screen words (not spoken) ----------

export const PLAY_LABEL: Record<PlayKind, string> = {
  'faceoff-win': 'FACEOFF WON!',
  'faceoff-loss': 'FACEOFF LOST',
  'stretch-pass': 'STRETCH PASS!',
  'tape-to-tape': 'TAPE TO TAPE!',
  'skate-out': 'BREAKOUT!',
  'spin-o-rama': 'SPIN-O-RAMA!',
  'toe-drag': 'TOE DRAG!',
  'give-and-go': 'GIVE AND GO!',
  'dump-and-chase': 'DUMP AND CHASE!',
  'one-timer': 'GOAL!',
  'wrist-shot': 'GOAL!',
  'rebound-goal': 'GOAL!',
  'so-goal': 'GOAL!',
  'body-check': 'BIG HIT!',
  'poke-check': 'POKE CHECK!',
  intercept: 'PICKED OFF!',
  'shot-block': 'SHOT BLOCKED!',
  'goalie-save': 'GREAT SAVE!',
  'picked-off': 'TURNOVER!',
  save: 'SAVE!',
  'so-saved': 'SAVED!',
  'so-stopped': 'STOPPED!',
  'steal-score': 'TURNOVER!',
  'breakaway-against': 'BREAKAWAY!',
  'counter-rush': 'COUNTER RUSH!',
  'they-score-wrister': 'SHOT!',
  'they-score-deke': 'DEKE!',
  'so-goal-against': 'THEY SCORE',
};

/** The banner for a play: `'<ABBR> GOAL'` for their goals, else the play's word. */
export function bannerFor(play: PlayKind, rival: Team): string {
  return isTheirGoal(play) ? `${rival.abbr} GOAL` : PLAY_LABEL[play];
}

// ---------- The clock and the scorebug ----------

/** "12:24". */
export function clockText(seconds: number): string {
  const whole = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** "1ST", "2ND", "3RD", "OT", "SO". */
export function periodShort(period: number): string {
  if (period === OVERTIME_PERIOD) return 'OT';
  if (period === SHOOTOUT_PERIOD) return 'SO';
  return ['', '1ST', '2ND', '3RD'][period] ?? `${period}TH`;
}

/** The banner that opens a period: "2ND PERIOD", "OVERTIME", "SHOOTOUT". */
export function periodBanner(period: number): string {
  if (period === OVERTIME_PERIOD) return 'OVERTIME';
  if (period === SHOOTOUT_PERIOD) return 'SHOOTOUT';
  return `${periodShort(period)} PERIOD`;
}

/** The banner that closes a regulation period: "END OF 1ST". */
export function endOfPeriodBanner(period: number): string {
  return `END OF ${periodShort(period)}`;
}

/** The zone the puck is in (a faceoff counts as its zone). */
export function zoneOf(puck: Puck): Zone {
  return puck.zone;
}

/** Whether the game went to a shootout. */
export function wentToShootout(state: GameState): boolean {
  return state.shootout !== null;
}

/** Easing a number towards a goal, frame-rate independent. */
export function easeToward(current: number, goal: number, rate: number, delta: number): number {
  return current + (goal - current) * (1 - Math.exp(-rate * delta));
}
