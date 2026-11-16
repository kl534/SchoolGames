import { describe, expect, it } from 'vitest';
import { megaEvents } from '../src/games/crash-course/mega/mega';
import { MEGA_IDS, OBSTACLE_KINDS } from '../src/games/crash-course/rules';
import { stuntEvents } from '../src/games/crash-course/stunts';
import { sfx } from '../src/shared/audio';

describe('Crash Course sounds', () => {
  it('has a function in the shared kit for every sfx event of every stunt and Mega course', () => {
    const names = new Set<string>();
    for (const kind of OBSTACLE_KINDS) {
      for (const outcome of ['clear', 'crash'] as const) {
        for (const variant of [0, 1] as const) {
          for (const e of stuntEvents(kind, outcome, variant)) {
            if (e.type.startsWith('sfx:')) names.add(e.type.slice(4));
          }
        }
      }
    }
    for (const id of MEGA_IDS) {
      for (const passed of [0, 1, 2, 3] as const) {
        for (const e of megaEvents(id, passed)) {
          if (e.type.startsWith('sfx:')) names.add(e.type.slice(4));
        }
      }
    }
    expect(names.size).toBeGreaterThan(8);
    const kit = sfx as Record<string, unknown>;
    for (const name of names) expect(typeof kit[name], `sfx.${name}`).toBe('function');
  });

  it('has the new wobble, roar and monkey sounds', () => {
    for (const name of ['wobble', 'roar', 'monkey']) {
      expect(typeof (sfx as Record<string, unknown>)[name]).toBe('function');
    }
  });
});
