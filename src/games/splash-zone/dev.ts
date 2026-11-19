/**
 * Dev-only hooks of Splash Zone: the jet-ski ride's own (`tricks streak skis lab at world mega`,
 * see `src/shared/jetski/dev.ts`). They compile away in production builds.
 */
import { parseRideDev, type RideDev } from '../../shared/jetski/dev';

/** The dev hooks of this page, or null in a production build. */
export function devOptions(): RideDev | null {
  return import.meta.env.DEV ? parseRideDev(location.search) : null;
}
