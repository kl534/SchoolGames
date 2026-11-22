import type { MissPicture } from '../pictures';
import type { Fact } from '../topics';
import { createWordCardElement } from './card';

/** `?wordcard=off` in a dev build: no word cards (a word miss keeps the plain caption). */
export function devWordCard(): 'off' | null {
  if (!import.meta.env.DEV) return null;
  const value = new URLSearchParams(globalThis.location?.search ?? '').get('wordcard');
  return value === 'off' ? 'off' : null;
}

/**
 * The card that explains a missed word fact, or null when it has no meaning (a math or other
 * fact, a word without one yet, or the dev hook says off). It says nothing and starts at once.
 */
export function createWordCard(fact: Fact): MissPicture | null {
  const meaning = fact.meaning;
  if (!meaning || devWordCard() === 'off') return null;
  return {
    card: createWordCardElement(meaning, fact.answer),
    start: (onDone) => onDone(),
    update() {},
    stop() {},
  };
}
