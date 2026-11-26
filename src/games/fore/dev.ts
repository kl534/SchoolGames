/**
 * Dev-only hooks for checking every state by eye. They compile away in production builds.
 *
 * - `?hole=N` starts at hole N (1 to 9), with the card filled in as if the earlier holes were par.
 * - `?lie=green|sand|rough|tee|water` starts that hole with the ball in that lie near the pin
 *   (12 yd on the green, 20 yd otherwise). `sand` uses the hole's first bunker when it has one;
 *   `water` stands 100 yd short of the first pond with the ring on its centre (the ring turns red).
 * - `?lie=tree` (on a hole with trees) starts on the fairway with the ring placed so a perfect shot
 *   flies low through the first tree it can (the ball drops in the rough there).
 * - `?target=<yd>,<deg>` puts the first shot's ring that far out and that many degrees from the
 *   line to the pin (+ is right on screen); it is clamped to the limits.
 * - `?strokes=N` presets the strokes already taken on the hole (to check the cap).
 * - `?scatter=<deg>` is the direction a miss or a slow right answer lands off the ring (0 straight
 *   on, 90 to the right on screen); absent is random.
 * - `?quality=perfect|close|miss` forces the next shot's quality, whatever the answer (`close` is
 *   a right answer at 60 % of the clock).
 * - `?bigmap=1` opens the big map once the aim view is up.
 * - `?place=1` holds the higher "place" camera view (as if a finger were down on the picture).
 * - `?intro=1` keeps the hole intro (the flyover) even with `hole`, `lie` or `strokes`.
 * - `?introAt=<0..1>` freezes the hole flyover at that progress (and keeps the intro).
 * - `?gfx=low|medium|high` forces the picture quality tier (and stops it adapting or being saved).
 *   Headless browsers run on a software renderer, so every shot passes it.
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
import {
  clampTarget,
  CLUBS,
  planShot,
  reachFor,
  ringRadius,
  treeHit,
  type Lie,
  type Plan,
  type Quality,
  type XZ,
} from './shot';
import { centreX, HOLES, surfaceAt, type Hole } from './course';
import { startHole, type HoleState } from './rules';
import type { Gfx } from './quality';

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

const RAD = Math.PI / 180;

/** A start and a ring spot from which a perfect shot hits a tree: the farthest-back such start. */
function treeShot(h: Hole): { at: XZ; lie: Lie; want: XZ } | null {
  const tree = h.trees[0];
  if (!tree) return null;
  for (let z = Math.max(tree.z - 120, 0); z < tree.z; z += 5) {
    const at = { x: centreX(h, z), z };
    const lie: Lie = z > 0 ? 'fairway' : 'tee';
    const base = Math.atan2(h.pin.x - at.x, h.pin.z - at.z);
    for (let dist = 60; dist <= reachFor(lie); dist += 10) {
      for (let a = -35; a <= 35; a += 0.5) {
        const want = {
          x: at.x + dist * Math.sin(base - a * RAD),
          z: at.z + dist * Math.cos(base - a * RAD),
        };
        const plan = planShot(h, at, lie, want);
        if (treeHit(h, plan, { quality: 'perfect', land: plan.landing })) return { at, lie, want };
      }
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
      // Stand 100 yd short of the first pond, on the centre line.
      const pond = h.hazards.find((hz) => hz.kind === 'water');
      if (pond) {
        const z = Math.max(pond.at.z - 100, 0);
        state.at = { x: centreX(h, z), z };
        state.lie = z > 0 ? surfaceAt(h, state.at.x, state.at.z) : 'tee';
      }
      break;
    }
    default:
      break;
  }
  return state;
}

/**
 * The ring spot a dev address wants for the first shot, or null for the smart suggestion:
 * `?target=<yd>,<deg>`, the first pond's centre for `lie=water`, a low flight through a tree for
 * `lie=tree`.
 */
export function devTarget(h: Hole, state: HoleState): XZ | null {
  if (!import.meta.env.DEV) return null;
  const q = params();
  const raw = q.get('target');
  if (raw) {
    const [yd, deg] = raw.split(',').map(Number);
    if (Number.isFinite(yd)) {
      const base = Math.atan2(h.pin.x - state.at.x, h.pin.z - state.at.z);
      // Screen-right is -x, so a positive angle turns towards -x.
      const dir = base - (Number.isFinite(deg) ? deg : 0) * RAD;
      const want = { x: state.at.x + yd * Math.sin(dir), z: state.at.z + yd * Math.cos(dir) };
      return clampTarget(h, state.at, state.lie, want);
    }
  }
  const lie = q.get('lie');
  if (lie === 'tree') return treeShot(h)?.want ?? null;
  if (lie !== 'water') return null;
  const pond = h.hazards.find((hz) => hz.kind === 'water');
  return pond ? clampTarget(h, state.at, state.lie, { x: pond.at.x, z: pond.at.z }) : null;
}

/** The direction (radians; 0 straight on, pi/2 right on screen) a miss lands in, or null for random. */
export function devScatter(): number | null {
  if (!import.meta.env.DEV) return null;
  const raw = params().get('scatter');
  if (raw === null || raw === '') return null;
  const deg = Number(raw);
  return Number.isFinite(deg) ? deg * RAD : null;
}

/** The quality every shot gets, if the address forces one. */
export function devQuality(): Quality | null {
  if (!import.meta.env.DEV) return null;
  const quality = params().get('quality');
  return quality === 'perfect' || quality === 'close' || quality === 'miss' ? quality : null;
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
    ringR: ringRadius(yards, club.id === 'putter'),
  };
}

/** Whether to open the big map once the aim view is up. */
export function devBigMap(): boolean {
  return import.meta.env.DEV && params().get('bigmap') === '1';
}

/** Whether to hold the higher "place" camera view. */
export function devPlace(): boolean {
  return import.meta.env.DEV && params().get('place') === '1';
}

export type DevCam = 'face' | 'dtl' | 'front' | 'crowd';

export function devCam(): DevCam | null {
  if (!import.meta.env.DEV) return null;
  const cam = params().get('cam');
  return cam === 'face' || cam === 'dtl' || cam === 'front' || cam === 'crowd' ? cam : null;
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

/** The picture quality tier forced by the address, or null to pick one for the device. */
export function devGfx(): Gfx | null {
  if (!import.meta.env.DEV) return null;
  const gfx = params().get('gfx');
  return gfx === 'low' || gfx === 'medium' || gfx === 'high' ? gfx : null;
}

/** Whether the gallery claps for ever (to check the clapping pose). */
export function devClap(): boolean {
  return import.meta.env.DEV && params().get('clap') === '1';
}
