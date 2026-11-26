/**
 * Downloads the CC0 sources Fore! uses (ambientCG, Poly Haven, three.js) and writes the converted
 * files under `public/fore/` plus `public/fore/CREDITS.md`. The outputs are committed, so CI and
 * players never need the network: run `npm run fore-assets` only to rebuild them.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

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

async function main() {
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
