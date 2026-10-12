import { describe, expect, it } from 'vitest';
import { gameUrl, parseGameParams } from '../src/shared/session';

describe('parseGameParams', () => {
  it('reads topic and timer', () => {
    expect(parseGameParams('?topic=times-3&timer=5')).toEqual({
      topicId: 'times-3',
      timerSeconds: 5,
    });
  });

  it.each(['', '?timer=abc', '?timer=-2', '?timer=0'])('treats %p as no timer', (search) => {
    expect(parseGameParams(search).timerSeconds).toBe(0);
  });

  it('caps the timer', () => {
    expect(parseGameParams('?timer=9999').timerSeconds).toBe(60);
  });
});

describe('gameUrl', () => {
  it('adds the topic and optional timer', () => {
    expect(gameUrl('/g/index.html', 'addition-1-10')).toBe('/g/index.html?topic=addition-1-10');
    expect(gameUrl('/g/index.html', 'times-2', 5)).toBe('/g/index.html?topic=times-2&timer=5');
  });

  it('round-trips through parseGameParams', () => {
    const url = gameUrl('/g/', 'subtraction-1-10', 5);
    expect(parseGameParams(url.slice(url.indexOf('?')))).toEqual({
      topicId: 'subtraction-1-10',
      timerSeconds: 5,
    });
  });
});
