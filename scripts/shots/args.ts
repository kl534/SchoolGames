/** Pure parts of `npm run shots`: argument parsing, target paths, steps and sheet layout. */

export interface Size {
  w: number;
  h: number;
}

export type Step =
  | { kind: 'tap'; selector: string }
  | { kind: 'tapat'; x: number; y: number }
  | { kind: 'wait'; ms: number }
  | { kind: 'key'; key: string };

export interface ShotOptions {
  targets: string[];
  sizes: Size[];
  start: boolean;
  steps: Step[];
  script?: string;
  wait: number;
  name?: string;
  out: string;
  url?: string;
}

export const ALL_SIZES = '390x844,844x390,1024x768,1366x1024';
export const PHONE_SIZES = '390x844,844x390';

export function parseSizes(text: string): Size[] {
  const list = text === 'all' ? ALL_SIZES : text === 'phone' ? PHONE_SIZES : text;
  return list.split(',').map((part) => {
    const match = /^(\d{2,5})x(\d{2,5})$/.exec(part.trim());
    if (!match) throw new Error(`Bad size "${part}": use WIDTHxHEIGHT, "all" or "phone"`);
    return { w: Number(match[1]), h: Number(match[2]) };
  });
}

/** Parse `tap:<css>;tapat:<x%>,<y%>;wait:<ms>;key:<Key>`. */
export function parseSteps(text: string): Step[] {
  const steps: Step[] = [];
  for (const raw of text.split(';')) {
    const part = raw.trim();
    if (!part) continue;
    const colon = part.indexOf(':');
    const kind = colon < 0 ? part : part.slice(0, colon);
    const arg = colon < 0 ? '' : part.slice(colon + 1).trim();
    if (kind === 'tap' && arg) {
      steps.push({ kind: 'tap', selector: arg });
    } else if (kind === 'tapat') {
      const m = /^(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)$/.exec(arg);
      if (!m) throw new Error(`Bad step "${part}": tapat needs <x%>,<y%>`);
      steps.push({ kind: 'tapat', x: Number(m[1]), y: Number(m[2]) });
    } else if (kind === 'wait' && /^\d+$/.test(arg)) {
      steps.push({ kind: 'wait', ms: Number(arg) });
    } else if (kind === 'key' && arg) {
      steps.push({ kind: 'key', key: arg });
    } else {
      throw new Error(`Bad step "${part}": use tap:<css>, tapat:<x%>,<y%>, wait:<ms> or key:<Key>`);
    }
  }
  return steps;
}

export function parseShotArgs(argv: string[]): ShotOptions {
  const options: ShotOptions = {
    targets: [],
    sizes: parseSizes('all'),
    start: false,
    steps: [],
    wait: 2500,
    out: '.shots',
  };
  const value = (i: number, flag: string): string => {
    const v = argv[i + 1];
    if (v === undefined) throw new Error(`${flag} needs a value`);
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--start') {
      options.start = true;
    } else if (arg === '--sizes') {
      options.sizes = parseSizes(value(i++, arg));
    } else if (arg === '--steps') {
      options.steps = parseSteps(value(i++, arg));
    } else if (arg === '--script') {
      options.script = value(i++, arg);
    } else if (arg === '--wait') {
      const ms = value(i++, arg);
      if (!/^\d+$/.test(ms)) throw new Error(`--wait needs milliseconds, got "${ms}"`);
      options.wait = Number(ms);
    } else if (arg === '--name') {
      options.name = value(i++, arg);
    } else if (arg === '--out') {
      options.out = value(i++, arg);
    } else if (arg === '--url') {
      options.url = value(i++, arg).replace(/\/+$/, '');
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown option ${arg}`);
    } else {
      options.targets.push(arg);
    }
  }
  if (!options.targets.length) throw new Error('Give at least one target, e.g. batter-up or /');
  if (options.name && options.targets.length > 1) {
    throw new Error('--name works with a single target only');
  }
  return options;
}

/** `crash-course?lab=x:1` → `/src/games/crash-course/index.html?lab=x:1`; `/path` stays as is. */
export function targetPath(target: string): string {
  if (target.startsWith('/')) return target;
  const q = target.indexOf('?');
  const id = q < 0 ? target : target.slice(0, q);
  const query = q < 0 ? '' : target.slice(q);
  return `/src/games/${id}/index.html${query}`;
}

/** A file-name-safe version of a target: only `[a-z0-9-]`, at most 80 characters. */
export function slug(target: string): string {
  const text = target
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
  return text || 'root';
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where a `size` screenshot goes inside a `cell`: scaled to fit and centred. */
export function cellRect(size: Size, cell: Size & { x?: number; y?: number }): Rect {
  const scale = Math.min(cell.w / size.w, cell.h / size.h);
  const w = size.w * scale;
  const h = size.h * scale;
  return { x: (cell.x ?? 0) + (cell.w - w) / 2, y: (cell.y ?? 0) + (cell.h - h) / 2, w, h };
}

/** Sheet size and the cell of each screenshot (2×2, side by side for two, whole for one). */
export function sheetLayout(count: number): { w: number; h: number; cells: Rect[] } {
  if (count <= 1) return { w: 1200, h: 900, cells: [{ x: 0, y: 0, w: 1200, h: 900 }] };
  if (count === 2) {
    return {
      w: 1200,
      h: 450,
      cells: [
        { x: 0, y: 0, w: 600, h: 450 },
        { x: 600, y: 0, w: 600, h: 450 },
      ],
    };
  }
  const cells: Rect[] = [];
  for (let i = 0; i < count; i++) {
    cells.push({ x: (i % 2) * 600, y: Math.floor(i / 2) * 450, w: 600, h: 450 });
  }
  return { w: 1200, h: Math.ceil(count / 2) * 450, cells };
}
