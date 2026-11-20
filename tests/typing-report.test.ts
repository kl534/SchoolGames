import { describe, expect, it } from 'vitest';
import { demoTypingProgress } from '../src/menu/dev';
import { KEYS } from '../src/shared/typing/keyboard-layout';
import { TYPING_LEVELS } from '../src/shared/typing/course';
import {
  TOTAL_LEARNABLE,
  emptyTyping,
  learnedCount,
  type TypingProgress,
} from '../src/shared/typing/progress';
import {
  keyStates,
  practiceCount,
  skillLabel,
  skillReport,
  typingReport,
  typingSteps,
} from '../src/shared/typing/report';
import { runs } from './helpers/full';

const withKeys = (open: number, keys: Record<string, string>): TypingProgress => ({
  ...emptyTyping(),
  open,
  keys,
});

describe('skillLabel', () => {
  it('names space and the Shifts, else the char', () => {
    expect(skillLabel(' ')).toBe('space');
    expect(skillLabel('shift-left')).toBe('Left Shift');
    expect(skillLabel('shift-right')).toBe('Right Shift');
    expect(skillLabel(';')).toBe(';');
    expect(skillLabel('f')).toBe('f');
  });
});

describe('skillReport', () => {
  const open = (history?: string) =>
    skillReport(withKeys(1, history ? { f: history } : {}), 'f', 1);
  const passed = (history?: string) =>
    skillReport(withKeys(2, history ? { f: history } : {}), 'f', 1);

  it('steps an open-level key by its history', () => {
    expect(open().step).toBe(0);
    expect(open('1110')).toMatchObject({ step: 1, right: 3, presses: 4 });
    expect(open('1'.repeat(12)).step).toBe(2);
    expect(open('1'.repeat(17)).step).toBe(2);
    expect(open('1'.repeat(18)).step).toBe(3);
    expect(open('1'.repeat(17) + '000').practice).toBe(false);
  });

  it('flags a passed key after 3 misses of the last 20', () => {
    expect(passed()).toMatchObject({ step: 3, practice: false });
    expect(passed('1'.repeat(18) + '00').practice).toBe(false);
    expect(passed('1'.repeat(17) + '000').practice).toBe(true);
    expect(passed('000').practice).toBe(true);
  });
});

describe('typingReport', () => {
  it('lists level 1 for a new player', () => {
    const report = typingReport(emptyTyping());
    expect(report).toHaveLength(1);
    expect(report[0].heading).toBe('Level 1 of 40: f j');
    expect(report[0].skills.map((s) => s.label)).toEqual(['f', 'j', 'space']);
  });

  it('lists the open levels newest first, speed levels with their wpm', () => {
    const report = typingReport(withKeys(31, {}));
    expect(report).toHaveLength(31);
    expect(report[0]).toMatchObject({ kind: 'speed', wpm: 20, passed: false });
    expect(report[0].heading).toBe('Level 31 of 40: 20 wpm');
    expect(report[1]).toMatchObject({ kind: 'speed', wpm: 15, passed: true });
    expect(report[30].n).toBe(1);
  });
});

describe('the typing demo', () => {
  const tp = demoTypingProgress('keys').typing!;

  it('has two keys to practice and sums to the total', () => {
    expect(practiceCount(tp)).toBe(2);
    const steps = typingSteps(tp);
    expect(steps.reduce((a, b) => a + b, 0)).toBe(TOTAL_LEARNABLE);
    expect(steps[3]).toBe(15);
    expect(steps[2]).toBe(1);
    expect(steps[1]).toBe(1);
    expect(steps[4]).toBe(0);
  });

  it('keeps a slipped Left Shift in the speed demo', () => {
    const speed = demoTypingProgress('speed').typing!;
    expect(practiceCount(speed)).toBe(1);
  });
});

describe('keyStates', () => {
  it('starts with f j and space new, the rest locked, and no grey keys', () => {
    const states = keyStates(emptyTyping());
    expect(states.f).toBe('new');
    expect(states.j).toBe('new');
    expect(states.space).toBe('new');
    expect(states.d).toBe('locked');
    expect(states['shift-left']).toBe('locked');
    expect('tab' in states).toBe(false);
  });

  it('gives a key its open skill when the other is locked', () => {
    // Level 4 open: `;` is open, `:` (level 27) is locked.
    const slipped = withKeys(5, { ';': '00101' + '1'.repeat(15) });
    expect(keyStates(slipped)[';']).toBe('practice');
  });

  it("takes the weakest of a key's open skills", () => {
    // Level 17 adds `'`, level 4's key has no pair; `1` and `!` share a key: `1` is level 21.
    const tp = withKeys(23, { '1': '1'.repeat(20), '!': '1010' });
    expect(keyStates(tp)['1']).toBe('started');
  });
});

describe('random progress', () => {
  it('keeps the report, the steps and the key states consistent', () => {
    const skills = TYPING_LEVELS.flatMap((l) => l.skills);
    const ids = new Set(KEYS.map((k) => k.id));
    const rnd = (n: number) => Math.floor(Math.random() * n);
    for (let i = 0; i < runs(400, 60); i++) {
      const tp = withKeys(1 + rnd(40), {});
      for (const skill of skills) {
        if (Math.random() < 0.6) {
          const len = rnd(21);
          tp.keys[skill] = Array.from({ length: len }, () =>
            Math.random() < 0.7 ? '1' : '0',
          ).join('');
        }
      }
      const report = typingReport(tp);
      expect(report.map((l) => l.n)).toEqual(
        Array.from({ length: tp.open }, (_, k) => tp.open - k),
      );
      const keyLevels = TYPING_LEVELS.filter((l) => l.kind === 'keys' && l.n <= tp.open);
      const listed = report.flatMap((l) => l.skills.map((s) => s.skill)).sort();
      expect(listed).toEqual(keyLevels.flatMap((l) => l.skills).sort());
      let practice = 0;
      for (const level of report) {
        for (const s of level.skills) {
          if (s.practice) {
            expect(level.passed).toBe(true);
            practice++;
          }
        }
      }
      expect(practiceCount(tp)).toBe(practice);
      const steps = typingSteps(tp);
      expect(steps.reduce((a, b) => a + b, 0)).toBe(TOTAL_LEARNABLE);
      expect(steps[3]).toBe(learnedCount(tp));
      const states = keyStates(tp);
      for (const [id, state] of Object.entries(states)) {
        expect(ids.has(id)).toBe(true);
        if (tp.open >= 29) expect(state).not.toBe('locked');
      }
    }
  });
});
