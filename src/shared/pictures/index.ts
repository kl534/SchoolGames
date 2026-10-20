import { preloadSpeech, speak } from '../audio';
import type { Random } from '../random';
import { deviceStore, type KeyValueStore } from '../storage';
import type { TapCard } from '../tapmarks';
import type { Fact } from '../topics';
import { createPictureCard } from './card';
import { pickCritters, HOPPERS } from './critters';
import { devPicture } from './dev';
import { buildPicture, countSpeech } from './plan';
import { createPicturePlayer } from './player';
import { canUse, pickWay, readTurn, saveTurn, WAYS } from './ways';

export interface MissPicture {
  card: TapCard;
  /** Starts the counting; `onDone` runs once, after the finale. */
  start(onDone: () => void): void;
  /** Per frame, in game seconds (0 holds it). */
  update(delta: number): void;
  /** Silences it: no more counts, no `onDone`. */
  stop(): void;
}

/** Kinds of critters asked for: one for each bunch, group or row. */
const KINDS = 10;

/**
 * The picture that shows a missed math fact, or null when it has none (a word fact, the dev hook
 * says off, or no way fits). Each call takes the next way of the fact's operation.
 */
export function createMissPicture(
  fact: Fact,
  options: { random?: Random; store?: KeyValueStore } = {},
): MissPicture | null {
  const visual = fact.visual;
  if (!visual) return null;
  const forced = devPicture();
  if (forced === 'off') return null;
  const random = options.random ?? Math.random;
  const store = options.store ?? deviceStore();
  const dev =
    forced && WAYS[visual.kind].includes(forced) && canUse(visual, forced) ? forced : null;
  const pick = dev ? { way: dev, nextTurn: null } : pickWay(visual, readTurn(visual.kind, store));
  if (!pick) return null;
  if (pick.nextTurn !== null) saveTurn(visual.kind, pick.nextTurn, store);

  const critters = pickCritters(KINDS, random);
  const hopper = HOPPERS[Math.floor(random() * HOPPERS.length)];
  const picture = buildPicture(visual, pick.way, { critters, hopper });
  preloadSpeech(
    picture.steps.flatMap((step) => (step.count === null ? [] : [countSpeech(step.count)])),
  );
  const player = createPicturePlayer(picture, (text, onEnd) => speak(text, onEnd));
  const card = createPictureCard(picture, player, fact);
  return {
    card,
    start: (onDone) => player.start(onDone),
    update(delta) {
      player.update(delta);
      card.render();
    },
    stop: () => player.stop(),
  };
}
