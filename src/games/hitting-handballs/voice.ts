/** Every line the game speaks that is not a fact, for `npm run voice`. No DOM, no three.js. */
import {
  allScoreCalls,
  CHAMPION_SPEECH,
  COOKING_SPEECH,
  MATCH_POINT_SPEECH,
  PAIRS,
  PLAY_BALL_SPEECH,
  SO_CLOSE_SPEECH,
  WE_WIN_SPEECH,
} from './rules';

export const VOICE_LINES: string[] = [
  PLAY_BALL_SPEECH,
  MATCH_POINT_SPEECH,
  WE_WIN_SPEECH,
  SO_CLOSE_SPEECH,
  CHAMPION_SPEECH,
  COOKING_SPEECH,
  ...allScoreCalls(),
  ...PAIRS.map((pair) => pair.intro),
];
