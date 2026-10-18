import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import {
  eatFrame,
  EAT_SECONDS,
  GAG_CUES,
  gagFrame,
  GRAB,
  restFrame,
  SFX_NAMES,
  smooth,
  SHOULDER_L,
  SHOULDER_R,
  track,
  type KidFrame,
} from '../src/games/grape-gobble/gags';
import { solveArm, vec3, type Vec3 } from '../src/games/grape-gobble/ik';
import {
  CAM_FOV,
  CAM_Y,
  fitCamera,
  LOOK_Y,
  playBand,
  SUBJECT,
} from '../src/games/grape-gobble/layout';
import {
  ateLine,
  BUNCH_SIZE,
  bunchAfterTake,
  clockText,
  GAG_SECONDS,
  GAGS,
  isUrgent,
  milestoneLine,
  pickGag,
  plateSpot,
  REFILL_BELOW,
  secondsLeft,
} from '../src/games/grape-gobble/rules';
import { createFactFeed } from '../src/shared/feed';
import { validateManifest } from '../src/shared/manifest';
import { RETRY_GAP } from '../src/shared/round';
import type { Fact } from '../src/shared/topics';

const dist = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

describe('grape gobble rules', () => {
  it('secondsLeft counts down and stops at 0', () => {
    expect(secondsLeft(0)).toBe(60);
    expect(secondsLeft(59.5)).toBeCloseTo(0.5);
    expect(secondsLeft(60)).toBe(0);
    expect(secondsLeft(75)).toBe(0);
    expect(secondsLeft(5, 8)).toBe(3);
  });

  it('clockText rounds up, isUrgent flags the last 10 seconds', () => {
    expect(clockText(60)).toBe('60');
    expect(clockText(59.01)).toBe('60');
    expect(clockText(0.2)).toBe('1');
    expect(clockText(0)).toBe('0');
    expect(clockText(-1)).toBe('0');
    expect(isUrgent(10)).toBe(true);
    expect(isUrgent(10.5)).toBe(false);
    expect(isUrgent(0)).toBe(false);
  });

  it('bunchAfterTake takes one and refills below the floor', () => {
    expect(bunchAfterTake(14)).toBe(13);
    expect(bunchAfterTake(4)).toBe(3);
    expect(bunchAfterTake(3)).toBe(14);
    expect(bunchAfterTake(1)).toBe(14);
    let left = BUNCH_SIZE;
    for (let i = 0; i < 200; i++) {
      left = bunchAfterTake(left);
      expect(left).toBeGreaterThanOrEqual(REFILL_BELOW);
      expect(left).toBeLessThanOrEqual(BUNCH_SIZE);
    }
  });

  it('plateSpot keeps skins on the plate, apart, in layers', () => {
    const spots = Array.from({ length: 40 }, (_, i) => plateSpot(i));
    spots.forEach((s, i) => {
      expect(s.x * s.x + s.z * s.z).toBeLessThanOrEqual(0.75 * 0.75);
      expect(s.layer).toBe(Math.floor(i / 14));
    });
    for (let i = 0; i < spots.length; i++) {
      for (let j = i + 1; j < spots.length; j++) {
        expect(Math.hypot(spots[i].x - spots[j].x, spots[i].z - spots[j].z)).toBeGreaterThanOrEqual(
          0.1,
        );
      }
    }
  });

  it('ateLine and milestoneLine', () => {
    expect(ateLine(1)).toBe('You ate 1 grape!');
    expect(ateLine(0)).toBe('You ate 0 grapes!');
    expect(ateLine(23)).toBe('You ate 23 grapes!');
    expect(milestoneLine(10)).toBe('10 grapes!');
    expect(milestoneLine(20)).toBe('20 grapes!');
    expect(milestoneLine(7)).toBeNull();
    expect(milestoneLine(0)).toBeNull();
  });

  it('pickGag never repeats, reaches every gag and stays in range', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(pickGag(null, i / 1000));
    expect(seen.size).toBe(8);
    for (const g of GAGS) {
      for (let i = 0; i < 100; i++) expect(pickGag(g, i / 100)).not.toBe(g);
    }
    expect(GAGS).toContain(pickGag(null, 0.9999));
    expect(GAGS).toContain(pickGag(null, 1));
    expect(GAGS).toContain(pickGag('dog', 1));
    let last = null as ReturnType<typeof pickGag> | null;
    const used = new Set<string>();
    for (let i = 0; i < 5000; i++) {
      const next = pickGag(last, Math.random());
      expect(next).not.toBe(last);
      used.add(next);
      last = next;
    }
    expect(used.size).toBe(8);
  });

  it('GAG_SECONDS are about three seconds', () => {
    expect(new Set(GAGS).size).toBe(8);
    const values = GAGS.map((g) => GAG_SECONDS[g]);
    values.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(2.8);
      expect(v).toBeLessThanOrEqual(3.4);
    });
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    expect(mean).toBeGreaterThanOrEqual(3.0);
    expect(mean).toBeLessThanOrEqual(3.15);
  });
});

describe('grape gobble arm solver', () => {
  const shoulder = vec3(-0.42, 1.12, -0.6);
  const pole = vec3(-0.6, -1, 0);
  const upper = 0.55;
  const fore = 0.55;

  it('reaches targets inside the arm with the right bone lengths', () => {
    for (let i = 0; i < 200; i++) {
      const target = vec3(
        shoulder.x + (Math.random() - 0.5) * 1.6,
        shoulder.y + (Math.random() - 0.5) * 1.6,
        shoulder.z + (Math.random() - 0.5) * 1.6,
      );
      const reach = dist(target, shoulder);
      if (reach < 0.06 || reach > upper + fore - 0.02) continue;
      const { elbow, hand } = solveArm(shoulder, target, upper, fore, pole);
      expect(dist(hand, target)).toBeLessThan(1e-6);
      expect(Math.abs(dist(elbow, shoulder) - upper)).toBeLessThan(1e-6);
      expect(Math.abs(dist(hand, elbow) - fore)).toBeLessThan(1e-6);
    }
  });

  it('clamps targets out of reach onto the line to the target', () => {
    const target = vec3(shoulder.x - 3, shoulder.y, shoulder.z);
    const { hand } = solveArm(shoulder, target, upper, fore, pole);
    expect(dist(hand, shoulder)).toBeCloseTo(upper + fore - 0.01, 6);
    expect(hand.y).toBeCloseTo(shoulder.y, 6);
    expect(hand.z).toBeCloseTo(shoulder.z, 6);
    expect(hand.x).toBeLessThan(shoulder.x);
  });

  it('gives finite numbers for a target at the shoulder', () => {
    const { elbow, hand } = solveArm(shoulder, shoulder, upper, fore, pole);
    for (const n of [elbow.x, elbow.y, elbow.z, hand.x, hand.y, hand.z]) {
      expect(Number.isFinite(n)).toBe(true);
    }
  });

  it('bends the elbow towards the pole', () => {
    const target = vec3(shoulder.x, shoulder.y, shoulder.z + 0.9);
    const { elbow, hand } = solveArm(shoulder, target, upper, fore, pole);
    const midY = (shoulder.y + hand.y) / 2;
    expect(elbow.y).toBeLessThanOrEqual(midY + 1e-6);
    expect(elbow.x).toBeLessThan(shoulder.x);
  });
});

describe('grape gobble tracks', () => {
  const keys: [number, number][] = [
    [1, 10],
    [2, 20],
    [4, 40],
  ];
  it('holds the ends, hits keys and rises evenly between', () => {
    expect(track(keys, 0)).toBe(10);
    expect(track(keys, 9)).toBe(40);
    expect(track(keys, 1)).toBe(10);
    expect(track(keys, 2)).toBe(20);
    expect(track(keys, 4)).toBe(40);
    let last = track(keys, 2);
    for (let t = 2; t <= 4; t += 0.05) {
      const v = track(keys, t);
      expect(v).toBeGreaterThanOrEqual(last - 1e-9);
      last = v;
    }
    expect(smooth(-1)).toBe(0);
    expect(smooth(2)).toBe(1);
    expect(smooth(0.5)).toBe(0.5);
  });
});

/** Every number in a frame, for finiteness checks. */
function numbers(f: KidFrame): number[] {
  const list: number[] = [];
  const point = (p: Vec3) => list.push(p.x, p.y, p.z);
  point(f.handR);
  point(f.handL);
  point(f.head);
  list.push(f.pitch, f.yaw, f.roll, f.mouth, f.cheekR, f.cheekL, f.look.x, f.look.y);
  if (f.grape) {
    point(f.grape.pos);
    list.push(f.grape.squash);
  }
  if (f.dog) {
    point(f.dog.pos);
    list.push(f.dog.yaw, f.dog.mouthOpen);
  }
  if (f.faceGrape) {
    point(f.faceGrape.pos);
    list.push(f.faceGrape.size);
  }
  if (f.hairProp) point(f.hairProp.pos);
  return list;
}

const EYES = ['open', 'wide', 'cross', 'squint', 'shut', 'one-shut'];
const REST = restFrame();

describe('grape gobble gags', () => {
  describe.each(GAGS)('%s', (kind) => {
    const length = GAG_SECONDS[kind];
    const frames: KidFrame[] = [];
    for (let t = 0; t <= length + 1e-9; t += 1 / 60) frames.push(gagFrame(kind, t));

    it('stays finite, in reach and in range', () => {
      for (const f of frames) {
        numbers(f).forEach((n) => expect(Number.isFinite(n)).toBe(true));
        expect(dist(f.handR, SHOULDER_R)).toBeLessThanOrEqual(1.1);
        expect(dist(f.handL, SHOULDER_L)).toBeLessThanOrEqual(1.1);
        for (const v of [f.mouth, f.cheekR, f.cheekL]) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
        if (f.grape) {
          expect(f.grape.squash).toBeGreaterThanOrEqual(0);
          expect(f.grape.squash).toBeLessThanOrEqual(1);
        }
        if (f.faceGrape) {
          expect(f.faceGrape.size).toBeGreaterThanOrEqual(0);
          expect(f.faceGrape.size).toBeLessThanOrEqual(1);
        }
        expect(EYES).toContain(f.eyes);
        if (f.hairProp) expect(['grape', 'dust']).toContain(f.hairProp.kind);
      }
    });

    it('starts and ends at rest', () => {
      for (const f of [gagFrame(kind, 0), gagFrame(kind, length)]) {
        expect(dist(f.handR, REST.handR)).toBeLessThanOrEqual(0.02);
        expect(dist(f.handL, REST.handL)).toBeLessThanOrEqual(0.02);
        expect(dist(f.head, REST.head)).toBeLessThanOrEqual(0.01);
        expect(Math.abs(f.pitch)).toBeLessThanOrEqual(0.01);
        expect(Math.abs(f.yaw)).toBeLessThanOrEqual(0.01);
        expect(Math.abs(f.roll)).toBeLessThanOrEqual(0.01);
        expect(f.mouth).toBe(0);
        expect(f.eyes).toBe('open');
        expect(f.grape).toBeNull();
        expect(f.dog).toBeNull();
        expect(f.faceGrape).toBeNull();
        expect(f.hairProp).toBeNull();
      }
    });

    it('does not teleport', () => {
      for (let i = 1; i < frames.length; i++) {
        expect(dist(frames[i].handR, frames[i - 1].handR)).toBeLessThan(0.35);
        expect(dist(frames[i].head, frames[i - 1].head)).toBeLessThan(0.25);
      }
    });

    it('has cues in order, inside the gag, with a sound and a word', () => {
      const cues = GAG_CUES[kind];
      for (let i = 1; i < cues.length; i++)
        expect(cues[i].at).toBeGreaterThanOrEqual(cues[i - 1].at);
      cues.forEach((c) => {
        expect(c.at).toBeGreaterThanOrEqual(0);
        expect(c.at).toBeLessThanOrEqual(length);
        if (c.sfx) expect(SFX_NAMES).toContain(c.sfx);
      });
      expect(cues.some((c) => c.sfx)).toBe(true);
      expect(cues.some((c) => c.pop)).toBe(true);
    });
  });

  it('the eight right-hand paths differ from each other', () => {
    const path = (kind: (typeof GAGS)[number]) =>
      Array.from({ length: 20 }, (_, i) => gagFrame(kind, (GAG_SECONDS[kind] * i) / 19).handR);
    for (let a = 0; a < GAGS.length; a++) {
      for (let b = a + 1; b < GAGS.length; b++) {
        const pa = path(GAGS[a]);
        const pb = path(GAGS[b]);
        const far = pa.some((p, i) => dist(p, pb[i]) >= 0.15);
        expect(far, `${GAGS[a]} vs ${GAGS[b]}`).toBe(true);
      }
    }
  });

  const sample = (kind: (typeof GAGS)[number]) => {
    const out: KidFrame[] = [];
    for (let t = 0; t <= GAG_SECONDS[kind]; t += 0.01) out.push(gagFrame(kind, t));
    return out;
  };

  it('each story has its props', () => {
    expect(sample('dog').some((f) => f.dog !== null)).toBe(true);
    expect(sample('face-splat').some((f) => f.faceGrape !== null)).toBe(true);
    expect(sample('hair').some((f) => f.hairProp?.kind === 'grape')).toBe(true);
    const under = sample('under-table');
    expect(under.some((f) => f.hairProp?.kind === 'dust')).toBe(true);
    expect(Math.min(...under.map((f) => f.head.y))).toBeLessThanOrEqual(-0.7);
  });

  it('air-chomp opens wide three times early on', () => {
    let rising = 0;
    let wasOpen = false;
    let peak = 0;
    for (let t = 0; t <= 1.5; t += 1 / 120) {
      const m = gagFrame('air-chomp', t).mouth;
      const open = m >= 0.5;
      if (open && !wasOpen) rising++;
      if (open) peak = Math.max(peak, m);
      if (!open && wasOpen) {
        expect(peak).toBeGreaterThanOrEqual(0.9);
        peak = 0;
      }
      wasOpen = open;
    }
    expect(rising).toBeGreaterThanOrEqual(3);
  });
});

describe('grape gobble eating', () => {
  const inReach = (f: KidFrame) => dist(f.handR, SHOULDER_R) <= 1.1;
  const check = (from: KidFrame) => {
    const start = eatFrame(0, from);
    expect(dist(start.handR, from.handR)).toBeLessThan(1e-9);
    expect(dist(start.head, from.head)).toBeLessThan(1e-9);
    const end = eatFrame(EAT_SECONDS, from);
    expect(dist(end.handR, REST.handR)).toBeLessThanOrEqual(0.02);
    expect(dist(end.handL, REST.handL)).toBeLessThanOrEqual(0.02);
    expect(end.grape).toBeNull();
    expect(end.mouth).toBe(0);
    for (let t = 0; t <= EAT_SECONDS; t += 1 / 60) {
      const f = eatFrame(t, from);
      numbers(f).forEach((n) => expect(Number.isFinite(n)).toBe(true));
      expect(inReach(f)).toBe(true);
      if (t > 0.28) expect(f.grape).toBeNull();
    }
  };

  it('goes from rest to the grape, the lips and back', () => {
    check(restFrame());
    expect(dist(eatFrame(0.12, restFrame()).handR, GRAB)).toBeLessThanOrEqual(0.05);
  });

  it('can start in the middle of a chew or a gag', () => {
    check(eatFrame(0.4, restFrame()));
    check(gagFrame('forehead', 1.2));
    check(gagFrame('hair', 1.6));
  });
});

describe('grape gobble layout', () => {
  const sizes: [number, number][] = [
    [390, 844],
    [844, 390],
    [1024, 768],
    [1366, 1024],
  ];

  it('fits the subject into the band and the width', () => {
    for (const [w, h] of sizes) {
      const band = playBand(w, h);
      const { distance, shift } = fitCamera(w, h, band);
      const cam = new PerspectiveCamera(CAM_FOV, w / h, 0.1, 100);
      cam.position.set(0, CAM_Y, distance);
      cam.lookAt(0, LOOK_Y, 0);
      cam.setViewOffset(w, h, 0, -shift, w, h);
      cam.updateMatrixWorld();
      for (const x of [-SUBJECT.halfW, SUBJECT.halfW]) {
        for (const y of [SUBJECT.bottom, SUBJECT.top]) {
          for (const z of [0, 1.15]) {
            const p = new Vector3(x, y, z).project(cam);
            const px = ((p.x + 1) / 2) * w;
            const py = ((1 - p.y) / 2) * h;
            expect(px).toBeGreaterThanOrEqual(-2);
            expect(px).toBeLessThanOrEqual(w + 2);
            expect(py).toBeGreaterThanOrEqual(band.top - 2);
            expect(py).toBeLessThanOrEqual(band.bottom + 2);
          }
        }
      }
    }
  });

  it('backs off for a narrower band and needs no shift for a centred one', () => {
    const wide = fitCamera(1024, 768, { top: 100, bottom: 668 });
    const narrow = fitCamera(1024, 768, { top: 250, bottom: 518 });
    expect(narrow.distance).toBeGreaterThan(wide.distance);
    expect(fitCamera(1024, 768, { top: 100, bottom: 668 }).shift).toBeCloseTo(0, 6);
  });

  it('mirrors the HUD in playBand', () => {
    expect(playBand(390, 844)).toEqual({ top: 240, bottom: 684 });
    expect(playBand(1024, 768)).toEqual({ top: 112, bottom: 680 });
  });
});

describe('grape gobble and the fact feed', () => {
  it('brings a missed fact back within the retry gap', () => {
    const fact = (id: string): Fact => ({ id, prompt: id, answer: id, statement: id });
    let n = 0;
    const feed = createFactFeed(() => Array.from({ length: 10 }, () => fact(`f${n++}`)));
    const missed = feed.take();
    feed.recordMiss(missed);
    const next = Array.from({ length: RETRY_GAP }, () => feed.take());
    expect(next).toContain(missed);
  });
});

describe('grape gobble manifest', () => {
  it('is valid and scored by points', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(import.meta.dirname, '../src/games/grape-gobble/game.json'), 'utf8'),
    );
    expect(validateManifest(manifest)).toEqual([]);
    expect(manifest.scoring).toBe('score');
  });
});
