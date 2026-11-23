import { TYPING_VOICE_LINES } from '../../shared/typing/lines';

/**
 * Every line this game speaks (`npm run voice`): only the lesson's finger explanations. The
 * countdown, the places and the results are text and sound effects, never spoken.
 */
export const VOICE_LINES: string[] = [...TYPING_VOICE_LINES];
