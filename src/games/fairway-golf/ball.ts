import {
  CircleGeometry,
  DoubleSide,
  BufferAttribute,
  BufferGeometry,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RingGeometry,
  SphereGeometry,
} from 'three';
import { DUFF_FRACTION, isPutt, pathAt, type Outcome, type Plan } from './shot';

/** The ball is drawn a lot bigger than life so it can be seen on a phone from behind. */
export const BALL_R = 0.16;
/** Putts roll at this speed, yards a second. */
export const PUTT_SPEED = 8;

export interface Ball {
  object: Group;
  /** Puts the ball's centre at `p` (height `p.y` above the ground); the shadow follows below. */
  place(p: { x: number; y: number; z: number }): void;
  setVisible(visible: boolean): void;
  /** A ring of water spreading from `at`, `t` seconds in; null hides it. */
  splash(at: { x: number; z: number } | null, t?: number): void;
  /**
   * The short trail behind a flying ball: pass the ball's point to add it, and call every frame
   * with `now` (seconds) so points older than TRAIL_SECONDS drop off the tail.
   */
  trail(now: number, p?: { x: number; y: number; z: number }): void;
}

/** A shot's trail follows the ball for this long, seconds. */
export const TRAIL_SECONDS = 1;
const TRAIL_POINTS = 60;

export function createBall(): Ball {
  const object = new Group();
  const sphere = new Mesh(
    new SphereGeometry(BALL_R, 20, 14),
    new MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 }),
  );
  object.add(sphere);
  const shadow = new Mesh(
    new CircleGeometry(BALL_R * 1.1, 16),
    new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.renderOrder = 4;
  object.add(shadow);

  const ring = new Mesh(
    new RingGeometry(0.85, 1, 28),
    new MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
      side: DoubleSide,
      depthWrite: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  ring.renderOrder = 5;

  const trailGeometry = new BufferGeometry();
  const trailPositions = new Float32Array(TRAIL_POINTS * 3);
  trailGeometry.setAttribute('position', new BufferAttribute(trailPositions, 3));
  const trailLine = new Line(
    trailGeometry,
    new LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 }),
  );
  trailLine.frustumCulled = false;
  trailLine.visible = false;
  trailLine.renderOrder = 6;
  const trail: { x: number; y: number; z: number; t: number }[] = [];

  return {
    object,
    trail(now, p) {
      if (p) trail.push({ ...p, t: now });
      while (trail.length && now - trail[0].t > TRAIL_SECONDS) trail.shift();
      if (trail.length < 2) {
        trailLine.visible = false;
        return;
      }
      if (!trailLine.parent) object.parent?.add(trailLine);
      const last = trail.slice(-TRAIL_POINTS);
      for (let i = 0; i < TRAIL_POINTS; i++) {
        const q = last[Math.min(i, last.length - 1)];
        trailPositions.set([q.x, q.y, q.z], i * 3);
      }
      trailGeometry.attributes.position.needsUpdate = true;
      trailLine.visible = true;
    },
    place(p) {
      object.position.set(p.x, 0, p.z);
      sphere.position.y = Math.max(p.y, BALL_R);
      shadow.position.y = 0.12;
      const s = 1 / (1 + Math.max(p.y - BALL_R, 0) * 0.08);
      shadow.scale.setScalar(s);
    },
    setVisible(visible) {
      object.visible = visible;
    },
    splash(at, t = 0) {
      if (!at) {
        ring.visible = false;
        return;
      }
      if (!ring.parent) object.parent?.add(ring);
      ring.visible = t < 1.2;
      ring.position.set(at.x, 0.2, at.z);
      ring.scale.setScalar(0.5 + t * 4);
      (ring.material as MeshBasicMaterial).opacity = Math.max(0, 0.8 - t * 0.7);
    },
  };
}

/** How long the ball is in the air (or rolling) for a struck shot, seconds. */
export function flightSeconds(plan: Plan, outcome: Outcome): number {
  const d = Math.hypot(outcome.end.x - plan.from.x, outcome.end.z - plan.from.z);
  if (isPutt(plan)) return Math.max(d / PUTT_SPEED, 0.4);
  const carry = outcome.quality === 'duff' ? DUFF_FRACTION * plan.carry : plan.carry;
  return 0.9 + carry / 120;
}

/**
 * Where the ball is `t` (0 to 1) of the way along its flight: a straight run from the tee to
 * the ring with a parabola for height. A hook or slice bends in late, so the ball starts on line.
 */
export function flightPoint(
  plan: Plan,
  outcome: Outcome,
  t: number,
): { x: number; y: number; z: number } {
  const p = pathAt(plan, outcome, t);
  return { x: p.x, y: BALL_R + p.h, z: p.z };
}
