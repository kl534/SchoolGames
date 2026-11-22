import { describe, expect, it } from 'vitest';
import { moveEvents } from '../src/games/cat-dash/moves';
import { OBSTACLE_IDS } from '../src/games/cat-dash/places';
import { sfx } from '../src/shared/audio';

describe('Cat Dash sounds', () => {
  it('has a function in the shared kit for every sfx event of every move', () => {
    const names = new Set<string>();
    for (const id of OBSTACLE_IDS) {
      for (const outcome of ['clear', 'fail'] as const) {
        for (const variant of [0, 1] as const) {
          for (const e of moveEvents(id, outcome, variant)) {
            if (e.type.startsWith('sfx:')) names.add(e.type.slice(4));
          }
        }
      }
    }
    expect(names.size).toBeGreaterThan(5);
    const kit = sfx as Record<string, unknown>;
    for (const name of names) expect(typeof kit[name], `sfx.${name}`).toBe('function');
  });

  it('has the four new cat sounds', () => {
    for (const name of ['meow', 'yowl', 'purr', 'hiss']) {
      expect(typeof (sfx as Record<string, unknown>)[name]).toBe('function');
    }
  });
});
