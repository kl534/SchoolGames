import { describe, expect, it } from 'vitest';
import { gameUrl, parseGameParams } from '../src/shared/session';

describe('parseGameParams', () => {
  it('reads the topic', () => {
    expect(parseGameParams('?topic=times-3')).toEqual({ topicId: 'times-3' });
    expect(parseGameParams('').topicId).toBeNull();
  });
});

describe('gameUrl', () => {
  it('adds the topic', () => {
    expect(gameUrl('/g/index.html', 'addition-1-10')).toBe('/g/index.html?topic=addition-1-10');
  });

  it('round-trips through parseGameParams', () => {
    const url = gameUrl('/g/', 'subtraction-1-10');
    expect(parseGameParams(url.slice(url.indexOf('?')))).toEqual({
      topicId: 'subtraction-1-10',
    });
  });
});
