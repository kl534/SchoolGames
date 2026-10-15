/** The rival teams and the lines about them, kept free of three.js and the DOM. */

export type TeamLevel = 'AAA' | 'AA' | 'A';

export interface Team {
  id: string;
  city: string;
  nickname: string;
  /** Three letters, for the scorebug and the big board. */
  abbr: string;
  /** Triple-A, Double-A or Single-A ball. */
  level: TeamLevel;
  /** The jersey colour (0xRRGGBB); the cap is a darker shade of it. */
  jersey: number;
}

/** Real Minor League teams with kid-friendly names. */
export const TEAMS: readonly Team[] = [
  {
    id: 'toledo-mud-hens',
    city: 'Toledo',
    nickname: 'Mud Hens',
    abbr: 'TOL',
    level: 'AAA',
    jersey: 0xe5702a,
  },
  {
    id: 'durham-bulls',
    city: 'Durham',
    nickname: 'Bulls',
    abbr: 'DUR',
    level: 'AAA',
    jersey: 0x2a6fd1,
  },
  {
    id: 'albuquerque-isotopes',
    city: 'Albuquerque',
    nickname: 'Isotopes',
    abbr: 'ABQ',
    level: 'AAA',
    jersey: 0x1f9d63,
  },
  {
    id: 'las-vegas-aviators',
    city: 'Las Vegas',
    nickname: 'Aviators',
    abbr: 'LVA',
    level: 'AAA',
    jersey: 0x2f3b52,
  },
  {
    id: 'sacramento-river-cats',
    city: 'Sacramento',
    nickname: 'River Cats',
    abbr: 'SAC',
    level: 'AAA',
    jersey: 0xf0a020,
  },
  {
    id: 'el-paso-chihuahuas',
    city: 'El Paso',
    nickname: 'Chihuahuas',
    abbr: 'ELP',
    level: 'AAA',
    jersey: 0x1fa8c9,
  },
  {
    id: 'lehigh-valley-ironpigs',
    city: 'Lehigh Valley',
    nickname: 'IronPigs',
    abbr: 'LHV',
    level: 'AAA',
    jersey: 0xe8467c,
  },
  { id: 'iowa-cubs', city: 'Iowa', nickname: 'Cubs', abbr: 'IOW', level: 'AAA', jersey: 0x3a6fd8 },
  {
    id: 'montgomery-biscuits',
    city: 'Montgomery',
    nickname: 'Biscuits',
    abbr: 'MON',
    level: 'AA',
    jersey: 0xd9a23a,
  },
  {
    id: 'rocket-city-trash-pandas',
    city: 'Rocket City',
    nickname: 'Trash Pandas',
    abbr: 'RCT',
    level: 'AA',
    jersey: 0x7a8794,
  },
  {
    id: 'hartford-yard-goats',
    city: 'Hartford',
    nickname: 'Yard Goats',
    abbr: 'HFD',
    level: 'AA',
    jersey: 0x2f9e44,
  },
  {
    id: 'akron-rubberducks',
    city: 'Akron',
    nickname: 'RubberDucks',
    abbr: 'AKR',
    level: 'AA',
    jersey: 0xf2c814,
  },
  {
    id: 'richmond-flying-squirrels',
    city: 'Richmond',
    nickname: 'Flying Squirrels',
    abbr: 'RCH',
    level: 'AA',
    jersey: 0xd1542f,
  },
  {
    id: 'amarillo-sod-poodles',
    city: 'Amarillo',
    nickname: 'Sod Poodles',
    abbr: 'AMA',
    level: 'AA',
    jersey: 0xc23a3a,
  },
  {
    id: 'fort-wayne-tincaps',
    city: 'Fort Wayne',
    nickname: 'TinCaps',
    abbr: 'FTW',
    level: 'A',
    jersey: 0x9b5de5,
  },
  {
    id: 'lansing-lugnuts',
    city: 'Lansing',
    nickname: 'Lugnuts',
    abbr: 'LAN',
    level: 'A',
    jersey: 0x1c8a8a,
  },
  {
    id: 'modesto-nuts',
    city: 'Modesto',
    nickname: 'Nuts',
    abbr: 'MOD',
    level: 'A',
    jersey: 0x8a5a2f,
  },
  {
    id: 'hickory-crawdads',
    city: 'Hickory',
    nickname: 'Crawdads',
    abbr: 'HIC',
    level: 'A',
    jersey: 0xd63a3a,
  },
];

/** A random rival; `random` is a number from 0 up to (not including) 1. */
export function pickRival(random: number): Team {
  const index = Math.floor(random * TEAMS.length);
  return TEAMS[Math.min(Math.max(index, 0), TEAMS.length - 1)];
}

/** A darker shade of a colour, for a team's caps. `amount` 0 is black, 1 is unchanged. */
export function darken(colour: number, amount: number): number {
  const shade = (shift: number) => Math.round(((colour >> shift) & 0xff) * amount);
  return (shade(16) << 16) | (shade(8) << 8) | shade(0);
}

/** The shirt and cap colours a team wears. */
export interface Colours {
  shirt: number;
  cap: number;
}

/** What our own team wears, in the field and at bat. */
export const OUR_COLOURS: Colours = { shirt: 0xf3f4f8, cap: 0x1c2f6b };

export function coloursOf(team: Team): Colours {
  return { shirt: team.jersey, cap: darken(team.jersey, 0.6) };
}

/** "Toledo Mud Hens". */
export function teamName(team: Team): string {
  return `${team.city} ${team.nickname}`;
}

/**
 * Our team's short name for the scorebug: the first three letters of the player's name, or "YOU"
 * when there is no name (or it would look just like the rival's).
 */
export function ourAbbr(name: string | undefined, rival: Team): string {
  const letters = (name ?? '').replace(/[^\p{L}]/gu, '').toUpperCase();
  const abbr = letters.slice(0, 3);
  return abbr.length < 2 || abbr === rival.abbr ? 'YOU' : abbr;
}

/** The announcer's lines that name the rival. All are recorded ahead of time. */
export function matchupSpeech(team: Team): string {
  return `Today you play the ${teamName(team)}!`;
}

export function loseSpeech(team: Team): string {
  return `The ${team.nickname} win!`;
}

export function walkOffSpeech(team: Team): string {
  return `Walk-off! The ${team.nickname} win!`;
}

/** The word for a rival hit in a banner, e.g. "Mud Hens single!". */
export function rivalHitTitle(team: Team, hit: string): string {
  return `${team.nickname} ${hit}!`;
}

/** "You 4 – Mud Hens 2", for the banner at the end of a half-inning. */
export function scoreLine(team: Team, us: number, them: number): string {
  return `You ${us} – ${team.nickname} ${them}`;
}

/** How the game went, for the results screen. */
export function outcomeText(team: Team, us: number, them: number): string {
  return us > them
    ? `You beat the ${teamName(team)} ${us}–${them}!`
    : `The ${teamName(team)} beat you ${them}–${us}.`;
}
