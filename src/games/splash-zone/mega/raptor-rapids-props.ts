/**
 * The props of Raptor Rapids: a Brachiosaurus whose neck bows and who sneezes, a Stegosaurus with
 * three plates that dip as the ski lands on them, and a T. rex with a jaw that opens and snaps.
 * Painted primitives, built once and only moved. Element-local coordinates: z = -d, x = s.
 */
import { ConeGeometry, Group, SphereGeometry, type Mesh, type Object3D } from 'three';
import { prog } from '../anim';
import type { Kit } from '../kit';
import {
  NECK,
  REX,
  STEGO,
  T_CHOMP,
  T_CLIP,
  T_CREST,
  T_PLATE,
  T_SNEEZE,
  T_SPIT,
  neckY,
  rexRampY,
  stegoRampY,
} from './raptor-rapids';
import { profile, type MegaBuilt } from './props-kit';

const GREEN = [0x5fa85a, 0x7cbf68];
const CREAM = 0xf3e6b8;

/** A ball scaled into an ellipsoid. */
function blob(
  kit: Kit,
  parent: Object3D,
  material: ReturnType<Kit['lit']>,
  r: number,
  x: number,
  y: number,
  z: number,
  sx = 1,
  sy = 1,
  sz = 1,
): Mesh {
  const m = kit.mesh(new SphereGeometry(r, 14, 10), material, parent, x, y, z);
  m.scale.set(sx, sy, sz);
  return m;
}

/** A pair of eyes and a dark pupil on a head facing -z (towards the skier is +z is behind). */
function eyes(kit: Kit, head: Object3D, x: number, y: number, z: number, r: number) {
  const white = kit.lit(0xffffff, 0.3);
  const dark = kit.lit(0x1d2a1d, 0.3);
  for (const side of [-1, 1]) {
    blob(kit, head, white, r, side * x, y, z);
    blob(kit, head, dark, r * 0.55, side * (x + r * 0.15), y, z - r * 0.7);
  }
}

// ---------- The Brachiosaurus ----------

function buildNeck(kit: Kit): MegaBuilt {
  const group = new Group();
  const neck = profile(
    kit,
    group,
    neckY,
    NECK.foot,
    NECK.head,
    0.75,
    -1.2,
    NECK.halfWidth,
    GREEN[0],
    GREEN[1],
  );
  const green = kit.lit(GREEN[0], 0.7);
  const belly = kit.lit(0xb7d078, 0.7);
  // The body stands to one side of the course and the neck loops out of it over the water.
  const body = new Group();
  body.position.set(-6.5, 0, -NECK.top);
  group.add(body);
  blob(kit, body, green, 4.2, 0, 3.2, 0, 1, 0.85, 1.4);
  blob(kit, body, belly, 3.4, 0, 2.4, 0, 1, 0.8, 1.3);
  for (const [x, z] of [
    [-2, -3],
    [2, -3],
    [-2, 3],
    [2, 3],
  ]) {
    kit.mesh(new ConeGeometry(1.0, 3.4, 8), green, body, x, 1.2, z).scale.set(1, 1, 1);
  }
  const stub = blob(kit, group, green, 1.9, -3.4, NECK.topY - 0.8, -NECK.top, 2.2, 1, 1);
  stub.rotation.y = 0;
  // The head at the end of the neck, with a sneeze.
  const head = new Group();
  head.position.set(0, 0, -(NECK.head + 1.2));
  group.add(head);
  blob(kit, head, green, 1.5, 0, 0.5, 0, 1, 0.9, 1.15);
  blob(kit, head, green, 0.95, 0, 0.2, -1.3, 1, 0.9, 1.1);
  blob(kit, head, kit.lit(0x2a3a2a, 0.5), 0.12, 0.3, 0.45, -2.25);
  blob(kit, head, kit.lit(0x2a3a2a, 0.5), 0.12, -0.3, 0.45, -2.25);
  eyes(kit, head, 0.9, 1.0, -0.7, 0.28);
  const cream = kit.lit(CREAM, 0.6);
  for (let i = 0; i < 4; i++)
    blob(
      kit,
      group,
      cream,
      0.5,
      -1.2 * (i % 2 ? 1 : -1) * 0.5,
      neckY(6 + i * 4) + 0.3,
      -(6 + i * 4),
      1,
      0.5,
      1,
    );
  const pose = (time: number, bow: number, sneeze: number) => {
    // The neck sags a little as the ski climbs it, and the head jerks back at the sneeze.
    neck.scale.y = 1 - 0.1 * bow;
    head.position.y = neckY(NECK.head) * (1 - 0.1 * bow) + 0.1 * Math.sin(time * 1.6) * (1 - bow);
    head.rotation.x = 0.7 * sneeze + 0.05 * Math.sin(time * 1.3);
    body.scale.y = 1 + 0.02 * Math.sin(time * 1.8);
  };
  return {
    group,
    update(outcome, t) {
      const bow = outcome === 'clear' ? Math.max(0, 1 - Math.abs(t - T_CREST) / 0.7) : 0;
      // A wind-up back, a snap forward, then it settles.
      const sneeze =
        outcome === 'fail'
          ? prog(t, T_SNEEZE - 0.3, T_SNEEZE, 'o') -
            1.2 * prog(t, T_SNEEZE, T_SNEEZE + 0.35, 'o') +
            0.2 * prog(t, T_SNEEZE + 0.35, T_SNEEZE + 0.9)
          : 0;
      pose(t, bow, sneeze);
    },
    ambient: (time) => pose(time, 0, 0),
    reset: () => pose(0, 0, 0),
  };
}

// ---------- The Stegosaurus ----------

function buildStego(kit: Kit): MegaBuilt {
  const group = new Group();
  profile(
    kit,
    group,
    stegoRampY,
    STEGO.foot,
    STEGO.back,
    0.75,
    -1.2,
    STEGO.halfWidth,
    0x7c9a4a,
    0x93b060,
  );
  const green = kit.lit(0x7c9a4a, 0.7);
  const orange = kit.lit(0xf08a3a, 0.6);
  const cream = kit.lit(CREAM, 0.6);
  // The back, from the neck to the tail, and the head at the water's edge at the near end.
  blob(kit, group, green, 1, 0, 0.5, -17.5, 2.2, 1.5, 9);
  blob(kit, group, green, 1.0, 0, 0.5, -(STEGO.foot - 1.2), 1.1, 0.9, 1.4);
  eyes(kit, group, 0.55, 1.0, -(STEGO.foot - 2.0), 0.18);
  // The tail trails off with two pairs of spikes.
  const tail = new Group();
  tail.position.set(0, 0.8, -26.5);
  group.add(tail);
  kit.mesh(new ConeGeometry(1.1, 7.5, 8), green, tail, 0, 0, -3.2).rotation.x = -Math.PI / 2 - 0.1;
  for (const side of [-1, 1]) {
    for (const z of [-5.6, -6.8]) {
      kit.mesh(new ConeGeometry(0.28, 1.6, 5), cream, tail, side * 0.7, 0.8, z).rotation.z =
        -side * 0.5;
    }
  }
  // Three big plates on the back.
  const plates = STEGO.plates.map((p) => {
    const plate = new Group();
    plate.position.set(0, p.y - 1.5, -p.d);
    group.add(plate);
    const m = blob(kit, plate, orange, 1, 0, 0.75, 0, 0.3, p.y > 3.5 ? 1.6 : 1.4, 1.45);
    blob(kit, plate, cream, 1, 0, 0.75, 0, 0.32, 0.3, 0.5).position.y = 1.2;
    return { plate, base: p.y - 1.5, m };
  });
  const pose = (outcome: 'clear' | 'fail', t: number, time: number) => {
    plates.forEach((p, i) => {
      let dip = 0;
      let tilt = 0;
      const since = t - T_PLATE[i];
      if (since > 0 && (outcome === 'clear' || i === 0)) {
        dip = 0.35 * Math.exp(-6 * since) * (1 + Math.cos(since * 14)) * 0.5;
      }
      if (outcome === 'fail' && i === 1 && t > T_CLIP) {
        const s = t - T_CLIP;
        tilt = 0.25 * Math.exp(-2.5 * s) * Math.sin(s * 12);
        dip = 0.2 * Math.exp(-5 * s);
      }
      p.plate.position.y = p.base - dip + 0.03 * Math.sin(time * 1.5 + i);
      p.plate.rotation.x = tilt;
    });
    tail.rotation.y = 0.12 * Math.sin(time * 1.4);
  };
  return {
    group,
    update: (outcome, t) => pose(outcome, t, t),
    ambient: (time) => pose('clear', -1, time),
    reset: () => pose('clear', -1, 0),
  };
}

// ---------- The T. rex ----------

function buildRex(kit: Kit): MegaBuilt {
  const group = new Group();
  profile(
    kit,
    group,
    rexRampY,
    REX.foot,
    REX.lip,
    0.75,
    -1.4,
    REX.rampHalfWidth,
    0x8a6a3a,
    0xe3cf9a,
  );
  const skin = kit.lit(0x9a5a3a, 0.7);
  const belly = kit.lit(0xe3cf9a, 0.7);
  const teeth = kit.lit(0xfffaf0, 0.4);
  const mouth = kit.lit(0x8a2a3a, 0.6);
  // The body stands to one side, its tail trailing away from the course.
  const body = new Group();
  body.position.set(-6.5, 0, -(REX.hinge.d + 5));
  group.add(body);
  blob(kit, body, skin, 4.2, 0, 4.4, 0, 1, 1.2, 1.1);
  blob(kit, body, belly, 3.2, 1.6, 3.8, -1.2, 0.8, 1.1, 1);
  for (const side of [-1, 1]) {
    kit.mesh(new ConeGeometry(1.1, 4.6, 8), skin, body, side * 1.8, 1.8, 0);
    blob(kit, body, skin, 0.7, side * 3.4, 6.0, -2.6, 0.6, 0.6, 1.2);
  }
  kit.mesh(new ConeGeometry(2.0, 9, 8), skin, body, -3.5, 3.0, 5).rotation.x = Math.PI / 2 + 0.2;
  // The neck from the body to the head hinge.
  const neck = blob(kit, group, skin, 2.0, -3.2, 5.5, -(REX.hinge.d + 3), 2.4, 1, 1.8);
  neck.rotation.y = 0.2;
  // The head: the skull behind the hinge and two jaws that swing about it.
  const head = new Group();
  head.position.set(0, REX.hinge.y, -REX.hinge.d);
  group.add(head);
  blob(kit, head, skin, 2.0, 0, 0.6, 1.1, 1.05, 1.0, 1.0);
  eyes(kit, head, 1.05, 1.9, -0.3, 0.32);
  const jaw = (up: boolean) => {
    const g = new Group();
    head.add(g);
    kit.box(2.2, 1.0, REX.jawLength, up ? skin : belly, g, 0, up ? 0.5 : -0.5, -REX.jawLength / 2);
    kit.box(
      1.8,
      0.35,
      REX.jawLength - 0.8,
      mouth,
      g,
      0,
      up ? -0.15 : 0.15,
      -REX.jawLength / 2 - 0.2,
    );
    for (let i = 0; i < 5; i++) {
      for (const side of [-1, 1]) {
        const tooth = kit.mesh(
          new ConeGeometry(0.2, 0.7, 5),
          teeth,
          g,
          side * 0.95,
          up ? -0.55 : 0.55,
          -1.2 - i * 1.15,
        );
        tooth.rotation.x = up ? Math.PI : 0;
      }
    }
    return g;
  };
  const upper = jaw(true);
  const lower = jaw(false);
  const pose = (open: number, time: number) => {
    // Jaws open: rotated about the hinge (x axis); the tips point towards -z (the skier).
    upper.rotation.x = -REX.upperOpen * open;
    lower.rotation.x = REX.lowerOpen * open;
    head.rotation.z = 0.02 * Math.sin(time * 1.5);
    body.scale.y = 1 + 0.02 * Math.sin(time * 1.9);
  };
  const clearOpen = (t: number) => 0.85 + 0.15 * Math.sin(t * 9);
  return {
    group,
    update(outcome, t) {
      if (outcome === 'clear') {
        pose(clearOpen(t), t);
        return;
      }
      // Wide open as the ski comes in, snapped shut on it, held, then opened to spit it out.
      const shut = prog(t, T_CHOMP - 0.15, T_CHOMP, 'i');
      const spit = prog(t, T_SPIT, T_SPIT + 0.2, 'o');
      pose(1 - shut + spit, t);
    },
    ambient: (time) => pose(0.9 + 0.1 * Math.sin(time * 2.2), time),
    reset: () => pose(0.9, 0),
  };
}

export function buildRaptorRapidsProps(kit: Kit): [MegaBuilt, MegaBuilt, MegaBuilt] {
  return [buildNeck(kit), buildStego(kit), buildRex(kit)];
}
