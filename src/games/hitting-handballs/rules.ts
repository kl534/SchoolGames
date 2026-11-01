/** The ladder, the match and the words of Hitting Handballs. Pure: no DOM, no three.js. */

export const TARGET = 11;
export const WIN_BY = 2;
export const RUNGS = 5;
/** `rung` 0-4 = the next pair to beat; 5 = crowned Recess Champions. */
export const CHAMPION_RUNG = 5;
/** Winning by this many points earns 3 stars. */
export const STAR_MARGIN = 5;
/** A loss with this many points earns 1 star. */
export const STAR_POINTS_ON_LOSS = 6;
export const TEAMMATE_NAME = 'Sam';

export type Side = 'us' | 'them';
export type PairId = 'kinder' | 'hopscotch' | 'lunch' | 'sneaker' | 'legends';

export interface Pair {
  id: PairId;
  /** Shown. */
  name: string;
  /** A right answer faster than this many seconds is a smash. */
  smashUnder: number;
  /** This many right answers in a row in a rally win the point. */
  streakToWin: number;
  /** Spoken on the VS card. */
  intro: string;
}

export type HitResult = 'smash' | 'winner' | 'return' | 'whiff';

export interface Match {
  /** Index into `PAIRS`. */
  pair: number;
  us: number;
  them: number;
  server: Side;
  /** Our right answers so far this rally. */
  streak: number;
  winner: Side | null;
}

export const PAIRS: readonly Pair[] = [
  {
    id: 'kinder',
    name: 'The Kinder Twins',
    smashUnder: 3,
    streakToWin: 2,
    intro: "We're the Kinder Twins! We're five!",
  },
  {
    id: 'hopscotch',
    name: 'The Hopscotch Sisters',
    smashUnder: 2.5,
    streakToWin: 3,
    intro: "Hop, skip and slap! We're the Hopscotch Sisters!",
  },
  {
    id: 'lunch',
    name: 'The Lunch Line Bullies',
    smashUnder: 2,
    streakToWin: 3,
    intro: 'Lunch Line Bullies! We want your pudding cup!',
  },
  {
    id: 'sneaker',
    name: 'The Sneaker Squad',
    smashUnder: 1.75,
    streakToWin: 4,
    intro: "Sneaker Squad! Squeak squeak, we're fast!",
  },
  {
    id: 'legends',
    name: 'The Fifth-Grade Legends',
    smashUnder: 1.5,
    streakToWin: 4,
    intro: 'We are the Fifth-Grade Legends. Nobody beats us.',
  },
];

export function newMatch(pair: number, server: Side): Match {
  return { pair, us: 0, them: 0, server, streak: 0, winner: null };
}

/** `random` below one half: we serve first. */
export function coinToss(random: number): Side {
  return random < 0.5 ? 'us' : 'them';
}

/** What one answer does to the ball. */
export function judgeHit(pair: Pair, streak: number, right: boolean, seconds: number): HitResult {
  if (!right) return 'whiff';
  if (seconds < pair.smashUnder) return 'smash';
  if (streak + 1 >= pair.streakToWin) return 'winner';
  return 'return';
}

/** A side wins with at least `TARGET` points and a lead of at least `WIN_BY`. */
export function matchWinner(us: number, them: number): Side | null {
  if (us >= TARGET && us - them >= WIN_BY) return 'us';
  if (them >= TARGET && them - us >= WIN_BY) return 'them';
  return null;
}

/** One answer. Throws if the match is already over. */
export function step(
  match: Match,
  right: boolean,
  seconds: number,
): { match: Match; result: HitResult; point: Side | null } {
  if (match.winner) throw new Error('The match is over');
  const result = judgeHit(PAIRS[match.pair], match.streak, right, seconds);
  let { us, them, server, streak } = match;
  let point: Side | null = null;
  if (result === 'smash' || result === 'winner') {
    us++;
    streak = 0;
    server = 'us';
    point = 'us';
  } else if (result === 'whiff') {
    them++;
    streak = 0;
    server = 'them';
    point = 'them';
  } else {
    streak++;
  }
  return {
    match: { ...match, us, them, server, streak, winner: matchWinner(us, them) },
    result,
    point,
  };
}

/** No winner yet, and one more point for either side would win. */
export function isMatchPoint(us: number, them: number): boolean {
  if (matchWinner(us, them)) return false;
  return matchWinner(us + 1, them) !== null || matchWinner(us, them + 1) !== null;
}

const WORD = [
  'Zero',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
] as const;

/** The score as the referee says it (ours first), or null for 0-0 and a finished match. */
export function scoreCall(us: number, them: number): string | null {
  if ((us === 0 && them === 0) || matchWinner(us, them)) return null;
  if (Math.max(us, them) >= TARGET + 1) {
    if (us === them) return 'Deuce!';
    return us > them ? 'Advantage us!' : 'Advantage them!';
  }
  if (us === them) return `${WORD[us]} all.`;
  return `${WORD[us]}, ${WORD[them].toLowerCase()}.`;
}

/** Every call `scoreCall` can make in a match. */
export function allScoreCalls(): string[] {
  const calls: string[] = [];
  for (let a = 0; a <= TARGET; a++) {
    for (let b = 0; b <= TARGET; b++) {
      const call = scoreCall(a, b);
      if (call) calls.push(call);
    }
  }
  calls.push('Deuce!', 'Advantage us!', 'Advantage them!');
  return calls;
}

/**
 * Which kid of a pair the ball goes to (0 = the front / left kid): `random` picks, but never the
 * same kid three times in a row.
 */
export function pickTarget(random: number, history: readonly (0 | 1)[]): 0 | 1 {
  const last = history.slice(-2);
  if (last.length === 2 && last[0] === last[1]) return last[0] === 0 ? 1 : 0;
  return random < 0.5 ? 0 : 1;
}

/** The rung after a match: a win climbs one (to the crown), a loss drops one unless crowned. */
export function nextRung(rung: number, won: boolean): number {
  if (won) return Math.min(rung + 1, CHAMPION_RUNG);
  return rung === CHAMPION_RUNG ? CHAMPION_RUNG : Math.max(0, rung - 1);
}

/** Rung < 5: that pair. Rung 5: random index 0-4, never `last` (when given). */
export function pairFor(rung: number, random: number, last?: number): number {
  if (rung < CHAMPION_RUNG) return Math.max(0, rung);
  const choices = PAIRS.map((_, i) => i).filter((i) => i !== last);
  return choices[Math.min(Math.floor(random * choices.length), choices.length - 1)];
}

/** Win by 5 or more = 3; any other win = 2; a loss with 6 or more points = 1; otherwise 0. */
export function matchStars(won: boolean, us: number, them: number): number {
  if (won) return us - them >= STAR_MARGIN ? 3 : 2;
  return us >= STAR_POINTS_ON_LOSS ? 1 : 0;
}

export const PLAY_BALL_SPEECH = 'Play ball!';
export const MATCH_POINT_SPEECH = 'Match point!';
export const WE_WIN_SPEECH = 'We win!';
export const SO_CLOSE_SPEECH = 'So close! Try again!';
export const CHAMPION_SPEECH = 'You are the Recess Champions!';

/** Comic words on screen (written, not spoken). */
export const WORDS = {
  smash: 'SMASH!',
  winner: 'WINNER!',
  whiff: 'WHIFF!',
  bonk: 'BONK!',
} as const;

/** The line on the results screen (written only, not spoken). */
export function outcomeText(
  rung: number,
  pair: Pair,
  won: boolean,
  us: number,
  them: number,
): string {
  if (won) {
    const score = `${us}–${them}`;
    if (rung < CHAMPION_RUNG - 1) {
      return `You beat ${pair.name} ${score}! Next up: ${PAIRS[rung + 1].name}.`;
    }
    if (rung === CHAMPION_RUNG - 1) {
      return `You beat ${pair.name} ${score}! You are the Recess Champions! 👑`;
    }
    return `You beat ${pair.name} ${score}!`;
  }
  const score = `${them}–${us}`;
  if (rung >= 1 && rung < CHAMPION_RUNG) {
    return `${pair.name} won ${score}. Back down to ${PAIRS[rung - 1].name}.`;
  }
  return `${pair.name} won ${score}. Try again!`;
}

/** The VS card's line under the names. */
export function vsSubtitle(pair: Pair): string {
  return `First to ${TARGET}, win by ${WIN_BY}. Answer in under ${pair.smashUnder} s to SMASH! ${pair.streakToWin} good hits in a row win the point.`;
}

/** What shows under the pair's name. */
export function rungLabel(rung: number, pair: number): string {
  return rung < CHAMPION_RUNG ? `Rung ${pair + 1} of ${RUNGS}` : 'Rematch';
}
