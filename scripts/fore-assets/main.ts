/**
 * Downloads the CC0 sources Fore! uses (ambientCG, Poly Haven, three.js) and writes the converted
 * files under `public/fore/` plus `public/fore/CREDITS.md`. The outputs are committed, so CI and
 * players never need the network: run `npm run fore-assets` only to rebuild them.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp, { type OverlayOptions } from 'sharp';
import { buildPeople, PEOPLE_SOURCE } from './people';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../../public/fore');
const work = mkdtempSync(join(tmpdir(), 'fore-assets-'));

interface Credit {
  file: string;
  source: string;
  licence: string;
}
const credits: Credit[] = [];

async function download(url: string): Promise<Buffer> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      if (attempt === 3) throw new Error(`Could not download ${url}`, { cause: err });
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
    }
  }
  throw new Error('unreachable');
}

interface PolyFile {
  url: string;
}
async function polyhaven<T>(id: string): Promise<T> {
  return JSON.parse((await download(`https://api.polyhaven.com/files/${id}`)).toString());
}

function save(file: string, data: Buffer, source: string, licence: string) {
  const path = join(OUT, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
  credits.push({ file, source, licence });
  console.log(`${file}  ${(data.length / 1024).toFixed(0)} KB`);
}

const webp = (input: Buffer, size: number, quality: number, grey = false) => {
  let s = sharp(input).resize(size, size, { fit: 'cover' });
  if (grey) s = s.greyscale();
  return s.webp({ quality }).toBuffer();
};

/**
 * Scales each channel so the picture's average is `mean` (0..255): the material colour in the game
 * is then the turf's average colour, and the photo only adds the variation around it.
 */
async function evened(input: Buffer, mean: number): Promise<Buffer> {
  const { channels } = await sharp(input).stats();
  const k = channels.slice(0, 3).map((c) => mean / c.mean);
  return sharp(input).removeAlpha().linear(k, [0, 0, 0]).png().toBuffer();
}

async function ambientCg(id: string, res: string) {
  const url = `https://ambientcg.com/get?file=${id}_${res}-JPG.zip`;
  const dir = mkdtempSync(join(work, `${id}-`));
  writeFileSync(join(dir, 'pack.zip'), await download(url));
  execFileSync('unzip', ['-q', '-o', join(dir, 'pack.zip'), '-d', join(dir, 'files')]);
  return (name: string) => readFileSync(join(dir, 'files', `${id}_${res}-JPG_${name}.jpg`));
}

// ---------- Tree pictures ----------

/** The alpha bounding box of an RGBA picture: [left, top, width, height]. */
async function alphaBox(rgba: Buffer): Promise<[number, number, number, number]> {
  const { data, info } = await sharp(rgba)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let x0 = info.width;
  let y0 = info.height;
  let x1 = 0;
  let y1 = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 40) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
    }
  }
  return [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
}

/** Joins a raw 3-channel colour and a 1-channel alpha into one raw 4-channel buffer. */
function interleave(rgb: Buffer, alpha: Buffer): Buffer {
  const out = Buffer.alloc(alpha.length * 4);
  for (let i = 0; i < alpha.length; i++) {
    out[i * 4] = rgb[i * 3];
    out[i * 4 + 1] = rgb[i * 3 + 1];
    out[i * 4 + 2] = rgb[i * 3 + 2];
    out[i * 4 + 3] = alpha[i];
  }
  return out;
}

/** A colour picture and its opacity picture as one RGBA png buffer. */
async function withOpacity(color: Buffer, opacity: Buffer): Promise<Buffer> {
  const rgb = await sharp(color).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const alpha = await sharp(opacity).greyscale().raw().toBuffer();
  const { width, height } = rgb.info;
  return sharp(interleave(rgb.data, alpha), { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
}

interface Piece {
  image: Buffer;
  left: number;
  top: number;
}

/**
 * Lays pieces on a transparent square and returns an RGBA webp whose colour under the clear parts
 * is the leaf green (so mip-mapped edges never go dark or white).
 */
async function flatAtlas(
  size: number,
  tiles: Piece[][],
  fill: { r: number; g: number; b: number },
): Promise<Buffer> {
  const half = size / 2;
  const all: OverlayOptions[] = [];
  tiles.forEach((pieces, t) => {
    const ox = (t % 2) * half;
    const oy = Math.floor(t / 2) * half;
    for (const p of pieces) all.push({ input: p.image, left: ox + p.left, top: oy + p.top });
  });
  const blank = { create: { width: size, height: size, channels: 4 as const } };
  const rgba = await sharp({
    create: { ...blank.create, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(all)
    .raw()
    .toBuffer();
  const alpha = Buffer.alloc(size * size);
  for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3];
  const colour = await sharp({
    create: { width: size, height: size, channels: 3, background: fill },
  })
    .composite(all)
    .removeAlpha()
    .raw()
    .toBuffer();
  return sharp(interleave(colour, alpha), { raw: { width: size, height: size, channels: 4 } })
    .webp({ quality: 78, alphaQuality: 90 })
    .toBuffer();
}

/** Four 512 px tiles of leaf clusters cut from the nine leaves of LeafSet024. */
async function leafAtlas(rgba: Buffer, seed: number): Promise<Buffer> {
  const rand = (() => {
    let s = seed;
    return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  })();
  const { width } = await sharp(rgba).metadata();
  const cell = Math.floor(width! / 3);
  const leaves: { image: Buffer; w: number; h: number }[] = [];
  for (let i = 0; i < 9; i++) {
    const crop = await sharp(rgba)
      .extract({ left: (i % 3) * cell, top: Math.floor(i / 3) * cell, width: cell, height: cell })
      .png()
      .toBuffer();
    const [l, t, w, h] = await alphaBox(crop);
    const image = await sharp(crop)
      .extract({ left: l, top: t, width: w, height: h })
      .png()
      .toBuffer();
    leaves.push({ image, w, h });
  }
  const tiles: Piece[][] = [];
  for (let t = 0; t < 4; t++) {
    const pieces: Piece[] = [];
    for (let k = 0; k < 30; k++) {
      const leaf = leaves[Math.floor(rand() * leaves.length)];
      const scale = 0.36 + rand() * 0.14;
      const angle = rand() * 360;
      const resized = await sharp(leaf.image)
        .resize(Math.round(leaf.w * scale), Math.round(leaf.h * scale))
        .rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
      const m = await sharp(resized).metadata();
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand()) * 165;
      pieces.push({
        image: resized,
        left: Math.round(256 + Math.cos(a) * d - m.width! / 2),
        top: Math.round(256 + Math.sin(a) * d - m.height! / 2),
      });
    }
    tiles.push(pieces);
  }
  return flatAtlas(1024, tiles, { r: 70, g: 105, b: 45 });
}

/** Four tiles of needle branches cut from the three branches of LeafSet019. */
async function needleAtlas(rgba: Buffer): Promise<Buffer> {
  const { width, height } = await sharp(rgba).metadata();
  const [l, t, w, h] = await alphaBox(rgba);
  void width;
  void height;
  // The three branches are stacked: split the opaque region into rows by the clear gaps.
  const { data, info } = await sharp(rgba)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rowOpaque = (y: number) => {
    for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 40) return true;
    return false;
  };
  const bands: [number, number][] = [];
  let start = -1;
  for (let y = t; y <= t + h; y++) {
    const on = y < t + h && rowOpaque(y);
    if (on && start < 0) start = y;
    if (!on && start >= 0) {
      if (y - start > 20) bands.push([start, y - start]);
      start = -1;
    }
  }
  void l;
  void w;
  const branches: { image: Buffer; w: number; h: number }[] = [];
  for (const [y, bh] of bands) {
    const strip = await sharp(rgba)
      .extract({ left: 0, top: y, width: info.width, height: bh })
      .png()
      .toBuffer();
    const [bl, bt, bw, bhh] = await alphaBox(strip);
    const image = await sharp(strip)
      .extract({ left: bl, top: bt, width: bw, height: bhh })
      .png()
      .toBuffer();
    branches.push({ image, w: bw, h: bhh });
  }
  const tiles: Piece[][] = [];
  for (let k = 0; k < 4; k++) {
    const a = branches[k % branches.length];
    const b = branches[(k + 1) % branches.length];
    const place = async (br: typeof a, width: number, angle: number, cx: number, cy: number) => {
      const scaled = await sharp(br.image)
        .resize(width, Math.round((br.h / br.w) * width))
        .rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
      const m = await sharp(scaled).metadata();
      return {
        image: scaled,
        left: Math.round(cx - m.width! / 2),
        top: Math.round(cy - m.height! / 2),
      };
    };
    tiles.push([
      await place(a, 480, k % 2 === 0 ? -12 : 10, 256, 190),
      await place(b, 440, k % 2 === 0 ? 14 : -9, 256, 330),
    ]);
  }
  return flatAtlas(1024, tiles, { r: 40, g: 78, b: 45 });
}

/** The rows of the credits table already on disk, so a partial run keeps the others. */
function existingCredits(): Credit[] {
  const path = join(OUT, 'CREDITS.md');
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .map((line) => /^\|\s*`([^`]+)`\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|$/.exec(line))
    .filter((m): m is RegExpExecArray => m !== null && m[1] !== 'CREDITS.md')
    .map((m) => ({ file: m[1], source: m[2], licence: m[3] }));
}

/** The people (from the owner's unzipped pack in `assets-src/`, so they run on their own too). */
async function people() {
  if (!existsSync(PEOPLE_SOURCE)) {
    console.warn(`${PEOPLE_SOURCE} is missing: keeping the people files as they are.`);
    credits.push(...existingCredits().filter((c) => c.file.startsWith('people/')));
    return;
  }
  await buildPeople({ out: OUT, work, save, download, polyhaven });
}

async function main() {
  const onlyPeople = process.argv.includes('people');
  if (onlyPeople) {
    credits.push(...existingCredits().filter((c) => !c.file.startsWith('people/')));
    await people();
    writeCredits();
    return;
  }
  const cc0 = 'CC0 1.0';

  // Sky: the 1k HDR lights the scene as it is; the tonemapped picture is the dome.
  const sky = await polyhaven<{
    hdri: Record<string, { hdr: PolyFile }>;
    tonemapped: PolyFile;
  }>('kloofendal_48d_partly_cloudy_puresky');
  const hdr = await download(sky.hdri['1k'].hdr.url);
  save('sky_env.hdr', hdr, 'https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky', cc0);
  const bg = await download(sky.tonemapped.url);
  save(
    'sky_bg.webp',
    await sharp(bg).resize(4096, 2048, { fit: 'fill' }).webp({ quality: 80 }).toBuffer(),
    'https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky (tonemapped JPG, resized)',
    cc0,
  );

  // Grass: colour, GL normal and roughness (roughness kept as one grey channel).
  const grass = await ambientCg('Grass004', '2K');
  const grassUrl = 'https://ambientcg.com/a/Grass004';
  save(
    'turf/grass_color.webp',
    await webp(await evened(grass('Color'), 235), 2048, 78),
    grassUrl,
    cc0,
  );
  save('turf/grass_normal.webp', await webp(grass('NormalGL'), 2048, 80), grassUrl, cc0);

  // Sand.
  const sand =
    await polyhaven<Record<string, Record<string, Record<string, PolyFile>>>>('coast_sand_01');
  const sandUrl = 'https://polyhaven.com/a/coast_sand_01';
  const part = async (key: string) => download(sand[key]['1k'].jpg.url);
  save(
    'turf/sand_color.webp',
    await webp(await evened(await part('Diffuse'), 190), 1024, 80),
    sandUrl,
    cc0,
  );
  save('turf/sand_normal.webp', await webp(await part('nor_gl'), 1024, 80), sandUrl, cc0);
  save('turf/sand_rough.webp', await webp(await part('Rough'), 1024, 70, true), sandUrl, cc0);

  // Water ripples, from the three.js examples.
  const waterUrl =
    'https://raw.githubusercontent.com/mrdoob/three.js/r186/examples/textures/waternormals.jpg';
  save('turf/waternormals.jpg', await download(waterUrl), waterUrl, 'MIT (three.js)');

  // Trees: bark for trunks (and the wood of the tee furniture) and the two leaf atlases.
  const bark =
    await polyhaven<Record<string, Record<string, Record<string, PolyFile>>>>('bark_brown_02');
  const barkUrl = 'https://polyhaven.com/a/bark_brown_02';
  const barkPart = async (key: string) => download(bark[key]['1k'].jpg.url);
  save('trees/bark_color.webp', await webp(await barkPart('Diffuse'), 1024, 78), barkUrl, cc0);
  save('trees/bark_normal.webp', await webp(await barkPart('nor_gl'), 1024, 80), barkUrl, cc0);
  const oakLeaves = await ambientCg('LeafSet024', '1K');
  save(
    'trees/leaves_oak.webp',
    await leafAtlas(await withOpacity(oakLeaves('Color'), oakLeaves('Opacity')), 24),
    'https://ambientcg.com/a/LeafSet024 (leaves clustered into four tiles)',
    cc0,
  );
  const pineLeaves = await ambientCg('LeafSet019', '1K');
  save(
    'trees/leaves_pine.webp',
    await needleAtlas(
      await withOpacity(
        await sharp(pineLeaves('Color'))
          .modulate({ brightness: 1.15, saturation: 1.1, hue: -10 })
          .toBuffer(),
        pineLeaves('Opacity'),
      ),
    ),
    'https://ambientcg.com/a/LeafSet019 (needle branches laid into four tiles)',
    cc0,
  );

  await people();
  writeCredits();
}

function writeCredits() {
  const rows = credits.map((c) => `| \`${c.file}\` | ${c.source} | ${c.licence} |`);
  const text = [
    '# Fore! asset credits',
    '',
    'Every file under `public/fore/` is listed here. Rebuild them with `npm run fore-assets`.',
    '',
    '| File | Source | Licence |',
    '| ---- | ------ | ------- |',
    `| \`CREDITS.md\` | this file | – |`,
    ...rows,
    '',
  ].join('\n');
  writeFileSync(join(OUT, 'CREDITS.md'), text);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => rmSync(work, { recursive: true, force: true }));
