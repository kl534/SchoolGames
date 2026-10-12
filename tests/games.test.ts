import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateManifest } from '../src/shared/manifest';

const gamesDir = resolve(import.meta.dirname, '../src/games');
const folders = readdirSync(gamesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

describe('game folders', () => {
  it('finds at least one game', () => {
    expect(folders.length).toBeGreaterThan(0);
  });

  describe.each(folders)('%s', (folder) => {
    const dir = resolve(gamesDir, folder);

    it('has index.html and main.ts', () => {
      expect(existsSync(resolve(dir, 'index.html'))).toBe(true);
      expect(existsSync(resolve(dir, 'main.ts'))).toBe(true);
    });

    it('has a valid game.json whose id matches the folder name', () => {
      const manifest = JSON.parse(readFileSync(resolve(dir, 'game.json'), 'utf8'));
      expect(validateManifest(manifest)).toEqual([]);
      expect(manifest.id).toBe(folder);
      if (manifest.thumbnail) expect(existsSync(resolve(dir, manifest.thumbnail))).toBe(true);
    });
  });
});
