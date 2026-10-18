import { describe, expect, it } from 'vitest';
import { seededRandom } from '../src/shared/random';
import {
  answerOptions,
  getTopic,
  groupBySubject,
  listTopic,
  TOPICS,
  validateTopic,
} from '../src/shared/topics';
import { mathFact, numericDistractors } from '../src/shared/topics/math';

describe('built-in topics', () => {
  it('have unique ids', () => {
    const ids = TOPICS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(TOPICS.map((t) => [t.id, t] as const))('%s is valid', (_id, topic) => {
    expect(validateTopic(topic)).toEqual([]);
  });

  it.each(TOPICS.map((t) => [t.id, t] as const))(
    '%s gives four distinct options containing the answer for every fact',
    (_id, topic) => {
      const random = seededRandom(1);
      for (const fact of topic.facts) {
        const options = answerOptions(topic, fact, 4, random);
        expect(options).toHaveLength(4);
        expect(new Set(options).size).toBe(4);
        expect(options).toContain(fact.answer);
      }
    },
  );

  it('addition 1-10 uses both addends from 1 to 10', () => {
    const topic = getTopic('addition-1-10')!;
    expect(topic.facts).toHaveLength(100);
    expect(topic.facts.map((f) => f.answer).map(Number)).toContain(20);
    expect(topic.facts.find((f) => f.id === '7+8')?.statement).toBe('7 + 8 = 15');
  });

  it('subtraction 1-10 mirrors the addition facts', () => {
    const topic = getTopic('subtraction-1-10')!;
    expect(topic.facts).toHaveLength(100);
    const answers = topic.facts.map((f) => Number(f.answer));
    expect(Math.min(...answers)).toBe(1);
    expect(Math.max(...answers)).toBe(10);
    expect(topic.facts.find((f) => f.id === '15-8')?.answer).toBe('7');
  });

  it('addition 11-16 holds every pair up to 16 with a number over 10', () => {
    const big = getTopic('addition-11-16')!;
    const base = getTopic('addition-1-10')!;
    expect(big.facts).toHaveLength(156);
    for (const { visual } of big.facts) {
      expect(Math.min(visual!.a, visual!.b)).toBeGreaterThanOrEqual(1);
      expect(Math.max(visual!.a, visual!.b)).toBeLessThanOrEqual(16);
      expect(Math.max(visual!.a, visual!.b)).toBeGreaterThanOrEqual(11);
    }
    const pairs = [...base.facts, ...big.facts].map((f) => `${f.visual!.a},${f.visual!.b}`);
    expect(pairs).toHaveLength(256);
    expect(new Set(pairs).size).toBe(256);
    const three = big.facts.find((f) => f.id === '3+12')!;
    expect(three.answer).toBe('15');
    expect(three.statement).toBe('3 + 12 = 15');
    expect(big.facts.find((f) => f.id === '16+16')?.answer).toBe('32');
    const answers = big.facts.map((f) => Number(f.answer));
    expect(Math.min(...answers)).toBe(12);
    expect(Math.max(...answers)).toBe(32);
  });

  it('subtraction 11-16 mirrors addition 11-16', () => {
    const big = getTopic('subtraction-11-16')!;
    const base = getTopic('subtraction-1-10')!;
    expect(big.facts).toHaveLength(156);
    const fact = big.facts.find((f) => f.id === '27-12')!;
    expect(fact.answer).toBe('15');
    expect(fact.statement).toBe('27 − 12 = 15');
    expect(big.facts.find((f) => f.id === '32-16')?.answer).toBe('16');
    for (const f of big.facts) {
      expect(f.visual!.a).toBeLessThanOrEqual(32);
      expect(Number(f.answer)).toBeGreaterThanOrEqual(1);
      expect(Number(f.answer)).toBeLessThanOrEqual(16);
    }
    const pairs = [...base.facts, ...big.facts].map((f) => `${f.visual!.b},${Number(f.answer)}`);
    expect(pairs).toHaveLength(256);
    expect(new Set(pairs).size).toBe(256);
  });

  it('lists the up-to-10 tables, then one 11-16 card, under Multiplication and Division', () => {
    const ids = (subject: string) => TOPICS.filter((t) => t.subject === subject).map((t) => t.id);
    expect(ids('Multiplication')).toEqual([
      ...Array.from({ length: 10 }, (_, i) => `times-${i + 1}`),
      'multiplication-11-16',
    ]);
    expect(ids('Division')).toEqual([
      ...Array.from({ length: 10 }, (_, i) => `divide-by-${i + 1}`),
      'division-11-16',
    ]);
    expect(getTopic('times-11')).toBeUndefined();
    expect(getTopic('times-16')).toBeUndefined();
    expect(getTopic('divide-by-12')).toBeUndefined();
  });

  it('has times tables 1 to 10, each running from 1 × n to 10 × n', () => {
    for (let n = 1; n <= 10; n++) {
      const topic = getTopic(`times-${n}`)!;
      expect(topic.facts.map((f) => f.answer)).toEqual(
        Array.from({ length: 10 }, (_, i) => String((i + 1) * n)),
      );
      expect(topic.facts.map((f) => f.id)).toEqual(
        Array.from({ length: 10 }, (_, i) => `${i + 1}x${n}`),
      );
    }
  });

  it('has divisors 1 to 10, mirroring the times tables', () => {
    for (let n = 1; n <= 10; n++) {
      const topic = getTopic(`divide-by-${n}`)!;
      expect(topic.facts.map((f) => f.answer)).toEqual(
        Array.from({ length: 10 }, (_, i) => String(i + 1)),
      );
      expect(topic.facts.map((f) => f.id)).toEqual(
        Array.from({ length: 10 }, (_, i) => `${(i + 1) * n}/${n}`),
      );
      expect(topic.facts[1].statement).toBe(`${2 * n} ÷ ${n} = 2`);
    }
  });

  it('multiplication 11-16 holds every product with a number over 10', () => {
    const big = getTopic('multiplication-11-16')!;
    const small = Array.from({ length: 10 }, (_, i) => getTopic(`times-${i + 1}`)!);
    expect(big.facts).toHaveLength(156);
    for (const { visual } of big.facts) {
      expect(visual!.kind).toBe('multiply');
      expect(Math.max(visual!.a, visual!.b)).toBeGreaterThanOrEqual(11);
      expect(Math.max(visual!.a, visual!.b)).toBeLessThanOrEqual(16);
      expect(Math.min(visual!.a, visual!.b)).toBeGreaterThanOrEqual(1);
    }
    expect(big.facts.find((f) => f.id === '12x7')?.statement).toBe('12 × 7 = 84');
    expect(big.facts.find((f) => f.id === '7x12')?.statement).toBe('7 × 12 = 84');
    expect(big.facts.find((f) => f.id === '16x16')?.statement).toBe('16 × 16 = 256');
    expect(big.facts.find((f) => f.id === '3x7')).toBeUndefined();
    const pairs = [...small, big]
      .flatMap((t) => t.facts)
      .map((f) => `${f.visual!.a},${f.visual!.b}`);
    expect(pairs).toHaveLength(256);
    expect(new Set(pairs).size).toBe(256);
  });

  it('division 11-16 mirrors multiplication 11-16', () => {
    const big = getTopic('division-11-16')!;
    const small = Array.from({ length: 10 }, (_, i) => getTopic(`divide-by-${i + 1}`)!);
    expect(big.facts).toHaveLength(156);
    for (const { visual, answer } of big.facts) {
      expect(visual!.kind).toBe('divide');
      expect(Math.max(Number(answer), visual!.b)).toBeGreaterThanOrEqual(11);
      expect(Math.max(Number(answer), visual!.b)).toBeLessThanOrEqual(16);
    }
    const fact = big.facts.find((f) => f.id === '84/7')!;
    expect(fact.answer).toBe('12');
    expect(fact.statement).toBe('84 ÷ 7 = 12');
    expect(big.facts.find((f) => f.id === '182/14')).toBeDefined();
    expect(big.facts.find((f) => f.id === '256/16')?.answer).toBe('16');
    expect(big.facts.find((f) => f.id === '70/7')).toBeUndefined();
    const pairs = [...small, big].flatMap((t) => t.facts).map((f) => `${f.answer},${f.visual!.b}`);
    expect(pairs).toHaveLength(256);
    expect(new Set(pairs).size).toBe(256);
  });

  it('keeps every times and divide fact id, each in exactly one topic', () => {
    const topicsOf = (id: string) => TOPICS.filter((t) => t.facts.some((f) => f.id === id));
    for (let n = 1; n <= 16; n++) {
      for (let table = 1; table <= 16; table++) {
        expect(topicsOf(`${n}x${table}`)).toHaveLength(1);
        expect(topicsOf(`${n * table}/${table}`)).toHaveLength(1);
      }
    }
    const timesIds = TOPICS.filter((t) => t.subject === 'Multiplication').flatMap((t) =>
      t.facts.map((f) => f.id),
    );
    const divideIds = TOPICS.filter((t) => t.subject === 'Division').flatMap((t) =>
      t.facts.map((f) => f.id),
    );
    expect(timesIds).toHaveLength(256);
    expect(divideIds).toHaveLength(256);
  });

  it('groups by subject in order', () => {
    expect(groupBySubject().map((g) => g.subject)).toEqual([
      'Addition',
      'Subtraction',
      'Multiplication',
      'Division',
    ]);
    const ids = (subject: string) =>
      groupBySubject()
        .find((g) => g.subject === subject)!
        .topics.map((t) => t.id);
    expect(ids('Addition')).toEqual(['addition-1-10', 'addition-11-16']);
    expect(ids('Subtraction')).toEqual(['subtraction-1-10', 'subtraction-11-16']);
    expect(ids('Multiplication')).toHaveLength(11);
    expect(ids('Division')).toHaveLength(11);
  });

  it('returns undefined for unknown topics', () => {
    expect(getTopic('nope')).toBeUndefined();
    expect(getTopic(null)).toBeUndefined();
  });
});

describe('mathFact', () => {
  it('builds prompt, statement and speech', () => {
    expect(mathFact('multiply', 3, 4)).toMatchObject({
      id: '3x4',
      prompt: '3 × 4 = ?',
      answer: '12',
      statement: '3 × 4 = 12',
      spokenPrompt: '3 times 4.',
      spokenStatement: '3 times 4 equals 12.',
    });
  });
});

describe('mathFact divide', () => {
  it('builds prompt, statement and speech', () => {
    expect(mathFact('divide', 12, 3)).toMatchObject({
      id: '12/3',
      prompt: '12 ÷ 3 = ?',
      answer: '4',
      statement: '12 ÷ 3 = 4',
      spokenPrompt: '12 divided by 3.',
      spokenStatement: '12 divided by 3 equals 4.',
    });
  });
});

describe('numericDistractors', () => {
  it('never returns the answer or values below min, and fills up to count', () => {
    const result = numericDistractors(1, [1, 0, -1, 2], 3, seededRandom(4), 1);
    expect(result).toHaveLength(3);
    expect(result).not.toContain('1');
    expect(result.map(Number).every((n) => n >= 1)).toBe(true);
    expect(new Set(result).size).toBe(3);
  });
});

describe('listTopic', () => {
  const words = listTopic(
    { id: 'sight-words', title: 'Sight words', subject: 'Reading', description: 'Words.' },
    [
      { prompt: '🔊', answer: 'the', spokenPrompt: 'the' },
      { prompt: '🔊', answer: 'said', spokenPrompt: 'said' },
      { prompt: '🔊', answer: 'was', spokenPrompt: 'was' },
      { prompt: '🔊', answer: 'they', spokenPrompt: 'they' },
    ],
  );

  it('is valid and uses answers as ids', () => {
    expect(validateTopic(words)).toEqual([]);
    expect(words.facts.map((f) => f.id)).toEqual(['the', 'said', 'was', 'they']);
  });

  it('takes wrong answers from the other words', () => {
    const options = answerOptions(words, words.facts[0], 4, seededRandom(2));
    expect([...options].sort()).toEqual(['said', 'the', 'they', 'was']);
  });

  it('returns fewer options when the list is short', () => {
    const tiny = listTopic({ id: 'tiny', title: 'T', subject: 'S', description: 'D' }, [
      { prompt: 'a?', answer: 'a' },
      { prompt: 'b?', answer: 'b' },
    ]);
    expect(answerOptions(tiny, tiny.facts[0], 4)).toHaveLength(2);
  });
});

describe('validateTopic', () => {
  it('reports duplicate fact ids and bad topic ids', () => {
    const bad = listTopic({ id: 'Bad Id', title: 'T', subject: 'S', description: 'D' }, [
      { prompt: 'x', answer: 'a' },
      { prompt: 'y', answer: 'a' },
    ]);
    const errors = validateTopic(bad);
    expect(errors.some((e) => e.includes('kebab-case'))).toBe(true);
    expect(errors.some((e) => e.includes('duplicate fact id'))).toBe(true);
    expect(errors.some((e) => e.includes('two different answers'))).toBe(true);
  });
});
