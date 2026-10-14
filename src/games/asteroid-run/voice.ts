import { GREAT_FLYING_SPEECH, NEW_HIGH_SCORE_SPEECH, SHIP_DESTROYED_SPEECH } from './rules';

/** Every line this game speaks besides the shared fact lines (`npm run voice`). */
export const VOICE_LINES: string[] = [
  SHIP_DESTROYED_SPEECH,
  NEW_HIGH_SCORE_SPEECH,
  GREAT_FLYING_SPEECH,
];
