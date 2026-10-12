import { describe, expect, it } from 'vitest';
import { isGameManifest, parseManifest, validateManifest } from '../src/shared/manifest';

const valid = { id: 'my-game', title: 'My Game', description: 'Fun.' };

describe('validateManifest', () => {
  it('accepts a minimal manifest', () => {
    expect(validateManifest(valid)).toEqual([]);
  });

  it('accepts optional thumbnail and tags', () => {
    expect(isGameManifest({ ...valid, thumbnail: 'thumb.png', tags: ['a', 'b'] })).toBe(true);
  });

  it.each([null, 'x', 5, [], undefined])('rejects non-object %p', (value) => {
    expect(validateManifest(value)).not.toEqual([]);
  });

  it.each(['', 'Has Caps', 'under_score', '-lead', 'trail-', 'a--b', 5])(
    'rejects bad id %p',
    (id) => {
      expect(isGameManifest({ ...valid, id })).toBe(false);
    },
  );

  it('rejects missing or blank title/description', () => {
    expect(isGameManifest({ ...valid, title: ' ' })).toBe(false);
    expect(isGameManifest({ id: 'a', title: 't' })).toBe(false);
  });

  it('rejects bad thumbnail and tags', () => {
    expect(isGameManifest({ ...valid, thumbnail: 3 })).toBe(false);
    expect(isGameManifest({ ...valid, tags: 'x' })).toBe(false);
    expect(isGameManifest({ ...valid, tags: ['ok', ''] })).toBe(false);
  });
});

describe('parseManifest', () => {
  it('returns the manifest when valid', () => {
    expect(parseManifest(valid)).toEqual(valid);
  });

  it('throws a readable error when invalid', () => {
    expect(() => parseManifest({})).toThrow(/Invalid game manifest/);
  });
});
