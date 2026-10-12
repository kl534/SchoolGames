import { describe, expect, it } from 'vitest';
import { classifyGesture, onPress } from '../src/shared/input';

describe('classifyGesture', () => {
  it('classifies a short quick press as a tap', () => {
    const g = classifyGesture(2, -3, 120);
    expect(g.kind).toBe('tap');
    expect(g.direction).toBeNull();
  });

  it('treats a long press without movement as a swipe-less non-tap', () => {
    expect(classifyGesture(0, 0, 900).kind).toBe('swipe');
  });

  it('treats large movement as a swipe', () => {
    expect(classifyGesture(80, 5, 100).kind).toBe('swipe');
  });

  it.each([
    [100, 10, 'right'],
    [-100, 10, 'left'],
    [10, 100, 'down'],
    [10, -100, 'up'],
  ] as const)('direction for (%d, %d) is %s', (dx, dy, direction) => {
    expect(classifyGesture(dx, dy, 100).direction).toBe(direction);
  });

  it('computes distance and velocity', () => {
    const g = classifyGesture(30, 40, 100);
    expect(g.distance).toBe(50);
    expect(g.velocity).toBe(0.5);
  });

  it('has zero velocity for zero duration', () => {
    expect(classifyGesture(50, 0, 0).velocity).toBe(0);
  });

  it('respects custom thresholds', () => {
    expect(classifyGesture(20, 0, 100, { tapMaxDistance: 30, tapMaxDuration: 300 }).kind).toBe(
      'tap',
    );
  });
});

describe('onPress', () => {
  const event = (type: string, props: Record<string, unknown>) =>
    Object.assign(new Event(type), props);

  const setup = () => {
    const target = new EventTarget();
    let presses = 0;
    const off = onPress(target as HTMLElement, () => presses++);
    return { target, off, presses: () => presses };
  };

  it('fires on primary pointer down, not on the click that follows', () => {
    const { target, presses } = setup();
    target.dispatchEvent(event('pointerdown', { isPrimary: true, button: 0 }));
    target.dispatchEvent(event('click', { detail: 1 }));
    expect(presses()).toBe(1);
  });

  it('ignores secondary pointers and other mouse buttons', () => {
    const { target, presses } = setup();
    target.dispatchEvent(event('pointerdown', { isPrimary: false, button: 0 }));
    target.dispatchEvent(event('pointerdown', { isPrimary: true, button: 2 }));
    expect(presses()).toBe(0);
  });

  it('fires on keyboard activation', () => {
    const { target, presses } = setup();
    target.dispatchEvent(event('click', { detail: 0 }));
    expect(presses()).toBe(1);
  });

  it('stops after cleanup', () => {
    const { target, off, presses } = setup();
    off();
    target.dispatchEvent(event('pointerdown', { isPrimary: true, button: 0 }));
    target.dispatchEvent(event('click', { detail: 0 }));
    expect(presses()).toBe(0);
  });
});
