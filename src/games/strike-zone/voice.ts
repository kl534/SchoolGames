/** Every line the game speaks that is not a fact, for `npm run voice`. No DOM, no three.js. */
import { allCallLines, GAME_OVER_SPEECH, LAST_FRAME_SPEECH, NEW_HIGH_SCORE_SPEECH } from './rules';

export const VOICE_LINES: string[] = [
  ...allCallLines(),
  LAST_FRAME_SPEECH,
  GAME_OVER_SPEECH,
  NEW_HIGH_SCORE_SPEECH,
];
