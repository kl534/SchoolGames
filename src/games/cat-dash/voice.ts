import { PLACES } from './places';
import { GREAT_RUNNING_SPEECH, NEW_HIGH_SCORE_SPEECH, OUT_OF_LIVES_SPEECH } from './rules';

/** Every line this game speaks besides the shared fact lines (`npm run voice`). */
export const VOICE_LINES: string[] = [
  OUT_OF_LIVES_SPEECH,
  NEW_HIGH_SCORE_SPEECH,
  GREAT_RUNNING_SPEECH,
  ...PLACES.map((p) => p.speech),
];
