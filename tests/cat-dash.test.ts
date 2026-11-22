import { describe, expect, it } from 'vitest';
import { parseDev } from '../src/games/cat-dash/dev';
import { CAT_IDS, CAT_LOOKS, CAT_SETTING, catFaceSvg, savedCat } from '../src/games/cat-dash/looks';
import {
  OBSTACLE_IDS,
  PLACES,
  PLACE_IDS,
  placeOf,
  type PlaceId,
} from '../src/games/cat-dash/places';
import {
  BASE_POINTS,
  FISH_TRAIL,
  LIVES,
  MAX_GAP,
  RUN_SPEED,
  SPRINT_MAX,
  ENTRY_SPEED,
  VISIT_LENGTH,
  approach,
  fishTrailLength,
  hitPoints,
  loseLife,
  multiplierFor,
  nextPlace,
  nextStreak,
  outOfLives,
  sprintSpeed,
  visitPlan,
} from '../src/games/cat-dash/rules';
import { VOICE_LINES } from '../src/games/cat-dash/voice';
import { runs } from './helpers/full';

function lcg(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

describe('scoring', () => {
  it('pays 150 for an instant answer and 100 for the last moment', () => {
    expect(hitPoints(10, 10, 1)).toBe(150);
    expect(hitPoints(0, 10, 1)).toBe(BASE_POINTS);
    expect(hitPoints(5, 10, 1)).toBe(125);
    expect(hitPoints(5, 0, 1)).toBe(BASE_POINTS);
  });

  it('doubles from a streak of 5 and triples from 10', () => {
    expect(multiplierFor(4)).toBe(1);
    expect(multiplierFor(5)).toBe(2);
    expect(multiplierFor(9)).toBe(2);
    expect(multiplierFor(10)).toBe(3);
    expect(hitPoints(10, 10, 5)).toBe(300);
    expect(hitPoints(10, 10, 10)).toBe(450);
  });

  it('counts the streak up on a hit and resets it on a miss', () => {
    expect(nextStreak(3, true)).toBe(4);
    expect(nextStreak(3, false)).toBe(0);
  });
});

describe('lives', () => {
  it('starts with 3 and never goes below 0', () => {
    expect(LIVES).toBe(3);
    expect(loseLife(3)).toBe(2);
    expect(loseLife(1)).toBe(0);
    expect(loseLife(0)).toBe(0);
    expect(outOfLives(0)).toBe(true);
    expect(outOfLives(1)).toBe(false);
  });
});

describe('visitPlan', () => {
  it('is six obstacles, each twice, variant 0 before 1, never the same twice in a row', () => {
    const next = lcg(7);
    for (let i = 0; i < runs(500, 50); i++) {
      const plan = visitPlan(['couch', 'bookshelf', 'basket'], next(), next());
      expect(plan).toHaveLength(VISIT_LENGTH);
      for (const id of ['couch', 'bookshelf', 'basket']) {
        const mine = plan.filter((p) => p.obstacle === id);
        expect(mine.map((p) => p.variant)).toEqual([0, 1]);
        expect(plan.findIndex((p) => p === mine[0])).toBeLessThan(
          plan.findIndex((p) => p === mine[1]),
        );
      }
      for (let k = 1; k < plan.length; k++) {
        expect(plan[k].obstacle).not.toBe(plan[k - 1].obstacle);
      }
    }
  });

  it('covers every order of the first three', () => {
    const seen = new Set<string>();
    for (let r = 0; r < 6; r++) {
      seen.add(
        visitPlan(['couch', 'bookshelf', 'basket'], (r + 0.5) / 6, 0.2)
          .slice(0, 3)
          .map((p) => p.obstacle)
          .join(),
      );
    }
    expect(seen.size).toBe(6);
  });
});

describe('nextPlace', () => {
  it('never picks the current place or a visited one while a fresh one exists', () => {
    const next = lcg(3);
    for (let i = 0; i < runs(500, 50); i++) {
      const current = PLACE_IDS[Math.floor(next() * PLACE_IDS.length)];
      const visited = new Set<PlaceId>([current]);
      for (const id of PLACE_IDS) if (next() < 0.4) visited.add(id);
      const pick = nextPlace(PLACE_IDS, visited, current, next());
      expect(pick).not.toBe(current);
      const fresh = PLACE_IDS.filter((p) => !visited.has(p));
      if (fresh.length > 0) expect(visited.has(pick)).toBe(false);
    }
  });

  it('a full cycle visits every place once before starting over', () => {
    const next = lcg(11);
    let current: PlaceId = 'living-room';
    let visited = new Set<PlaceId>([current]);
    for (let cycle = 0; cycle < 3; cycle++) {
      const seen = new Set<PlaceId>(visited);
      while (seen.size < PLACE_IDS.length) {
        const pick = nextPlace(PLACE_IDS, visited, current, next());
        expect(seen.has(pick)).toBe(false);
        seen.add(pick);
        visited.add(pick);
        current = pick;
      }
      // Everything is visited: the next pick starts over, and is never the current place.
      const pick = nextPlace(PLACE_IDS, visited, current, next());
      expect(pick).not.toBe(current);
      visited = new Set([pick]);
      current = pick;
    }
  });

  it('stays put with a single place', () => {
    expect(nextPlace(['kitchen'], new Set(), 'kitchen', 0.5)).toBe('kitchen');
  });
});

describe('approach and sprint', () => {
  it('arrives as the clock ends and keeps the gap in range', () => {
    for (const clock of [1, 5, 10, 30, 100]) {
      for (const ahead of [8, 20, 40, 80]) {
        const ap = approach(clock, ahead);
        expect(ap.gap).toBeLessThanOrEqual(MAX_GAP);
        expect(ap.gap).toBeGreaterThanOrEqual(Math.min(ahead + 5, MAX_GAP) - 1e-9);
        expect(ap.runSpeed * Math.max(clock, 1)).toBeCloseTo(ap.gap, 6);
      }
    }
    expect(approach(10, 8).runSpeed).toBeCloseTo(RUN_SPEED, 6);
  });

  it('sprints at least the entry speed and at most the limit', () => {
    expect(sprintSpeed(0)).toBe(ENTRY_SPEED);
    expect(sprintSpeed(5)).toBe(ENTRY_SPEED);
    expect(sprintSpeed(1000)).toBe(SPRINT_MAX);
    expect(sprintSpeed(18)).toBeCloseTo(20, 6);
  });

  it('has 3, 4 or 5 fish in a trail', () => {
    const seen = new Set<number>();
    for (let r = 0; r < 1; r += 0.05) seen.add(fishTrailLength(r));
    expect([...seen].sort()).toEqual([...FISH_TRAIL]);
    expect(fishTrailLength(0.999)).toBe(5);
  });
});

describe('places', () => {
  it('has unique ids, three obstacles each and every obstacle in exactly one place', () => {
    expect(new Set(PLACE_IDS).size).toBe(PLACES.length);
    expect(PLACES).toHaveLength(8);
    const all = PLACES.flatMap((p) => [...p.obstacles]);
    expect(all).toHaveLength(24);
    expect(new Set(all).size).toBe(24);
    expect([...OBSTACLE_IDS].sort()).toEqual([...all].sort());
    for (const p of PLACES) {
      expect(p.obstacles).toHaveLength(3);
      for (const o of p.obstacles) expect(placeOf(o).id).toBe(p.id);
      expect(p.speech).toBe(`The ${p.name.replace(/^The /, '').toLowerCase()}!`);
    }
  });

  it('speaks every place name', () => {
    for (const p of PLACES) expect(VOICE_LINES).toContain(p.speech);
    expect(VOICE_LINES).toContain('Out of lives!');
    expect(VOICE_LINES).toContain('New high score!');
    expect(VOICE_LINES).toContain('Great running!');
  });
});

describe('cats', () => {
  it('falls back to orange for an unknown or missing saved cat', () => {
    expect(savedCat(null)).toBe('orange');
    expect(savedCat('dog')).toBe('orange');
    expect(savedCat('calico')).toBe('calico');
    expect(CAT_SETTING('abc')).toBe('cat-dash:cat:abc');
    expect(CAT_SETTING(null)).toBe('cat-dash:cat:guest');
  });

  it('draws a well-formed face for every cat, bright and lost', () => {
    for (const id of CAT_IDS) {
      for (const lost of [false, true]) {
        const svg = catFaceSvg(CAT_LOOKS[id], lost);
        expect(svg.startsWith('<svg')).toBe(true);
        expect(svg.endsWith('</svg>')).toBe(true);
        expect(svg).toContain('viewBox="0 0 64 64"');
        // Every opened tag is closed or self-closed.
        const opened = (svg.match(/<(?!\/)[a-z]+/g) ?? []).length;
        const closed = (svg.match(/<\/[a-z]+>/g) ?? []).length + (svg.match(/\/>/g) ?? []).length;
        expect(closed).toBe(opened);
      }
    }
  });
});

describe('parseDev', () => {
  it('reads the hooks', () => {
    const d = parseDev(
      '?cat=calico&lives=2&place=kitchen&places=bedroom,kitchen,x&obstacle=yarn&lab=couch:fail:1&at=1.5&door=bathroom',
    );
    expect(d.cat).toBe('calico');
    expect(d.lives).toBe(2);
    expect(d.place).toBe('kitchen');
    expect(d.places).toEqual(['bedroom', 'kitchen']);
    expect(d.obstacle).toBe('yarn');
    expect(d.lab).toEqual({ obstacle: 'couch', outcome: 'fail', variant: 1 });
    expect(d.at).toBe(1.5);
    expect(d.door).toBe('bathroom');
  });

  it('reads the town places and obstacles', () => {
    const d = parseDev(
      '?place=rooftops&places=park,street&obstacle=roof-gap&lab=pond:clear:1&door=backyard',
    );
    expect(d.place).toBe('rooftops');
    expect(d.places).toEqual(['park', 'street']);
    expect(d.obstacle).toBe('roof-gap');
    expect(d.lab).toEqual({ obstacle: 'pond', outcome: 'clear', variant: 1 });
    expect(d.door).toBe('backyard');
  });

  it('ignores unknown or malformed values', () => {
    const d = parseDev('?cat=dog&lives=9&place=moon&obstacle=x&lab=couch:crash:0&at=abc&door=x');
    expect(d).toEqual({
      cat: null,
      lives: null,
      place: null,
      places: [],
      obstacle: null,
      lab: null,
      door: null,
      at: null,
    });
    expect(parseDev('').lab).toBeNull();
    expect(parseDev('?lab=couch:clear').lab).toBeNull();
  });
});
