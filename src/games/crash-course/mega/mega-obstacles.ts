/**
 * The Mega courses and the checkpoint gates as three.js objects. A course is a group with its
 * origin at the course's entry line; each of its three elements keeps its props in a group at the
 * element's offset. `update(passed, t)` poses all of them for time t of the stunt that clears
 * `passed` elements: the ones already ridden look finished, the current one follows its own clock
 * and the ones still ahead stay as they were.
 */
import {
  CircleGeometry,
  CylinderGeometry,
  Group,
  MeshBasicMaterial,
  SphereGeometry,
  type Mesh,
} from 'three';
import { Kit, type Cut, type Placed } from '../kit';
import type { MegaId, Passed } from '../rules';
import { TAU } from '../stunts';
import { MEGA_SPECS, megaCuts, megaLength, megaLocate, megaOffsets } from './mega';
import { buildSkyCircusProps } from './sky-circus-props';
import { buildTripleLoopProps, type MegaBuilt } from './triple-loop-props';
import { buildVolcanoRushProps } from './volcano-rush-props';

export interface MegaCourse extends Placed {
  id: MegaId;
  /** Poses all the props for time t of the stunt that clears `passed` elements. */
  update(passed: Passed, t: number): void;
  dispose(): void;
}

const BUILDERS: Record<MegaId, (kit: Kit) => [MegaBuilt, MegaBuilt, MegaBuilt]> = {
  'triple-loop': buildTripleLoopProps,
  'sky-circus': buildSkyCircusProps,
  'volcano-rush': buildVolcanoRushProps,
};

function createMegaCourse(id: MegaId): MegaCourse {
  const kit = new Kit();
  const spec = MEGA_SPECS[id];
  const offsets = megaOffsets(id);
  const object = new Group();
  const elements = BUILDERS[id](kit);
  elements.forEach((element, i) => {
    element.group.position.x = offsets[i];
    object.add(element.group);
  });
  const cuts: readonly Cut[] = megaCuts(id);
  const reset = () => elements.forEach((element) => element.reset());
  reset();
  elements.forEach((element) => element.ambient(0));
  return {
    id,
    object,
    length: megaLength(id),
    cuts,
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

// ---------- Gates ----------

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

/** Half the distance between the posts, and the height of the bar. */
export const GATE_HALF = 2;
export const GATE_HEIGHT = 5;

/**
 * A checkpoint gate: two white posts with a chequered bar, a bulb on top (grey, green when the
 * bike passed, red on a miss) and the question number on a round sign. The origin is the centre
 * of the gate on the road; it stands behind the bike's lane so the bike rides under the bar.
 */
export function createGate(number: number): Gate {
  const kit = new Kit();
  const object = new Group();
  const white = kit.lit(0xf6f6f6, 0.5);
  const black = kit.lit(0x22262e, 0.6);
  const z = -0.8;
  for (const side of [-1, 1]) {
    kit.box(0.3, GATE_HEIGHT, 0.3, white, object, side * GATE_HALF, GATE_HEIGHT / 2, z);
  }
  const tiles = 9;
  for (let i = 0; i < tiles; i++) {
    const tile = i % 2 === 0 ? black : white;
    kit.box(0.5, 0.5, 0.3, tile, object, (i - (tiles - 1) / 2) * 0.5, GATE_HEIGHT + 0.25, z);
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
    GATE_HEIGHT + 1.0,
    z,
  );
  kit.box(0.2, 0.5, 0.2, white, object, 0, GATE_HEIGHT + 0.7, z);
  // The number sign hangs under the bar.
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
  kit.mesh(new CircleGeometry(0.75, 32), face, object, 0, GATE_HEIGHT - 1.0, z + 0.2);
  kit.mesh(
    new CylinderGeometry(0.03, 0.03, 0.5, 6),
    white,
    object,
    -0.35,
    GATE_HEIGHT - 0.3,
    z + 0.1,
  );
  kit.mesh(
    new CylinderGeometry(0.03, 0.03, 0.5, 6),
    white,
    object,
    0.35,
    GATE_HEIGHT - 0.3,
    z + 0.1,
  );

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
    length: GATE_HALF + 0.5,
    cuts: [],
    setState,
    ambient(time) {
      // The idle bulb breathes a little, so the gate looks switched on.
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
