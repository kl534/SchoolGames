/** The rival players and the lines about them, kept free of three.js and the DOM. */

export interface Rival {
  id: string;
  /** "Rocket Raccoon": on the scorebug's second line, in banners and in "<name> wins!". */
  name: string;
  /** Three capital letters for the scorebug. */
  abbr: string;
  emoji: string;
  /** Jersey colour (0xRRGGBB); shorts and headband are `darken(jersey, 0.6)`. */
  jersey: number;
}

export const RIVALS: readonly Rival[] = [
  { id: 'rocket-raccoon', name: 'Rocket Raccoon', abbr: 'RAC', emoji: '🦝', jersey: 0x6b7280 },
  { id: 'thunder-turtle', name: 'Thunder Turtle', abbr: 'TUR', emoji: '🐢', jersey: 0x1f9d63 },
  { id: 'dizzy-dolphin', name: 'Dizzy Dolphin', abbr: 'DOL', emoji: '🐬', jersey: 0x1fa8c9 },
  { id: 'slam-kangaroo', name: 'Slam Kangaroo', abbr: 'KAN', emoji: '🦘', jersey: 0xb7793f },
  {
    id: 'jumpin-jackrabbit',
    name: "Jumpin' Jackrabbit",
    abbr: 'JAK',
    emoji: '🐰',
    jersey: 0x7c4dcc,
  },
  { id: 'hoopin-hippo', name: "Hoopin' Hippo", abbr: 'HIP', emoji: '🦛', jersey: 0xe8467c },
  { id: 'flash-fox', name: 'Flash Fox', abbr: 'FOX', emoji: '🦊', jersey: 0xe5702a },
  { id: 'zoom-zebra', name: 'Zoom Zebra', abbr: 'ZEB', emoji: '🦓', jersey: 0x22252b },
  { id: 'lucky-llama', name: 'Lucky Llama', abbr: 'LLA', emoji: '🦙', jersey: 0xf0a020 },
  { id: 'bouncy-bear', name: 'Bouncy Bear', abbr: 'BEA', emoji: '🐻', jersey: 0x7a4a2a },
  { id: 'swish-shark', name: 'Swish Shark', abbr: 'SHA', emoji: '🦈', jersey: 0x2a5fd1 },
  { id: 'flying-frog', name: 'Flying Frog', abbr: 'FRG', emoji: '🐸', jersey: 0x7cc242 },
];

/** A random rival; `random` is a number from 0 up to (not including) 1. */
export function pickRival(random: number): Rival {
  const index = Math.floor(random * RIVALS.length);
  return RIVALS[Math.min(Math.max(index, 0), RIVALS.length - 1)];
}

/** What our player wears: white jersey, navy shorts and headband. */
export const OUR_JERSEY = 0xf3f4f8;
export const OUR_TRIM = 0x1c2f6b;

/** A darker shade of a colour. `amount` 0 is black, 1 is unchanged. */
export function darken(colour: number, amount: number): number {
  const shade = (shift: number) => Math.round(((colour >> shift) & 0xff) * amount);
  return (shade(16) << 16) | (shade(8) << 8) | shade(0);
}

/** "Rocket Raccoon wins!". */
export function rivalWinsSpeech(rival: Rival): string {
  return `${rival.name} wins!`;
}

/** "You 24 – Rocket Raccoon 18", for the halftime, overtime and final banners. */
export function scoreLine(rival: Rival, us: number, them: number): string {
  return `You ${us} – ${rival.name} ${them}`;
}

/** How the game went, for the results screen. */
export function outcomeText(rival: Rival, us: number, them: number): string {
  return us > them
    ? `You beat ${rival.name} ${us}–${them}!`
    : `${rival.name} beat you ${them}–${us}.`;
}

/**
 * Our short name for the scorebug: the first three letters of the player's name, or "YOU" when
 * there is no name (or it would look just like the rival's).
 */
export function ourAbbr(name: string | undefined, rival: Rival): string {
  const letters = (name ?? '').replace(/[^\p{L}]/gu, '').toUpperCase();
  const abbr = letters.slice(0, 3);
  return abbr.length < 2 || abbr === rival.abbr ? 'YOU' : abbr;
}
