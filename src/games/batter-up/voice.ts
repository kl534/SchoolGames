import {
  BASES_FOR,
  cpuHitSpeech,
  EXTRA_INNINGS,
  finalSpeech,
  GROUND_OUT_SPEECH,
  halfEndSpeech,
  hitSpeech,
  inningSpeech,
  leadSpeech,
  MAX_SPOKEN_INNING,
  MAX_SPOKEN_RUNS,
  pitchStrikeCall,
  PLAY_BALL,
  POP_OUT_SPEECH,
  strikeCall,
  YOU_WIN,
  type Half,
  type Hit,
} from './rules';
import { loseSpeech, matchupSpeech, TEAMS, walkOffSpeech } from './teams';

const hits = Object.keys(BASES_FOR) as Hit[];
const halves: Half[] = ['top', 'bottom'];
/** Counts from none up to one more than the most, which stands for every bigger one. */
const upToMost = Array.from({ length: MAX_SPOKEN_RUNS + 2 }, (_, n) => n);

/** Every line this game speaks besides the shared fact and score lines (`npm run voice`). */
export const VOICE_LINES: string[] = [
  PLAY_BALL,
  EXTRA_INNINGS,
  YOU_WIN,
  POP_OUT_SPEECH,
  GROUND_OUT_SPEECH,
  ...[1, 2, 3].flatMap((n) => [true, false].map((called) => strikeCall(n, called).spoken)),
  ...[1, 2, 3].map((n) => pitchStrikeCall(n).spoken),
  ...hits.flatMap((hit) => [hitSpeech(hit), cpuHitSpeech(hit)]),
  // One past the last spoken inning stands for every later one ("Extra innings. ...").
  ...Array.from({ length: MAX_SPOKEN_INNING + 1 }, (_, i) => i + 1).flatMap((inning) =>
    halves.map((half) => inningSpeech(inning, half)),
  ),
  ...(['outs', 'mercy'] as const).map(halfEndSpeech),
  // Who leads, from them by one past the most to us by one past the most.
  ...upToMost.flatMap((n) => [leadSpeech(n), leadSpeech(-n)]),
  ...upToMost.map(finalSpeech),
  ...TEAMS.flatMap((team) => [matchupSpeech(team), loseSpeech(team), walkOffSpeech(team)]),
];
