// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NUDGE_EVERY, NUDGE_FIRST, TAP_GUARD, TAP_SPEECH } from '../src/shared/tapgate';

vi.mock('../src/shared/audio', () => ({
  preloadSpeech: vi.fn(),
  speak: vi.fn(),
  stopSpeaking: vi.fn(),
}));

import { preloadSpeech, speak, stopSpeaking } from '../src/shared/audio';
import { createTapFlow, type TapFlow } from '../src/shared/tapflow';

function makeButtons(): HTMLButtonElement[] {
  return Array.from({ length: 4 }, () => {
    const button = document.createElement('button');
    button.className = 'game-answer';
    document.body.appendChild(button);
    return button;
  });
}

let flow: TapFlow;
let buttons: HTMLButtonElement[];

beforeEach(() => {
  vi.mocked(speak).mockClear();
  vi.mocked(stopSpeaking).mockClear();
  buttons = makeButtons();
  flow = createTapFlow();
});

afterEach(() => {
  flow.dispose();
  document.body.replaceChildren();
});

describe('tapflow', () => {
  it('loads the reminder clip up front', () => {
    expect(preloadSpeech).toHaveBeenCalledWith([TAP_SPEECH]);
  });

  it('arm marks the right answer and waits', () => {
    expect(flow.armed).toBe(false);
    flow.arm(buttons, 2);
    expect(flow.armed).toBe(true);
    expect(buttons[2].classList.contains('sg-tap-correct')).toBe(true);
    expect(buttons[0].classList.contains('sg-tap-dim')).toBe(true);
  });

  it('ignores a tap inside the guard', () => {
    flow.arm(buttons, 2);
    flow.update(TAP_GUARD - 0.1);
    expect(flow.tap(2)).toBe(false);
    expect(flow.armed).toBe(true);
    expect(stopSpeaking).not.toHaveBeenCalled();
    expect(speak).not.toHaveBeenCalled();
  });

  it('goes on the green answer: stops the speech, clears the marks, disarms', () => {
    flow.arm(buttons, 2);
    flow.update(TAP_GUARD);
    expect(flow.tap(2)).toBe(true);
    expect(stopSpeaking).toHaveBeenCalledTimes(1);
    expect(flow.armed).toBe(false);
    expect(buttons.every((b) => b.className === 'game-answer')).toBe(true);
    expect(document.querySelector<HTMLElement>('.sg-tap-pointer')!.hidden).toBe(true);
    // A second tap does nothing.
    expect(flow.tap(2)).toBe(false);
    expect(stopSpeaking).toHaveBeenCalledTimes(1);
  });

  it('shakes a dim answer and keeps waiting', () => {
    flow.arm(buttons, 2);
    flow.update(TAP_GUARD);
    expect(flow.tap(0)).toBe(false);
    expect(flow.armed).toBe(true);
    expect(buttons[0].classList.contains('sg-tap-nope')).toBe(true);
    expect(buttons[2].classList.contains('sg-tap-hint')).toBe(true);
    expect(stopSpeaking).not.toHaveBeenCalled();
  });

  it('does nothing when it is not armed', () => {
    expect(flow.tap(0)).toBe(false);
    flow.update(100);
    flow.readFinished();
    expect(speak).not.toHaveBeenCalled();
    expect(stopSpeaking).not.toHaveBeenCalled();
  });

  it('reminds at 6 s and 16 s after the reading ends, never before', () => {
    flow.arm(buttons, 1);
    for (let i = 0; i < 100; i++) flow.update(1);
    expect(speak).not.toHaveBeenCalled();
    flow.readFinished();
    flow.update(NUDGE_FIRST - 0.01);
    expect(speak).not.toHaveBeenCalled();
    flow.update(0.01);
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenLastCalledWith(TAP_SPEECH);
    expect(buttons[1].classList.contains('sg-tap-step-1')).toBe(true);
    flow.update(NUDGE_EVERY - 0.01);
    expect(speak).toHaveBeenCalledTimes(1);
    flow.update(0.01);
    expect(speak).toHaveBeenCalledTimes(2);
    expect(buttons[1].classList.contains('sg-tap-step-2')).toBe(true);
    expect(buttons[1].classList.contains('sg-tap-step-1')).toBe(false);
  });

  it('disarm clears the marks and stops the reminders', () => {
    flow.arm(buttons, 1);
    flow.readFinished();
    flow.disarm();
    expect(flow.armed).toBe(false);
    expect(buttons.every((b) => b.className === 'game-answer')).toBe(true);
    flow.update(100);
    expect(speak).not.toHaveBeenCalled();
    flow.disarm();
  });

  it('arm again replaces the earlier arm', () => {
    flow.arm(buttons, 1);
    flow.update(5);
    flow.arm(buttons, 3);
    expect(buttons[1].classList.contains('sg-tap-correct')).toBe(false);
    expect(buttons[3].classList.contains('sg-tap-correct')).toBe(true);
    // The guard starts again.
    expect(flow.tap(3)).toBe(false);
    expect(flow.armed).toBe(true);
  });

  it('dispose removes the pointer', () => {
    flow.arm(buttons, 1);
    flow.dispose();
    expect(document.querySelector('.sg-tap-pointer')).toBeNull();
  });
});
