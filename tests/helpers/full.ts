/** True in CI, in `npm run test:all` and in `npm run check`: run every random sweep in full. */
export const FULL = Boolean(process.env.CI || process.env.FULL_TESTS);

/** Iterations for a random sweep: `full` in CI and checks, `quick` in a plain local `npm test`. */
export const runs = (full: number, quick: number): number => (FULL ? full : quick);
