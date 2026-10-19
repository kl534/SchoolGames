import { describe, expect, it } from 'vitest';
import { stripAnsi, tail, testCount, formatLine } from '../scripts/check-report';
import {
  cellRect,
  parseShotArgs,
  parseSteps,
  sheetLayout,
  slug,
  targetPath,
} from '../scripts/shots/args';

describe('parseShotArgs', () => {
  it('defaults to all four sizes, a 2.5 s wait and .shots', () => {
    const o = parseShotArgs(['batter-up']);
    expect(o.targets).toEqual(['batter-up']);
    expect(o.sizes).toEqual([
      { w: 390, h: 844 },
      { w: 844, h: 390 },
      { w: 1024, h: 768 },
      { w: 1366, h: 1024 },
    ]);
    expect(o.wait).toBe(2500);
    expect(o.out).toBe('.shots');
    expect(o.start).toBe(false);
    expect(o.steps).toEqual([]);
  });

  it('reads --sizes phone and a comma list', () => {
    expect(parseShotArgs(['x', '--sizes', 'phone']).sizes).toEqual([
      { w: 390, h: 844 },
      { w: 844, h: 390 },
    ]);
    expect(parseShotArgs(['x', '--sizes', '844x390,1024x768']).sizes).toEqual([
      { w: 844, h: 390 },
      { w: 1024, h: 768 },
    ]);
  });

  it('throws on a bad size or an unknown flag', () => {
    expect(() => parseShotArgs(['x', '--sizes', '844by390'])).toThrow(/size/);
    expect(() => parseShotArgs(['x', '--bogus'])).toThrow(/Unknown option --bogus/);
  });

  it('takes several targets and the other options', () => {
    const o = parseShotArgs([
      'crash-course?lab=loop:clear:0&at=1',
      'batter-up',
      '/',
      '--start',
      '--wait',
      '100',
      '--out',
      'x',
      '--steps',
      'wait:5',
    ]);
    expect(o.targets).toEqual(['crash-course?lab=loop:clear:0&at=1', 'batter-up', '/']);
    expect(o.start).toBe(true);
    expect(o.wait).toBe(100);
    expect(o.out).toBe('x');
    expect(o.steps).toEqual([{ kind: 'wait', ms: 5 }]);
  });

  it('needs a target, and --name only with one', () => {
    expect(() => parseShotArgs(['--start'])).toThrow(/target/);
    expect(() => parseShotArgs(['a', 'b', '--name', 'n'])).toThrow(/--name/);
  });
});

describe('targetPath', () => {
  it('maps a game id and query to its page', () => {
    expect(targetPath('crash-course?lab=x:1')).toBe('/src/games/crash-course/index.html?lab=x:1');
    expect(targetPath('batter-up')).toBe('/src/games/batter-up/index.html');
  });
  it('keeps a path', () => {
    expect(targetPath('/')).toBe('/');
    expect(targetPath('/menu?a=1')).toBe('/menu?a=1');
  });
});

describe('slug', () => {
  it('keeps only lowercase letters, digits and dashes', () => {
    expect(slug('crash-course?lab=Loop:clear:0&at=1')).toBe('crash-course-lab-loop-clear-0-at-1');
    expect(slug('/')).toBe('root');
    expect(slug('??a??')).toBe('a');
  });
  it('is at most 80 characters with no trailing dash', () => {
    const s = slug(`game?${'a-'.repeat(100)}`);
    expect(s.length).toBeLessThanOrEqual(80);
    expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});

describe('parseSteps', () => {
  it('parses every kind in order', () => {
    expect(parseSteps('tap:.sg-btn;tapat:50,12.5;wait:300;key:Space')).toEqual([
      { kind: 'tap', selector: '.sg-btn' },
      { kind: 'tapat', x: 50, y: 12.5 },
      { kind: 'wait', ms: 300 },
      { kind: 'key', key: 'Space' },
    ]);
  });
  it('throws on a bad step', () => {
    expect(() => parseSteps('jump:1')).toThrow(/Bad step/);
    expect(() => parseSteps('wait:soon')).toThrow(/Bad step/);
    expect(() => parseSteps('tapat:50')).toThrow(/Bad step/);
    expect(() => parseSteps('tap:')).toThrow(/Bad step/);
  });
});

describe('cellRect', () => {
  const cell = { x: 0, y: 0, w: 600, h: 450 };
  for (const size of [
    { w: 390, h: 844 },
    { w: 844, h: 390 },
    { w: 1024, h: 768 },
    { w: 1366, h: 1024 },
  ]) {
    it(`fits ${size.w}x${size.h} inside the cell, centred, with its aspect`, () => {
      const r = cellRect(size, cell);
      expect(r.x).toBeGreaterThanOrEqual(-1e-9);
      expect(r.y).toBeGreaterThanOrEqual(-1e-9);
      expect(r.x + r.w).toBeLessThanOrEqual(cell.w + 1e-9);
      expect(r.y + r.h).toBeLessThanOrEqual(cell.h + 1e-9);
      expect(r.x + r.w / 2).toBeCloseTo(cell.w / 2, 6);
      expect(r.y + r.h / 2).toBeCloseTo(cell.h / 2, 6);
      expect(Math.abs(r.w / r.h / (size.w / size.h) - 1)).toBeLessThan(0.01);
    });
  }
  it('offsets by the cell origin', () => {
    const r = cellRect({ w: 600, h: 450 }, { x: 600, y: 450, w: 600, h: 450 });
    expect(r).toEqual({ x: 600, y: 450, w: 600, h: 450 });
  });
});

describe('sheetLayout', () => {
  it('tiles four 2x2, two side by side and one whole', () => {
    expect(sheetLayout(4)).toMatchObject({ w: 1200, h: 900 });
    expect(sheetLayout(4).cells[3]).toEqual({ x: 600, y: 450, w: 600, h: 450 });
    expect(sheetLayout(2)).toMatchObject({ w: 1200, h: 450 });
    expect(sheetLayout(1)).toMatchObject({ w: 1200, h: 900 });
  });
});

describe('check report helpers', () => {
  it('stripAnsi removes colour codes', () => {
    expect(stripAnsi('\u001b[31mred\u001b[39m \u001b[1;32mok\u001b[0m')).toBe('red ok');
  });

  it('tail leaves a short text alone and cuts a long one', () => {
    expect(tail('a\nb\nc', 5)).toBe('a\nb\nc');
    expect(tail('a\nb\nc\nd\ne', 2)).toBe('… (3 lines cut)\nd\ne');
  });

  it('testCount reads the passed count', () => {
    expect(testCount(' Test Files  28 passed (28)\n      Tests  1640 passed (1640)\n')).toBe(1640);
    expect(testCount('\u001b[2m      Tests \u001b[22m \u001b[32m12 passed\u001b[39m')).toBe(12);
    expect(testCount('nothing here')).toBeNull();
  });

  it('formatLine lines the columns up', () => {
    expect(formatLine('lint', true, '2.1s')).toBe('lint    ok   2.1s');
    expect(formatLine('format', true, 'no changes')).toBe('format  ok   no changes');
    expect(formatLine('test', false, '8.0s')).toBe('test    FAIL 8.0s');
  });
});
