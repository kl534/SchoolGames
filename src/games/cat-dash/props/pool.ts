/**
 * One built prop per obstacle of the current place and the next; a place's props are disposed
 * when it is left.
 */
import type { ObstacleId } from '../places';
import type { Prop } from '../kit';
import { HOUSE_PROPS } from './house';
import { TOWN_PROPS } from './town';
import { BUSY_PROPS } from './busy';
import { ADVENTURE_PROPS } from './adventure';

export const PROP_BUILDERS: Record<ObstacleId, () => Prop> = {
  ...HOUSE_PROPS,
  ...TOWN_PROPS,
  ...BUSY_PROPS,
  ...ADVENTURE_PROPS,
};

export interface PropPool {
  get(id: ObstacleId): Prop;
  /** Disposes every prop that is not in `keep`. */
  prune(keep: readonly ObstacleId[]): void;
  dispose(): void;
}

export function createPropPool(): PropPool {
  const built = new Map<ObstacleId, Prop>();
  return {
    get(id) {
      let prop = built.get(id);
      if (!prop) {
        prop = PROP_BUILDERS[id]();
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
