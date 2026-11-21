import { TYPING_VOICE_LINES } from '../../shared/typing/lines';

/**
 * Every line this game speaks (`npm run voice`): only the lesson's finger explanations. Fights,
 * level-ups, the test-out and the results are silent.
 */
export const VOICE_LINES: string[] = [...TYPING_VOICE_LINES];
