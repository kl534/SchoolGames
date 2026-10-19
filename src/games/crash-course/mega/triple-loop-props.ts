/**
 * The props of the Triple Loop: three bright track hoops (blue, orange, red) on pillars with
 * chequered bases, each with a ring of bulbs that light up as the bike goes round (the GIANT one
 * flashes all of them when the bike gets to the top), and a number sign saying which loop it is.
 * Bright painted primitives like obstacles.ts; everything is built once and only moved.
 */
import {
  CircleGeometry,
  Group,
  MeshBasicMaterial,
  SphereGeometry,
  TorusGeometry,
  type Mesh,
} from 'three';
import { clamp01, type Kit } from '../kit';
import { createFrame, TAU, type Frame } from '../stunts';
import { LOOPS, TRIPLE_LOOP } from './triple-loop';

/** One element's props, in element-local coordinates (origin at its entry line on the road). */
export interface MegaBuilt {
  group: Group;
  /** Poses the props for time `localT` of the element's clear or crash. */
  update(outcome: 'clear' | 'crash', localT: number): void;
  /** Idle motion: the chasing bulbs, the flashing finale. */
  ambient(time: number): void;
  /** Puts every prop back as it was before the stunt. */
  reset(): void;
}

const HOOP_COLORS = [0x1e66d6, 0xff8a1f, 0xe8403a] as const;
const BULBS_PER_UNIT = 4.2;

/** A round sign with the element's number painted on it (plain where there is no canvas). */
function numberSign(kit: Kit, n: number, color: number): MeshBasicMaterial {
  const texture = kit.paint(128, 128, (g) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    g.beginPath();
    g.arc(64, 64, 54, 0, TAU);
    g.fill();
    g.fillStyle = '#ffffff';
    g.font = 'bold 84px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(n), 64, 70);
  });
  const material = new MeshBasicMaterial(texture ? { map: texture } : { color });
  kit.materials.push(material);
  return material;
}

function buildLoop(kit: Kit, index: 0 | 1 | 2): MegaBuilt {
  const g = LOOPS[index];
  const element = TRIPLE_LOOP.elements[index];
  const finale = index === 2;
  const group = new Group();
  const hoop = kit.lit(HOOP_COLORS[index], 0.4);
  const yellow = kit.lit(0xffd43b, 0.5);
  const steel = kit.lit(0x8791a8, 0.5);
  const black = kit.lit(0x22262e, 0.6);
  const white = kit.lit(0xf6f6f6, 0.6);
  const cy = g.R;

  // The track: a hoop with yellow chevron plates on its surface.
  const ring = kit.mesh(new TorusGeometry(g.R + 0.2, 0.2, 10, 80), hoop, group, g.cx, cy, -0.5);
  ring.scale.z = 3.2;
  const plates = Math.round(g.R * 9.3);
  for (let i = 0; i < plates; i++) {
    const phi = (i / plates) * TAU;
    const plate = kit.box(0.34, 0.05, 1.0, yellow, group);
    plate.position.set(
      g.cx + Math.sin(phi) * (g.R - 0.01),
      cy - Math.cos(phi) * (g.R - 0.01),
      -0.5,
    );
    plate.rotation.z = phi;
  }

  // Legs holding the hoop up behind it, on chequered bases.
  const legH = 1.5 * g.R;
  for (const side of [-1, 1]) {
    const foot = g.cx + side * (g.R + 0.9);
    const leg = kit.box(0.28, legH, 0.28, steel, group, foot - side * 0.25, legH / 2, -1.4);
    leg.rotation.z = side * 0.18;
    kit.box(0.2, 0.2, 1.8, steel, group, g.cx + side * (g.R * 0.92), cy * 0.9, -0.95);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 2; j++) {
        const tile = (i + j) % 2 === 0 ? black : white;
        kit.box(
          0.3,
          0.3,
          0.9,
          tile,
          group,
          foot - side * 0.25 + (i - 1.5) * 0.3,
          0.15 + j * 0.3,
          -1.4,
        );
      }
    }
  }
  kit.box(2 * g.R + 1.8, 0.22, 0.22, steel, group, g.cx, 2 * g.R + 0.35, -1.4);

  // The GIANT loop also has two tall lit pillars either side.
  if (finale) {
    for (const side of [-1, 1]) {
      const px = g.cx + side * (g.R + 2.2);
      kit.box(0.4, 6.0, 0.4, white, group, px, 3.0, -1.1);
      kit.mesh(new SphereGeometry(0.22, 12, 8), kit.basic(0xffe066), group, px, 6.2, -1.1);
      for (let k = 1; k <= 4; k++) {
        kit.mesh(new SphereGeometry(0.1, 8, 6), kit.basic(0xff4fa0), group, px, k * 1.25, -0.88);
      }
    }
  }

  // The number sign on its own post, to the left of the hoop.
  const signX = g.cx - g.R - 2.0;
  kit.box(0.14, 2.0, 0.14, steel, group, signX, 1.0, -0.95);
  kit.mesh(
    new CircleGeometry(0.8, 32),
    numberSign(kit, index + 1, HOOP_COLORS[index]),
    group,
    signX,
    2.5,
    -0.9,
  );
  kit.box(1.7, 1.7, 0.08, white, group, signX, 2.5, -0.97);

  // The ring of bulbs on the front of the hoop.
  const count = Math.round(g.R * BULBS_PER_UNIT * 2);
  const off = kit.basic(0x4d566e);
  const on = kit.basic(0xffe066);
  const flash = kit.basic(0xff4fa0);
  const bulbs: Mesh[] = [];
  const bulbGeometry = new SphereGeometry(0.14, 10, 8);
  for (let i = 0; i < count; i++) {
    const phi = ((i + 0.5) / count) * TAU;
    const bulb = kit.mesh(
      bulbGeometry,
      off,
      group,
      g.cx + Math.sin(phi) * (g.R + 0.2),
      cy - Math.cos(phi) * (g.R + 0.2),
      0.2,
    );
    bulbs.push(bulb);
  }

  // State: how far round the bike has been, and whether the finale is flashing.
  let reached = 0;
  let flashing = false;
  const light = (k: number) => {
    bulbs.forEach((bulb, i) => {
      bulb.material = (i + 0.5) / count <= k ? on : off;
    });
  };
  const scratch: Frame = createFrame();
  /** The furthest round the circle the bike has got by `localT`, as a fraction of a turn. */
  const furthest = (outcome: 'clear' | 'crash', localT: number) => {
    const def = outcome === 'clear' ? element.clear : element.crash;
    let best = 0;
    const end = Math.min(localT, def.duration);
    for (let t = 0; t <= end + 1e-9; t += 1 / 30) {
      scratch.bike.pitch = 0;
      def.at(t, scratch);
      best = Math.max(best, clamp01(scratch.bike.pitch / TAU));
    }
    def.at(end, scratch);
    return Math.max(best, clamp01(scratch.bike.pitch / TAU));
  };

  return {
    group,
    update(outcome, localT) {
      reached = furthest(outcome, localT);
      flashing = finale && outcome === 'clear' && localT >= element.clear.beats.top;
      if (!flashing) light(reached);
    },
    ambient(time) {
      if (flashing) {
        const alt = Math.floor(time * 7) % 2;
        bulbs.forEach((bulb, i) => {
          bulb.material = (i + alt) % 2 === 0 ? flash : on;
        });
      } else if (reached === 0) {
        // Idle: a few bulbs chase round the hoop.
        const step = Math.floor(time * 6);
        bulbs.forEach((bulb, i) => {
          bulb.material = (i + step) % 5 === 0 ? on : off;
        });
      }
    },
    reset() {
      reached = 0;
      flashing = false;
      light(0);
    },
  };
}

/** The three hoops of the Triple Loop, in order. */
export function buildTripleLoopProps(kit: Kit): [MegaBuilt, MegaBuilt, MegaBuilt] {
  return [buildLoop(kit, 0), buildLoop(kit, 1), buildLoop(kit, 2)];
}
