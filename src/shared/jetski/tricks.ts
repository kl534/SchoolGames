/**
 * The ten tricks and their ten wipeouts as authored animations, plus the lifeguard boat's respawn.
 * Pure data and maths, no three.js and no DOM: `trickFrame(id, outcome, t, out)` says where the
 * ski, the rider and the dolphins are at a time; `trickEvents` lists the effects and sounds to
 * fire along the way and `trickRate` the slow motion.
 *
 * Coordinates are launcher-local: `d` metres forward of the launcher's entry line (world
 * `z = entryZ - d`), `y` up from the water's rest surface, `s` sideways (+ is the rider's right,
 * world x). Angles: `pitch` + noses up, `roll` + dips the right side, `yaw` + turns left.
 */
import {
  LAUNCHERS,
  SEAT,
  TAU,
  clamp01,
  createFrame,
  lerp,
  prog,
  resetFrame,
  seatOf,
  sitOnSki,
  type Def,
  type EventType,
  type Frame,
  type LauncherGeometry,
  type Pos,
  type TrickEvent,
} from './anim';
import type { Framing } from './layout';
import { TRICK_IDS, TRICK_TIER, type LauncherKind, type Outcome, type TrickId } from './rules';
import { BACKFLIP, BARREL_ROLL, HELICOPTER, SUGAR_SPIN, TAIL_WHIP } from './tricks-t2';
import { CORKSCREW, COTTON_CANDY_CLOUD, DOUBLE_BACKFLIP, EGG_HATCH, SUBMARINE } from './tricks-t3';
import { SPRAY_SPIN, SUPERMAN, TAIL_STAND, WAVE_HOP, type TrickDefs } from './tricks-t1';

export {
  LAUNCHERS,
  SEAT,
  TAU,
  createFrame,
  resetFrame,
  type EventType,
  type Frame,
  type LauncherGeometry,
  type Pos,
  type TrickEvent,
};
export { surfaceY } from './anim';

/** Slow motion: the playback rate and the stunt time it covers, with the ramps in and out. */
export const SLOW_RATE = 0.4;
export const SLOW_SPAN = 0.7;
export const SLOW_RAMP = 0.15;

export interface TrickSpec {
  /** d of the end of a trick that lands: it finishes here, riding on the water. */
  length: number;
  /** The lowest y the ski or the rider may reach in either version. */
  floorY: number;
  launcher: LauncherKind;
}

const TABLE: Record<TrickId, TrickDefs> = {
  'wave-hop': WAVE_HOP,
  'spray-spin': SPRAY_SPIN,
  superman: SUPERMAN,
  'tail-stand': TAIL_STAND,
  backflip: BACKFLIP,
  'barrel-roll': BARREL_ROLL,
  helicopter: HELICOPTER,
  'sugar-spin': SUGAR_SPIN,
  'tail-whip': TAIL_WHIP,
  'double-backflip': DOUBLE_BACKFLIP,
  submarine: SUBMARINE,
  corkscrew: CORKSCREW,
  'cotton-candy-cloud': COTTON_CANDY_CLOUD,
  'egg-hatch': EGG_HATCH,
};

const FLOOR_Y: Record<TrickId, number> = {
  'wave-hop': -1,
  'spray-spin': -0.6,
  superman: -0.6,
  'tail-stand': -1,
  backflip: -1,
  'barrel-roll': -1,
  helicopter: -1,
  'sugar-spin': -1,
  'tail-whip': -1,
  'double-backflip': -1.4,
  submarine: -2.2,
  corkscrew: -2.2,
  'cotton-candy-cloud': -2.2,
  'egg-hatch': -2.2,
};

export const TRICK_SPECS = Object.fromEntries(
  TRICK_IDS.map((id): [TrickId, TrickSpec] => [
    id,
    {
      length: TABLE[id].clear.length ?? 0,
      floorY: FLOOR_Y[id],
      launcher: launcherOf(id),
    },
  ]),
) as Record<TrickId, TrickSpec>;

function launcherOf(id: TrickId): LauncherKind {
  const tier = TRICK_TIER[id];
  return tier === 1 ? 'wave' : tier === 2 ? 'kicker' : 'mega-ramp';
}

const def = (id: TrickId, outcome: Outcome): Def => TABLE[id][outcome];

export function trickDuration(id: TrickId, outcome: Outcome): number {
  return def(id, outcome).duration;
}

/** The comic word shown on screen: the trick's name in capitals for a clear, its fail word otherwise. */
export function trickWord(id: TrickId, outcome: Outcome): string {
  return def(id, outcome).word;
}

const eventCache = new Map<Def, TrickEvent[]>();
const probeFrame = createFrame();

/** The effects and sounds to fire during a trick, sorted by time and clamped to its duration. */
export function trickEvents(id: TrickId, outcome: Outcome): TrickEvent[] {
  const d = def(id, outcome);
  let events = eventCache.get(d);
  if (!events) {
    const sample = (t: number, rider: boolean): Pos => {
      trickFrame(id, outcome, t, probeFrame);
      const r = probeFrame.rider;
      const k = probeFrame.ski;
      return rider && r.mode === 'free' ? { d: r.d, y: r.y, s: r.s } : { d: k.d, y: k.y, s: k.s };
    };
    const list = d.events(
      (t) => sample(t, false),
      (t) => sample(t, true),
    );
    events = list
      .map(([at, type, ed, y, s]) => ({
        at: Math.min(Math.max(at, 0), d.duration),
        type,
        d: ed,
        y,
        s: s ?? 0,
      }))
      .sort((a, b) => a.at - b.at);
    eventCache.set(d, events);
  }
  return events;
}

/**
 * The ski, the rider and the dolphins at time `t` of a trick (clamped to its duration), into `out`
 * when given. A seated rider is always at the ski's seat. A clear ends exactly at the trick's
 * `length`, level on the water, rider seated.
 */
export function trickFrame(
  id: TrickId,
  outcome: Outcome,
  t: number,
  out: Frame = createFrame(),
): Frame {
  const d = def(id, outcome);
  const time = Math.min(Math.max(Number.isFinite(t) ? t : 0, 0), d.duration);
  resetFrame(out);
  d.at(time, out);
  if (out.rider.mode === 'seated') sitOnSki(out);
  return out;
}

/**
 * What the stunt camera follows: the ski, or the middle of the ski and a rider who has left it
 * (so the two stay in the picture together), into `out`.
 */
export function focusOf(f: Frame, out: Pos = { d: 0, y: 0, s: 0 }): Pos {
  const k = f.ski;
  const r = f.rider;
  if (r.mode === 'free' && r.visible && k.visible) {
    out.d = (k.d + r.d) / 2;
    out.s = (k.s + r.s) / 2;
    out.y = Math.max((k.y + r.y) / 2, 0);
  } else if (r.mode === 'free' && r.visible) {
    out.d = r.d;
    out.s = r.s;
    out.y = Math.max(r.y, 0);
  } else {
    out.d = k.d;
    out.s = k.s;
    out.y = Math.max(k.y, 0);
  }
  return out;
}

const framingCache = new Map<Def, Framing>();

/**
 * How high and how low a trick takes the ski and the rider (u above the water, with room for the
 * rider's head and the ski's underside): what the stunt camera has to fit in the frame.
 */
export function trickFraming(id: TrickId, outcome: Outcome): Framing {
  const d = def(id, outcome);
  let framing = framingCache.get(d);
  if (!framing) {
    let peak = 1.5;
    let low = 0;
    let span = 0;
    const f = createFrame();
    for (let t = 0; t <= d.duration + 1e-9; t += 1 / 30) {
      trickFrame(id, outcome, t, f);
      if (f.ski.visible) {
        peak = Math.max(peak, f.ski.y + 1.0);
        low = Math.min(low, f.ski.y - 0.3);
      }
      if (f.rider.visible) {
        peak = Math.max(peak, f.rider.y + 1.15);
        low = Math.min(low, f.rider.y - 0.3);
      }
      const focus = focusOf(f);
      // A rider flung towards the camera is seen from higher up, so he sits lower in the picture.
      if (f.rider.mode === 'free' && f.rider.visible) {
        low = Math.min(low, f.rider.y - 0.3 - 0.14 * Math.max(f.rider.s - focus.s, 0));
      }
      if (f.ski.visible) span = Math.max(span, 2 * Math.abs(f.ski.d - focus.d) + 2.6);
      if (f.rider.mode === 'free' && f.rider.visible) {
        // A rider flung towards the camera looms larger, so sideways counts too.
        span = Math.max(
          span,
          2 * Math.abs(f.rider.d - focus.d) + 1.6 + 1.6 * Math.abs(f.rider.s - focus.s),
        );
      }
    }
    framing = { peak, low, span };
    framingCache.set(d, framing);
  }
  return framing;
}

/**
 * Playback speed at stunt time `t`: 1 everywhere except tier 3, which slows to SLOW_RATE for
 * SLOW_SPAN seconds around its big moment, with SLOW_RAMP ramps either side.
 */
export function trickRate(id: TrickId, outcome: Outcome, t: number): number {
  const slow = def(id, outcome).slow;
  if (!slow) return 1;
  let rate = 1;
  for (const centre of slow) {
    const away = Math.abs(t - centre) - SLOW_SPAN / 2;
    const k = 1 - clamp01(away / SLOW_RAMP);
    rate = Math.min(rate, lerp(1, SLOW_RATE, k));
  }
  return rate;
}

// ---------- The lifeguard boat ----------

/** Seconds the boat takes: it runs in, the rider climbs aboard the new ski, the boat peels away. */
export const RESPAWN_TIME = 1.8;
const BOAT_RUN = 0.8;
const CLIMB_END = 1.3;
const TOW = 4.2;
const BOAT_SIDE = 2.4;
const BOAT_FROM = 30;
/** How far the boat is from the ski when it has faded away completely. */
export const BOAT_GONE = 40;

export interface RespawnFrame {
  boat: { d: number; y: number; s: number; yaw: number; opacity: number; visible: boolean };
  ski: {
    d: number;
    y: number;
    s: number;
    pitch: number;
    roll: number;
    yaw: number;
    visible: boolean;
  };
  rider: Frame['rider'];
  /** How far the old ski has sunk (0 down to -2). */
  sink: number;
}

export function createRespawnFrame(): RespawnFrame {
  return {
    boat: { d: 0, y: 0, s: 0, yaw: 0, opacity: 1, visible: true },
    ski: { d: 0, y: 0, s: 0, pitch: 0, roll: 0, yaw: 0, visible: true },
    rider: createFrame().rider,
    sink: 0,
  };
}

const respawnProbe = createFrame();

/**
 * The boat, the new ski and the rider `t` seconds into the respawn. The new ski ends at `skiD`
 * (side 0); the rider starts floating at (`riderD`, `riderS`). Valid past RESPAWN_TIME: the boat
 * keeps going until it has faded away.
 */
export function respawnFrame(
  t: number,
  out: RespawnFrame = createRespawnFrame(),
  skiD = 0,
  riderD = skiD - 5,
  riderS = 1.5,
): RespawnFrame {
  const time = Math.max(Number.isFinite(t) ? t : 0, 0);
  // The boat runs in from behind and to the right, towing the ski, which sits behind it.
  const run = prog(time, 0, BOAT_RUN, 'o');
  const boatD = skiD + TOW - BOAT_FROM * (1 - run);
  const boatS = BOAT_SIDE + 10 * (1 - run);
  // Then it peels away to the left, faster and faster.
  const peel = Math.max(time - CLIMB_END, 0);
  const awayS = -(8 * peel + 14 * peel * peel);
  const awayD = 6 * peel;
  out.boat.d = boatD + awayD;
  out.boat.s = boatS + awayS;
  out.boat.y = 0;
  out.boat.yaw = Math.atan2(-awayS * 0.3, 10) * clamp01(peel * 3) + 0.4 * (1 - run);
  const away = Math.hypot(out.boat.d - skiD, out.boat.s);
  out.boat.opacity = peel > 0 ? 1 - clamp01((away - (BOAT_GONE - 15)) / 15) : 1;
  out.boat.visible = out.boat.opacity > 0.01;
  // The new ski is towed until the climb, then drifts to rest at side 0.
  out.ski.d = boatD - TOW + awayD * 0;
  out.ski.s = boatS - BOAT_SIDE;
  out.ski.y = 0;
  out.ski.pitch = out.ski.roll = out.ski.yaw = 0;
  out.ski.visible = true;
  out.sink = 0 - 2 * prog(time, BOAT_RUN, BOAT_RUN + 1.0, 'io');
  // The rider climbs from the water onto the ski, then sits on it.
  const r = out.rider;
  r.props.seaweed = r.props.fish = false;
  r.visible = true;
  const climb = prog(time, BOAT_RUN, CLIMB_END, 'io');
  respawnProbe.ski.d = out.ski.d;
  respawnProbe.ski.s = out.ski.s;
  respawnProbe.ski.y = 0;
  respawnProbe.ski.pitch = respawnProbe.ski.roll = respawnProbe.ski.yaw = 0;
  const seat = seatOf(respawnProbe.ski);
  if (time >= CLIMB_END) {
    r.mode = 'seated';
    r.d = seat.d;
    r.y = seat.y;
    r.s = seat.s;
    r.pitch = r.roll = r.yaw = 0;
    r.pose = time < CLIMB_END + 0.3 ? 'climb' : 'wave';
    r.face = 'happy';
    return out;
  }
  r.mode = 'free';
  r.d = lerp(riderD, seat.d, climb);
  r.s = lerp(riderS, seat.s, climb);
  const hop = Math.sin(Math.PI * climb) * 0.5;
  r.y = lerp(-0.3, seat.y, climb) + hop;
  r.pitch = r.roll = r.yaw = 0;
  r.pose = time < BOAT_RUN ? 'float' : 'climb';
  r.face = time < BOAT_RUN + 0.2 ? 'soaked' : 'happy';
  return out;
}
