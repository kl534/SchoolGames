import { PerspectiveCamera, Scene, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import {
  createBall,
  createBatter,
  createCatcher,
  createFielder,
  createPitcher,
  createUmpire,
  FIELDER_SPOTS,
  SWING_CONTACT,
  type FielderId,
} from '../src/games/batter-up/characters';
import { createEffects } from '../src/games/batter-up/effects';
import { buildField } from '../src/games/batter-up/field';
import {
  BALL_RADIUS,
  BASE_SIDE,
  BASE_SPOTS,
  basePathPoint,
  BOARD,
  BURST_RADIUS,
  CHASERS,
  CONTACT,
  dashPosition,
  FOUL_ANGLE,
  fieldAngle,
  fieldPoint,
  FIREWORKS_CENTRE,
  GLOVE,
  LAP,
  pickChasers,
  pitchPosition,
  planHit,
  RELEASE,
  WALL_CENTRE,
  WALL_HEIGHT,
  WALL_POLE,
  wallRadius,
  type Vec,
} from '../src/games/batter-up/flight';
import {
  callInPanel,
  centreShift,
  fireworksAim,
  fireworksFit,
  fireworksPoints,
  fitView,
  followGoal,
  hitBand,
  homeView,
  keepBoardClear,
  playBand,
  project,
} from '../src/games/batter-up/layout';
import { createMover } from '../src/games/batter-up/mover';
import { createPerson, mixPose, neutralPose } from '../src/games/batter-up/person';
import {
  advance,
  applyHit,
  applyStrike,
  BASES_FOR,
  clockFraction,
  dots,
  easeToward,
  EMPTY_BASES,
  hitFor,
  hitLabel,
  hitSpeech,
  MAX_BATTERS,
  MAX_OUTS,
  newGame,
  runsText,
  STRIKES_OUT,
  strikeCall,
  type Bases,
  type GameState,
  type Hit,
} from '../src/games/batter-up/rules';

const at = (x: number, y: number, z: number): Vec => ({ x, y, z });

describe('hit tiers', () => {
  it('gives a home run for the first quarter of the clock', () => {
    expect(hitFor(0)).toBe('homer');
    expect(hitFor(0.1)).toBe('homer');
    expect(hitFor(0.2499)).toBe('homer');
  });

  it('steps down to a triple, a double and a single at the quarter marks', () => {
    expect(hitFor(0.25)).toBe('triple');
    expect(hitFor(0.4999)).toBe('triple');
    expect(hitFor(0.5)).toBe('double');
    expect(hitFor(0.7499)).toBe('double');
    expect(hitFor(0.75)).toBe('single');
    expect(hitFor(1)).toBe('single');
  });

  it('works out the fraction of the clock used, kept between 0 and 1', () => {
    expect(clockFraction(0, 10)).toBe(0);
    expect(clockFraction(2.5, 10)).toBe(0.25);
    expect(clockFraction(12, 10)).toBe(1);
    expect(clockFraction(-1, 10)).toBe(0);
    expect(clockFraction(3, 0)).toBe(1);
  });

  it('is worth one to four bases, with names and speech', () => {
    expect(BASES_FOR).toEqual({ single: 1, double: 2, triple: 3, homer: 4 });
    expect(hitLabel('homer')).toBe('HOME RUN!');
    expect(hitLabel('double')).toBe('DOUBLE!');
    expect(hitLabel('single')).toBe('SINGLE!');
    expect(hitLabel('triple')).toBe('TRIPLE!');
    expect(hitSpeech('homer')).toBe('Home run!');
    expect(hitSpeech('double')).toBe('Double!');
  });

  it('says how many runs scored', () => {
    expect(runsText(0)).toBe('');
    expect(runsText(1)).toBe('+1 run!');
    expect(runsText(4)).toBe('+4 runs!');
  });
});

describe('running the bases', () => {
  const loaded: Bases = [true, true, true];

  it('scores four on a home run with the bases loaded, and clears them', () => {
    const result = advance(loaded, 4);
    expect(result.runs).toBe(4);
    expect(result.bases).toEqual(EMPTY_BASES);
    expect(result.moves).toHaveLength(4);
    expect(result.moves.every((m) => m.to === 4)).toBe(true);
  });

  it('scores the batter alone on a home run with nobody on', () => {
    const result = advance(EMPTY_BASES, 4);
    expect(result.runs).toBe(1);
    expect(result.moves).toEqual([{ from: 0, to: 4 }]);
  });

  it('puts the batter on first for a single with nobody on', () => {
    const result = advance(EMPTY_BASES, 1);
    expect(result.runs).toBe(0);
    expect(result.bases).toEqual([true, false, false]);
  });

  it('scores one on a double with runners on first and second, leaving second and third', () => {
    const result = advance([true, true, false], 2);
    expect(result.runs).toBe(1);
    expect(result.bases).toEqual([false, true, true]);
    expect(result.moves).toEqual([
      { from: 2, to: 4 },
      { from: 1, to: 3 },
      { from: 0, to: 2 },
    ]);
  });

  it('moves every runner up as many bases as the hit is worth', () => {
    expect(advance([true, false, true], 1)).toMatchObject({
      runs: 1,
      bases: [true, true, false],
    });
    expect(advance([true, false, false], 3)).toMatchObject({
      runs: 1,
      bases: [false, false, true],
    });
    expect(advance([false, true, false], 3)).toMatchObject({
      runs: 1,
      bases: [false, false, true],
    });
    expect(advance(loaded, 1)).toMatchObject({ runs: 1, bases: [true, true, true] });
    expect(advance(loaded, 2)).toMatchObject({ runs: 2, bases: [false, true, true] });
    expect(advance(loaded, 3)).toMatchObject({ runs: 3, bases: [false, false, true] });
  });

  it('lists the lead runner first and the batter last', () => {
    const froms = advance(loaded, 1).moves.map((m) => m.from);
    expect(froms).toEqual([3, 2, 1, 0]);
  });
});

describe('the count and the half-inning', () => {
  const strikeOut = (state: GameState) => {
    let s = state;
    for (let i = 0; i < STRIKES_OUT; i++) s = applyStrike(s).state;
    return s;
  };

  it('starts with the first batter, no outs, no strikes and nobody on', () => {
    expect(newGame()).toEqual({
      batter: 1,
      strikes: 0,
      outs: 0,
      runs: 0,
      bases: EMPTY_BASES,
      over: false,
    });
  });

  it('adds a strike and keeps the same batter until the third', () => {
    const one = applyStrike(newGame());
    expect(one.state).toMatchObject({ strikes: 1, outs: 0, batter: 1 });
    expect(one.out).toBe(false);
    const two = applyStrike(one.state);
    expect(two.state).toMatchObject({ strikes: 2, outs: 0, batter: 1 });
    expect(two.out).toBe(false);
  });

  it('makes the third strike an out and brings up the next batter with no strikes', () => {
    let s = newGame();
    s = applyStrike(s).state;
    s = applyStrike(s).state;
    const third = applyStrike(s);
    expect(third.out).toBe(true);
    expect(third.state).toMatchObject({ strikes: 0, outs: 1, batter: 2, over: false });
  });

  it('ends the half-inning at three outs, even with batters left', () => {
    let s = newGame();
    s = strikeOut(s);
    s = strikeOut(s);
    expect(s.over).toBe(false);
    s = strikeOut(s);
    expect(s).toMatchObject({ outs: MAX_OUTS, over: true, batter: 3 });
  });

  it('puts the batter on base for a hit and clears the strikes for the next batter', () => {
    let s = newGame();
    s = applyStrike(s).state;
    s = applyStrike(s).state;
    const hit = applyHit(s, 'single');
    expect(hit.out).toBe(false);
    expect(hit.state).toMatchObject({
      strikes: 0,
      batter: 2,
      outs: 0,
      bases: [true, false, false],
    });
  });

  it('adds runs to the score as they cross the plate', () => {
    let s: GameState = { ...newGame(), bases: [true, true, true] };
    const result = applyHit(s, 'homer');
    expect(result.runs).toBe(4);
    expect(result.state.runs).toBe(4);
    s = result.state;
    expect(applyHit(s, 'homer').state.runs).toBe(5);
  });

  it('ends after nine batters, once the ninth has finished their turn', () => {
    let s = newGame();
    for (let i = 1; i < MAX_BATTERS; i++) {
      const result = applyHit(s, 'single');
      s = result.state;
      expect(s.over).toBe(false);
      expect(s.batter).toBe(i + 1);
    }
    expect(s.batter).toBe(MAX_BATTERS);
    const last = applyHit(s, 'single');
    expect(last.state.over).toBe(true);
    expect(last.state.batter).toBe(MAX_BATTERS);
  });

  it('counts the runs from nine singles in a row', () => {
    let s = newGame();
    while (!s.over) s = applyHit(s, 'single').state;
    // Everyone after the third batter pushes a runner home.
    expect(s.runs).toBe(MAX_BATTERS - 3);
  });

  it('lets the ninth batter strike out without making a fourth out', () => {
    let s: GameState = { ...newGame(), batter: MAX_BATTERS, outs: 1 };
    s = strikeOut(s);
    expect(s).toMatchObject({ over: true, outs: 2, batter: MAX_BATTERS });
  });

  it('does not end early while there are outs to give and batters to come', () => {
    let s = newGame();
    s = strikeOut(s);
    s = applyHit(s, 'double').state;
    s = strikeOut(s);
    expect(s).toMatchObject({ outs: 2, batter: 4, over: false });
    expect(s.bases).toEqual([false, true, false]);
  });

  it('never changes the state it is given', () => {
    const before = newGame();
    const copy = structuredClone(before);
    applyStrike(before);
    applyHit(before, 'homer');
    expect(before).toEqual(copy);
  });
});

describe('the umpire', () => {
  it('calls strikes one and two, swinging or looking', () => {
    expect(strikeCall(1, false)).toEqual({ title: 'Strike 1!', spoken: 'Strike one!', out: false });
    expect(strikeCall(2, true)).toEqual({
      title: 'Called strike 2!',
      spoken: 'Called strike two!',
      out: false,
    });
  });

  it('rings up the batter on the third', () => {
    expect(strikeCall(3, false)).toMatchObject({ out: true, spoken: 'Strike three! You are out!' });
    expect(strikeCall(3, true).title).toContain('looking');
  });

  it('shows outs and strikes as dots', () => {
    expect(dots(0, 3)).toBe('○○○');
    expect(dots(2, 3)).toBe('●●○');
    expect(dots(5, 3)).toBe('●●●');
  });

  it('eases towards a goal the same at any frame rate', () => {
    let a = 0;
    for (let i = 0; i < 60; i++) a = easeToward(a, 10, 4, 1 / 60);
    let b = 0;
    for (let i = 0; i < 30; i++) b = easeToward(b, 10, 4, 1 / 30);
    expect(a).toBeCloseTo(b, 6);
  });
});

describe('pitches and hits in flight', () => {
  const hits: Hit[] = ['single', 'double', 'triple', 'homer'];

  it('floats the pitch from the hand to the plate in an arc', () => {
    const start = at(0.2, 2, -7);
    const out = at(0, 0, 0);
    expect(pitchPosition(0, out, start)).toEqual(start);
    expect(pitchPosition(1, out, start)).toEqual(CONTACT);
    const mid = pitchPosition(0.5, out, start);
    // Above the straight line between the two.
    expect(mid.y).toBeGreaterThan((start.y + CONTACT.y) / 2 + 0.5);
    expect(mid.z).toBeCloseTo((start.z + CONTACT.z) / 2, 6);
  });

  it('starts the pitch at the release point by default and moves steadily towards the plate', () => {
    const out = at(0, 0, 0);
    expect(pitchPosition(0, out)).toEqual(RELEASE);
    let last = -Infinity;
    for (let u = 0; u <= 1; u += 0.1) {
      const z = pitchPosition(u, out).z;
      expect(z).toBeGreaterThan(last);
      last = z;
    }
  });

  it('zips from where it is to where it is going', () => {
    const out = at(0, 0, 0);
    expect(dashPosition(at(0, 2, -4), CONTACT, 0, out)).toEqual(at(0, 2, -4));
    expect(dashPosition(at(0, 2, -4), CONTACT, 1, out)).toEqual(CONTACT);
    expect(dashPosition(at(0, 2, -4), CONTACT, 2, out)).toEqual(CONTACT);
  });

  it('measures the wall from the poles to centre field', () => {
    expect(wallRadius(FOUL_ANGLE)).toBeCloseTo(WALL_POLE, 6);
    expect(wallRadius(-FOUL_ANGLE)).toBeCloseTo(WALL_POLE, 6);
    expect(wallRadius(0)).toBeCloseTo(WALL_CENTRE, 6);
    expect(wallRadius(0.3)).toBeLessThan(WALL_CENTRE);
    expect(wallRadius(0.3)).toBeGreaterThan(WALL_POLE);
  });

  it('converts between field angles and points', () => {
    const p = fieldPoint(0.4, 20);
    expect(Math.hypot(p.x, p.z)).toBeCloseTo(20, 6);
    expect(fieldAngle(p)).toBeCloseTo(0.4, 6);
    expect(fieldPoint(0, 10).z).toBeCloseTo(-10, 6);
    expect(fieldPoint(0.5, 10).x).toBeGreaterThan(0);
  });

  it.each(hits)('starts a %s at the bat and lands where it says', (hit) => {
    for (const side of [-1, 1] as const) {
      const plan = planHit(hit, side, 0.5, 0.5);
      const out = at(0, 0, 0);
      expect(plan.position(0, out)).toMatchObject(CONTACT);
      const down = plan.position(plan.airTime, out);
      expect(down.x).toBeCloseTo(plan.landing.x, 6);
      expect(down.z).toBeCloseTo(plan.landing.z, 6);
      expect(Math.sign(plan.landing.x)).toBe(side);
      expect(plan.duration).toBeGreaterThanOrEqual(plan.airTime);
    }
  });

  it('hits a single into shallow outfield, past the infield and short of the wall', () => {
    for (const roll of [0, 0.5, 1]) {
      const plan = planHit('single', 1, roll, roll);
      const reach = Math.hypot(plan.landing.x, plan.landing.z);
      expect(reach).toBeGreaterThan(19);
      expect(reach).toBeLessThan(24);
      expect(plan.overWall).toBe(false);
      expect(plan.lift).toBeLessThan(4);
    }
  });

  it('puts a double in the gap between the fielders and rolls it towards the wall', () => {
    for (const side of [-1, 1] as const) {
      const plan = planHit('double', side, 0.5, 0.5);
      const angle = Math.abs(fieldAngle(plan.landing));
      expect(angle).toBeGreaterThan((14 * Math.PI) / 180);
      expect(angle).toBeLessThan((25 * Math.PI) / 180);
      const stop = Math.hypot(plan.stop.x, plan.stop.z);
      expect(stop).toBeGreaterThan(Math.hypot(plan.landing.x, plan.landing.z));
      expect(stop).toBeLessThan(wallRadius(fieldAngle(plan.stop)));
    }
  });

  it('drives a triple deep down the line and rolls it into the corner', () => {
    for (const side of [-1, 1] as const) {
      const plan = planHit('triple', side, 0.5, 0.5);
      expect(Math.abs(fieldAngle(plan.landing))).toBeGreaterThan((34 * Math.PI) / 180);
      expect(Math.abs(fieldAngle(plan.landing))).toBeLessThan(FOUL_ANGLE);
      expect(Math.abs(fieldAngle(plan.stop))).toBeGreaterThan((41 * Math.PI) / 180);
      expect(Math.hypot(plan.stop.x, plan.stop.z)).toBeLessThan(wallRadius(fieldAngle(plan.stop)));
    }
  });

  it('sends a home run high over the wall', () => {
    for (const side of [-1, 1] as const) {
      for (const roll of [0, 0.5, 1]) {
        const plan = planHit('homer', side, roll, roll);
        expect(plan.overWall).toBe(true);
        const angle = fieldAngle(plan.landing);
        expect(Math.hypot(plan.landing.x, plan.landing.z)).toBeGreaterThan(wallRadius(angle) + 4);
        // Find the moment the ball is over the wall and check it is well above it.
        const out = at(0, 0, 0);
        let clearance = Infinity;
        for (let t = 0; t <= plan.airTime; t += 0.01) {
          plan.position(t, out);
          if (Math.hypot(out.x, out.z) >= wallRadius(fieldAngle(out))) {
            clearance = out.y;
            break;
          }
        }
        expect(clearance).toBeGreaterThan(WALL_HEIGHT + 3);
      }
    }
  });

  it('flies further and higher the better the hit', () => {
    const lifts = hits.map((h) => planHit(h, 1, 0.5, 0.5).lift);
    expect(lifts).toEqual([...lifts].sort((a, b) => a - b));
    const reach = Object.fromEntries(
      hits.map((h) => {
        const p = planHit(h, 1, 0.5, 0.5).landing;
        return [h, Math.hypot(p.x, p.z)];
      }),
    );
    expect(reach.single).toBeLessThan(reach.double);
    expect(reach.homer).toBeGreaterThan(reach.triple + 10);
  });

  it('keeps a rolling ball on the ground, slowing down to a stop', () => {
    const plan = planHit('double', 1, 0.5, 0.5);
    const out = at(0, 0, 0);
    plan.position(plan.airTime + 0.5, out);
    expect(out.y).toBeGreaterThanOrEqual(BALL_RADIUS - 1e-9);
    expect(out.y).toBeLessThan(1);
    const end = plan.position(plan.duration, at(0, 0, 0));
    expect(end.x).toBeCloseTo(plan.stop.x, 6);
    expect(end.z).toBeCloseTo(plan.stop.z, 6);
    const later = plan.position(plan.duration + 3, at(0, 0, 0));
    expect(later.x).toBeCloseTo(plan.stop.x, 6);
  });

  it('sends the nearest outfielders after the ball', () => {
    const outfield = (['LF', 'CF', 'RF'] as FielderId[]).map((id) => ({
      id,
      ...FIELDER_SPOTS[id],
    }));
    expect(pickChasers(outfield, at(-10, 0, -25), 1).map((f) => f.id)).toEqual(['LF']);
    expect(pickChasers(outfield, at(12, 0, -30), 2).map((f) => f.id)).toEqual(['RF', 'CF']);
    expect(pickChasers(outfield, at(0, 0, -30), 0)).toEqual([]);
    expect(CHASERS).toEqual({ single: 1, double: 2, triple: 2, homer: 1 });
  });

  it('lays out the bases a base-side apart, with the mound between home and second', () => {
    expect(BASE_SPOTS).toHaveLength(4);
    for (let i = 0; i < 4; i++) {
      const a = BASE_SPOTS[i];
      const b = BASE_SPOTS[(i + 1) % 4];
      expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeCloseTo(BASE_SIDE, 6);
    }
    expect(BASE_SPOTS[1].x).toBeGreaterThan(0);
    expect(BASE_SPOTS[3].x).toBeLessThan(0);
  });

  it('follows the base paths round and back to home', () => {
    const out = at(0, 0, 0);
    for (let i = 0; i <= 4; i++) {
      const p = basePathPoint(i * BASE_SIDE, out);
      const spot = BASE_SPOTS[i % 4];
      expect(p.x).toBeCloseTo(spot.x, 6);
      expect(p.z).toBeCloseTo(spot.z, 6);
    }
    expect(LAP).toBe(4 * BASE_SIDE);
    const half = basePathPoint(BASE_SIDE / 2, out);
    expect(half.x).toBeCloseTo(BASE_SPOTS[1].x / 2, 6);
    expect(basePathPoint(999, out).z).toBeCloseTo(0, 6);
  });
});

describe('the camera', () => {
  const SCREENS: [number, number][] = [
    [360, 640],
    [390, 844],
    [412, 915],
    [844, 390],
    [768, 1024],
    [1024, 768],
    [1280, 800],
    [1366, 768],
  ];

  /** Screen row of a world point as the batting view shows it. */
  const rowOf = (w: number, h: number, p: Vec) => {
    const fit = fitView(w, h);
    const camera = new PerspectiveCamera(fit.fov, w / h, 0.3, 600);
    camera.setViewOffset(w, h, 0, fit.shift, w, h);
    const home = homeView(w / h);
    camera.position.set(home.cam.x, home.cam.y, home.cam.z);
    camera.lookAt(home.look.x, home.look.y, home.look.z);
    camera.updateMatrixWorld();
    const v = new Vector3(p.x, p.y, p.z).project(camera);
    return { row: ((1 - v.y) / 2) * h, col: ((v.x + 1) / 2) * w };
  };

  it.each(SCREENS)(
    'keeps the pitcher and the plate clear of the question and answers at %ix%i',
    (w, h) => {
      const band = playBand(w, h);
      const pitcher = rowOf(w, h, at(0, 3, -8.2));
      const plate = rowOf(w, h, at(0, 0, 0));
      expect(pitcher.row).toBeGreaterThanOrEqual(band.top - 2);
      expect(plate.row).toBeLessThanOrEqual(band.bottom + 2);
      expect(pitcher.col).toBeGreaterThan(0);
      expect(pitcher.col).toBeLessThan(w);
    },
  );

  it.each(SCREENS)('picks a sensible field of view at %ix%i', (w, h) => {
    const fit = fitView(w, h);
    expect(fit.fov).toBeGreaterThanOrEqual(30);
    expect(fit.fov).toBeLessThanOrEqual(88);
    expect(Number.isFinite(fit.shift)).toBe(true);
  });

  it('has room for the pitcher and the batter side by side on the narrowest phone', () => {
    const batter = rowOf(360, 640, at(-1.5, 1, 0));
    const ump = rowOf(360, 640, at(1.3, 1, 3.4));
    expect(batter.col).toBeGreaterThan(0);
    expect(ump.col).toBeLessThan(360);
  });

  it('holds the batting view until the ball has left the plate, then follows it', () => {
    const home = homeView(0.5);
    const cam = at(0, 0, 0);
    const look = at(0, 0, 0);
    followGoal(at(0, 1, 0), cam, look, home);
    expect(cam).toMatchObject({ x: home.cam.x, z: home.cam.z });
    expect(look.z).toBeCloseTo(home.look.z, 6);
    followGoal(at(-10, 8, -30), cam, look, home);
    expect(look.x).toBeLessThan(-5);
    expect(look.z).toBeCloseTo(-30, 6);
    expect(cam.y).toBeGreaterThan(home.cam.y);
  });

  it('stays near home so it never ends up inside the stands', () => {
    for (const aspect of [0.46, 1, 2.2]) {
      const cam = at(0, 0, 0);
      followGoal(at(40, 20, -60), cam, at(0, 0, 0), homeView(aspect));
      expect(Math.abs(cam.x)).toBeLessThan(6);
      expect(cam.z).toBeGreaterThan(0);
    }
  });

  it('comes down a little on a wide screen so people fill more of the picture', () => {
    expect(homeView(2.2).cam.y).toBeLessThan(homeView(0.46).cam.y);
    expect(homeView(0.3)).toEqual(homeView(0.5));
    expect(homeView(5)).toEqual(homeView(2.5));
  });
});

describe('the view of a hit', () => {
  const SCREENS: [number, number][] = [
    [390, 844],
    [844, 390],
    [568, 320],
    [768, 1024],
    [1366, 1024],
  ];

  it('keeps everything below the scorebug and leaves the foot of the screen to the field', () => {
    expect(hitBand(390, 844, 150)).toEqual({ top: 158, bottom: 832 });
    const guess = hitBand(390, 844);
    expect(guess.top).toBeGreaterThan(100);
    expect(guess.bottom).toBeGreaterThan(guess.top);
    expect(centreShift(800, { top: 100, bottom: 700 })).toBe(0);
    expect(centreShift(800, { top: 200, bottom: 700 })).toBe(-50);
  });

  it.each(SCREENS)(
    'closes a home run on the whole scoreboard and the fireworks at %ix%i',
    (w, h) => {
      const fit = fitView(w, h);
      const band = hitBand(w, h);
      const shot = fireworksFit(w, h, fit.fov, band);
      expect(shot.fov).toBeGreaterThanOrEqual(fit.fov);
      // A little wider than the batting view, never a lurch to a fisheye.
      expect(shot.fov).toBeLessThanOrEqual(fit.fov + 12);
      const cam = at(0, 0, 0);
      const look = at(0, 0, 0);
      followGoal(fireworksAim(), cam, look, homeView(w / h));
      // The scoreboard's four corners and the furthest the sparks reach either way.
      const spots = [
        ...[-1, 1].flatMap((sx) =>
          [-1, 1].map((sy) =>
            at(BOARD.x + (sx * BOARD.width) / 2, BOARD.y + (sy * BOARD.height) / 2, BOARD.z),
          ),
        ),
        ...[-1, 1].flatMap((sx) =>
          [-1, 1].map((sy) =>
            at(
              FIREWORKS_CENTRE.x + sx * BURST_RADIUS,
              FIREWORKS_CENTRE.y + sy * BURST_RADIUS,
              FIREWORKS_CENTRE.z,
            ),
          ),
        ),
      ];
      expect(fireworksPoints()).toEqual(spots.slice(0, 4).concat(spots.slice(4)));
      for (const p of spots) {
        const screen = project(p, cam, look, shot.fov, w, h);
        const row = screen.y - shot.shift;
        expect(row).toBeGreaterThanOrEqual(band.top);
        expect(row).toBeLessThanOrEqual(band.bottom);
        expect(screen.x).toBeGreaterThanOrEqual(0);
        expect(screen.x).toBeLessThanOrEqual(w);
      }
    },
  );

  const HITS = ['single', 'double', 'triple'] as const;
  it.each(SCREENS)(
    'never leaves the scoreboard half behind the scorebug on a single, double or triple at %ix%i',
    (w, h) => {
      const fit = fitView(w, h);
      const band = hitBand(w, h);
      const home = homeView(w / h);
      const lift = (band.top + band.bottom) / 2 - h / 2;
      for (const hit of HITS) {
        for (const side of [-1, 1] as const) {
          for (const roll of [0, 0.5, 1]) {
            const plan = planHit(hit, side, roll, roll);
            const ball = at(0, 0, 0);
            const cam = at(0, 0, 0);
            const look = at(0, 0, 0);
            for (let t = 0; t <= plan.duration + 0.5; t += 0.1) {
              plan.position(t, ball);
              followGoal(ball, cam, look, home);
              keepBoardClear(ball, cam, look, fit.fov, w, h, band);
              const spots = [-1, 1].flatMap((sx) =>
                [-1, 1].map((sy) =>
                  project(
                    at(
                      BOARD.x + (sx * BOARD.width) / 2,
                      BOARD.y + (sy * BOARD.height) / 2,
                      BOARD.z,
                    ),
                    cam,
                    look,
                    fit.fov,
                    w,
                    h,
                  ),
                ),
              );
              const top = Math.min(...spots.map((p) => p.y)) + lift;
              const bottom = Math.max(...spots.map((p) => p.y)) + lift;
              const left = Math.min(...spots.map((p) => p.x));
              const right = Math.max(...spots.map((p) => p.x));
              // Wholly in the band with its sides on screen, or wholly out of the picture.
              const inside = top >= band.top - 0.5 && left >= -0.5 && right <= w + 0.5;
              const gone = bottom <= 0.5 || right <= 0.5 || left >= w - 0.5;
              expect(inside || gone).toBe(true);
            }
            // The closing frame still shows the ball.
            const row = project(ball, cam, look, fit.fov, w, h).y + lift;
            expect(row).toBeGreaterThan(band.top);
            expect(row).toBeLessThan(band.bottom);
          }
        }
      }
    },
  );

  it('leaves the aim alone once the scoreboard is clear', () => {
    const fit = fitView(844, 390);
    const band = hitBand(844, 390);
    const cam = at(0.4, 3.5, 11);
    const look = at(0, 0.5, -30);
    const ball = at(0, 0.2, -30);
    keepBoardClear(ball, cam, look, fit.fov, 844, 390, band);
    const settled = { ...look };
    keepBoardClear(ball, cam, look, fit.fov, 844, 390, band);
    expect(look).toEqual(settled);
  });
});

describe("the umpire's call on screen", () => {
  it('goes in the question panel on tall and narrow screens, and beside the plate on wide ones', () => {
    for (const [w, h] of [
      [360, 740],
      [390, 844],
      [768, 1024],
    ]) {
      expect(callInPanel(w, h)).toBe(true);
    }
    for (const [w, h] of [
      [844, 390],
      [1024, 768],
      [1366, 1024],
    ]) {
      expect(callInPanel(w, h)).toBe(false);
    }
  });
});

describe('the people', () => {
  it('builds a person that can be posed without error, and blends two poses', () => {
    const person = createPerson({ shirt: 0xff0000, pants: 0x0000ff, hat: 'cap' });
    const a = neutralPose();
    const b = neutralPose();
    b.armR.raise = 2;
    b.lean = 1;
    const mid = mixPose(a, b, 0.5, neutralPose());
    expect(mid.armR.raise).toBe(1);
    expect(mid.lean).toBe(0.5);
    person.apply(mid);
    expect(person.root.children.length).toBeGreaterThan(0);
    const hand = person.handWorld('R', new Vector3());
    expect(Number.isFinite(hand.y)).toBe(true);
  });

  it('puts the batter at the plate with the bat meeting the ball where it arrives', () => {
    const batter = createBatter();
    const pos = batter.person.root.position;
    // Beside the plate on the third-base side, not on top of it.
    expect(pos.x).toBeLessThan(-0.5);
    expect(pos.x).toBeGreaterThan(-2.6);
    expect(Math.abs(pos.z)).toBeLessThan(1.5);
    expect(SWING_CONTACT).toBeCloseTo(0.3, 6);
  });

  it('swings through to the follow-through, and can drop the bat', () => {
    const scene = new Scene();
    const batter = createBatter();
    scene.add(batter.person.root);
    batter.swing();
    for (let i = 0; i < 60; i++) batter.mover.update(1 / 60, i / 60);
    const prop = batter.dropBat();
    expect(prop).not.toBeNull();
    expect(batter.dropBat()).toBeNull();
    let alive = true;
    for (let i = 0; i < 400 && alive; i++) alive = prop!.update(1 / 60);
    expect(alive).toBe(false);
    expect(prop!.object.position.y).toBeLessThan(0.2);
  });

  it('gives each batter their own colours', () => {
    const batter = createBatter();
    const before = batter.person.materials.shirt.color.getHex();
    batter.setLook(1);
    expect(batter.person.materials.shirt.color.getHex()).not.toBe(before);
    batter.setLook(1 + 9);
    expect(batter.person.materials.shirt.color.getHex()).not.toBe(before);
  });

  it('holds the catcher behind the plate with the mitt under the ball', () => {
    const catcher = createCatcher();
    catcher.update(0.016, 0);
    const mitt = catcher.mittPosition(new Vector3());
    expect(mitt.x).toBeCloseTo(GLOVE.x, 1);
    expect(mitt.z).toBeCloseTo(GLOVE.z, 1);
    expect(mitt.y).toBeGreaterThan(0.4);
    expect(mitt.y).toBeLessThan(1.6);
    catcher.pop();
    catcher.update(0.05, 0.1);
  });

  it('lets the pitcher release the ball once, a moment into the throw', () => {
    const pitcher = createPitcher();
    pitcher.windUp();
    for (let i = 0; i < 60; i++) pitcher.update(1 / 60, i / 60);
    expect(pitcher.windTime).toBeGreaterThan(0.9);
    let released = 0;
    pitcher.release(() => released++);
    pitcher.update(0.05, 1);
    expect(released).toBe(0);
    pitcher.update(0.1, 1.05);
    expect(released).toBe(1);
    for (let i = 0; i < 60; i++) pitcher.update(1 / 60, 1.2 + i / 60);
    expect(released).toBe(1);
    expect(pitcher.handPosition(new Vector3()).y).toBeGreaterThan(0.3);
    pitcher.reset();
    expect(pitcher.windTime).toBe(0);
  });

  it('lets the umpire call a strike and go back to standing', () => {
    const umpire = createUmpire();
    umpire.callStrike(true);
    for (let i = 0; i < 90; i++) umpire.update(1 / 60, i / 60);
    umpire.reset();
    umpire.update(0.1, 2);
    expect(umpire.root.position.z).toBeGreaterThan(2);
  });

  it('puts all seven fielders in their places, facing home', () => {
    const ids = Object.keys(FIELDER_SPOTS) as FielderId[];
    expect(ids.sort()).toEqual(['1B', '2B', '3B', 'CF', 'LF', 'RF', 'SS']);
    for (const [i, id] of ids.entries()) {
      const fielder = createFielder(id, i);
      const pos = fielder.mover.person.root.position;
      expect(pos.x).toBeCloseTo(FIELDER_SPOTS[id].x, 6);
      expect(pos.z).toBeCloseTo(FIELDER_SPOTS[id].z, 6);
      expect(fielder.atHome()).toBe(true);
    }
    // First base is on the right, third on the left; the outfielders are further out.
    expect(FIELDER_SPOTS['1B'].x).toBeGreaterThan(0);
    expect(FIELDER_SPOTS['3B'].x).toBeLessThan(0);
    expect(FIELDER_SPOTS.LF.x).toBeLessThan(0);
    expect(FIELDER_SPOTS.RF.x).toBeGreaterThan(0);
    expect(FIELDER_SPOTS.CF.z).toBeLessThan(FIELDER_SPOTS.SS.z - 5);
  });

  it('sends a fielder after the ball and back again', () => {
    const fielder = createFielder('LF', 0);
    let arrived = 0;
    fielder.chase(at(-3, 0, -40), 9, 'scoop', () => arrived++);
    for (let i = 0; i < 60; i++) fielder.mover.update(1 / 60, i / 60);
    expect(arrived).toBe(0);
    expect(fielder.mover.moving).toBe(true);
    for (let i = 0; i < 240; i++) fielder.mover.update(1 / 60, 1 + i / 60);
    expect(arrived).toBe(1);
    expect(fielder.mover.person.root.position.x).toBeCloseTo(-3, 6);
    fielder.goHome(7);
    for (let i = 0; i < 600; i++) fielder.mover.update(1 / 60, 5 + i / 60);
    expect(fielder.atHome()).toBe(true);
  });

  it('runs a person along a path at a steady speed and stops at the end', () => {
    const person = createPerson({ shirt: 1, pants: 2 });
    const mover = createMover(person);
    let arrived = false;
    mover.runTo([at(0, 0, -10), at(10, 0, -10)], 10, () => (arrived = true));
    for (let i = 0; i < 15; i++) mover.update(0.1, i * 0.1);
    // 1.5 seconds at 10 units/s is 15 of the 20 units.
    expect(arrived).toBe(false);
    expect(person.root.position.x).toBeCloseTo(5, 6);
    for (let i = 0; i < 10; i++) mover.update(0.1, 1.5 + i * 0.1);
    expect(arrived).toBe(true);
    expect(person.root.position.x).toBeCloseTo(10, 6);
    expect(person.root.position.z).toBeCloseTo(-10, 6);
    expect(mover.moving).toBe(false);
  });

  it('can be told to stop short', () => {
    const mover = createMover(createPerson({ shirt: 1, pants: 2 }));
    let arrived = false;
    mover.runTo([at(0, 0, -50)], 10, () => (arrived = true));
    mover.update(0.5, 0);
    mover.halt();
    mover.update(0.5, 0.5);
    expect(arrived).toBe(false);
    expect(mover.person.root.position.z).toBeCloseTo(-5, 6);
  });

  it('keeps the ball and its shadow together, drawing it bigger when asked', () => {
    const ball = createBall();
    ball.place(at(1, 2, 3), 2);
    const [mesh, shadow] = ball.object.children;
    expect(mesh.position.x).toBe(1);
    expect(mesh.scale.x).toBe(2);
    expect(shadow.position.y).toBeLessThan(0.1);
    ball.setVisible(false);
    expect(ball.object.visible).toBe(false);
  });
});

describe('the ballpark', () => {
  it('builds the field, and redraws the scoreboard without a canvas', () => {
    const scene = new Scene();
    const field = buildField(scene);
    expect(scene.children.length).toBeGreaterThan(30);
    expect(() =>
      field.setBoard({ runs: 3, outs: 2, strikes: 1, batter: 5, batters: 9 }),
    ).not.toThrow();
    // Fireworks go off beyond the outfield wall and well above it.
    expect(field.fireworksCentre.z).toBeLessThan(-wallRadius(0));
    expect(field.fireworksCentre.y).toBeGreaterThan(15);
  });

  it('bursts fireworks after the rocket has climbed, and clears them', () => {
    const effects = createEffects();
    let bursts = 0;
    effects.onBurst = () => bursts++;
    effects.firework(at(0, 30, -50), 0xff0000, 0.2);
    effects.update(0.1);
    expect(bursts).toBe(0);
    for (let i = 0; i < 100; i++) effects.update(0.016);
    expect(bursts).toBe(1);
    effects.crack(CONTACT);
    effects.pop(GLOVE);
    effects.dust(at(0, 0, -20));
    effects.trail(at(0, 2, -5), 0.5);
    effects.halo(at(0, 2, -5), 0.8, 0.05);
    effects.setScale(500);
    effects.update(0.016);
    effects.clear();
    effects.update(0.016);
  });
});

describe('manifest', () => {
  it('is a points game called Batter Up', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const manifest = JSON.parse(
      readFileSync(resolve(import.meta.dirname, '../src/games/batter-up/game.json'), 'utf8'),
    );
    expect(manifest.id).toBe('batter-up');
    expect(manifest.title).toBe('Batter Up');
    expect(manifest.scoring).toBe('score');
    expect(manifest.tags).toEqual(['sports', '3d']);
  });
});
