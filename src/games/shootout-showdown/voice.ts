/** Every line the game speaks that is not a fact, for `npm run voice`. No DOM, no three.js. */
import {
  COIN_TOSS_SPEECH,
  FIRST_US_SPEECH,
  SHOOTERS,
  SHOOTOUT_SPEECH,
  SHOT_CALL,
  SUDDEN_DEATH_SPEECH,
  YOU_WIN_SPEECH,
  firstThemSpeech,
  shooterSpeech,
} from './rules';
import { RIVALS, US, rivalWinsSpeech, theirGoalSpeech } from '../../shared/hockey/teams';

export const VOICE_LINES: string[] = [
  SHOOTOUT_SPEECH,
  COIN_TOSS_SPEECH,
  FIRST_US_SPEECH,
  ...RIVALS.map(firstThemSpeech),
  SUDDEN_DEATH_SPEECH,
  ...[US, ...RIVALS].flatMap((team) => SHOOTERS.map((role) => shooterSpeech(team, role))),
  ...Object.values(SHOT_CALL),
  // Their goals have no fixed call: the rival's name and "score".
  ...RIVALS.map(theirGoalSpeech),
  YOU_WIN_SPEECH,
  ...RIVALS.map(rivalWinsSpeech),
];
