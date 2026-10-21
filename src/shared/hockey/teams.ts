/** The teams: ours and the six rivals, with the lines about them. Pure: no three.js, no DOM. */

export interface Team {
  id: string;
  /** "Wolves": in "Wolves score." and "The Wolves win." */
  nickname: string;
  /** Three capital letters for the scorebug. */
  abbr: string;
  /** Jersey colour (0xRRGGBB). */
  jersey: number;
  /** Helmet, stripe and socks. */
  trim: number;
}

export type Role = 'C' | 'W' | 'D';

/** The big number on the back of each role (the goalie is `G`). */
export const ROLE_NUMBER: Record<Role | 'G', number> = { C: 19, W: 9, D: 4, G: 30 };

export const US: Team = {
  id: 'home',
  nickname: 'Home Team',
  abbr: 'HOM',
  jersey: 0x2a6fd1,
  trim: 0xffffff,
};

export const RIVALS: readonly Team[] = [
  { id: 'polar-bears', nickname: 'Polar Bears', abbr: 'PLR', jersey: 0xe8eef5, trim: 0x1d2b53 },
  { id: 'thunder', nickname: 'Thunder', abbr: 'THU', jersey: 0xf2c230, trim: 0x222222 },
  { id: 'wolves', nickname: 'Wolves', abbr: 'WLV', jersey: 0x7a8590, trim: 0x111827 },
  { id: 'comets', nickname: 'Comets', abbr: 'COM', jersey: 0xf07a2a, trim: 0x1f2937 },
  { id: 'moose', nickname: 'Moose', abbr: 'MOO', jersey: 0x8a5a2b, trim: 0xf5deb3 },
  { id: 'sharks', nickname: 'Sharks', abbr: 'SHK', jersey: 0x1aa39a, trim: 0x0b1f2a },
];

/** A random rival; `random` is a number from 0 up to (not including) 1. */
export function pickRival(random: number): Team {
  const index = Math.floor(random * RIVALS.length);
  return RIVALS[Math.min(Math.max(index, 0), RIVALS.length - 1)];
}

/** "Wolves score.": said when the rival scores. */
export function theirGoalSpeech(team: Team): string {
  return `${team.nickname} score.`;
}

/** "The Wolves win.". */
export function rivalWinsSpeech(team: Team): string {
  return `The ${team.nickname} win.`;
}

/** How the game went, for the results screen (on screen only). */
export function outcomeText(team: Team, us: number, them: number, shootout: boolean): string {
  const tail = shootout ? ' in a shootout' : '';
  return us > them
    ? `You won ${us}–${them}${tail}!`
    : `The ${team.nickname} won ${them}–${us}${tail}.`;
}
