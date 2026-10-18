/** Every line the game speaks that is not a fact, for `npm run voice`. No DOM, no three.js. */
import {
  AND_ONE_SPEECH,
  FREE_THROW_MADE_SPEECH,
  FREE_THROW_MISSED_SPEECH,
  HALFTIME_SPEECH,
  MISS_SPEECH,
  OFFENSIVE_REBOUND_SPEECH,
  ON_FIRE_SPEECH,
  OVERTIME_SPEECH,
  SHOT_POINTS,
  SHOT_SPEECH,
  STOP_SPEECH,
  THEIR_BALL_SPEECH,
  theirScoreSpeech,
  VIOLATION_SPEECH,
  YOU_WIN_SPEECH,
} from './rules';
import { RIVALS, rivalWinsSpeech } from './rivals';

export const VOICE_LINES: string[] = [
  ...Object.values(SHOT_SPEECH),
  AND_ONE_SPEECH,
  FREE_THROW_MADE_SPEECH,
  FREE_THROW_MISSED_SPEECH,
  MISS_SPEECH,
  OFFENSIVE_REBOUND_SPEECH,
  THEIR_BALL_SPEECH,
  VIOLATION_SPEECH,
  ON_FIRE_SPEECH,
  ...Object.values(STOP_SPEECH),
  // Every way the rival can score.
  ...(['three', 'dunk', 'jumper', 'layup'] as const).map((shot) =>
    theirScoreSpeech({ shot, andOne: false, points: SHOT_POINTS[shot] }),
  ),
  theirScoreSpeech({ shot: 'layup', andOne: true, points: 3 }),
  HALFTIME_SPEECH,
  OVERTIME_SPEECH,
  YOU_WIN_SPEECH,
  ...RIVALS.map(rivalWinsSpeech),
];
