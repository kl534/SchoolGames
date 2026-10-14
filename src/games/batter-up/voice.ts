import {
  BASES_FOR,
  endSpeech,
  finalSpeech,
  hitSpeech,
  MAX_BATTERS,
  PLAY_BALL,
  strikeCall,
  type Hit,
} from './rules';

/** Every line this game speaks besides the shared fact and score lines (`npm run voice`). */
export const VOICE_LINES: string[] = [
  PLAY_BALL,
  ...[1, 2, 3].flatMap((n) => [true, false].map((called) => strikeCall(n, called).spoken)),
  ...(Object.keys(BASES_FOR) as Hit[]).map(hitSpeech),
  ...Array.from({ length: MAX_BATTERS + 1 }, (_, runs) => runs).flatMap((runs) => [
    endSpeech(true, runs),
    endSpeech(false, runs),
    finalSpeech(runs),
  ]),
];
