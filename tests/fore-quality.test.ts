import { describe, expect, it } from 'vitest';
import {
  adaptGfx,
  brightestDirection,
  GFX_SETTINGS,
  horizonRow,
  pickGfx,
  SLOW_FRAME_MS,
  sunSetup,
  type DeviceInfo,
} from '../src/games/fore/quality';

const device = (over: Partial<DeviceInfo>): DeviceInfo => ({
  gpu: 'ANGLE (NVIDIA GeForce RTX 3070)',
  cores: 8,
  minSide: 1080,
  mobile: false,
  ...over,
});

describe('pickGfx', () => {
  it('puts software renderers and old mobile GPUs on low', () => {
    expect(pickGfx(device({ gpu: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device))' }))).toBe(
      'low',
    );
    expect(pickGfx(device({ gpu: 'Mali-G52', mobile: true, minSide: 820 }))).toBe('low');
    expect(pickGfx(device({ gpu: 'Adreno (TM) 506', mobile: true, minSide: 600 }))).toBe('low');
    expect(pickGfx(device({ gpu: 'Intel(R) UHD Graphics 620' }))).toBe('low');
  });
  it('puts a phone on medium and an iPad on high', () => {
    const apple = { gpu: 'Apple GPU', mobile: true, cores: 6 };
    expect(pickGfx(device({ ...apple, minSide: 390 }))).toBe('medium');
    expect(pickGfx(device({ ...apple, minSide: 820 }))).toBe('high');
  });
  it('sends few cores to medium and a strong desktop to high', () => {
    expect(pickGfx(device({ cores: 4 }))).toBe('medium');
    expect(pickGfx(device({ cores: 8 }))).toBe('high');
    expect(pickGfx(device({ cores: 0 }))).toBe('high');
  });
});

describe('adaptGfx', () => {
  it('steps down once and never below low', () => {
    expect(adaptGfx(SLOW_FRAME_MS + 1, 'high')).toBe('medium');
    expect(adaptGfx(SLOW_FRAME_MS + 1, 'medium')).toBe('low');
    expect(adaptGfx(SLOW_FRAME_MS + 1, 'low')).toBe('low');
  });
  it('keeps the tier when frames are fast enough', () => {
    expect(adaptGfx(SLOW_FRAME_MS, 'high')).toBe('high');
    expect(adaptGfx(16, 'medium')).toBe('medium');
  });
});

describe('tier settings', () => {
  it('match the table', () => {
    const { low, medium, high } = GFX_SETTINGS;
    expect([low.pixelRatio, medium.pixelRatio, high.pixelRatio]).toEqual([1, 1.5, 2]);
    expect([low.msaa, medium.msaa, high.msaa]).toEqual([0, 4, 4]);
    expect([low.post, medium.post, high.post]).toEqual([false, true, true]);
    expect([low.bloom, medium.bloom, high.bloom]).toEqual([false, true, true]);
    expect([low.ao, medium.ao, high.ao]).toEqual([false, false, true]);
    expect([low.dof, medium.dof, high.dof]).toEqual([false, false, true]);
    expect([low.shadows, medium.shadows, high.shadows]).toEqual(['none', 'single', 'cascaded']);
    expect([medium.shadowSize, high.shadowSize]).toEqual([2048, 2048]);
    expect([medium.shadowFar, high.shadowFar, high.cascades]).toEqual([60, 320, 3]);
    expect([low.water, medium.water, high.water]).toEqual(['env', 'env', 'mirror']);
    expect([low.treeLeafCards, medium.treeLeafCards, high.treeLeafCards]).toEqual([140, 260, 420]);
    expect([low.sceneryShare, medium.sceneryShare, high.sceneryShare]).toEqual([0.5, 0.8, 1]);
    expect([low.blades, medium.blades, high.blades]).toEqual([0, 15000, 40000]);
    expect([low.tufts, medium.tufts, high.tufts]).toEqual([600, 1500, 3000]);
    expect([low.gallery, medium.gallery, high.gallery]).toEqual([0, 14, 24]);
  });
});

describe('reading the sky picture', () => {
  const w = 64;
  const h = 32;
  const flat = () => new Float32Array(w * h * 4).fill(0.1);

  it('finds a planted bright texel', () => {
    const data = flat();
    // Column 48 of 64 (u = 0.758), row 8 of 32 (v = 0.734): 45 degrees up, a quarter turn round.
    data.set([50, 48, 40, 1], (8 * w + 48) * 4);
    const { phi, elevation } = brightestDirection(data, w, h);
    expect(phi).toBeCloseTo((0.7578125 - 0.5) * 2 * Math.PI, 5);
    expect(elevation).toBeCloseTo((0.734375 - 0.5) * Math.PI, 5);
  });

  it('works on three floats a texel', () => {
    const data = new Float32Array(w * h * 3).fill(0.1);
    data.set([9, 9, 9], (16 * w + 0) * 3);
    const { phi, elevation } = brightestDirection(data, w, h, 3);
    expect(phi).toBeLessThan(-Math.PI + 0.1);
    expect(Math.abs(elevation)).toBeLessThan(0.1);
  });

  it('averages the row at the horizon', () => {
    const data = flat();
    for (let x = 0; x < w; x++) data.set([0.2 + (x % 2) * 0.2, 0.4, 0.6, 1], (15 * w + x) * 4);
    const [r, g, b] = horizonRow(data, w, h, 2);
    expect(r).toBeCloseTo(0.3, 5);
    expect(g).toBeCloseTo(0.4, 5);
    expect(b).toBeCloseTo(0.6, 5);
  });
});

describe('sunSetup', () => {
  it('puts the sun behind the tee, to the left on screen, at the picture elevation', () => {
    const { dir } = sunSetup({ phi: 1.2, elevation: 0.8 });
    expect(dir[0]).toBeGreaterThan(0);
    expect(dir[1]).toBeCloseTo(Math.sin(0.8), 6);
    expect(dir[2]).toBeLessThan(0);
    expect(Math.hypot(...dir)).toBeCloseTo(1, 6);
  });

  it('turns the picture so its own sun lands on that direction', () => {
    const sun = { phi: -2.3, elevation: 0.7 };
    const { dir, yaw } = sunSetup(sun);
    // The lookup turns the world direction by yaw about y, and must land on the picture's sun.
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const looked = [dir[0] * c + dir[2] * s, dir[1], -dir[0] * s + dir[2] * c];
    const picture = [
      Math.cos(sun.elevation) * Math.cos(sun.phi),
      Math.sin(sun.elevation),
      Math.cos(sun.elevation) * Math.sin(sun.phi),
    ];
    looked.forEach((v, i) => expect(v).toBeCloseTo(picture[i], 6));
  });

  it('has a plain sun and no turn without a picture', () => {
    const { dir, yaw } = sunSetup(null);
    expect(yaw).toBe(0);
    expect(dir[1]).toBeGreaterThan(0.5);
  });
});
