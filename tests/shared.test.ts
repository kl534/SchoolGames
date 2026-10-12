import { describe, expect, it } from 'vitest';
import { toProgress } from '../src/shared/assets';
import { clampPixelRatio } from '../src/shared/scene';
import { bestVoice } from '../src/shared/audio';

describe('toProgress', () => {
  it('returns a fraction', () => {
    expect(toProgress(1, 4)).toBe(0.25);
  });
  it('is 1 when nothing to load', () => {
    expect(toProgress(0, 0)).toBe(1);
  });
  it('clamps to 0..1', () => {
    expect(toProgress(9, 3)).toBe(1);
    expect(toProgress(-1, 3)).toBe(0);
  });
});

describe('clampPixelRatio', () => {
  it('caps high-density displays', () => {
    expect(clampPixelRatio(3)).toBe(2);
  });
  it('keeps normal values and floors at 1', () => {
    expect(clampPixelRatio(1.5)).toBe(1.5);
    expect(clampPixelRatio(0.5)).toBe(1);
  });
});

describe('bestVoice', () => {
  const v = (name: string, lang = 'en-US', isDefault = false) => ({
    name,
    lang,
    default: isDefault,
  });

  it('prefers natural and Google voices over OS defaults', () => {
    const david = v('Microsoft David - English (United States)', 'en-US', true);
    const google = v('Google US English');
    const aria = v('Microsoft Aria Online (Natural) - English (United States)');
    expect(bestVoice([david, google])).toBe(google);
    expect(bestVoice([david, google, aria])).toBe(aria);
  });
  it('never picks novelty or robotic voices', () => {
    const albert = v('Albert');
    const samantha = v('Samantha');
    expect(bestVoice([albert, v('Zarvox'), samantha])).toBe(samantha);
    expect(bestVoice([albert, v('eSpeak English')])).toBeNull();
  });
  it('ignores non-English voices and handles underscore locales', () => {
    const french = v('Amélie (Enhanced)', 'fr-FR');
    const english = v('English United States', 'en_US');
    expect(bestVoice([french, english])).toBe(english);
    expect(bestVoice([french])).toBeNull();
  });
});
