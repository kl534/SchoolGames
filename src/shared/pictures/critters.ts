import { shuffle, type Random } from '../random';

export const ANIMALS = [
  '🐸',
  '🐥',
  '🐰',
  '🐷',
  '🐼',
  '🦊',
  '🐵',
  '🐶',
  '🐱',
  '🐯',
  '🐨',
  '🐮',
  '🐧',
  '🐢',
  '🐙',
  '🦄',
];
export const TREATS = ['🍓', '🍌', '🍉', '🍎', '🍇', '🍊', '🍒', '🧁', '🍩', '🍪'];
export const HOPPERS = ['🐰', '🐸', '🦘'];

/** `count` distinct critters from ANIMALS + TREATS, shuffled. */
export function pickCritters(count: number, random: Random): string[] {
  return shuffle([...ANIMALS, ...TREATS], random).slice(0, count);
}
