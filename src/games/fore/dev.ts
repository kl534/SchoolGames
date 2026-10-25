/**
 * Dev-only hooks for checking every state by eye. They compile away in production builds.
 *
 * - `?hole=N` starts at hole N (1 to 9), with the card filled in as if the earlier holes were par.
 * - `?lie=green|sand|rough|tee|water` starts that hole with the ball in that lie near the pin
 *   (12 yd on the green, 20 yd otherwise). `sand` uses the hole's first bunker when it has one;
 *   `water` stands where a club's carry reaches the first pond, ring aimed at it (the ring turns red).
 * - `?lie=tree` (on a hole with trees) starts on the fairway with the ring aimed so a perfect shot
 *   flies low through the first tree it can (the ball drops in the rough there).
 * - `?strokes=N` presets the strokes already taken on the hole (to check the cap).
 * - `?side=-1|1|0` forces the wobble and duff side (0 or absent is random).
 * - `?quality=perfect|wobbly|duff` forces the next shot's quality, whatever the answer.
 * - `?intro=1` keeps the hole intro (the flyover) even with `hole`, `lie` or `strokes`.
 * - `?introAt=<0..1>` freezes the hole flyover at that progress (and keeps the intro).
 * - `?shadows=off` turns the real shadow map off and brings back the round blobs under the people.
 * - `?holes=ok` plays every hole instantly, so the results can be seen at once.
 * - `?swing=<seconds>` freezes the golfer that many seconds into the swing for the club in play
 *   (clamped to the swing's length), and pauses the game's own swing.
 * - `?club=driver|iron3|iron5|iron7|wedge|sand|putter` forces the club (on the green only `putter`
 *   is valid; anywhere else `putter` is ignored). `?carry=N` also sets its carry in yards, to reach
 *   the half swing of a chip (a wedge or sand wedge at 40 yd or less).
 * - `?cam=face|dtl|front` puts the camera 5 yd from the golfer at chest height (1.2 yd): `face`
 *   across the line looking at his front, `dtl` 5 yd behind the ball looking along the line,
 *   `front` from the target side looking back at him.
 */
import { AIM_MAX, CLUBS, planShot, treeHit, type Lie, type Plan, type Quality } from './shot';
import { centreX, HOLES, surfaceAt, type Hole } from './course';
import { startHole, type HoleState } from './rules';

const params = () => new URLSearchParams(location.search);

export interface DevStart {
  /** 0-based index of the hole to start on. */
  hole: number;
  /** The scores of the holes before it (par). */
  scores: number[];
}

export function devStart(): DevStart {
  if (!import.meta.env.DEV) return { hole: 0, scores: [] };
  const n = Number(params().get('hole'));
  const hole = Number.isInteger(n) && n >= 1 && n <= HOLES.length ? n - 1 : 0;
  return { hole, scores: HOLES.slice(0, hole).map((h) => h.par) };
}

/** A start and an aim from which a perfect shot hits a tree: the farthest-back such start. */
function treeShot(h: Hole): { at: { x: number; z: number }; lie: Lie; aim: number } | null {
  const tree = h.trees[0];
  if (!tree) return null;
  for (let z = Math.max(tree.z - 120, 0); z < tree.z; z += 5) {
    const at = { x: centreX(h, z), z };
    const lie: Lie = z > 0 ? 'fairway' : 'tee';
    for (let a = -AIM_MAX; a <= AIM_MAX; a += 0.5) {
      const plan = planShot(h, at, lie, a);
      const outcome = { quality: 'perfect' as const, end: plan.landing, side: 1 as const };
      if (treeHit(h, plan, outcome)) return { at, lie, aim: a };
    }
  }
  return null;
}

/** The state of the first shot on a hole: the address's lie and strokes, or a fresh tee. */
export function devHoleState(h: Hole): HoleState {
  const state = startHole(h);
  if (!import.meta.env.DEV) return state;
  const q = params();
  const strokes = Number(q.get('strokes'));
  if (Number.isInteger(strokes) && strokes > 0) state.strokes = Math.min(strokes, 6);
  const lie = q.get('lie');
  const short = (d: number) => h.length - d;
  switch (lie) {
    case 'green':
      state.at = { x: 4, z: short(12) };
      state.lie = 'green';
      break;
    case 'sand': {
      const bunker = h.hazards.find((hz) => hz.kind === 'sand');
      state.at = bunker ? { x: bunker.at.x, z: bunker.at.z } : { x: 0, z: short(20) };
      state.lie = 'sand';
      break;
    }
    case 'tree': {
      const found = treeShot(h);
      if (found) {
        state.at = found.at;
        state.lie = found.lie;
      }
      break;
    }
    case 'rough':
      state.at = { x: centreX(h, short(20)) + 25, z: short(20) };
      state.lie = 'rough';
      break;
    case 'water': {
      // Stand where the club's carry lands on the first pond, on the centre line.
      const pond = h.hazards.find((hz) => hz.kind === 'water');
      if (pond) {
        let bestD = Infinity;
        for (let z = Math.max(pond.at.z - 250, 0); z <= pond.at.z - 40; z += 5) {
          const at = { x: centreX(h, z), z };
          const from: Lie = z > 0 ? surfaceAt(h, at.x, at.z) : 'tee';
          for (let a = -AIM_MAX; a <= AIM_MAX; a += 1) {
            const p = planShot(h, at, from, a);
            const d = Math.hypot(p.landing.x - pond.at.x, p.landing.z - pond.at.z);
            if (d < bestD) {
              bestD = d;
              state.at = at;
              state.lie = from;
            }
          }
        }
      }
      break;
    }
    default:
      break;
  }
  return state;
}

/** The aim a dev address wants (ring on the first pond for `lie=water`), or null for the pin. */
export function devAim(h: Hole, state: HoleState): number | null {
  if (import.meta.env.DEV && params().get('lie') === 'tree') return treeShot(h)?.aim ?? null;
  if (!import.meta.env.DEV || params().get('lie') !== 'water') return null;
  const pond = h.hazards.find((hz) => hz.kind === 'water');
  if (!pond) return null;
  let best = 0;
  let bestD = Infinity;
  const lie: Lie = state.lie;
  for (let a = -AIM_MAX; a <= AIM_MAX; a += 0.5) {
    const p = planShot(h, state.at, lie, a);
    const d = Math.hypot(p.landing.x - pond.at.x, p.landing.z - pond.at.z);
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}

/** The wobble and duff side the address forces, or 0 for a random one. */
export function devSide(): -1 | 0 | 1 {
  if (!import.meta.env.DEV) return 0;
  const side = params().get('side');
  return side === '1' ? 1 : side === '-1' ? -1 : 0;
}

/** The quality every shot gets, if the address forces one. */
export function devQuality(): Quality | null {
  if (!import.meta.env.DEV) return null;
  const quality = params().get('quality');
  return quality === 'perfect' || quality === 'wobbly' || quality === 'duff' ? quality : null;
}

/** A dev address that picks a hole, lie or strokes goes straight to the aim, with no intro. */
export function devSkipIntro(): boolean {
  if (!import.meta.env.DEV) return false;
  const q = params();
  return (
    (q.has('hole') || q.has('lie') || q.has('strokes')) && !q.has('intro') && !q.has('introAt')
  );
}

/** Whether to play every hole at once and go straight to the results. */
export function devHolesOk(): boolean {
  return import.meta.env.DEV && params().get('holes') === 'ok';
}

/** Seconds into the swing to freeze the golfer at, or null. */
export function devSwing(): number | null {
  if (!import.meta.env.DEV) return null;
  const raw = params().get('swing');
  if (raw === null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** A forced club on the plan, or the plan itself (the putter is only valid on the green). */
export function devClubPlan(plan: Plan, lie: Lie): Plan {
  if (!import.meta.env.DEV) return plan;
  const q = params();
  const club = CLUBS.find((c) => c.id === q.get('club'));
  if (!club || (club.id === 'putter') !== (lie === 'green')) return plan;
  const carry = Number(q.get('carry'));
  const yards = club.id === 'putter' ? plan.carry : carry > 0 ? carry : club.carry;
  return {
    ...plan,
    club: { ...club, carry: yards },
    carry: yards,
    landing: {
      x: plan.from.x + yards * Math.sin(plan.dir),
      z: plan.from.z + yards * Math.cos(plan.dir),
    },
  };
}

export type DevCam = 'face' | 'dtl' | 'front';

export function devCam(): DevCam | null {
  if (!import.meta.env.DEV) return null;
  const cam = params().get('cam');
  return cam === 'face' || cam === 'dtl' || cam === 'front' ? cam : null;
}

/** Progress (0 to 1) to freeze the hole flyover at, or null. */
export function devIntroAt(): number | null {
  if (!import.meta.env.DEV) return null;
  const raw = params().get('introAt');
  if (raw === null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), 1) : null;
}

/** False when the real shadow map is switched off. */
export function devShadows(): boolean {
  return !(import.meta.env.DEV && params().get('shadows') === 'off');
}
