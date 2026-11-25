import { describe, expect, it } from 'vitest';
import { DOOR_ICONS } from '../src/games/cat-dash/door';
import { parseDev } from '../src/games/cat-dash/dev';
import {
  CAT_IDS,
  CAT_LOOKS,
  CAT_SETTING,
  NORMAL_BUILD,
  catFaceSvg,
  savedCat,
} from '../src/games/cat-dash/looks';
import {
  GROUP_DOORS,
  OBSTACLE_IDS,
  PLACES,
  PLACE_IDS,
  doorOf,
  placeOf,
  type DoorKind,
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
  fishPoints,
  fishTrailLength,
  leapLift,
  LEAP_REACH,
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
    expect([1, 2, 3, 4, 5].map(fishPoints)).toEqual([25, 50, 75, 100, 125]);
  });
});

describe('places', () => {
  it('has unique ids, three obstacles each and every obstacle in exactly one place', () => {
    expect(new Set(PLACE_IDS).size).toBe(PLACES.length);
    expect(PLACES).toHaveLength(21);
    const all = PLACES.flatMap((p) => [...p.obstacles]);
    expect(all).toHaveLength(63);
    expect(new Set(all).size).toBe(63);
    expect([...OBSTACLE_IDS].sort()).toEqual([...all].sort());
    for (const p of PLACES) {
      expect(p.obstacles).toHaveLength(3);
      for (const o of p.obstacles) expect(placeOf(o).id).toBe(p.id);
      expect(p.speech).toBe(`The ${p.name.replace(/^The /, '').toLowerCase()}!`);
    }
  });

  it('has house 4, town 6, busy 5 and adventure 6 places', () => {
    const counts = { house: 4, town: 6, busy: 5, adventure: 6 };
    for (const group of ['house', 'town', 'busy', 'adventure'] as const) {
      expect(PLACES.filter((p) => p.group === group)).toHaveLength(counts[group]);
    }
    for (const id of ['farm', 'jungle', 'pirate-ship', 'zoo']) {
      expect(PLACES.find((p) => p.id === id)?.look.indoor).toBe(false);
    }
    const indoor = PLACES.filter((p) => p.look.indoor).map((p) => p.id);
    for (const id of ['grocery', 'library', 'fish-market', 'space-station', 'toy-store']) {
      expect(indoor).toContain(id);
    }
    for (const id of [
      'construction',
      'beach',
      'snowy-forest',
      'desert',
      'farm',
      'jungle',
      'pirate-ship',
      'zoo',
    ]) {
      expect(indoor).not.toContain(id);
    }
    expect(PLACES.find((p) => p.id === 'space-station')?.look.floorPattern).toBe('metal');
    expect(PLACES.find((p) => p.id === 'snowy-forest')?.look.floorPattern).toBe('snow');
  });

  it('speaks the exact lines of the design for the busy and adventure places', () => {
    const lines = Object.fromEntries(PLACES.map((p) => [p.id, p.speech]));
    expect(lines).toMatchObject({
      grocery: 'The grocery store!',
      library: 'The library!',
      'fish-market': 'The fish market!',
      construction: 'The construction site!',
      beach: 'The beach!',
      'snowy-forest': 'The snowy forest!',
      desert: 'The desert!',
      'space-station': 'The space station!',
    });
  });

  it('speaks the exact lines of the toy store and the pirate ship', () => {
    const lines = Object.fromEntries(PLACES.map((p) => [p.id, p.speech]));
    expect(lines).toMatchObject({
      'toy-store': 'The toy store!',
      'pirate-ship': 'The pirate ship!',
    });
    expect(PLACES.find((p) => p.id === 'toy-store')?.group).toBe('busy');
    expect(PLACES.find((p) => p.id === 'pirate-ship')?.group).toBe('adventure');
  });

  it('speaks the exact line of the zoo', () => {
    expect(PLACES.find((p) => p.id === 'zoo')).toMatchObject({
      group: 'town',
      name: 'The Zoo',
      speech: 'The zoo!',
      obstacles: ['elephant', 'giraffe', 'penguins'],
    });
  });

  it('gives the zoo its own doorway and every other place its group door', () => {
    for (const p of PLACES) {
      expect(doorOf(p), p.id).toBe(p.id === 'zoo' ? 'zoo-arch' : GROUP_DOORS[p.group]);
    }
    expect(PLACES.filter((p) => p.door).map((p) => p.id)).toEqual(['zoo']);
    const kinds: DoorKind[] = ['door', 'gate', 'shop-doors', 'portal', 'zoo-arch'];
    for (const kind of kinds) expect(DOOR_ICONS[kind], kind).toBeTruthy();
    expect(Object.keys(DOOR_ICONS).sort()).toEqual([...kinds].sort());
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
    expect(savedCat('british-shorthair')).toBe('british-shorthair');
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

describe('the ten cats', () => {
  it('has ten unique ids that match the looks', () => {
    expect(CAT_IDS.length).toBe(10);
    expect(new Set(CAT_IDS).size).toBe(10);
    expect(new Set(CAT_IDS)).toEqual(new Set(Object.keys(CAT_LOOKS)));
    for (const id of CAT_IDS) expect(CAT_LOOKS[id].id).toBe(id);
    expect(CAT_IDS.slice(0, 5)).toEqual(['orange', 'black', 'tuxedo', 'calico', 'grey-tabby']);
  });

  it('gives each odd feature to the right cats', () => {
    const ids = (f: (l: (typeof CAT_LOOKS)[keyof typeof CAT_LOOKS]) => boolean) =>
      CAT_IDS.filter((id) => f(CAT_LOOKS[id]));
    expect(ids((l) => l.build !== NORMAL_BUILD)).toEqual(['british-shorthair']);
    expect(ids((l) => l.points !== null)).toEqual(['siamese']);
    expect(ids((l) => l.eyes2 !== null)).toEqual(['white']);
    expect(ids((l) => l.whitePaws)).toEqual(['tuxedo', 'calico', 'ginger-white']);
  });

  it('shows the points, both eye colours and the chubby face in the picture', () => {
    const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
    expect(catFaceSvg(CAT_LOOKS.siamese)).toContain(hex(CAT_LOOKS.siamese.points!));
    const white = catFaceSvg(CAT_LOOKS.white);
    expect(white).toContain(hex(CAT_LOOKS.white.eyes));
    expect(white).toContain(hex(CAT_LOOKS.white.eyes2!));
    const faceRx = (id: (typeof CAT_IDS)[number]) =>
      Number(/<ellipse cx="32" cy="36" rx="([\d.]+)"/.exec(catFaceSvg(CAT_LOOKS[id]))![1]);
    expect(faceRx('british-shorthair')).toBeGreaterThan(faceRx('orange'));
  });

  it('reads ?cat= for a new cat', () => {
    expect(parseDev('?cat=tortoiseshell').cat).toBe('tortoiseshell');
  });
});

describe('parseDev', () => {
  it('reads the toy store and the pirate ship', () => {
    expect(parseDev('?place=pirate-ship').place).toBe('pirate-ship');
    expect(parseDev('?places=toy-store,pirate-ship').places).toEqual(['toy-store', 'pirate-ship']);
    expect(parseDev('?lab=ball-pit:fail:1').lab).toEqual({
      obstacle: 'ball-pit',
      outcome: 'fail',
      variant: 1,
    });
  });

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

  it('reads the busy and adventure places and obstacles', () => {
    const d = parseDev(
      '?place=space-station&places=grocery,beach,fish-market&obstacle=airlock&lab=net:clear:1&door=library&at=2.4',
    );
    expect(d.place).toBe('space-station');
    expect(d.places).toEqual(['grocery', 'beach', 'fish-market']);
    expect(d.obstacle).toBe('airlock');
    expect(d.lab).toEqual({ obstacle: 'net', outcome: 'clear', variant: 1 });
    expect(d.door).toBe('library');
    expect(d.at).toBe(2.4);
    expect(parseDev('?lab=wave:fail:0').lab).toEqual({
      obstacle: 'wave',
      outcome: 'fail',
      variant: 0,
    });
    expect(parseDev('?door=beach').door).toBe('beach');
  });

  it('reads the zoo', () => {
    expect(parseDev('?place=zoo').place).toBe('zoo');
    expect(parseDev('?door=zoo&at=1').door).toBe('zoo');
    expect(parseDev('?lab=giraffe:clear:0').lab?.obstacle).toBe('giraffe');
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
      quality: null,
    });
    expect(parseDev('').lab).toBeNull();
    expect(parseDev('?lab=couch:clear').lab).toBeNull();
  });

  it('lifts the cat to a fish, peaking at it and 0 out of reach', () => {
    expect(leapLift(0, 1.2)).toBeCloseTo(1.2);
    expect(leapLift(LEAP_REACH, 1.2)).toBe(0);
    expect(leapLift(-LEAP_REACH - 1, 1.2)).toBe(0);
    expect(leapLift(0, 0)).toBe(0);
    expect(leapLift(-1, 1.2)).toBeGreaterThan(0);
    expect(leapLift(1, 1.2)).toBeLessThan(1.2);
  });
});
