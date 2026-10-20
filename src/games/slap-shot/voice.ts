/** Every line the game speaks that is not a fact, for `npm run voice`. No DOM, no three.js. */
import {
  DROP_THE_PUCK,
  END_OF_PERIOD,
  OVERTIME_SPEECH,
  PLAY_CALL,
  SHOOTOUT_SPEECH,
  YOU_WIN_SPEECH,
} from './rules';
import { RIVALS, rivalWinsSpeech, theirGoalSpeech } from './teams';

export const VOICE_LINES: string[] = [
  ...Object.values(PLAY_CALL),
  // Their goals have no fixed call: the rival's name and "score".
  ...RIVALS.map(theirGoalSpeech),
  DROP_THE_PUCK,
  ...END_OF_PERIOD,
  OVERTIME_SPEECH,
  SHOOTOUT_SPEECH,
  YOU_WIN_SPEECH,
  ...RIVALS.map(rivalWinsSpeech),
];
