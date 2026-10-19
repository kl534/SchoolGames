/**
 * The Mega courses as authored animations: a course is three big elements ridden in one long
 * stunt. `megaFrame(id, passed, t)` says where the bike and the rider are at time `t` of the
 * stunt that clears `passed` elements and crashes on the next (nothing after the third). Pure
 * data and maths, no three.js and no DOM, like stunts.ts.
 */
import type { MegaId, Passed } from '../rules';
import {
  createFrame,
  resetFrame,
  settleClear,
  TAU,
  type Def,
  type Frame,
  type Pos,
  type StuntEvent,
} from '../stunts';
import { INFERNO_DROP } from './inferno-drop';
import { SKY_CIRCUS } from './sky-circus';
import { TRIPLE_LOOP } from './triple-loop';
import { VOLCANO_RUSH } from './volcano-rush';

export type Cut = readonly [from: number, to: number];

/** One big element of a course, in element-local coordinates (x = 0 at its entry line). */
export interface MegaElement {
  name: string; // 'Little Loop'
  length: number; // x of its end; a cleared element finishes here, riding on the road
  floorY: number; // lowest y the bike or rider may reach (0, or below zero over a pit)
  height: number; // tallest prop above the road; must be <= MEGA_MAX_H
  /** Pit cuts in the road, element-local (a pool, a canyon). */
  cuts: readonly Cut[];
  clear: Def; // plays when this element is cleared
  crash: Def; // plays when this is the element the bike crashes on
}

export interface MegaSpec {
  id: MegaId;
  title: string; // 'Triple Loop'
  emoji: string; // the road strip goal icon

  elements: readonly [MegaElement, MegaElement, MegaElement];
  /** Elements 2 and 3 start in the air: a cleared element 1 or 2 ends mid-flight, not on the road. */
  airborne?: boolean;
  /** How far (u) the camera may rise to follow the bike up; 0 or absent: it never rises. */
  rise?: number;
}

/** Tallest prop of a course: the bike's top (7.2) minus the bike, so the layout is unchanged. */
export const MEGA_MAX_H = 6.4; // u

export const MEGA_SPECS: Record<MegaId, MegaSpec> = {
  'triple-loop': TRIPLE_LOOP,
  'sky-circus': SKY_CIRCUS,
  'volcano-rush': VOLCANO_RUSH,
  'inferno-drop': INFERNO_DROP,
};

const specOf = (id: MegaId) => MEGA_SPECS[id];

/** x of each element's entry line, course-local. */
export const megaOffsets = (id: MegaId): [number, number, number] => {
  const [a, b] = specOf(id).elements;
  return [0, a.length, a.length + b.length];
};

/** Total length of the three elements. */
export const megaLength = (id: MegaId): number =>
  specOf(id).elements.reduce((sum, e) => sum + e.length, 0);

/** All pit cuts, course-local. */
export const megaCuts = (id: MegaId): Cut[] => {
  const offsets = megaOffsets(id);
  return specOf(id).elements.flatMap((e, i) =>
    e.cuts.map(([from, to]): Cut => [offsets[i] + from, offsets[i] + to]),
  );
};

/** Lowest floorY of the three elements. */
export const megaFloorY = (id: MegaId): number =>
  Math.min(...specOf(id).elements.map((e) => e.floorY));

/** What plays at time t of a stunt that clears `passed` elements (crash on the next, if any). */
export interface Segment {
  index: 0 | 1 | 2; // which element
  outcome: 'clear' | 'crash';
  start: number; // seconds into the whole stunt when this segment starts
  localT: number; // seconds into the element's own animation
}

export interface SegmentPlan {
  start: number;
  index: 0 | 1 | 2;
  outcome: 'clear' | 'crash';
  duration: number;
}

const INDEXES = [0, 1, 2] as const;

/** `passed` clears back to back, then (if `passed < 3`) the crash of the next element. */
export function megaSegments(id: MegaId, passed: Passed): SegmentPlan[] {
  const { elements } = specOf(id);
  const plan: SegmentPlan[] = [];
  let start = 0;
  for (const index of INDEXES) {
    if (index > passed) break;
    const outcome = index < passed ? 'clear' : 'crash';
    const duration =
      outcome === 'clear' ? elements[index].clear.duration : elements[index].crash.duration;
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

const defOf = (id: MegaId, index: 0 | 1 | 2, outcome: 'clear' | 'crash'): Def => {
  const element = specOf(id).elements[index];
  return outcome === 'clear' ? element.clear : element.crash;
};

const probe = createFrame();

/**
 * Whole turns the bike has made by the end of each cleared element. A cleared element ends with
 * its pitch and roll a whole number of turns round; the next one starts from nought, so the
 * sampler carries the turns on and the angles never jump. An airborne course hands over
 * mid-flight: the bike's pitch at both boundaries is within +-pi, so it rounds to 0 whole turns
 * and the next element carries on from the same angle.
 */
const turnCache = new Map<string, { pitch: number; roll: number }>();
function turnsBefore(id: MegaId, index: number): { pitch: number; roll: number } {
  const key = `${id}:${index}`;
  let turns = turnCache.get(key);
  if (!turns) {
    let pitch = 0;
    let roll = 0;
    for (let i = 0; i < index; i++) {
      const def = specOf(id).elements[i].clear;
      resetFrame(probe);
      def.at(def.duration, probe);
      pitch += TAU * Math.round(probe.bike.pitch / TAU);
      roll += TAU * Math.round(probe.bike.roll / TAU);
    }
    turns = { pitch, roll };
    turnCache.set(key, turns);
  }
  return turns;
}

/**
 * The bike and rider at time `t` of the stunt (clamped to its duration), into `out` when given.
 * Each segment plays its element's own animation shifted to the element's place on the course;
 * a cleared element ends exactly riding on the road where the next one starts.
 */
export function megaFrame(
  id: MegaId,
  passed: Passed,
  t: number,
  out: Frame = createFrame(),
): Frame {
  const seg = megaLocate(id, passed, t);
  const spec = specOf(id);
  const element = spec.elements[seg.index];
  const def = defOf(id, seg.index, seg.outcome);
  resetFrame(out);
  def.at(seg.localT, out);
  if (seg.outcome === 'clear' && seg.localT >= def.duration && !(spec.airborne && seg.index < 2))
    settleClear(out, element.length);
  const offset = megaOffsets(id)[seg.index];
  const turns = turnsBefore(id, seg.index);
  out.bike.x += offset;
  out.bike.pitch += turns.pitch;
  out.bike.roll += turns.roll;
  if (out.rider.mode === 'free') out.rider.x += offset;
  return out;
}

const eventCache = new Map<string, StuntEvent[]>();

/** The effects to fire during the stunt, sorted by time, in course-local coordinates. */
export function megaEvents(id: MegaId, passed: Passed): StuntEvent[] {
  const key = `${id}:${passed}`;
  let events = eventCache.get(key);
  if (!events) {
    const offsets = megaOffsets(id);
    const list: StuntEvent[] = [];
    for (const seg of megaSegments(id, passed)) {
      const def = defOf(id, seg.index, seg.outcome);
      const sample = (t: number, rider: boolean): Pos => {
        const f = resetFrame(probe);
        def.at(Math.min(Math.max(t, 0), def.duration), f);
        return rider && f.rider.mode === 'free'
          ? { x: f.rider.x, y: f.rider.y }
          : { x: f.bike.x, y: f.bike.y };
      };
      const raw = def.events(
        (t) => sample(t, false),
        (t) => sample(t, true),
      );
      for (const [at, type, x, y, color] of raw) {
        const e: StuntEvent = {
          at: seg.start + Math.min(Math.max(at, 0), def.duration),
          type,
          x: x + offsets[seg.index],
          y,
        };
        if (color !== undefined) e.color = color;
        list.push(e);
      }
    }
    events = list.sort((a, b) => a.at - b.at);
    eventCache.set(key, events);
  }
  return events;
}

/** The comic word of the stunt: the crash's word when it ends in one, else the finale's. */
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

/** Playback rate at the slowest moment of a slow-motion beat. */
export const SLOW_RATE = 0.35;
/** Stunt seconds either side of the beat at the slowest rate, then over which it eases back to 1. */
export const SLOW_HOLD = 0.12;
export const SLOW_FADE = 0.12;

/**
 * The playback rate at stunt time t (1 = normal). It is SLOW_RATE within SLOW_HOLD of any slow
 * beat of the segments that play, and rises linearly back to 1 over the next SLOW_FADE.
 */
export function megaRate(id: MegaId, passed: Passed, t: number): number {
  if (Number.isNaN(t)) return 1;
  let weight = 0;
  for (const seg of megaSegments(id, passed)) {
    for (const c of defOf(id, seg.index, seg.outcome).slow ?? []) {
      if (c < 0 || c > seg.duration) continue;
      const d = Math.abs(t - (seg.start + c));
      const w = d <= SLOW_HOLD ? 1 : Math.max(0, 1 - (d - SLOW_HOLD) / SLOW_FADE);
      weight = Math.max(weight, w);
    }
  }
  return 1 - (1 - SLOW_RATE) * weight;
}
