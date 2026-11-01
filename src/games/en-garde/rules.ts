/** The ladder, the bout and the words of En Garde!. Pure: no DOM, no three.js. */

export const HITS_TO_LOSE = 3;
export const RUNGS = 5;
/** `rung` 0-4 = the next rival to beat; 5 = crowned Party Champion. */
export const CHAMPION_RUNG = 5;
/** A loss with this many pokes landed earns 1 star. */
export const STAR_POKES_ON_LOSS = 5;

export type RivalId = 'pip' | 'sprinkles' | 'cupcake' | 'noodle' | 'champion';

export interface Rival {
  id: RivalId;
  /** Shown and spoken. */
  name: string;
  pokesToWin: number;
  /** Spoken on the VS card. */
  intro: string;
  /** Spoken when they poke you, alternating. */
  taunts: readonly [string, string];
}

export const RIVALS: readonly Rival[] = [
  {
    id: 'pip',
    name: 'Pip the Party Pup',
    pokesToWin: 8,
    intro: "I'm Pip the Party Pup! Let's play!",
    taunts: ['Boop! Got you!', 'Yip yip! Gotcha!'],
  },
  {
    id: 'sprinkles',
    name: 'Sir Sprinkles',
    pokesToWin: 9,
    intro: 'I am Sir Sprinkles! Have at thee!',
    // "Too-shay!" is spelled for the voice: Kokoro reads "Touché" as "tuh-shay".
    taunts: ['Ha! A royal poke!', 'Too-shay!'],
  },
  {
    id: 'cupcake',
    name: 'Captain Cupcake',
    pokesToWin: 10,
    intro: 'Captain Cupcake! Prepare to be poked!',
    taunts: ['Arr! Gotcha!', 'Yo ho, a hit!'],
  },
  {
    id: 'noodle',
    name: 'Ninja Noodle',
    pokesToWin: 11,
    intro: 'Ninja Noodle strikes in silence!',
    taunts: ['Hi-yah!', 'Swift as a noodle!'],
  },
  {
    id: 'champion',
    name: 'The Birthday Champion',
    pokesToWin: 12,
    intro: 'I am the Birthday Champion! Bow before my balloon!',
    taunts: ['Ha! Gotcha!', 'The champion strikes!'],
  },
];

export type Side = 'us' | 'them';

export interface Bout {
  /** Index into `RIVALS`. */
  rival: number;
  pokesToWin: number;
  /** Pokes we have landed. */
  landed: number;
  /** Pokes we have taken. */
  taken: number;
  winner: Side | null;
}

export function newBout(rival: number): Bout {
  return { rival, pokesToWin: RIVALS[rival].pokesToWin, landed: 0, taken: 0, winner: null };
}

/** One answer. Throws if the bout is already over. */
export function step(bout: Bout, right: boolean): Bout {
  if (bout.winner) throw new Error('The bout is over');
  const landed = bout.landed + (right ? 1 : 0);
  const taken = bout.taken + (right ? 0 : 1);
  const winner: Side | null =
    landed >= bout.pokesToWin ? 'us' : taken >= HITS_TO_LOSE ? 'them' : null;
  return { ...bout, landed, taken, winner };
}

/** The rung after a bout: a win climbs one (to the crown), a loss drops one unless crowned. */
export function nextRung(rung: number, won: boolean): number {
  if (won) return Math.min(rung + 1, CHAMPION_RUNG);
  return rung === CHAMPION_RUNG ? CHAMPION_RUNG : Math.max(0, rung - 1);
}

/** Rung < 5: that rival. Rung 5: random index 0-4, never `last` (when given). */
export function rivalFor(rung: number, random: number, last?: number): number {
  if (rung < CHAMPION_RUNG) return Math.max(0, rung);
  const choices = RIVALS.map((_, i) => i).filter((i) => i !== last);
  return choices[Math.min(Math.floor(random * choices.length), choices.length - 1)];
}

/** Win without being poked = 3; win = 2; loss with enough pokes landed = 1; otherwise 0. */
export function boutStars(won: boolean, taken: number, landed: number): number {
  if (won) return taken === 0 ? 3 : 2;
  return landed >= STAR_POKES_ON_LOSS ? 1 : 0;
}

export type PokeKind = 'belly' | 'head' | 'nose' | 'bottom';
export const POKE_KINDS: readonly PokeKind[] = ['belly', 'head', 'nose', 'bottom'];
export const POKE_WORD: Record<PokeKind, string> = {
  belly: 'POKE!',
  head: 'BONK!',
  nose: 'BOOP!',
  bottom: 'BOING!',
};
export const FINISH_WORD = 'KA-POW!';

/** An item of `list` picked by `random` (0 up to 1), never `last`. */
function pickOther<T>(list: readonly T[], random: number, last?: T): T {
  const choices = list.filter((item) => item !== last);
  return choices[Math.min(Math.floor(random * choices.length), choices.length - 1)];
}

/** Random kind, never `last`. */
export function pickPoke(random: number, last?: PokeKind): PokeKind {
  return pickOther(POKE_KINDS, random, last);
}

export const POKE_CALLS = ['Poke!', 'Bullseye!', 'Nice one!'] as const;

/** One of the announcer's poke calls, never `last`. */
export function pickCall(random: number, last?: string): string {
  return pickOther<string>(POKE_CALLS, random, last);
}

// Spelled for the voice: Kokoro reads "En garde" as "en gard" (the banner stays "EN GARDE!").
export const EN_GARDE_SPEECH = 'Ahn gard!';
export const VICTORY_SPEECH = 'Victory!';
export const SO_CLOSE_SPEECH = 'So close! Try again!';
export const CHAMPION_SPEECH = 'You are the Party Champion!';

/** The line on the results screen (written only, not spoken). */
export function outcomeText(
  rung: number,
  rival: Rival,
  won: boolean,
  landed: number,
  taken: number,
): string {
  if (won) {
    const score = `${landed}–${taken}`;
    if (rung < CHAMPION_RUNG - 1) {
      return `You beat ${rival.name} ${score}! Next up: ${RIVALS[rung + 1].name}.`;
    }
    if (rung === CHAMPION_RUNG - 1) {
      return `You beat ${rival.name} ${score}! You are the Party Champion! 👑`;
    }
    return `You beat ${rival.name} ${score}!`;
  }
  const score = `${taken}–${landed}`;
  if (rung >= 1 && rung < CHAMPION_RUNG) {
    return `${rival.name} won ${score}. Back down to ${RIVALS[rung - 1].name}.`;
  }
  return `${rival.name} won ${score}. Try again!`;
}

/** The VS card's line under the names. */
export function vsSubtitle(rival: Rival): string {
  return `Poke ${rival.pokesToWin} times to win. Get poked ${HITS_TO_LOSE} times and you're out!`;
}

/** What shows under the rival's bar. */
export function rungLabel(rung: number, rival: number): string {
  return rung < CHAMPION_RUNG ? `Rung ${rival + 1} of ${RUNGS}` : 'Rematch';
}
