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

    it('shows and hides the state map', () => {
      const main = readFileSync(resolve(dir, 'main.ts'), 'utf8');
      expect(main).toMatch(/from '\.\.\/\.\.\/shared\/maps'/);
      expect(main).toContain('showFactMap(');
      expect(main).toContain('hideFactMap(');
    });

    it('has a MAP.md that lists every .ts file in the folder', () => {
      const mapPath = resolve(dir, 'MAP.md');
      expect(existsSync(mapPath)).toBe(true);
      const map = readFileSync(mapPath, 'utf8');
      const files = (readdirSync(dir, { recursive: true }) as string[])
        .map((f) => f.split('\\').join('/'))
        .filter((f) => f.endsWith('.ts'));
      expect(files.length).toBeGreaterThan(0);
      const unlisted = files.filter((f) => !map.includes('`' + f + '`'));
      expect(unlisted).toEqual([]);
    });
  });
});
