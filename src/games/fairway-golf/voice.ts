/** Every line the game speaks that is not a fact, for `npm run voice`. No DOM, no three.js. */
import { allCallLines } from './rules';

export const VOICE_LINES: string[] = [...allCallLines()];
