import {
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  InterleavedBufferAttribute,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RingGeometry,
  Sprite,
  SpriteMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { isPutt, pathAt, type Lie, type Outcome, type Plan } from './shot';

/** The ball is true size (1.68 in across); a ring and a halo help the eye find it. */
export const BALL_R = 0.047;
/** Putts roll at this speed, yards a second. */
export const PUTT_SPEED = 8;
/** A ball on a tee peg sits this high above a ball on the ground, yards. */
export const TEE_H = 0.05;
/** The little pieces thrown up when the club hits the ground, and how long they fly, seconds. */
const PUFF_PIECES = 12;
export const PUFF_SECONDS = 0.6;
const PUFF_COLOURS = { grass: 0x4f8a3a, sand: 0xe8cf8f } as const;
export type PuffKind = keyof typeof PUFF_COLOURS | 'none';

export interface Ball {
  object: Group;
  /**
   * Puts the ball's centre at `p` (`p.y` is its height in the world); the shadow follows below on
   * the ground, which is `ground` yards up (below zero in a bunker). Pass the lie when the ball is
   * at rest: on the tee it sits on a peg.
   */
  place(p: { x: number; y: number; z: number }, lie?: Lie, ground?: number): void;
  /** Sinks the ball into the cup at `at`, `u` (0 to 1) of the way down. */
  sink(at: { x: number; z: number }, u: number): void;
  /** True while the ball sits at address: the pulsing ring shows and the halo does not. */
  setAddress(on: boolean): void;
  /** Throws up grass or sand where the club met the ground; call `update` every frame. */
  puff(kind: PuffKind, at: { x: number; y?: number; z: number }, now: number, dir?: number): void;
  /** Pulses the aids and flies the puff. */
  update(now: number): void;
  setVisible(visible: boolean): void;
  /** A ring of water spreading from `at`, `t` seconds in; null hides it. */
  splash(at: { x: number; z: number } | null, t?: number): void;
  /**
   * The red-orange tracer behind a flying ball: pass the ball's point (and the `ground` under it)
   * to extend it while the ball is in the air; call every frame with `now` (seconds) so it can
   * hold and fade once `endTrail` was called.
   */
  trail(now: number, p?: { x: number; y: number; z: number }, ground?: number): void;
  /** The ball has landed at `now`: the tracer holds TRACER_HOLD seconds, then fades. */
  endTrail(now: number): void;
  /** Drops the tracer at once (a new shot, a putt). */
  clearTrail(): void;
  /** The drawing buffer's size in pixels, which the tracer's pixel width needs. */
  setResolution(width: number, height: number): void;
}

/** The tracer holds this long after the ball lands, then fades over TRACER_FADE seconds. */
export const TRACER_HOLD = 1;
export const TRACER_FADE = 0.5;
/** The tracer is this many pixels wide. */
export const TRACER_WIDTH = 3;
/** The most points a tracer keeps (one every frame of the longest flight is well under it). */
const TRACER_POINTS = 360;
/** A ball is in the air for the tracer when it is this far above the ground, yards. */
const AIRBORNE = 0.08;

/** A white ball pitted with grey dimples, so its spin can be seen when it rolls. */
function dimpleTexture(): CanvasTexture | null {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const c = canvas.getContext('2d');
  if (!c) return null;
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, 128, 64);
  c.fillStyle = '#b9c3cf';
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 16; col++) {
      c.beginPath();
      c.arc(col * 8 + (row % 2) * 4 + 2, row * 8 + 4, 1.8, 0, Math.PI * 2);
      c.fill();
    }
  }
  return new CanvasTexture(canvas);
}

/** The ball only spins to match a move this short (yards); a long jump is a flight or a reset. */
const SPIN_MAX_STEP = 0.6;
const spinAxis = new Vector3();

/**
 * `glow` multiplies the aids' and tracer's colour: above 1 when a tone-mapping post pass follows
 * (so whites stay white and the tracer is bright enough for bloom).
 */
export function createBall(glow = 1): Ball {
  const object = new Group();
  const sphere = new Mesh(
    new SphereGeometry(BALL_R, 20, 14),
    new MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, map: dimpleTexture() }),
  );
  let last: { x: number; z: number } | null = null;
  object.add(sphere);
  const shadow = new Mesh(
    new CircleGeometry(BALL_R * 1.1, 16),
    new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.renderOrder = 4;
  object.add(shadow);

  // A tee peg under the ball while it is on the tee.
  const peg = new Mesh(
    new CylinderGeometry(0.014, 0.004, TEE_H, 8),
    new MeshStandardMaterial({ color: 0xf1ead6, roughness: 0.6 }),
  );
  peg.position.y = TEE_H / 2;
  peg.visible = false;
  object.add(peg);
  let restH = BALL_R;

  // Aids so a true-size ball can still be found: a ring on the ground at address and a halo after.
  const aimRing = new Mesh(
    new RingGeometry(0.35, 0.4, 36),
    new MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.7,
      side: DoubleSide,
      depthTest: false,
      depthWrite: false,
    }),
  );
  (aimRing.material as MeshBasicMaterial).color.multiplyScalar(glow);
  aimRing.rotation.x = -Math.PI / 2;
  aimRing.position.y = 0.04;
  aimRing.renderOrder = 8;
  object.add(aimRing);
  const haloCanvas = document.createElement('canvas');
  haloCanvas.width = haloCanvas.height = 64;
  const hctx = haloCanvas.getContext('2d');
  if (hctx) {
    const gradient = hctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,0.95)');
    gradient.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    hctx.fillStyle = gradient;
    hctx.fillRect(0, 0, 64, 64);
  }
  const halo = new Sprite(
    new SpriteMaterial({
      map: new CanvasTexture(haloCanvas),
      transparent: true,
      depthTest: false,
      depthWrite: false,
      sizeAttenuation: false,
    }),
  );
  halo.scale.setScalar(0.035);
  halo.renderOrder = 9;
  halo.visible = false;
  object.add(halo);
  let atAddress = true;
  let flying = false;

  const puffGeometry = new BoxGeometry(0.03, 0.03, 0.03);
  const puffMaterial = new MeshBasicMaterial({ color: PUFF_COLOURS.grass });
  const puffPieces = Array.from({ length: PUFF_PIECES }, () => {
    const piece = new Mesh(puffGeometry, puffMaterial);
    piece.visible = false;
    return piece;
  });
  const puffVelocity = puffPieces.map(() => ({ x: 0, y: 0, z: 0 }));
  let puffAt = -1;
  let puffFrom = { x: 0, y: 0, z: 0 };

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
  (ring.material as MeshBasicMaterial).color.multiplyScalar(glow);
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  ring.renderOrder = 5;

  const trailGeometry = new LineGeometry();
  trailGeometry.setPositions(new Float32Array(TRACER_POINTS * 3));
  const trailMaterial = new LineMaterial({
    color: 0xff4a1c,
    linewidth: TRACER_WIDTH,
    toneMapped: false,
    transparent: true,
  });
  trailMaterial.color.multiplyScalar(glow > 1 ? 4 : 1);
  const trailLine = new Line2(trailGeometry, trailMaterial);
  trailLine.frustumCulled = false;
  trailLine.visible = false;
  trailLine.renderOrder = 6;
  const segments = (trailGeometry.getAttribute('instanceStart') as InterleavedBufferAttribute).data;
  const trail: { x: number; y: number; z: number }[] = [];
  let landedAt = -1;

  return {
    object,
    trail(now, p, ground = 0) {
      if (p && p.y - ground > BALL_R + AIRBORNE && landedAt < 0 && trail.length < TRACER_POINTS) {
        trail.push({ ...p });
      }
      if (trail.length < 2) {
        trailLine.visible = false;
        return;
      }
      if (!trailLine.parent) object.parent?.add(trailLine);
      const out = segments.array as Float32Array;
      for (let i = 0; i < trail.length - 1; i++) {
        const a = trail[i];
        const b = trail[i + 1];
        out.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
      }
      segments.needsUpdate = true;
      trailGeometry.instanceCount = trail.length - 1;
      trailLine.visible = true;
      const age = landedAt < 0 ? 0 : now - landedAt - TRACER_HOLD;
      trailMaterial.opacity = Math.min(Math.max(1 - age / TRACER_FADE, 0), 1);
      if (age >= TRACER_FADE) {
        trailLine.visible = false;
        trail.length = 0;
        landedAt = -1;
      }
    },
    endTrail(now) {
      if (trail.length > 1) landedAt = now;
    },
    clearTrail() {
      trail.length = 0;
      landedAt = -1;
      trailLine.visible = false;
    },
    setResolution(width, height) {
      trailMaterial.resolution.set(width, height);
    },
    place(p, lie, ground = 0) {
      if (lie !== undefined) {
        const onTee = lie === 'tee';
        peg.visible = onTee;
        restH = onTee ? BALL_R + TEE_H : BALL_R;
      }
      // Rolling turns the ball about the axis across its way, a turn of distance / radius.
      if (last) {
        const dx = p.x - last.x;
        const dz = p.z - last.z;
        const step = Math.hypot(dx, dz);
        if (step > 1e-6 && step < SPIN_MAX_STEP) {
          spinAxis.set(dz, 0, -dx).normalize();
          sphere.rotateOnWorldAxis(spinAxis, step / BALL_R);
        }
      }
      last = { x: p.x, z: p.z };
      object.position.set(p.x, ground, p.z);
      const up = p.y - ground;
      sphere.position.y = Math.max(up, restH);
      shadow.position.y = 0.012;
      const s = 1 / (1 + Math.max(up - BALL_R, 0) * 0.08);
      shadow.scale.setScalar(s);
      flying = up > restH + 0.02;
      halo.position.y = sphere.position.y;
    },
    sink(at, u) {
      object.position.set(at.x, 0, at.z);
      peg.visible = false;
      sphere.position.y = BALL_R + (-0.12 - BALL_R) * Math.min(Math.max(u, 0), 1);
      halo.visible = false;
      shadow.visible = u < 0.2;
    },
    setAddress(on) {
      atAddress = on;
    },
    puff(kind, at, now, dir = 0) {
      if (kind === 'none') return;
      puffMaterial.color.setHex(PUFF_COLOURS[kind]);
      puffAt = now;
      puffFrom = { x: at.x, y: at.y ?? 0, z: at.z };
      if (!puffPieces[0].parent) puffPieces.forEach((piece) => object.parent?.add(piece));
      puffPieces.forEach((piece, i) => {
        // Up and forward along the shot, fanned a little either side.
        const fan = ((i % 4) - 1.5) * 0.35;
        const speed = 1.2 + (i % 3) * 0.5;
        puffVelocity[i] = {
          x: Math.sin(dir + fan) * speed,
          y: 1.4 + (i % 5) * 0.35,
          z: Math.cos(dir + fan) * speed,
        };
        piece.visible = true;
        piece.position.set(at.x, puffFrom.y + 0.03, at.z);
      });
    },
    update(now) {
      shadow.visible = true;
      const pulse = 0.675 + 0.225 * Math.sin(now * 2 * Math.PI * 1.2);
      (aimRing.material as MeshBasicMaterial).opacity = pulse;
      aimRing.visible = object.visible && atAddress && !flying;
      halo.visible = object.visible && !atAddress && sphere.position.y > -0.05;
      (halo.material as SpriteMaterial).opacity = 0.85;
      if (puffAt >= 0) {
        const age = now - puffAt;
        puffPieces.forEach((piece, i) => {
          if (age > PUFF_SECONDS || age < 0) {
            piece.visible = false;
            return;
          }
          const v = puffVelocity[i];
          piece.position.set(
            puffFrom.x + v.x * age,
            puffFrom.y + Math.max(0.03 + v.y * age - 4.9 * age * age, 0.02),
            puffFrom.z + v.z * age,
          );
        });
        if (age > PUFF_SECONDS) puffAt = -1;
      }
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
  const d = Math.hypot(outcome.land.x - plan.from.x, outcome.land.z - plan.from.z);
  if (isPutt(plan)) return Math.max(d / PUTT_SPEED, 0.4);
  return 0.9 + plan.carry / 120;
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
