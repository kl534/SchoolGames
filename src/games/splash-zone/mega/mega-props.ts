/**
 * The Mega courses and the checkpoint gates as three.js objects. A course is a group with its
 * origin at the course's entry line on the water (it reaches forward, -z); each of its three
 * elements keeps its props in a group at the element's offset. `update(passed, t)` poses all of
 * them for time `t` of the stunt that clears `passed` elements: the ones already ridden look
 * finished, the current one follows its own clock and the ones still ahead stay as they were.
 */
import {
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  MeshBasicMaterial,
  PlaneGeometry,
  SphereGeometry,
  type Mesh,
} from 'three';
import { TAU } from '../anim';
import { Kit, type Placed } from '../kit';
import type { MegaId, Passed } from '../rules';
import { buildGeyserBlastProps } from './geyser-blast-props';
import { buildHarbourHavocProps } from './harbour-havoc-props';
import { buildJawsSomeJumpProps } from './jaws-some-jump-props';
import { buildPenguinParadeProps } from './penguin-parade-props';
import { buildRaptorRapidsProps } from './raptor-rapids-props';
import { buildSweetToothRushProps } from './sweet-tooth-rush-props';
import { MEGA_SPECS, megaLength, megaLocate, megaOffsets } from './mega';
import type { MegaBuilt } from './props-kit';
import { buildWhaleProps } from './whale-of-a-time-props';

export interface MegaCourse extends Placed {
  id: MegaId;
  /** Poses all the props for time t of the stunt that clears `passed` elements. */
  update(passed: Passed, t: number): void;
  dispose(): void;
}

const BUILDERS: Record<MegaId, (kit: Kit) => [MegaBuilt, MegaBuilt, MegaBuilt]> = {
  'whale-of-a-time': buildWhaleProps,
  'raptor-rapids': buildRaptorRapidsProps,
  'harbour-havoc': buildHarbourHavocProps,
  'penguin-parade': buildPenguinParadeProps,
  'geyser-blast': buildGeyserBlastProps,
  'jaws-some-jump': buildJawsSomeJumpProps,
  'sweet-tooth-rush': buildSweetToothRushProps,
};

function createMegaCourse(id: MegaId): MegaCourse {
  const kit = new Kit();
  const spec = MEGA_SPECS[id];
  const offsets = megaOffsets(id);
  const object = new Group();
  const elements = BUILDERS[id](kit);
  elements.forEach((element, i) => {
    element.group.position.z = -offsets[i];
    object.add(element.group);
  });
  const reset = () => elements.forEach((element) => element.reset());
  reset();
  elements.forEach((element) => element.ambient(0));
  object.visible = false;
  return {
    id,
    object,
    length: megaLength(id),
    cuts: [],
    update(passed, t) {
      const seg = megaLocate(id, passed, t);
      elements.forEach((element, i) => {
        if (i < seg.index) element.update('clear', spec.elements[i].clear.duration);
        else if (i === seg.index) element.update(seg.outcome, seg.localT);
        else element.reset();
      });
    },
    ambient: (time) => elements.forEach((element) => element.ambient(time)),
    reset,
    dispose() {
      object.removeFromParent();
      kit.dispose();
    },
  };
}

/** Keeps one built course per id, made when first needed, so a long ride never allocates. */
export function createMegaCoursePool(): { get(id: MegaId): MegaCourse; dispose(): void } {
  const made = new Map<MegaId, MegaCourse>();
  return {
    get(id) {
      let course = made.get(id);
      if (!course) {
        course = createMegaCourse(id);
        made.set(id, course);
      }
      return course;
    },
    dispose() {
      made.forEach((course) => course.dispose());
      made.clear();
    },
  };
}

// ---------- Checkpoint gates ----------

export type GateState = 'idle' | 'pass' | 'miss';

export interface Gate extends Placed {
  readonly number: number;
  setState(state: GateState): void;
  dispose(): void;
}

const GATE_COLORS: Record<GateState, number> = {
  idle: 0x8b93a7,
  pass: 0x39d353,
  miss: 0xff3b3b,
};

/** Half the distance between the buoys, and the height of the banner arch. */
export const GATE_HALF = 3.2;
export const GATE_HEIGHT = 5.2;

/**
 * A checkpoint gate: two striped buoys with a banner arch between them (a bulb on top that is
 * grey, green when the ski passed and red on a miss, and the question number on a round sign). The
 * origin is the middle of the gate on the water; the ski rides between the buoys, under the banner.
 */
export function createGate(number: number): Gate {
  const kit = new Kit();
  const object = new Group();
  const red = kit.lit(0xe8403a, 0.55);
  const white = kit.lit(0xf6f6f6, 0.5);
  const dark = kit.lit(0x22262e, 0.6);
  const buoys: Group[] = [];
  for (const side of [-1, 1]) {
    const buoy = new Group();
    buoy.position.set(side * GATE_HALF, 0, 0);
    object.add(buoy);
    // Three stripes, a cone on top to hold the mast and a little mast carrying the banner.
    for (let i = 0; i < 3; i++) {
      kit.mesh(
        new CylinderGeometry(0.62 - i * 0.09, 0.7 - i * 0.09, 0.62, 16),
        i % 2 === 0 ? red : white,
        buoy,
        0,
        0.2 + i * 0.62,
        0,
      );
    }
    kit.mesh(new ConeGeometry(0.4, 0.7, 14), red, buoy, 0, 2.4, 0);
    kit.mesh(
      new CylinderGeometry(0.07, 0.07, GATE_HEIGHT - 2.6, 8),
      white,
      buoy,
      0,
      2.7 + (GATE_HEIGHT - 2.6) / 2,
      0,
    );
    kit.mesh(new SphereGeometry(0.16, 10, 8), red, buoy, 0, GATE_HEIGHT + 0.25, 0);
    buoys.push(buoy);
  }
  // The banner between the masts: chequered, with the number sign hanging from its middle.
  const tiles = 14;
  const span = GATE_HALF * 2;
  for (let i = 0; i < tiles; i++) {
    const tile = i % 2 === 0 ? dark : white;
    kit.box(
      span / tiles,
      0.6,
      0.12,
      tile,
      object,
      ((i + 0.5) / tiles - 0.5) * span,
      GATE_HEIGHT - 0.1,
      0,
    );
  }
  const bulbs: Record<GateState, MeshBasicMaterial> = {
    idle: kit.basic(GATE_COLORS.idle),
    pass: kit.basic(GATE_COLORS.pass),
    miss: kit.basic(GATE_COLORS.miss),
  };
  const bulb: Mesh = kit.mesh(
    new SphereGeometry(0.5, 16, 12),
    bulbs.idle,
    object,
    0,
    GATE_HEIGHT + 0.85,
    0,
  );
  kit.box(0.2, 0.5, 0.2, white, object, 0, GATE_HEIGHT + 0.42, 0);
  const texture = kit.paint(128, 128, (g) => {
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(64, 64, 62, 0, TAU);
    g.fill();
    g.fillStyle = '#1e3c8c';
    g.beginPath();
    g.arc(64, 64, 52, 0, TAU);
    g.fill();
    g.fillStyle = '#ffffff';
    g.font = 'bold 84px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(number), 64, 70);
  });
  const face = new MeshBasicMaterial(texture ? { map: texture } : { color: 0x1e3c8c });
  kit.materials.push(face);
  kit.mesh(new CircleGeometry(0.85, 32), face, object, 0, GATE_HEIGHT - 1.3, 0.1);
  kit.mesh(new PlaneGeometry(0.06, 0.6), white, object, 0, GATE_HEIGHT - 0.55, 0.08);

  let state: GateState = 'idle';
  const setState = (next: GateState) => {
    state = next;
    bulb.material = bulbs[next];
    bulb.scale.setScalar(next === 'idle' ? 1 : 1.2);
  };
  setState('idle');
  object.visible = false;
  return {
    number,
    object,
    length: GATE_HALF + 0.7,
    cuts: [],
    setState,
    ambient(time) {
      // The buoys bob on the swell and the idle bulb breathes a little, so the gate looks on.
      buoys.forEach((buoy, i) => {
        buoy.position.y = 0.05 * Math.sin(time * 2 + i * 1.9);
        buoy.rotation.z = 0.05 * Math.sin(time * 1.6 + i);
      });
      if (state === 'idle') bulb.scale.setScalar(1 + 0.08 * Math.sin(time * 4));
    },
    reset() {
      setState('idle');
    },
    dispose() {
      object.removeFromParent();
      kit.dispose();
    },
  };
}
