/**
 * One built prop per obstacle of the current place and the next; a place's props are disposed
 * when it is left.
 */
import { MeshBasicMaterial, type Mesh } from 'three';
import type { ObstacleId } from '../places';
import type { Prop } from '../kit';
import { addOutline, OUTLINE_PROP_PX, type Outline } from '../outline';
import { HOUSE_PROPS } from './house';
import { TOWN_PROPS } from './town';
import { BUSY_PROPS } from './busy';
import { ADVENTURE_PROPS } from './adventure';
import { EXTRA_PROPS } from './extra';
import { TOYS_PIRATES_PROPS } from './toys-pirates';
import { ZOO_PROPS } from './zoo';

export const PROP_BUILDERS: Record<ObstacleId, () => Prop> = {
  ...HOUSE_PROPS,
  ...TOWN_PROPS,
  ...BUSY_PROPS,
  ...ADVENTURE_PROPS,
  ...EXTRA_PROPS,
  ...TOYS_PIRATES_PROPS,
  ...ZOO_PROPS,
};

export interface PropPool {
  get(id: ObstacleId): Prop;
  /** Disposes every prop that is not in `keep`. */
  prune(keep: readonly ObstacleId[]): void;
  /** Shows or hides every prop's ink outline (the quality tier); props built later follow it. */
  setOutlines(on: boolean): void;
  dispose(): void;
}

/** Props cast and receive real shadows (not glass, glow or other see-through bits). */
function castAndReceive(prop: Prop): void {
  prop.object.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const m = mesh.material as { transparent?: boolean };
    const solid = !m.transparent && !(mesh.material instanceof MeshBasicMaterial);
    mesh.castShadow = solid;
    mesh.receiveShadow = true;
  });
}

export function createPropPool(outlines = true): PropPool {
  const built = new Map<ObstacleId, Prop>();
  const inks = new Map<ObstacleId, Outline>();
  let inkOn = outlines;
  const drop = (id: ObstacleId, prop: Prop) => {
    inks.get(id)?.dispose();
    inks.delete(id);
    prop.dispose();
  };
  return {
    get(id) {
      let prop = built.get(id);
      if (!prop) {
        prop = PROP_BUILDERS[id]();
        castAndReceive(prop);
        const ink = addOutline(prop.object, OUTLINE_PROP_PX);
        ink.setVisible(inkOn);
        inks.set(id, ink);
        built.set(id, prop);
      }
      return prop;
    },
    prune(keep) {
      for (const [id, prop] of built) {
        if (keep.includes(id)) continue;
        drop(id, prop);
        built.delete(id);
      }
    },
    setOutlines(on) {
      inkOn = on;
      for (const ink of inks.values()) ink.setVisible(on);
    },
    dispose() {
      for (const [id, prop] of built) drop(id, prop);
      built.clear();
    },
  };
}
