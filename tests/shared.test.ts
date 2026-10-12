import { describe, expect, it } from 'vitest';
import { toProgress } from '../src/shared/assets';
import { clampPixelRatio } from '../src/shared/scene';

describe('toProgress', () => {
  it('returns a fraction', () => {
    expect(toProgress(1, 4)).toBe(0.25);
  });
  it('is 1 when nothing to load', () => {
    expect(toProgress(0, 0)).toBe(1);
  });
  it('clamps to 0..1', () => {
    expect(toProgress(9, 3)).toBe(1);
    expect(toProgress(-1, 3)).toBe(0);
  });
});

describe('clampPixelRatio', () => {
  it('caps high-density displays', () => {
    expect(clampPixelRatio(3)).toBe(2);
  });
  it('keeps normal values and floors at 1', () => {
    expect(clampPixelRatio(1.5)).toBe(1.5);
    expect(clampPixelRatio(0.5)).toBe(1);
  });
});
