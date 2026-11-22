// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWordCard } from '../src/shared/wordcard';
import { stateCapitals } from '../src/shared/topics/capitals';
import { mathFact } from '../src/shared/topics/math';
import { antonymFact, synonymFact, VOCAB_GRADES } from '../src/shared/topics/vocabulary';

afterEach(() => document.body.replaceChildren());

const row = VOCAB_GRADES[0].rows.find((r) => r[0] === 'happy')!;
const meaning = VOCAB_GRADES[0].meanings!.happy;
const syn = synonymFact(row, meaning);
const ant = antonymFact(row, meaning)!;

describe('createWordCard', () => {
  it('is null for a math fact, a capital fact and a word without a meaning', () => {
    expect(createWordCard(mathFact('add', 2, 3))).toBeNull();
    expect(createWordCard(stateCapitals.facts[0])).toBeNull();
    expect(createWordCard(synonymFact(row))).toBeNull();
  });

  it('shows the word, its part of speech, the meaning, the example and the answer', () => {
    const card = createWordCard(syn)!.card.element;
    expect(card.querySelector('.sg-wc-word')!.textContent).toBe('HAPPY');
    expect(card.querySelector('.sg-wc-pos')!.textContent).toContain('adjective');
    expect(card.querySelector('.sg-wc-def')!.textContent).toBe(meaning[0]);
    const example = card.querySelector('.sg-wc-example')!;
    expect(example.textContent).toBe(`“${meaning[1].replaceAll('*', '')}”`);
    expect(example.querySelector('.sg-wc-mark')!.textContent).toBe('happy');
    expect(card.querySelector('.sg-wc-rel')!.textContent).toBe('Synonym:');
    expect(card.querySelector('.sg-wc-answer')!.textContent).toContain('glad');
    expect(card.textContent).not.toContain('*');
    const antCard = createWordCard(ant)!.card.element;
    expect(antCard.querySelector('.sg-wc-rel')!.textContent).toBe('Antonym:');
    expect(antCard.querySelector('.sg-wc-answer')!.textContent).toContain('sad');
  });

  it('starts at once, once, and update and stop do nothing', () => {
    const picture = createWordCard(syn)!;
    const done = vi.fn();
    picture.start(done);
    expect(done).toHaveBeenCalledTimes(1);
    expect(() => {
      picture.update(0.1);
      picture.stop();
    }).not.toThrow();
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('fits its width to the room, between 220 and 380 px', () => {
    const { card } = createWordCard(syn)!;
    card.fit(300, 200);
    expect(card.element.style.width).toBe('300px');
    card.fit(1000, 400);
    expect(card.element.style.width).toBe('380px');
    card.fit(100, 400);
    expect(card.element.style.width).toBe('220px');
  });
});
