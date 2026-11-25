import { describe, expect, it } from 'vitest';
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three';
import { parseDev } from '../src/games/cat-dash/dev';
import { lightFor } from '../src/games/cat-dash/lighting';
import { addOutline } from '../src/games/cat-dash/outline';
import { PLACES } from '../src/games/cat-dash/places';
import {
  MIN_FPS,
  SAMPLE_FRAMES,
  SETTLE_SECONDS,
  createGovernor,
  initialQuality,
  type Quality,
} from '../src/games/cat-dash/quality';
import { runs } from './helpers/full';

describe('initialQuality', () => {
  it('lets a saved tier win and ignores a bad one', () => {
    expect(initialQuality({ saved: 'low', cores: 8, memoryGb: 8 })).toBe('low');
    expect(initialQuality({ saved: 'high', cores: 2 })).toBe('high');
    expect(initialQuality({ saved: 'ultra', cores: 8, memoryGb: 8 })).toBe('high');
    expect(initialQuality({ saved: 'ultra', cores: 2 })).toBe('medium');
  });
  it('starts weak devices on medium and the rest on high', () => {
    expect(initialQuality({ saved: null, cores: 4 })).toBe('medium');
    expect(initialQuality({ saved: null, memoryGb: 3 })).toBe('medium');
    expect(initialQuality({ saved: null, cores: 8, memoryGb: 8 })).toBe('high');
    expect(initialQuality({ saved: null })).toBe('high');
  });
});

/** Feeds `frames` steady frames at `fps`; returns each step the governor made. */
function feed(gov: ReturnType<typeof createGovernor>, fps: number, frames: number): Quality[] {
  const steps: Quality[] = [];
  for (let i = 0; i < frames; i++) {
    const s = gov.sample(1 / fps);
    if (s) steps.push(s);
  }
  return steps;
}

describe('quality governor', () => {
  it('never steps at a steady 60 fps', () => {
    const gov = createGovernor('high');
    expect(feed(gov, 60, 60 * 60)).toEqual([]);
    expect(gov.quality).toBe('high');
  });

  it('steps high to medium to low at 30 fps, then stays low', () => {
    const gov = createGovernor('high');
    const settleFrames = Math.ceil(SETTLE_SECONDS * 30) + 1;
    expect(feed(gov, 30, settleFrames + SAMPLE_FRAMES - 2)).toEqual([]);
    expect(feed(gov, 30, 5)).toEqual(['medium']);
    expect(feed(gov, 30, settleFrames + SAMPLE_FRAMES - 8)).toEqual([]);
    expect(feed(gov, 30, 8)).toEqual(['low']);
    expect(feed(gov, 30, 3000)).toEqual([]);
    expect(gov.quality).toBe('low');
  });

  it('counts nothing in the first two seconds', () => {
    const gov = createGovernor('high');
    // 1.9 s of very slow frames is all settling.
    expect(feed(gov, 12, 23)).toEqual([]);
    // The window then needs a full 90 frames before it can judge.
    expect(feed(gov, 12, SAMPLE_FRAMES - 2)).toEqual([]);
  });

  it('ignores hitches of 0.1 s and more', () => {
    const gov = createGovernor('high');
    expect(feed(gov, 5, 2000)).toEqual([]);
    expect(gov.quality).toBe('high');
  });

  it('never steps up when the frame rate recovers', () => {
    const gov = createGovernor('high');
    feed(gov, 30, 160);
    expect(gov.quality).toBe('medium');
    expect(feed(gov, 120, 6000)).toEqual([]);
    expect(gov.quality).toBe('medium');
  });

  it('on random traces never steps up and never steps more than twice', () => {
    const order: Quality[] = ['high', 'medium', 'low'];
    for (let run = 0; run < runs(300, 40); run++) {
      const gov = createGovernor('high');
      let seed = run * 7919 + 13;
      const rand = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      };
      let fps = 20 + rand() * 100;
      let steps = 0;
      let last = 0;
      for (let i = 0; i < 6000; i++) {
        if (rand() < 0.01) fps = 20 + rand() * 100;
        const s = gov.sample(1 / fps);
        if (s) {
          steps++;
          const index = order.indexOf(s);
          expect(index).toBeGreaterThan(last);
          last = index;
        }
      }
      expect(steps).toBeLessThanOrEqual(2);
    }
  });

  it('judges against the minimum frame rate', () => {
    const gov = createGovernor('high');
    expect(feed(gov, MIN_FPS + 3, 4000)).toEqual([]);
  });
});

describe('lightFor', () => {
  it('gives every place finite, positive light and a haze that runs near to far', () => {
    for (const place of PLACES) {
      const l = lightFor(place);
      for (const n of [l.keyIntensity, l.fillIntensity, l.fogNear, l.fogFar]) {
        expect(Number.isFinite(n) && n > 0).toBe(true);
      }
      expect(l.fogNear).toBeLessThan(l.fogFar);
      for (const c of [l.key, l.sky, l.ground, l.fog]) {
        expect(Number.isInteger(c) && c >= 0 && c <= 0xffffff).toBe(true);
      }
    }
  });

  it('applies the per-place overrides', () => {
    const by = (id: string) => lightFor(PLACES.find((p) => p.id === id)!);
    expect(by('desert').key).toBe(0xffe2b0);
    expect(by('desert').keyIntensity).toBe(2.9);
    expect(by('snowy-forest').fillIntensity).toBe(1.3);
    expect(by('rooftops').sky).toBe(0x9a7fc0);
    expect(by('space-station').sky).toBe(0x9ec8ff);
    expect(by('jungle').ground).toBe(0x2f6b3a);
    expect(by('beach').keyIntensity).toBe(2.9);
    expect(by('living-room').keyIntensity).toBe(2.0);
    expect(by('park').keyIntensity).toBe(2.6);
    expect(by('park').fogNear).toBe(30);
    expect(by('kitchen').fogNear).toBe(60);
  });
});

describe('dev quality hook', () => {
  it('parses a tier and ignores anything else', () => {
    expect(parseDev('?quality=low').quality).toBe('low');
    expect(parseDev('?quality=high').quality).toBe('high');
    expect(parseDev('?quality=ultra').quality).toBeNull();
    expect(parseDev('').quality).toBeNull();
  });
});

describe('addOutline', () => {
  it('outlines only solid, thick, non-basic meshes, and removes its hull on dispose', () => {
    const group = new Group();
    const solid = new MeshStandardMaterial({ color: 0xff8800 });
    const sphere = new Mesh(new SphereGeometry(0.5, 12, 8), solid);
    const glass = new Mesh(
      new SphereGeometry(0.5, 12, 8),
      new MeshStandardMaterial({ transparent: true, opacity: 0.3 }),
    );
    const whisker = new Mesh(new BoxGeometry(0.4, 0.008, 0.4), solid);
    const glow = new Mesh(new SphereGeometry(0.5, 12, 8), new MeshBasicMaterial());
    group.add(sphere, glass, whisker, glow);
    const outline = addOutline(group, 2.5);
    const hulls = () => {
      let n = 0;
      group.traverse((o) => {
        if (o.userData.outlineHull) n++;
      });
      return n;
    };
    expect(hulls()).toBe(1);
    expect(sphere.children).toHaveLength(1);
    expect(sphere.children[0].castShadow).toBe(false);
    outline.setVisible(false);
    expect(sphere.children[0].visible).toBe(false);
    outline.dispose();
    expect(hulls()).toBe(0);
    expect(sphere.children).toHaveLength(0);
  });
});
