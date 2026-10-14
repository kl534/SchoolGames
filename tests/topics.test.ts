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

  it('has one topic per times table', () => {
    for (let n = 1; n <= 10; n++) {
      const topic = getTopic(`times-${n}`)!;
      expect(topic.facts.map((f) => f.answer)).toEqual(
        Array.from({ length: 10 }, (_, i) => String((i + 1) * n)),
      );
    }
  });

  it('has one topic per divisor, mirroring the times tables', () => {
    for (let n = 1; n <= 10; n++) {
      const topic = getTopic(`divide-by-${n}`)!;
      expect(topic.facts.map((f) => f.answer)).toEqual(
        Array.from({ length: 10 }, (_, i) => String(i + 1)),
      );
      expect(topic.facts[1].statement).toBe(`${2 * n} ÷ ${n} = 2`);
    }
  });

  it('groups by subject in order', () => {
    expect(groupBySubject().map((g) => g.subject)).toEqual([
      'Addition',
      'Subtraction',
      'Multiplication',
      'Division',
    ]);
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
