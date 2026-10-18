import { GAGS, ROUND_SECONDS, type Gag } from './rules';

const params = () => new URLSearchParams(location.search);

const isGag = (value: string | null | undefined): value is Gag => GAGS.includes(value as Gag);

/** The gag the address asks for (`?gag=forehead` ...) in a dev build: every wrong answer plays it. */
export function forcedGag(): Gag | null {
  if (!import.meta.env.DEV) return null;
  const value = params().get('gag');
  return isGag(value) ? value : null;
}

/** Round length from `?time=<seconds>` in a dev build (1-600), otherwise ROUND_SECONDS. */
export function devRoundSeconds(): number {
  if (!import.meta.env.DEV) return ROUND_SECONDS;
  const value = Number(params().get('time'));
  return Number.isFinite(value) && value >= 1 && value <= 600 ? value : ROUND_SECONDS;
}

/** `?frame=<gag>:<seconds>` in a dev build: show that one frame of that gag, with the HUD hidden, no preview, no round. */
export function devFrame(): { gag: Gag; t: number } | null {
  if (!import.meta.env.DEV) return null;
  const [name, seconds] = (params().get('frame') ?? '').split(':');
  if (!isGag(name)) return null;
  const t = Number(seconds);
  return { gag: name, t: Number.isFinite(t) ? Math.max(t, 0) : 0 };
}
