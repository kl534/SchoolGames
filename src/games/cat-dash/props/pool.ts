/**
 * One built prop per obstacle of the current place and the next; a place's props are disposed
 * when it is left.
 */
import { MeshBasicMaterial, type Mesh } from 'three';
import type { ObstacleId } from '../places';
import type { Prop } from '../kit';
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

export function createPropPool(): PropPool {
  const built = new Map<ObstacleId, Prop>();
  return {
    get(id) {
      let prop = built.get(id);
      if (!prop) {
        prop = PROP_BUILDERS[id]();
        castAndReceive(prop);
        built.set(id, prop);
      }
      return prop;
    },
    prune(keep) {
      for (const [id, prop] of built) {
        if (keep.includes(id)) continue;
        prop.dispose();
        built.delete(id);
      }
    },
    dispose() {
      for (const prop of built.values()) prop.dispose();
      built.clear();
    },
  };
}
