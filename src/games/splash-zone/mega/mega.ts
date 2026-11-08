/**
 * The Mega courses as authored animations: a course is three big elements ridden in one long
 * stunt. `megaFrame(id, passed, t)` says where the ski and the rider are at time `t` of the stunt
 * that clears `passed` elements and wipes out on the next (nothing after the third). Pure data and
 * maths, no three.js and no DOM, like `tricks.ts`.
 *
 * Coordinates are course-local: `d` metres forward of the course's entry line (world
 * `z = entryZ - d`), `y` up from the water, `s` sideways (+ is the rider's right).
 */
import {
  TAU,
  clamp01,
  createFrame,
  lerp,
  resetFrame,
  sitOnSki,
  type Def,
  type Frame,
  type Pos,
  type TrickEvent,
} from '../anim';
import type { Framing } from '../layout';
import type { MegaId, Passed } from '../rules';
import { SLOW_RAMP, SLOW_RATE, SLOW_SPAN, focusOf } from '../tricks';
import { GEYSER_BLAST } from './geyser-blast';
import { HARBOUR_HAVOC } from './harbour-havoc';
import { PENGUIN_PARADE } from './penguin-parade';
import { WHALE_OF_A_TIME } from './whale-of-a-time';

/** One big element of a course, in element-local coordinates (`d` = 0 at its entry line). */
export interface MegaElement {
  name: string; // 'Sandbar Island'
  length: number; // d of its end; a cleared element finishes here, riding on the water
  floorY: number; // lowest y the ski or the rider may reach
  /** What the camera has to show of this element as the ski reaches it (a point a little ahead). */
  cue: { d: number; y: number };
  /** The element's props along the course (element-local d): the camera keeps `anchor`, the middle of them, in frame while the ski is within `extent` (at most about 9 u either side of the anchor, so a phone held upright can show both). */
  anchor: { d: number; y: number };
  extent: readonly [from: number, to: number];
  clear: Def; // plays when this element is cleared
  fail: Def; // plays when this is the element the ski wipes out on
}

export interface MegaSpec {
  id: MegaId;
  title: string; // 'Whale of a Time'
  emoji: string; // the wake strip's goal icon
  elements: readonly [MegaElement, MegaElement, MegaElement];
}

export const MEGA_SPECS: Record<MegaId, MegaSpec> = {
  'whale-of-a-time': WHALE_OF_A_TIME,
  'harbour-havoc': HARBOUR_HAVOC,
  'penguin-parade': PENGUIN_PARADE,
  'geyser-blast': GEYSER_BLAST,
};

const specOf = (id: MegaId) => MEGA_SPECS[id];

/** d of each element's entry line, course-local. */
export const megaOffsets = (id: MegaId): [number, number, number] => {
  const [a, b] = specOf(id).elements;
  return [0, a.length, a.length + b.length];
};

/** Total length of the three elements. */
export const megaLength = (id: MegaId): number =>
  specOf(id).elements.reduce((sum, e) => sum + e.length, 0);

/** Lowest floorY of the three elements. */
export const megaFloorY = (id: MegaId): number =>
  Math.min(...specOf(id).elements.map((e) => e.floorY));

export interface Segment {
  index: 0 | 1 | 2; // which element
  outcome: 'clear' | 'fail';
  start: number; // seconds into the whole stunt when this segment starts
  localT: number; // seconds into the element's own animation
}

export interface SegmentPlan {
  start: number;
  index: 0 | 1 | 2;
  outcome: 'clear' | 'fail';
  duration: number;
}

const INDEXES = [0, 1, 2] as const;

/** `passed` clears back to back, then (if `passed < 3`) the wipeout on the next element. */
export function megaSegments(id: MegaId, passed: Passed): SegmentPlan[] {
  const { elements } = specOf(id);
  const plan: SegmentPlan[] = [];
  let start = 0;
  for (const index of INDEXES) {
    if (index > passed) break;
    const outcome = index < passed ? 'clear' : 'fail';
    const duration = elements[index][outcome].duration;
    plan.push({ start, index, outcome, duration });
    start += duration;
  }
  return plan;
}

/** Seconds the whole stunt lasts. */
export function megaDuration(id: MegaId, passed: Passed): number {
  const plan = megaSegments(id, passed);
  const last = plan[plan.length - 1];
  return last.start + last.duration;
}

const finite = (t: number) => (Number.isNaN(t) ? 0 : t);

/**
 * The segment playing at time `t` (clamped to the stunt). On a boundary the later segment plays,
 * from its start; past the end the last one is at its final moment.
 */
export function megaLocate(id: MegaId, passed: Passed, t: number): Segment {
  const plan = megaSegments(id, passed);
  const total = megaDuration(id, passed);
  const time = Math.min(Math.max(finite(t), 0), total);
  let seg = plan[0];
  for (const candidate of plan) {
    if (candidate.start <= time) seg = candidate;
    else break;
  }
  return {
    index: seg.index,
    outcome: seg.outcome,
    start: seg.start,
    localT: Math.min(time - seg.start, seg.duration),
  };
}

const defOf = (id: MegaId, index: 0 | 1 | 2, outcome: 'clear' | 'fail'): Def =>
  specOf(id).elements[index][outcome];

const probe = createFrame();

/**
 * Whole turns the ski has made by the end of each cleared element. A cleared element ends with its
 * angles a whole number of turns round; the next one starts from nought, so the sampler carries the
 * turns on and the angles never jump.
 */
const turnCache = new Map<string, { pitch: number; roll: number; yaw: number }>();
function turnsBefore(id: MegaId, index: number): { pitch: number; roll: number; yaw: number } {
  const key = `${id}:${index}`;
  let turns = turnCache.get(key);
  if (!turns) {
    let pitch = 0;
    let roll = 0;
    let yaw = 0;
    for (let i = 0; i < index; i++) {
      const def = specOf(id).elements[i].clear;
      resetFrame(probe);
      def.at(def.duration, probe);
      pitch += TAU * Math.round(probe.ski.pitch / TAU);
      roll += TAU * Math.round(probe.ski.roll / TAU);
      yaw += TAU * Math.round(probe.ski.yaw / TAU);
    }
    turns = { pitch, roll, yaw };
    turnCache.set(key, turns);
  }
  return turns;
}

/**
 * The ski, the rider and the dolphins at time `t` of the stunt (clamped to its duration), into
 * `out` when given. Each segment plays its element's own animation shifted to the element's place
 * on the course; a cleared element ends exactly riding on the water where the next one starts.
 */
export function megaFrame(
  id: MegaId,
  passed: Passed,
  t: number,
  out: Frame = createFrame(),
): Frame {
  const seg = megaLocate(id, passed, t);
  const def = defOf(id, seg.index, seg.outcome);
  resetFrame(out);
  def.at(seg.localT, out);
  const offset = megaOffsets(id)[seg.index];
  const turns = turnsBefore(id, seg.index);
  out.ski.d += offset;
  out.ski.pitch += turns.pitch;
  out.ski.roll += turns.roll;
  out.ski.yaw += turns.yaw;
  if (out.rider.mode === 'seated') sitOnSki(out);
  else out.rider.d += offset;
  for (const dolphin of out.dolphins) dolphin.d += offset;
  return out;
}

const eventCache = new Map<string, TrickEvent[]>();

/** The effects to fire during the stunt, sorted by time, in course-local coordinates. */
export function megaEvents(id: MegaId, passed: Passed): TrickEvent[] {
  const key = `${id}:${passed}`;
  let events = eventCache.get(key);
  if (!events) {
    const offsets = megaOffsets(id);
    const list: TrickEvent[] = [];
    for (const seg of megaSegments(id, passed)) {
      const def = defOf(id, seg.index, seg.outcome);
      const sample = (t: number, rider: boolean): Pos => {
        const f = resetFrame(probe);
        def.at(Math.min(Math.max(t, 0), def.duration), f);
        if (f.rider.mode === 'seated') sitOnSki(f);
        return rider && f.rider.mode === 'free'
          ? { d: f.rider.d, y: f.rider.y, s: f.rider.s }
          : { d: f.ski.d, y: f.ski.y, s: f.ski.s };
      };
      const raw = def.events(
        (t) => sample(t, false),
        (t) => sample(t, true),
      );
      for (const [at, type, d, y, s] of raw) {
        list.push({
          at: seg.start + Math.min(Math.max(at, 0), def.duration),
          type,
          d: d + offsets[seg.index],
          y,
          s: s ?? 0,
        });
      }
    }
    events = list.sort((a, b) => a.at - b.at);
    eventCache.set(key, events);
  }
  return events;
}

/** The comic word of the stunt: the wipeout's word when it ends in one, else the finale's. */
export function megaWord(id: MegaId, passed: Passed): string {
  const plan = megaSegments(id, passed);
  const last = plan[plan.length - 1];
  return defOf(id, last.index, last.outcome).word;
}

/** The comic word of the segment playing at time `t`, and whether it is a clear (a good word). */
export function megaWordAt(id: MegaId, passed: Passed, t: number): { text: string; good: boolean } {
  const seg = megaLocate(id, passed, t);
  return { text: defOf(id, seg.index, seg.outcome).word, good: seg.outcome === 'clear' };
}

/**
 * Playback rate at stunt time `t` (1 = normal): only a course's finale has slow motion, easing to
 * SLOW_RATE for SLOW_SPAN seconds around its big moment with SLOW_RAMP ramps either side.
 */
export function megaRate(id: MegaId, passed: Passed, t: number): number {
  if (Number.isNaN(t)) return 1;
  let rate = 1;
  for (const seg of megaSegments(id, passed)) {
    for (const centre of defOf(id, seg.index, seg.outcome).slow ?? []) {
      const away = Math.abs(t - (seg.start + centre)) - SLOW_SPAN / 2;
      rate = Math.min(rate, lerp(1, SLOW_RATE, 1 - clamp01(away / SLOW_RAMP)));
    }
  }
  return rate;
}

// ---------- The camera over a course ----------

/** The most the camera looks ahead of or behind the ski towards the element it is on (u). */
export const LOOK_BIAS_MAX = 5.5;
/** Seconds ahead the camera already makes room for the next element. */
export const VIEW_LEAD = 0.7;

/**
 * Where along the course the camera is drawn to: the middle of the element the ski is on while it
 * is on it, and in between elements a slide from the last one's middle to the next one's cue (at
 * its entry line) and on to its middle, so the view moves smoothly. Course-local d.
 */
export function megaAttractor(id: MegaId, x: number): number {
  const offsets = megaOffsets(id);
  const knots: [number, number][] = [];
  specOf(id).elements.forEach((e, i) => {
    // Arriving at an element's entry line the camera already looks at its cue, then at its middle.
    knots.push(
      i > 0 ? [offsets[i], offsets[i] + e.cue.d] : [0, 3],
      [offsets[i] + e.extent[0], offsets[i] + e.anchor.d],
      [offsets[i] + e.extent[1], offsets[i] + e.anchor.d],
    );
  });
  // Past the last element the camera is drawn to nothing: it just follows.
  knots.push([megaLength(id), megaLength(id)]);
  if (!(x > knots[0][0])) return knots[0][1];
  for (let i = 1; i < knots.length; i++) {
    if (x <= knots[i][0]) {
      const [x0, y0] = knots[i - 1];
      const [x1, y1] = knots[i];
      return x1 > x0 ? lerp(y0, y1, (x - x0) / (x1 - x0)) : y1;
    }
  }
  return knots[knots.length - 1][1];
}

/** How far ahead (+) or behind (-) of the ski at `x` the camera looks: half way to the attractor. */
export function megaLookBias(id: MegaId, x: number): number {
  const bias = (megaAttractor(id, x) - x) / 2;
  return Math.min(Math.max(bias, -LOOK_BIAS_MAX), LOOK_BIAS_MAX);
}

const segmentFramingCache = new Map<string, Framing>();

/**
 * What the camera has to fit while one element plays: how high and how low the ski and the rider
 * go (u above the water, with room for the head and the underside), and how wide the picture must
 * be: the ski and a thrown rider, the element's middle while the ski is on it, and the next
 * element's cue as the ski reaches it, all measured from where the camera looks.
 */
export function megaSegmentFraming(id: MegaId, passed: Passed, index: 0 | 1 | 2): Framing {
  const key = `${id}:${passed}:${index}`;
  let framing = segmentFramingCache.get(key);
  if (!framing) {
    const seg = megaSegments(id, passed).find((s) => s.index === index);
    if (!seg) throw new Error(`No element ${index} when ${passed} are right`);
    const spec = specOf(id);
    const element = spec.elements[index];
    const offset = megaOffsets(id)[index];
    const anchorD = offset + element.anchor.d;
    let peak = 1.5;
    let low = 0;
    let half = 1.5;
    const f = createFrame();
    const focus = { d: 0, y: 0, s: 0 };
    for (let t = 0; t <= seg.duration + 1e-9; t += 1 / 30) {
      megaFrame(id, passed, seg.start + t, f);
      if (f.ski.visible) {
        peak = Math.max(peak, f.ski.y + 1.0);
        low = Math.min(low, f.ski.y - 0.3);
      }
      if (f.rider.visible) {
        peak = Math.max(peak, f.rider.y + 1.15);
        low = Math.min(low, f.rider.y - 0.3);
      }
      focusOf(f, focus);
      const look = focus.d + megaLookBias(id, focus.d);
      if (f.rider.mode === 'free' && f.rider.visible) {
        // A rider flung towards the camera is seen from higher up, so he sits lower in the picture.
        low = Math.min(low, f.rider.y - 0.3 - 0.14 * Math.max(f.rider.s - focus.s, 0));
      }
      if (f.ski.visible) half = Math.max(half, Math.abs(f.ski.d - look) + 1.3);
      if (f.rider.mode === 'free' && f.rider.visible) {
        // A rider flung towards the camera looms larger, so sideways counts too.
        half = Math.max(
          half,
          Math.abs(f.rider.d - look) + 0.8 + 0.8 * Math.abs(f.rider.s - focus.s),
        );
      }
      if (f.ski.d >= offset + element.extent[0] && f.ski.d <= offset + element.extent[1]) {
        half = Math.max(half, Math.abs(anchorD - look) + 1.0);
        peak = Math.max(peak, element.anchor.y + 1.0);
      }
    }
    if (seg.outcome === 'clear' && index < 2) {
      // The next element's cue, as the ski reaches it.
      const next = spec.elements[index + 1];
      megaFrame(id, passed, seg.start + seg.duration, f);
      focusOf(f, focus);
      const look = focus.d + megaLookBias(id, focus.d);
      half = Math.max(half, Math.abs(offset + element.length + next.cue.d - look) + 0.5);
      peak = Math.max(peak, next.cue.y + 1.0);
    }
    framing = { peak, low, span: 2 * half };
    segmentFramingCache.set(key, framing);
  }
  return framing;
}

/**
 * What the camera frames at stunt time `t`: the element being ridden, and from `VIEW_LEAD` seconds
 * before it the next one too, so the camera has eased out by the time the bigger one starts.
 */
export function megaFramingAt(id: MegaId, passed: Passed, t: number): Framing {
  const time = finite(t);
  let peak = Number.NEGATIVE_INFINITY;
  let low = Number.POSITIVE_INFINITY;
  let span = 0;
  for (const seg of megaSegments(id, passed)) {
    if (seg.start + seg.duration < time || seg.start > time + VIEW_LEAD) continue;
    const f = megaSegmentFraming(id, passed, seg.index);
    peak = Math.max(peak, f.peak);
    low = Math.min(low, f.low);
    span = Math.max(span, f.span ?? 0);
  }
  if (peak === Number.NEGATIVE_INFINITY) {
    const last = megaSegments(id, passed).slice(-1)[0];
    return megaSegmentFraming(id, passed, last.index);
  }
  return { peak, low, span };
}
