import {
  BOSS_DOWN_SPEECH,
  BOSS_SPEECH,
  GAME_OVER_SPEECH,
  GREAT_BLASTING_SPEECH,
  NEW_HIGH_SCORE_SPEECH,
  NEXT_WAVE_SPEECH,
} from './rules';

/** Every line this game speaks besides the shared fact and score lines (`npm run voice`). */
export const VOICE_LINES: string[] = [
  GAME_OVER_SPEECH,
  BOSS_SPEECH,
  BOSS_DOWN_SPEECH,
  NEXT_WAVE_SPEECH,
  NEW_HIGH_SCORE_SPEECH,
  GREAT_BLASTING_SPEECH,
];
