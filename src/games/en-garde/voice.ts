/** Every line the game speaks that is not a fact, for `npm run voice`. No DOM, no three.js. */
import {
  CHAMPION_SPEECH,
  EN_GARDE_SPEECH,
  POKE_CALLS,
  RIVALS,
  SO_CLOSE_SPEECH,
  VICTORY_SPEECH,
} from './rules';

export const VOICE_LINES: string[] = [
  EN_GARDE_SPEECH,
  ...POKE_CALLS,
  VICTORY_SPEECH,
  SO_CLOSE_SPEECH,
  CHAMPION_SPEECH,
  ...RIVALS.flatMap((rival) => [rival.intro, ...rival.taunts]),
];
