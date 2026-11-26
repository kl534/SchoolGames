/**
 * Quality tiers: how much the renderer does. A device starts on the tier its hints suggest (or the
 * one it saved) and the governor steps it down, never up, when the frame rate stays low. The last
 * tier keeps everything `low` draws but renders fewer pixels, for the slowest Chromebooks.
 */
import { MAX_DELTA } from '../../shared/scene';

export type Quality = 'high' | 'medium' | 'low' | 'lowest';
export const QUALITIES: readonly Quality[] = ['high', 'medium', 'low', 'lowest'];

export interface QualitySettings {
  /** Cap on devicePixelRatio (under 1 draws fewer pixels than the screen has and scales up). */
  maxPixelRatio: number;
  /** Multisample antialiasing; it can only be chosen when the renderer is made (the start tier). */
  antialias: boolean;
  /** 0 = no real shadows (the blob shadow only). */
  shadowMapSize: number;
  /** PCFSoftShadowMap, else PCFShadowMap. */
  softShadows: boolean;
  outlines: boolean;
  /** Scenery decor casts shadows too (floor and walls always receive). */
  decorShadows: boolean;
}

export const QUALITY_SETTINGS: Record<Quality, QualitySettings> = {
  high: {
    maxPixelRatio: 2,
    antialias: true,
    shadowMapSize: 2048,
    softShadows: true,
    outlines: true,
    decorShadows: true,
  },
  medium: {
    maxPixelRatio: 1.5,
    antialias: true,
    shadowMapSize: 1024,
    softShadows: false,
    outlines: true,
    decorShadows: false,
  },
  low: {
    maxPixelRatio: 1,
    antialias: true,
    shadowMapSize: 0,
    softShadows: false,
    outlines: false,
    decorShadows: false,
  },
  lowest: {
    maxPixelRatio: 0.75,
    antialias: false,
    shadowMapSize: 0,
    softShadows: false,
    outlines: false,
    decorShadows: false,
  },
};

export const MIN_FPS = 45;
/** Rolling window of frame deltas. */
export const SAMPLE_FRAMES = 90;
/** Seconds ignored after the start and after every change. */
export const SETTLE_SECONDS = 2;
/** localStorage key, per device. */
export const QUALITY_KEY = 'cd-quality';

export const isQuality = (value: string | null | undefined): value is Quality =>
  (QUALITIES as readonly (string | null | undefined)[]).includes(value);

/**
 * Starting tier from hints: a saved tier wins; else 'medium' for 4 cores or fewer (a Celeron
 * Chromebook) or 3 GB or less, else 'high'. The governor takes it lower only if frames are slow.
 */
export function initialQuality(hints: {
  saved: string | null;
  cores?: number;
  memoryGb?: number;
}): Quality {
  if (isQuality(hints.saved)) return hints.saved;
  if (hints.cores !== undefined && hints.cores <= 4) return 'medium';
  if (hints.memoryGb !== undefined && hints.memoryGb <= 3) return 'medium';
  return 'high';
}

export interface Governor {
  /** Feed every frame's delta (s); returns the new tier when it steps down, else null. */
  sample(delta: number): Quality | null;
  readonly quality: Quality;
}

export function createGovernor(start: Quality): Governor {
  let quality = start;
  let settle = 0;
  let window: number[] = [];
  return {
    get quality() {
      return quality;
    },
    sample(raw) {
      if (!(raw > 0)) return null;
      // The loop clamps its steps to MAX_DELTA; a clamped frame still counts, as the slowest it
      // can be, so a device under 10 fps steps down too. One hitch in the window barely moves it.
      const delta = Math.min(raw, MAX_DELTA);
      if (settle < SETTLE_SECONDS) {
        settle += delta;
        return null;
      }
      window.push(delta);
      if (window.length > SAMPLE_FRAMES) window.shift();
      if (window.length < SAMPLE_FRAMES) return null;
      const sum = window.reduce((a, b) => a + b, 0);
      if (SAMPLE_FRAMES / sum >= MIN_FPS) return null;
      const next = QUALITIES[QUALITIES.indexOf(quality) + 1];
      if (!next) return null;
      quality = next;
      settle = 0;
      window = [];
      return quality;
    },
  };
}
