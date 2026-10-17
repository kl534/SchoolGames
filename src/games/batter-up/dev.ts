/**
 * Dev-only hook for checking every kind of play by eye: with `?play=<HitKind|OutKind>` in the
 * address, every ball in play is forced to that kind. It compiles away in production builds.
 */
import { HIT_KINDS, type Bases, type Half, type HitKind, type OutKind } from './rules';

const HIT_NAMES = Object.values(HIT_KINDS).flatMap((kinds) => kinds.map((k) => k.kind));
const OUT_NAMES: OutKind[] = [
  'pop',
  'foul-pop',
  'fly',
  'liner',
  'diving',
  'ground',
  'double-play',
  'force-second',
];

/** The kind of play the address asks for, if this is a dev build and it names one. */
export function forcedPlay(): { hit?: HitKind; out?: OutKind } {
  if (!import.meta.env.DEV) return {};
  const asked = new URLSearchParams(location.search).get('play');
  if (!asked) return {};
  if ((HIT_NAMES as string[]).includes(asked)) return { hit: asked as HitKind };
  if ((OUT_NAMES as string[]).includes(asked)) return { out: asked as OutKind };
  return {};
}

/**
 * Dev only: `?start=bottom&bases=101&outs=1` begins the game in that half with runners on the
 * bases (first, second, third as three digits) and that many outs, to check a play in context.
 */
export function devStart(): { half?: Half; bases?: Bases; outs?: number } {
  if (!import.meta.env.DEV) return {};
  const q = new URLSearchParams(location.search);
  const out: { half?: Half; bases?: Bases; outs?: number } = {};
  const half = q.get('start');
  if (half === 'top' || half === 'bottom') out.half = half;
  const bases = q.get('bases');
  if (bases && /^[01]{3}$/.test(bases)) {
    out.bases = [bases[0] === '1', bases[1] === '1', bases[2] === '1'];
  }
  const outs = Number(q.get('outs'));
  if (outs === 1 || outs === 2) out.outs = outs;
  return out;
}
