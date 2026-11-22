/**
 * The 6 farm and jungle obstacles (hay, scarecrow, chickens, vine, stones, mud) as meshes. Each
 * builder returns a `Prop` whose `update(outcome, variant, t)` poses it at the same time as the
 * cat's move (`moves/extra.ts`); with a null outcome it is the idle motion, driven by the clock.
 * The river and the mud are flat discs on the floor, so the cat never goes below y = 0.
 */
import { BoxGeometry, ConeGeometry, CylinderGeometry, Group, SphereGeometry } from 'three';
import { type Prop } from '../kit';
import { VINE, armDrop, hayTip, henScatter, vineSwing } from '../moves/extra';
import { beam, cyl, hash, makeProp as prop, sphere } from './parts';

// ---------- Farm ----------

function hay(): Prop {
  return prop((kit, root) => {
    const straw = kit.lit(0xe8c34a, 0.95);
    const band = kit.lit(0x8a5a2a, 0.9);
    const bale = (parent: Group, x: number, y: number, w: number, h: number) => {
      kit.box(w, h, 1.2, straw, parent, x, y + h / 2, -0.3);
      for (const s of [-0.3, 0.3])
        kit.box(0.08, h + 0.04, 1.24, band, parent, x + s * w, y + h / 2, -0.3);
      for (let i = 0; i < 6; i++) {
        kit.box(
          0.5,
          0.04,
          0.04,
          straw,
          parent,
          x + (hash(i) - 0.5) * w,
          y + h * hash(i + 3),
          0.32,
        ).rotation.z = hash(i + 8) - 0.5;
      }
    };
    bale(root, 5.4, 0, 1.2, 1.2);
    bale(root, 6.8, 0, 1.2, 1.2);
    const top = new Group();
    root.add(top);
    bale(top, 0, 0, 1.2, 1.2);
    top.position.set(6.1, 1.2, 0);
    return (outcome, variant, t) => {
      const tip = hayTip(outcome, variant, t);
      top.position.set(6.1 + tip * 1.4, 1.2 - tip * 0.6, 0);
      top.rotation.z = -tip * 1.5;
    };
  });
}

function scarecrow(): Prop {
  return prop((kit, root) => {
    const wood = kit.lit(0x7a5230, 0.9);
    const shirt = kit.lit(0xc0392b, 0.8);
    const straw = kit.lit(0xe8c34a, 0.95);
    cyl(kit, 0.1, 0.1, 3.4, wood, root, 6, 1.7, -0.9);
    const arms = new Group();
    arms.position.set(6, 2.4, -0.7);
    root.add(arms);
    kit.box(2.2, 0.2, 0.2, wood, arms, 0, 0, 0);
    kit.box(0.9, 1.1, 0.35, shirt, root, 6, 1.9, -0.7);
    for (const s of [-1, 1]) {
      kit.box(0.5, 0.4, 0.3, shirt, arms, s * 0.9, 0, 0.05);
      for (let i = 0; i < 4; i++) {
        kit.box(0.05, 0.3, 0.05, straw, arms, s * (1.15 + i * 0.07), -0.25, 0.05).rotation.z =
          0.2 * s;
      }
    }
    sphere(kit, 0.42, kit.lit(0xf2dcb0, 0.8), root, 6, 3.25, -0.7);
    kit.mesh(new CylinderGeometry(0.75, 0.75, 0.06, 16), wood, root, 6, 3.55, -0.7);
    kit.mesh(new CylinderGeometry(0.4, 0.5, 0.55, 16), kit.lit(0x5a3a1a, 0.9), root, 6, 3.85, -0.7);
    for (const s of [-1, 1]) sphere(kit, 0.06, kit.lit(0x222222), root, 6 + s * 0.15, 3.3, -0.3);
    return (outcome, variant, t) => {
      const drop = armDrop(outcome, variant, t);
      arms.rotation.z =
        outcome === null ? 0.08 * Math.sin(t * 1.6) : -drop * 0.7 + 0.04 * Math.sin(t * 3);
    };
  });
}

function chickens(): Prop {
  return prop((kit, root) => {
    const hens: Group[] = [];
    [4.0, 6.0, 8.0].forEach((x, i) => {
      const hen = new Group();
      hen.position.set(x, 0, 0.1);
      root.add(hen);
      const white = kit.lit(i === 1 ? 0xc0562a : 0xfdfdf5, 0.85);
      sphere(kit, 0.5, white, hen, 0, 0.62, 0).scale.set(1.2, 0.95, 0.9);
      sphere(kit, 0.24, white, hen, 0.55, 1.05, 0);
      kit.mesh(
        new ConeGeometry(0.1, 0.25, 5),
        kit.lit(0xf2a22e, 0.6),
        hen,
        0.85,
        1.02,
        0,
      ).rotation.z = -Math.PI / 2;
      kit.box(0.12, 0.14, 0.04, kit.lit(0xd8302a, 0.7), hen, 0.55, 1.32, 0);
      kit.mesh(new SphereGeometry(0.28, 10, 8), white, hen, -0.55, 0.85, 0).scale.set(0.5, 1, 0.7);
      for (const s of [-0.15, 0.15])
        cyl(kit, 0.03, 0.03, 0.2, kit.lit(0xf2a22e, 0.6), hen, s, 0.1, 0);
      sphere(kit, 0.04, kit.lit(0x111111), hen, 0.72, 1.12, 0.2);
      hens.push(hen);
    });
    return (outcome, _variant, t) => {
      const scatter = henScatter(outcome, t);
      hens.forEach((hen, i) => {
        const bob = Math.abs(Math.sin(t * 5 + i * 1.7)) * (outcome === null ? 0.1 : 0.05);
        hen.position.y = bob + scatter * (0.8 + i * 0.4);
        hen.position.x = [4.0, 6.0, 8.0][i] + scatter * (i - 1) * 2.2;
        hen.position.z = 0.1 - scatter * 1.2;
        hen.rotation.z = scatter * (i - 1) * 0.8;
      });
    };
  });
}

// ---------- Jungle ----------

function vine(): Prop {
  return prop((kit, root) => {
    // A dark pit under the vine (flat on the floor).
    kit.mesh(new CylinderGeometry(2.0, 2.0, 0.04, 24), kit.lit(0x1b1208, 0.95), root, 6.4, 0.02, 0);
    const branch = kit.lit(0x6a4a2a, 0.9);
    kit.box(4.2, 0.35, 0.5, branch, root, VINE.x, VINE.top + 0.1, -1.0);
    const leaf = kit.lit(0x2f9a4a, 0.8);
    for (let i = 0; i < 6; i++) {
      sphere(kit, 0.4, leaf, root, VINE.x - 1.8 + i * 0.72, VINE.top + 0.35, -1.0).scale.y = 0.6;
    }
    const swing = new Group();
    swing.position.set(VINE.x, VINE.top, -0.5);
    root.add(swing);
    const rope = kit.lit(0x4a8a2a, 0.85);
    const segs = 6;
    for (let i = 0; i < segs; i++) {
      cyl(
        kit,
        0.07,
        0.07,
        VINE.length / segs + 0.04,
        rope,
        swing,
        0,
        -(i + 0.5) * (VINE.length / segs),
        0,
      );
      if (i % 2 === 0) {
        sphere(kit, 0.2, leaf, swing, 0.15, -(i + 0.5) * (VINE.length / segs), 0.05).scale.y = 0.5;
      }
    }
    sphere(kit, 0.16, kit.lit(0xf2c230, 0.6), swing, 0, -VINE.length - 0.05, 0);
    return (outcome, variant, t) => {
      swing.rotation.z = -vineSwing(outcome, variant, t);
    };
  });
}

function stones(): Prop {
  return prop((kit, root) => {
    const water = kit.lit(0x3aa0d8, 0.35);
    kit.mesh(new BoxGeometry(5.6, 0.04, 2.6), water, root, 6.4, 0.02, -0.2);
    const foam = kit.basic(0xe8f8ff, 0.8);
    const ripples = [4.4, 6.2, 8.2].map((x) => {
      const r = kit.mesh(
        new CylinderGeometry(0.75, 0.75, 0.02, 16),
        foam,
        root,
        x + 0.1,
        0.05,
        0.5,
      );
      r.scale.set(1, 1, 0.5);
      return r;
    });
    const rock = kit.lit(0x8a8a90, 0.95);
    [4.6, 6.4, 8.2].forEach((x, i) => {
      kit.mesh(new CylinderGeometry(0.55, 0.65, 0.3, 10), rock, root, x, 0.15, 0);
      sphere(kit, 0.12, kit.lit(0x4a8a3a, 0.9), root, x - 0.2, 0.3, 0.2).scale.y = 0.4;
      void i;
    });
    return (outcome, _variant, t) => {
      ripples.forEach((r, i) => {
        const k = (Math.sin(t * 2 + i) + 1) / 2;
        r.scale.set(1 + 0.2 * k, 1, 0.5 + 0.1 * k);
      });
      void outcome;
    };
  });
}

function mud(): Prop {
  return prop((kit, root) => {
    const brown = kit.lit(0x6a4526, 0.5);
    const puddle = kit.mesh(new CylinderGeometry(2.1, 2.1, 0.06, 24), brown, root, 6.2, 0.03, 0);
    puddle.scale.z = 0.55;
    const bubbles = [5.3, 6.4, 7.2].map((x, i) => {
      const b = sphere(kit, 0.18, kit.lit(0x8a6038, 0.3), root, x, 0.1, 0.1 + i * 0.05);
      b.scale.y = 0.7;
      return b;
    });
    // A little palm leaf and a rock at the edge.
    kit
      .mesh(new SphereGeometry(0.45, 10, 8), kit.lit(0x8a8a90, 0.95), root, 3.8, 0.2, -0.4)
      .scale.set(1.3, 0.7, 1);
    beam(kit, kit.lit(0x2f9a4a, 0.8), root, [8.6, 0], [8.9, 0.8], 0.08, -0.3);
    return (outcome, _variant, t) => {
      bubbles.forEach((b, i) => {
        const k = (t * (outcome === null ? 0.6 : 1.2) + i * 0.37) % 1;
        b.position.y = 0.1 + 0.18 * Math.sin(Math.PI * k);
        b.scale.setScalar(0.6 + 0.8 * Math.sin(Math.PI * k));
      });
    };
  });
}

void hash;

/** One builder per obstacle id. */
export const EXTRA_PROPS = { hay, scarecrow, chickens, vine, stones, mud } as const;
