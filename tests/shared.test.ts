import { describe, expect, it } from 'vitest';
import { toProgress } from '../src/shared/assets';
import { clampPixelRatio } from '../src/shared/scene';
import { bestVoice } from '../src/shared/audio';
import { resultsSummary, type ResultsOptions } from '../src/shared/results';

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

describe('resultsSummary', () => {
  const base: ResultsOptions = {
    topicId: 't',
    correct: 7,
    total: 10,
    stars: 2,
    newBest: true,
    missed: [],
    playerName: 'Ava',
    onPlayAgain: () => {},
  };

  it('is unchanged for a stars game: stars, the star badge, the usual button', () => {
    expect(resultsSummary(base)).toEqual({
      heading: 'Great job, Ava!',
      outcome: null,
      score: null,
      highScore: null,
      badge: 'New best!',
      right: '7 out of 10 right',
      showStars: true,
      playAgainLabel: 'Play again ⚽',
    });
  });

  it('gives no star badge for zero stars or a repeat', () => {
    expect(resultsSummary({ ...base, stars: 0 }).badge).toBeNull();
    expect(resultsSummary({ ...base, newBest: false }).badge).toBeNull();
  });

  it('shows the score and high score, and no stars, when there is a score', () => {
    const s = resultsSummary({ ...base, score: 2400, highScore: 2400, newHighScore: false });
    expect(s.showStars).toBe(false);
    expect(s.score).toBe((2400).toLocaleString());
    expect(s.highScore).toBe(`High score: ${(2400).toLocaleString()}`);
    expect(s.right).toBe('7 out of 10 right');
    // The stars game's badge never shows in score mode.
    expect(s.badge).toBeNull();
  });

  it('passes on a line about how the game went', () => {
    expect(resultsSummary({ ...base, outcome: 'You beat the Bulls 9–6!' }).outcome).toBe(
      'You beat the Bulls 9–6!',
    );
  });

  it('badges a new high score', () => {
    expect(
      resultsSummary({ ...base, score: 3100, highScore: 3100, newHighScore: true }).badge,
    ).toBe('New high score!');
  });

  it('shows a score of zero, and uses a custom play again label', () => {
    const s = resultsSummary({ ...base, score: 0, playAgainLabel: 'Fly again 🚀' });
    expect(s.score).toBe('0');
    expect(s.highScore).toBeNull();
    expect(s.playAgainLabel).toBe('Fly again 🚀');
  });
});
