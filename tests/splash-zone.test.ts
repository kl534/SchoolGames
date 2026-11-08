import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { MAX_DEV_STREAK, parseDev } from '../src/games/splash-zone/dev';
import {
  CAM_BACK,
  CAM_UP,
  bandShift,
  blendCam,
  chasePose,
  createPose,
  fovFor,
  playBand,
  bandFraction,
  framingMid,
  stuntDistance,
  stuntPose,
  CAM_AZIMUTH,
  SIDE_MARGIN,
  SWING_IN,
  stuntLookD,
  CAM_EYE,
  LOOK_LAG,
  STUNT_MAX_DIST,
  STUNT_MIN_DIST,
} from '../src/games/splash-zone/layout';
import {
  BASE_POINTS,
  COIN_GAP,
  COIN_SWAY,
  COIN_TRAIL,
  ENTRY_SPEED,
  GREAT_RIDING_SPEECH,
  MAX_GAP,
  MIN_GAP,
  NEW_HIGH_SCORE_SPEECH,
  OUT_OF_SKIS_SPEECH,
  RIDE_SPEED,
  SKIS,
  SPEED_MAX,
  TIME_BONUS,
  TIER_LAUNCHER,
  TRICK_IDS,
  TRICK_TIER,
  TURBO_MAX,
  approach,
  approachProgress,
  coinSide,
  easeToward,
  hitPoints,
  loseSki,
  meterFill,
  nextStreak,
  nextTrick,
  outOfSkis,
  tierFor,
  trailLength,
  turboSpeed,
  worldSpeedFactor,
  type Tier,
  type TrickId,
} from '../src/games/splash-zone/rules';
import { LAUNCHERS } from '../src/games/splash-zone/anim';
import {
  TRICK_SPECS,
  createFrame,
  focusOf,
  trickDuration,
  trickFrame,
  trickFraming,
} from '../src/games/splash-zone/tricks';
import { VOICE_LINES } from '../src/games/splash-zone/voice';
import { runs } from './helpers/full';

describe('tier', () => {
  it('steps up at streaks 3 and 6', () => {
    expect([0, 2, 3, 5, 6, 40].map(tierFor)).toEqual([1, 1, 2, 2, 3, 3]);
  });

  it('the tier meter is empty until the first right answer, then fills to the tier', () => {
    expect([0, 1, 2, 3, 5, 6, 40].map(meterFill)).toEqual([0, 1, 1, 2, 2, 3, 3]);
  });

  it('tiers have their launcher', () => {
    expect(TIER_LAUNCHER).toEqual({ 1: 'wave', 2: 'kicker', 3: 'mega-ramp' });
  });

  it('the 4th right answer in a row is the first tier 2 trick, the 7th the first tier 3', () => {
    let streak = 0;
    const tiers: Tier[] = [];
    for (let i = 0; i < 8; i++) {
      tiers.push(tierFor(streak));
      streak = nextStreak(streak, true);
    }
    expect(tiers).toEqual([1, 1, 1, 2, 2, 2, 3, 3]);
  });
});

describe('nextTrick', () => {
  it('has ten tricks, four, three and three to a tier', () => {
    expect(TRICK_IDS).toHaveLength(10);
    for (const [tier, count] of [
      [1, 4],
      [2, 3],
      [3, 3],
    ] as const) {
      expect(TRICK_IDS.filter((id) => TRICK_TIER[id] === tier)).toHaveLength(count);
    }
  });

  it('always gives the tier asked, never the previous trick, and reaches every allowed one', () => {
    const n = runs(2000, 2000);
    for (const tier of [1, 2, 3] as const) {
      const allowed = TRICK_IDS.filter((id) => TRICK_TIER[id] === tier);
      for (const previous of [null, ...TRICK_IDS] as (TrickId | null)[]) {
        const seen = new Set<TrickId>();
        for (let i = 0; i < n; i++) {
          const trick = nextTrick(tier, previous, i / n);
          expect(TRICK_TIER[trick]).toBe(tier);
          expect(trick).not.toBe(previous);
          seen.add(trick);
        }
        expect([...seen].sort()).toEqual(allowed.filter((id) => id !== previous).sort());
      }
    }
  });

  it('works with a previous trick from another tier: the whole tier is allowed', () => {
    const seen = new Set<TrickId>();
    for (let i = 0; i < 100; i++) seen.add(nextTrick(2, 'wave-hop', i / 100));
    expect(seen.size).toBe(3);
  });

  it('picks by index in TRICK_IDS order and survives odd randoms', () => {
    expect(nextTrick(1, null, 0)).toBe('wave-hop');
    expect(nextTrick(1, null, 0.99)).toBe('tail-stand');
    expect(nextTrick(1, 'wave-hop', 0)).toBe('spray-spin');
    expect(nextTrick(3, null, 1)).toBe('corkscrew');
    expect(nextTrick(3, null, -1)).toBe('double-backflip');
    expect(nextTrick(3, 'corkscrew', 5)).toBe('submarine');
  });
});

describe('points', () => {
  it('hitPoints: 100, plus up to 50 for time left, times the tier', () => {
    expect(hitPoints(10, 10, 1)).toBe(150);
    expect(hitPoints(0, 10, 1)).toBe(100);
    expect(hitPoints(5, 10, 2)).toBe(250);
    expect(hitPoints(10, 10, 3)).toBe(450);
    expect(BASE_POINTS + TIME_BONUS).toBe(150);
  });

  it('a timer of 0 counts as no time left, and odd times are clamped', () => {
    expect(hitPoints(5, 0, 1)).toBe(100);
    expect(hitPoints(5, 0, 3)).toBe(300);
    expect(hitPoints(5, -3, 2)).toBe(200);
    expect(hitPoints(-4, 10, 1)).toBe(100);
    expect(hitPoints(40, 10, 1)).toBe(150);
  });

  it('nextStreak, loseSki and outOfSkis', () => {
    expect(nextStreak(4, true)).toBe(5);
    expect(nextStreak(4, false)).toBe(0);
    expect(SKIS).toBe(3);
    expect(loseSki(3)).toBe(2);
    expect(loseSki(0)).toBe(0);
    expect(outOfSkis(1)).toBe(false);
    expect(outOfSkis(0)).toBe(true);
  });

  it('worldSpeedFactor grows 5 % a trick and caps at 1.6', () => {
    expect(worldSpeedFactor(0)).toBe(1);
    expect(worldSpeedFactor(4)).toBeCloseTo(1.2, 9);
    expect(worldSpeedFactor(12)).toBeCloseTo(1.6, 9);
    expect(worldSpeedFactor(500)).toBe(SPEED_MAX);
    expect(worldSpeedFactor(-3)).toBe(1);
  });

  it('easeToward moves a fraction of the way and never overshoots', () => {
    expect(easeToward(0, 10, 4, 0)).toBe(0);
    const a = easeToward(0, 10, 4, 0.1);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(10);
    expect(easeToward(0, 10, 4, 100)).toBeCloseTo(10, 6);
  });
});

describe('the approach', () => {
  it('clamps the gap to MIN_GAP and MAX_GAP, and rides so that it arrives as the clock ends', () => {
    for (const landed of [0, 3, 10, 40]) {
      for (const clock of [0, 0.5, 1, 2, 4, 6, 10, 30]) {
        const { gap, rideSpeed } = approach(landed, clock);
        expect(gap).toBeGreaterThanOrEqual(MIN_GAP);
        expect(gap).toBeLessThanOrEqual(MAX_GAP);
        expect(rideSpeed * Math.max(clock, 1)).toBeCloseTo(gap, 9);
      }
    }
    expect(approach(0, 1).gap).toBe(MIN_GAP);
    expect(approach(0, 100).gap).toBe(MAX_GAP);
    expect(approach(0, 6).gap).toBeCloseTo(RIDE_SPEED * 6, 9);
    expect(approach(4, 6).gap).toBeCloseTo(RIDE_SPEED * 1.2 * 6, 9);
  });

  it('turboSpeed stays between the entry speed and the maximum', () => {
    expect(turboSpeed(0)).toBe(ENTRY_SPEED);
    expect(turboSpeed(5)).toBe(ENTRY_SPEED);
    expect(turboSpeed(90)).toBe(TURBO_MAX);
    expect(turboSpeed(30)).toBeCloseTo(30 / 0.9, 9);
    for (let gap = 0; gap < 200; gap += 3) {
      expect(turboSpeed(gap)).toBeGreaterThanOrEqual(ENTRY_SPEED);
      expect(turboSpeed(gap)).toBeLessThanOrEqual(TURBO_MAX);
    }
  });

  it('approachProgress runs from 0 to 1', () => {
    expect(approachProgress(6, 6)).toBe(0);
    expect(approachProgress(3, 6)).toBe(0.5);
    expect(approachProgress(0, 6)).toBe(1);
    expect(approachProgress(-1, 6)).toBe(1);
    expect(approachProgress(5, 0)).toBe(1);
  });
});

describe('coins', () => {
  it('trails are 4, 5 or 6 coins 3 u apart', () => {
    expect(COIN_GAP).toBe(3);
    expect([0, 0.34, 0.67, 0.999, 1, -1].map(trailLength)).toEqual([4, 5, 6, 6, 6, 4]);
    expect([...COIN_TRAIL]).toEqual([4, 5, 6]);
  });

  it('coinSide is 0 at both ends and never more than 2.2 to either side', () => {
    for (const n of COIN_TRAIL) {
      for (const sign of [-1, 1]) {
        expect(Math.abs(coinSide(0, n, sign))).toBeCloseTo(0, 9);
        expect(Math.abs(coinSide(n - 1, n, sign))).toBeCloseTo(0, 9);
        for (let i = 0; i < n; i++) {
          expect(Math.abs(coinSide(i, n, sign))).toBeLessThanOrEqual(COIN_SWAY + 1e-9);
        }
      }
      // A gentle S: the sign decides which way it bulges.
      expect(coinSide(1, n, 1)).toBeGreaterThan(0);
      expect(coinSide(1, n, -1)).toBeLessThan(0);
    }
    expect(COIN_SWAY).toBe(2.2);
    expect(coinSide(0, 1, 1)).toBe(0);
  });
});

// ---------- Layout ----------

const SCREENS: [number, number][] = [
  [390, 844],
  [844, 390],
  [1024, 768],
  [1366, 1024],
];

/** A camera with the picture slid so its middle is the middle of the band. */
function probeCamera(width: number, height: number): PerspectiveCamera {
  const camera = new PerspectiveCamera(fovFor(width / height), width / height, 0.3, 400);
  camera.setViewOffset(width, height, 0, bandShift(width, height), width, height);
  return camera;
}

/** The screen row of a world point for the chase camera resting behind a ski at the origin. */
function chaseRow(width: number, height: number, x: number, y: number, z: number): number {
  const camera = new PerspectiveCamera(fovFor(width / height), width / height, 0.3, 400);
  camera.setViewOffset(width, height, 0, bandShift(width, height), width, height);
  const pose = chasePose(0, 0, 0);
  camera.position.set(pose.x, pose.y, pose.z);
  camera.lookAt(pose.lookX, pose.lookY, pose.lookZ);
  camera.updateMatrixWorld();
  const p = new Vector3(x, y, z).project(camera);
  return ((1 - p.y) / 2) * height;
}

describe('layout', () => {
  it.each(SCREENS)('%i x %i keeps the ski in the band and the ramp lip above it', (w, h) => {
    const band = playBand(w, h);
    const ski = chaseRow(w, h, 0, 0, 0);
    expect(ski).toBeGreaterThanOrEqual(band.top + 40);
    expect(ski).toBeLessThanOrEqual(band.bottom - 30);
    // A mega ramp's lip, as near as the launcher can be when the clock starts.
    const lip = chaseRow(w, h, 0, 4.2, -MIN_GAP);
    expect(lip).toBeGreaterThan(band.top);
    expect(lip).toBeLessThan(ski);
    // The launcher's foot is on screen too, and so is the whole approach to it.
    const far = chaseRow(w, h, 0, 0, -MAX_GAP);
    expect(far).toBeGreaterThan(0);
    expect(far).toBeLessThan(ski);
  });

  it('the camera is behind and above the ski, looking ahead', () => {
    const pose = chasePose(0, 0, 0);
    expect(pose.y).toBe(CAM_UP);
    expect(pose.z).toBe(CAM_BACK);
    expect(pose.lookZ).toBeLessThan(0);
    const other = chasePose(2, 1, -10);
    expect(other.x).toBe(2);
    expect(other.y).toBe(1 + CAM_UP);
    expect(other.z).toBe(-10 + CAM_BACK);
  });

  it('fovFor stays between 52 and 74 degrees', () => {
    expect(fovFor(2)).toBe(52);
    expect(fovFor(1)).toBe(52);
    expect(fovFor(0.1)).toBe(74);
    for (let aspect = 0.2; aspect < 3; aspect += 0.05) {
      expect(fovFor(aspect)).toBeGreaterThanOrEqual(52);
      expect(fovFor(aspect)).toBeLessThanOrEqual(74);
    }
    expect(fovFor(390 / 844)).toBeGreaterThan(fovFor(1024 / 768));
    expect(fovFor(Number.NaN)).toBe(52);
  });

  it('the band is inside the screen and bandShift centres the picture on it', () => {
    for (const [w, h] of SCREENS) {
      const band = playBand(w, h);
      expect(band.top).toBeGreaterThan(0);
      expect(band.bottom).toBeLessThan(h);
      expect(band.bottom - band.top).toBeGreaterThan(150);
      expect(h / 2 - bandShift(w, h)).toBeCloseTo((band.top + band.bottom) / 2, 9);
    }
  });

  it('the stunt camera is a three-quarter side view on the right, nearly level', () => {
    const pose = stuntPose(1, -20, 3, 15);
    expect(pose.lookX).toBe(1);
    expect(pose.lookZ).toBe(-20);
    expect(pose.lookY).toBe(3);
    expect(pose.y - pose.lookY).toBeCloseTo(CAM_EYE, 9);
    // 70 degrees off the travel axis, to the right and a little behind.
    const dx = pose.x - pose.lookX;
    const dz = pose.z - pose.lookZ;
    expect(dx).toBeGreaterThan(0);
    expect(dz).toBeGreaterThan(0);
    expect(Math.hypot(dx, dz)).toBeCloseTo(15, 9);
    expect((Math.atan2(dx, dz) * 180) / Math.PI).toBeCloseTo(70, 6);
    expect(CAM_AZIMUTH).toBeCloseTo((70 * Math.PI) / 180, 9);
  });

  it('blends smoothly from the chase pose into the stunt pose', () => {
    const chase = chasePose(0, 0, 0);
    const stunt = stuntPose(0, -20, 2, 15);
    const start = blendCam(chase, stunt, 0, createPose());
    const end = blendCam(chase, stunt, 1, createPose());
    expect(start.x).toBeCloseTo(chase.x, 9);
    expect(end.x).toBeCloseTo(stunt.x, 9);
    expect(end.lookZ).toBeCloseTo(stunt.lookZ, 9);
    const mid = blendCam(chase, stunt, 0.5, createPose());
    expect(mid.x).toBeGreaterThan(chase.x);
    expect(mid.x).toBeLessThan(stunt.x);
  });

  it('taller tricks stand further back, within limits', () => {
    const fov = fovFor(844 / 390);
    const fraction = bandFraction(844, 390);
    const wave = stuntDistance(trickFraming('wave-hop', 'clear'), fov, fraction);
    const kicker = stuntDistance(trickFraming('backflip', 'clear'), fov, fraction);
    const mega = stuntDistance(trickFraming('double-backflip', 'clear'), fov, fraction);
    expect(wave).toBeLessThan(kicker);
    expect(kicker).toBeLessThan(mega);
    for (const id of TRICK_IDS) {
      for (const outcome of ['clear', 'fail'] as const) {
        const d = stuntDistance(trickFraming(id, outcome), fov, fraction);
        expect(d).toBeGreaterThanOrEqual(STUNT_MIN_DIST);
        expect(d).toBeLessThanOrEqual(STUNT_MAX_DIST);
      }
    }
    expect(framingMid({ peak: 8, low: -2 })).toBe(3);
  });

  it('every trick shows the lip at take-off and the ski big enough', () => {
    for (const [w, h] of [
      [844, 390],
      [390, 844],
      [1024, 768],
    ] as const) {
      const band = playBand(w, h);
      const bandH = band.bottom - band.top;
      const aspect = w / h;
      const fov = fovFor(aspect);
      for (const id of TRICK_IDS) {
        for (const outcome of ['clear', 'fail'] as const) {
          const framing = trickFraming(id, outcome);
          const dist = stuntDistance(framing, fov, bandFraction(w, h), aspect);
          const lip = LAUNCHERS[TRICK_SPECS[id].launcher];
          const camera = probeCamera(w, h);
          const pose = stuntPose(0, -lip.lipD, framingMid(framing), dist);
          camera.position.set(pose.x, pose.y, pose.z);
          camera.lookAt(pose.lookX, pose.lookY, pose.lookZ);
          camera.updateMatrixWorld();
          const p = new Vector3(0, lip.lipY, -lip.lipD).project(camera);
          const lipRow = ((1 - p.y) / 2) * h;
          expect(lipRow).toBeGreaterThan(band.top);
          expect(lipRow).toBeLessThan(band.bottom);
          expect(((p.x + 1) / 2) * w).toBeGreaterThan(SIDE_MARGIN * w);
          expect(((p.x + 1) / 2) * w).toBeLessThan((1 - SIDE_MARGIN) * w);
          // The ski and its seated rider (1.7 u tall) are a good part of the band's height.
          const pixelsPerUnit = h / (2 * dist * Math.tan((fov * Math.PI) / 360));
          if (dist < STUNT_MAX_DIST) {
            // (A narrow screen has to stand back further to fit the width, so the ski is a bit smaller.)
            expect((1.7 * pixelsPerUnit) / bandH).toBeGreaterThanOrEqual(aspect < 1 ? 0.07 : 0.115);
          }
        }
      }
    }
    expect(LOOK_LAG).toBeGreaterThan(0);
  });

  it('through every trick the ski and a free rider stay inside the screen sides and the band', () => {
    const dt = 1 / 60;
    for (const [w, h] of [
      [390, 844],
      [844, 390],
      [1024, 768],
    ] as const) {
      const band = playBand(w, h);
      const aspect = w / h;
      const fov = fovFor(aspect);
      for (const id of TRICK_IDS) {
        for (const outcome of ['clear', 'fail'] as const) {
          const framing = trickFraming(id, outcome);
          const dist = stuntDistance(framing, fov, bandFraction(w, h), aspect);
          const lipD = LAUNCHERS[TRICK_SPECS[id].launcher].lipD;
          const camera = probeCamera(w, h);
          const frame = createFrame();
          const focus = { d: 0, y: 0, s: 0 };
          trickFrame(id, outcome, 0, frame);
          focusOf(frame, focus);
          // The camera as the game steers it: it eases after the look point at rate 8.
          let camD = stuntLookD(focus.d, lipD, dist, fov, aspect);
          let camS = focus.s;
          const mid = framingMid(framing);
          const screen = (s: number, y: number, d: number) => {
            const p = new Vector3(s, y, -d).project(camera);
            return { x: ((p.x + 1) / 2) * w, y: ((1 - p.y) / 2) * h };
          };
          const duration = trickDuration(id, outcome);
          for (let t = 0; t <= duration + 1e-9; t += dt) {
            trickFrame(id, outcome, t, frame);
            focusOf(frame, focus);
            camD = easeToward(camD, stuntLookD(focus.d, lipD, dist, fov, aspect), 8, dt);
            camS = easeToward(camS, focus.s, 8, dt);
            // The swing out from the chase view takes SWING_IN seconds.
            if (t < SWING_IN) continue;
            const pose = stuntPose(camS, -camD, mid, dist);
            camera.position.set(pose.x, pose.y, pose.z);
            camera.lookAt(pose.lookX, pose.lookY, pose.lookZ);
            camera.updateMatrixWorld();
            const seen: { x: number; y: number; what: string }[] = [];
            if (frame.ski.visible) {
              seen.push({ ...screen(frame.ski.s, frame.ski.y, frame.ski.d), what: 'ski' });
            }
            if (frame.rider.mode === 'free' && frame.rider.visible) {
              seen.push({ ...screen(frame.rider.s, frame.rider.y, frame.rider.d), what: 'rider' });
            }
            for (const point of seen) {
              const where = `${id} ${outcome} ${point.what} at ${t.toFixed(2)}s, ${w}x${h}`;
              expect(point.x, where).toBeGreaterThanOrEqual(SIDE_MARGIN * w);
              expect(point.x, where).toBeLessThanOrEqual((1 - SIDE_MARGIN) * w);
              expect(point.y, where).toBeGreaterThanOrEqual(band.top);
              expect(point.y, where).toBeLessThanOrEqual(band.bottom);
            }
          }
        }
      }
    }
  });
});

// ---------- Dev hooks and voice ----------

describe('parseDev', () => {
  it('reads each hook', () => {
    expect(parseDev('?tricks=backflip,submarine').tricks).toEqual(['backflip', 'submarine']);
    expect(parseDev('?streak=6').streak).toBe(6);
    expect(parseDev('?skis=1').skis).toBe(1);
    expect(parseDev('?lab=backflip:clear').lab).toEqual({ trick: 'backflip', outcome: 'clear' });
    expect(parseDev('?lab=submarine:fail&at=3.5')).toMatchObject({
      lab: { trick: 'submarine', outcome: 'fail' },
      at: 3.5,
    });
    expect(parseDev('?lab=respawn&at=0.9')).toMatchObject({ lab: { respawn: true }, at: 0.9 });
    expect(parseDev('?lab=whale-of-a-time:3&at=7.4')).toMatchObject({
      lab: { mega: 'whale-of-a-time', passed: 3 },
      at: 7.4,
    });
    expect(parseDev('?lab=harbour-havoc:0').lab).toEqual({ mega: 'harbour-havoc', passed: 0 });
    expect(parseDev('?world=harbour').world).toBe('harbour');
    expect(parseDev('?world=iceberg').world).toBe('iceberg');
    expect(parseDev('?lab=penguin-parade:2&at=4').lab).toEqual({
      mega: 'penguin-parade',
      passed: 2,
    });
    expect(parseDev('?mega=1').mega).toBe(true);
  });

  it('has nothing set by default', () => {
    expect(parseDev('')).toEqual({
      tricks: [],
      streak: null,
      skis: null,
      lab: null,
      at: null,
      world: null,
      mega: false,
    });
  });

  it('ignores malformed input', () => {
    expect(parseDev('?tricks=backflip,nope,,corkscrew').tricks).toEqual(['backflip', 'corkscrew']);
    expect(parseDev('?tricks=').tricks).toEqual([]);
    expect(parseDev('?streak=x').streak).toBeNull();
    expect(parseDev('?streak=').streak).toBeNull();
    expect(parseDev('?streak=-1').streak).toBeNull();
    expect(parseDev('?streak=2.5').streak).toBeNull();
    expect(parseDev(`?streak=${MAX_DEV_STREAK + 1}`).streak).toBeNull();
    expect(parseDev(`?streak=${MAX_DEV_STREAK}`).streak).toBe(MAX_DEV_STREAK);
    expect(parseDev('?streak=0').streak).toBe(0);
    expect(parseDev('?skis=0').skis).toBeNull();
    expect(parseDev('?skis=4').skis).toBeNull();
    expect(parseDev('?skis=2').skis).toBe(2);
    expect(parseDev('?lab=backflip').lab).toBeNull();
    expect(parseDev('?lab=backflip:crash').lab).toBeNull();
    expect(parseDev('?lab=nope:clear').lab).toBeNull();
    expect(parseDev('?lab=backflip:clear:0').lab).toBeNull();
    expect(parseDev('?lab=whale-of-a-time').lab).toBeNull();
    expect(parseDev('?lab=whale-of-a-time:4').lab).toBeNull();
    expect(parseDev('?lab=whale-of-a-time:-1').lab).toBeNull();
    expect(parseDev('?lab=whale-of-a-time:1.5').lab).toBeNull();
    expect(parseDev('?lab=whale-of-a-time:clear').lab).toBeNull();
    expect(parseDev('?lab=nope:2').lab).toBeNull();
    expect(parseDev('?lab=harbour-havoc:2:1').lab).toBeNull();
    expect(parseDev('?world=atlantis').world).toBeNull();
    expect(parseDev('?world=').world).toBeNull();
    expect(parseDev('?lab=penguin-parade:4').lab).toBeNull();
    expect(parseDev('?mega=0').mega).toBe(false);
    expect(parseDev('?mega=yes').mega).toBe(false);
    expect(parseDev('?at=abc').at).toBeNull();
    expect(parseDev('?at=').at).toBeNull();
  });
});

describe('voice', () => {
  it('lists the three lines the game speaks', () => {
    expect(VOICE_LINES).toEqual([OUT_OF_SKIS_SPEECH, NEW_HIGH_SCORE_SPEECH, GREAT_RIDING_SPEECH]);
    expect(OUT_OF_SKIS_SPEECH).toBe('Out of jet skis!');
    expect(NEW_HIGH_SCORE_SPEECH).toBe('New high score!');
    expect(GREAT_RIDING_SPEECH).toBe('Great riding!');
  });
});
