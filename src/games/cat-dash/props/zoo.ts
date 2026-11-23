/**
 * The 3 zoo obstacles (elephant, giraffe, penguins) as meshes. Each builder returns a `Prop`
 * whose `update(outcome, variant, t)` poses it at the same time as the cat's move
 * (`moves/zoo.ts`); with a null outcome it is the idle motion, driven by the clock. The animals
 * are chunky and cute like the cat: round heads, big eyes with glints. They stand at z = 0 or
 * behind it, so the cat runs in front of them (or between the legs of the tall ones).
 */
import { ConeGeometry, CylinderGeometry, Group, type Mesh } from 'three';
import type { Kit, Prop } from '../kit';
import {
  ICE,
  NECK,
  PENGUIN_X,
  TRUNK,
  earFlap,
  giraffeHead,
  neckBend,
  neckJoints,
  penguinPose,
  tongueOut,
  trunkCurl,
  trunkJoints,
  type Point,
} from '../moves/zoo';
import { cyl, hash, makeProp as prop, sphere } from './parts';

/** Puts a cylinder (made along y) between two points of the xy plane. */
function between(m: Mesh, a: Point, b: Point, z: number) {
  m.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, z);
  m.rotation.z = Math.atan2(-(b.x - a.x), b.y - a.y);
  m.scale.y = Math.hypot(b.x - a.x, b.y - a.y);
}

/** A big eye with a glint, on the near side of a head. */
function eye(kit: Kit, parent: Group, x: number, y: number, z: number, r = 0.13) {
  sphere(kit, r, kit.lit(0xffffff, 0.3), parent, x, y, z);
  sphere(kit, r * 0.62, kit.lit(0x16161c, 0.2), parent, x + r * 0.15, y - r * 0.05, z + r * 0.55);
  sphere(kit, r * 0.2, kit.basic(0xffffff), parent, x + r * 0.3, y + r * 0.2, z + r * 0.95);
}

// ---------- Elephant ----------

function elephant(): Prop {
  return prop((kit, root) => {
    const grey = kit.lit(0x9aa6b2, 0.7);
    const dark = kit.lit(0x7f8b98, 0.75);
    const pink = kit.lit(0xf0a8b4, 0.6);
    const ivory = kit.lit(0xfff3d6, 0.4);
    // Body and head.
    sphere(kit, 1, grey, root, 7.2, 2.3, -0.1).scale.set(1.7, 1.25, 1.0);
    sphere(kit, 0.88, grey, root, 5.1, 2.75, -0.1);
    // Four chunky legs, a pair on each side of the cat's lane.
    for (const x of [6.1, 8.3]) {
      for (const z of [-0.6, 0.55]) {
        cyl(kit, 0.4, 0.42, 1.5, grey, root, x, 0.75, z);
        kit.mesh(new CylinderGeometry(0.43, 0.43, 0.14, 14), dark, root, x, 0.07, z);
      }
    }
    // Tail with a tuft.
    const tail = new Group();
    tail.position.set(8.85, 2.9, -0.1);
    root.add(tail);
    cyl(kit, 0.06, 0.05, 1.1, dark, tail, 0.1, -0.5, 0);
    sphere(kit, 0.14, dark, tail, 0.1, -1.15, 0).scale.y = 1.4;
    // Ears on both sides, hinged at the back of the head.
    const ears = [-1, 1].map((s) => {
      const hinge = new Group();
      hinge.position.set(5.55, 3.0, -0.1 + s * 0.7);
      root.add(hinge);
      sphere(kit, 0.75, dark, hinge, 0.2, -0.1, 0).scale.set(0.9, 1.0, 0.13);
      sphere(kit, 0.5, pink, hinge, 0.2, -0.1, s * 0.1).scale.set(0.9, 1.0, 0.1);
      return { hinge, s };
    });
    // The face on the near side: eye, cheek and tusks.
    eye(kit, root, 4.55, 3.1, 0.7, 0.15);
    sphere(kit, 0.17, pink, root, 4.6, 2.6, 0.72).scale.set(1, 0.7, 0.3);
    for (const z of [-0.35, 0.4]) {
      kit.mesh(new ConeGeometry(0.1, 0.7, 8), ivory, root, 4.3, 2.0, z).rotation.z = 0.5;
    }
    // The trunk: six tapering segments with a round joint each, posed every frame.
    const segs = Array.from({ length: TRUNK.count }, (_, i) => {
      const r = 0.34 - i * 0.03;
      const cylMesh = kit.mesh(new CylinderGeometry(r * 0.92, r, 1, 12), grey, root);
      const joint = sphere(kit, r, grey, root);
      return { cylMesh, joint };
    });
    const tipJoint = sphere(kit, 0.17, dark, root);
    // Water drops sprayed from the tip.
    const water = kit.lit(0x6fc8f2, 0.2);
    const drops = Array.from({ length: 12 }, () => sphere(kit, 0.1, water, root));
    return (outcome, variant, t) => {
      const curl = trunkCurl(outcome, variant, t);
      const joints = trunkJoints(curl.a0, curl.bend);
      segs.forEach((s, i) => {
        between(s.cylMesh, joints[i], joints[i + 1], 0.1);
        s.cylMesh.scale.x = s.cylMesh.scale.z = 1;
        s.joint.position.set(joints[i + 1].x, joints[i + 1].y, 0.1);
      });
      const tip = joints[TRUNK.count];
      tipJoint.position.set(tip.x, tip.y, 0.1);
      const flap = earFlap(outcome, t);
      for (const e of ears) e.hinge.rotation.y = e.s * flap;
      tail.rotation.z = 0.2 * Math.sin(t * 2.4);
      drops.forEach((d, j) => {
        const u = (t * 2.2 + j / drops.length) % 1;
        d.visible = curl.spray > 0.05;
        d.position.set(
          tip.x - 0.25 + 0.35 * u + 0.05 * hash(j),
          tip.y - (tip.y - 0.6) * u * u,
          0.1 + (hash(j + 4) - 0.5) * 0.3,
        );
        d.scale.setScalar(curl.spray * 1.6);
      });
    };
  });
}

// ---------- Giraffe ----------

function giraffe(): Prop {
  return prop((kit, root) => {
    const gold = kit.lit(0xf2c14a, 0.7);
    const spot = kit.lit(0xa8662a, 0.8);
    const dark = kit.lit(0x5a3a1a, 0.7);
    // Body, hump and four long legs, a pair on each side of the cat's lane.
    sphere(kit, 1, gold, root, 7.6, 2.8, -0.1).scale.set(1.5, 0.8, 0.65);
    for (const x of [6.5, 8.7]) {
      for (const z of [-0.5, 0.5]) {
        cyl(kit, 0.2, 0.22, 2.2, gold, root, x, 1.1, z);
        kit.mesh(new CylinderGeometry(0.24, 0.24, 0.16, 12), dark, root, x, 0.08, z);
      }
    }
    // Spots on the near flank.
    for (let i = 0; i < 9; i++) {
      const x = 6.7 + hash(i) * 1.9;
      const y = 2.5 + hash(i + 5) * 0.7;
      sphere(kit, 0.2 + 0.1 * hash(i + 9), spot, root, x, y, 0.5).scale.z = 0.2;
    }
    // Tail with a tuft.
    const tail = new Group();
    tail.position.set(9.05, 3.0, -0.1);
    root.add(tail);
    cyl(kit, 0.05, 0.04, 1.3, gold, tail, 0.1, -0.6, 0);
    sphere(kit, 0.14, dark, tail, 0.1, -1.3, 0).scale.y = 1.3;
    // The neck: five segments, each with a spot, posed every frame.
    const segs = Array.from({ length: NECK.count }, (_, i) => {
      const r = 0.34 - i * 0.025;
      const g = new Group();
      root.add(g);
      const tube = kit.mesh(new CylinderGeometry(r * 0.9, r, 1, 12), gold, g);
      sphere(kit, r, gold, g, 0, NECK.seg / 2, 0);
      sphere(kit, 0.13, spot, g, 0, 0, r * 0.95).scale.z = 0.25;
      return { g, tube };
    });
    // The head: skull, snout, horns, ear, eye. It points along its own +y; +x is its top.
    const head = new Group();
    root.add(head);
    sphere(kit, 0.4, gold, head).scale.set(0.95, 1.15, 0.85);
    sphere(kit, 0.27, gold, head, 0, 0.5, 0).scale.set(0.9, 1.0, 0.85);
    sphere(kit, 0.08, dark, head, 0.05, 0.75, 0.12);
    for (const z of [-0.12, 0.12]) {
      cyl(kit, 0.045, 0.045, 0.3, gold, head, 0.38, -0.1, z).rotation.z = -0.3;
      sphere(kit, 0.075, dark, head, 0.46, 0.04, z);
    }
    sphere(kit, 0.15, gold, head, 0.28, -0.22, 0.3).scale.set(1.5, 0.7, 0.4);
    eye(kit, head, 0.08, 0.14, 0.31, 0.12);
    sphere(kit, 0.1, spot, head, 0.2, 0.0, 0.3).scale.z = 0.3;
    // The tongue: from the mouth towards the cat's lane, when it licks.
    const tongue = kit.mesh(new CylinderGeometry(0.1, 0.1, 1, 10), kit.lit(0xf06a8c, 0.4), root);
    const tongueTip = sphere(kit, 0.12, kit.lit(0xf06a8c, 0.4), root);
    return (outcome, variant, t) => {
      const psi = neckBend(outcome, variant, t);
      const joints = neckJoints(psi);
      segs.forEach(({ g, tube }, i) => {
        const a = joints[i];
        const b = joints[i + 1];
        g.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, 0);
        g.rotation.z = Math.atan2(-(b.x - a.x), b.y - a.y);
        tube.scale.y = Math.hypot(b.x - a.x, b.y - a.y);
      });
      const h = giraffeHead(psi);
      head.position.set(h.x, h.y, 0);
      head.rotation.z = h.angle;
      tail.rotation.z = 0.15 * Math.sin(t * 2);
      const k = tongueOut(outcome, variant, t);
      tongue.visible = tongueTip.visible = k > 0.02;
      if (k > 0.02) {
        const mouth = { x: h.x - Math.sin(h.angle) * 0.7, y: h.y + Math.cos(h.angle) * 0.7 };
        const end = {
          x: mouth.x + (3.55 - mouth.x) * k + 0.1 * Math.sin(t * 14),
          y: mouth.y + (0.9 - mouth.y) * k,
        };
        between(tongue, mouth, end, 0.15);
        tongueTip.position.set(end.x, end.y, 0.15);
      }
    };
  });
}

// ---------- Penguins ----------

function penguins(): Prop {
  return prop((kit, root) => {
    // The ice, flat on the floor, with a few shine marks.
    const ice = kit.basic(0xc4ecff);
    const mid = (ICE.from + ICE.to) / 2;
    kit
      .mesh(new CylinderGeometry(1, 1, 0.06, 28), ice, root, mid, 0.03, -0.1)
      .scale.set((ICE.to - ICE.from) / 2 + 0.2, 1, 1.8);
    const shine = kit.basic(0xffffff, 0.8);
    for (let i = 0; i < 5; i++) {
      kit.box(
        0.7 + hash(i) * 0.5,
        0.012,
        0.05,
        shine,
        root,
        ICE.from + 0.9 + i * 1.3,
        0.066,
        0.5 - hash(i + 3),
      );
    }
    const navy = kit.lit(0x2b3550, 0.6);
    const white = kit.lit(0xf6f8fc, 0.6);
    const orange = kit.lit(0xf2a22e, 0.55);
    const birds = PENGUIN_X.map((_, i) => {
      const bird = new Group();
      root.add(bird);
      const tilt = new Group();
      tilt.position.y = 0.6;
      bird.add(tilt);
      // Everything is built standing, relative to the tilt pivot at belly height.
      sphere(kit, 0.62, navy, tilt, 0, 0.3, 0).scale.set(0.8, 1.05, 0.72);
      sphere(kit, 0.5, white, tilt, 0.17, 0.25, 0.14).scale.set(0.7, 1.0, 0.55);
      sphere(kit, 0.4, navy, tilt, 0.08, 1.2, 0);
      sphere(kit, 0.27, white, tilt, 0.2, 1.12, 0.12).scale.set(0.8, 0.85, 0.6);
      eye(kit, tilt, 0.27, 1.32, 0.25, 0.1);
      kit.mesh(new ConeGeometry(0.11, 0.3, 8), orange, tilt, 0.5, 1.2, 0.02).rotation.z =
        -Math.PI / 2;
      const flip = [-1, 1].map((s) => {
        const hinge = new Group();
        hinge.position.set(-0.05, 0.75, s * 0.5);
        tilt.add(hinge);
        sphere(kit, 0.34, navy, hinge, 0, -0.3, 0).scale.set(0.25, 1.0, 0.45);
        return { hinge, s };
      });
      for (const z of [-0.2, 0.2]) {
        kit.box(0.45, 0.08, 0.26, orange, tilt, 0.08, -0.56, z);
      }
      return { bird, tilt, flip, i };
    });
    return (outcome, variant, t) => {
      for (const b of birds) {
        const p = penguinPose(outcome, variant, t, b.i);
        const slidingBack = outcome === 'fail' && variant === 1;
        b.bird.position.set(p.x, 0, p.z);
        b.bird.scale.x = slidingBack ? -1 : 1;
        b.tilt.rotation.z = -p.lie * (Math.PI / 2 - 0.05) + p.sway * (1 - p.lie);
        b.tilt.position.y = 0.6 - 0.12 * p.lie;
        b.tilt.scale.y = p.sy;
        const bob = Math.abs(Math.sin(t * 6 + b.i * 2.1)) * 0.05 * (1 - p.lie);
        b.bird.position.y = bob;
        for (const f of b.flip) {
          f.hinge.rotation.z = f.s * (0.35 + 0.35 * Math.sin(t * 8 + b.i) + p.lie * 1.0);
        }
      }
    };
  });
}

/** One builder per obstacle id. */
export const ZOO_PROPS = { elephant, giraffe, penguins } as const;
