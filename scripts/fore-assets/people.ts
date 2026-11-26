/**
 * Converts the owner's Quaternius "Universal Base Characters" pack (CC0, unzipped into
 * `assets-src/quaternius/`, never committed) into the files Fore! loads:
 *   people/golfer.glb  the Superhero male body (eyes and eyebrows included)
 *   people/caddie.glb  the Superhero female body
 *   people/hair.glb    every hairstyle as a rigid mesh in the Head bone's own space
 *   people/fabric_normal.webp  Poly Haven fabric_pattern_07, the cloth weave
 * Textures go to <= 1024 WebP, the meshes are deduped, pruned and meshopt compressed (filter
 * mode, so the decoder hands back plain floats and the skin stays exact).
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { Document, NodeIO, type Primitive } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, mergeDocuments, prune, reorder, textureCompress } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

export const PEOPLE_SOURCE = 'assets-src/quaternius';
const POSE = 'Base Characters/Godot - UE';
const HAIR = 'Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)';
const SOURCE_URL = 'https://quaternius.itch.io/universal-base-characters';
const LICENCE = 'CC0 1.0 (Quaternius)';

export interface PeopleTools {
  out: string;
  work: string;
  save(file: string, data: Buffer, source: string, licence: string): void;
  download(url: string): Promise<Buffer>;
  polyhaven<T>(id: string): Promise<T>;
}

interface GltfJson {
  images?: { uri: string; name?: string }[];
}

/**
 * Copies a .gltf and its buffers to `dir` with every picture pointed at a file that exists: the
 * pack names some pictures `*_png.png` that are not shipped, wants the GL-convention normal maps
 * from `Textures/Normals Unity - Godot`, and calls the light-underwear skin `Ligh`.
 */
function stage(source: string, file: string, dir: string): string {
  mkdirSync(dir, { recursive: true });
  const json = JSON.parse(readFileSync(join(source, file), 'utf8')) as GltfJson & {
    buffers: { uri: string }[];
  };
  const folder = join(source, file, '..');
  const lookIn = [
    join(PEOPLE_SOURCE, 'Base Characters/Textures/Normals Unity - Godot'),
    join(PEOPLE_SOURCE, 'Base Characters/Textures'),
    join(PEOPLE_SOURCE, 'Hairstyles/Textures/Normals Unity - Godot'),
    join(PEOPLE_SOURCE, 'Hairstyles/Textures'),
    folder,
  ];
  for (const image of json.images ?? []) {
    let name = decodeURIComponent(image.uri).replace(/_png\.png$/, '.png');
    name = name.replace('Male_Dark', 'Male_Ligh').replace('Female_Dark', 'Female_Light');
    const isNormal = /Normal/.test(name);
    const dirs = isNormal ? lookIn : [...lookIn].reverse();
    const found = dirs.map((d) => join(d, name)).find((p) => existsSync(p));
    if (!found) throw new Error(`Picture ${name} for ${file} is not in the pack`);
    copyFileSync(found, join(dir, name));
    image.uri = name;
  }
  for (const buffer of json.buffers) copyFileSync(join(folder, buffer.uri), join(dir, buffer.uri));
  const staged = join(dir, basename(file));
  writeFileSync(staged, JSON.stringify(json));
  return staged;
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

/** Drops what the game does not use (second UV sets, vertex colours) from a primitive. */
function trim(prim: Primitive): void {
  for (const semantic of prim.listSemantics()) {
    if (/^(COLOR|TEXCOORD)_[1-9]$|^COLOR_0$/.test(semantic)) prim.setAttribute(semantic, null);
  }
}

async function finish(doc: Document, textureSize: number, file: string, tools: PeopleTools) {
  await MeshoptEncoder.ready;
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({
    method: EXTMeshoptCompression.EncoderMethod.FILTER,
  });
  await doc.transform(
    dedup(),
    prune(),
    textureCompress({
      encoder: sharp,
      targetFormat: 'webp',
      resize: [textureSize, textureSize],
      quality: 80,
    }),
    reorder({ encoder: MeshoptEncoder }),
  );
  io.registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  const data = Buffer.from(await io.writeBinary(doc));
  tools.save(file, data, `${SOURCE_URL} (${file.replace('people/', '')} converted)`, LICENCE);
}

async function body(gltf: string, file: string, tools: PeopleTools) {
  const doc = await io.read(stage(PEOPLE_SOURCE, `${POSE}/${gltf}`, join(tools.work, gltf)));
  for (const mesh of doc.getRoot().listMeshes()) mesh.listPrimitives().forEach(trim);
  await finish(doc, 1024, file, tools);
}

/** Every hairstyle as one static mesh in the Head bone's own space (so any body can wear it). */
async function hair(tools: PeopleTools) {
  const out = new Document();
  const scene = out.createScene('hair');
  const names = [
    'Hair_SimpleParted',
    'Hair_Buzzed',
    'Hair_Beard',
    'Hair_Long',
    'Hair_Buns',
    'Hair_BuzzedFemale',
  ];
  for (const name of names) {
    const src = await io.read(stage(PEOPLE_SOURCE, `${HAIR}/${name}.gltf`, join(tools.work, name)));
    const skin = src.getRoot().listSkins()[0];
    const joints = skin.listJoints();
    const at = joints.findIndex((j) => j.getName() === 'Head');
    const ibm = skin.getInverseBindMatrices()!;
    const m = ibm.getElement(at, new Array(16).fill(0));
    const prim = src.getRoot().listMeshes()[0].listPrimitives()[0];
    const pos = prim.getAttribute('POSITION')!;
    const normal = prim.getAttribute('NORMAL')!;
    const p = [0, 0, 0];
    const n = [0, 0, 0];
    for (let i = 0; i < pos.getCount(); i++) {
      pos.getElement(i, p);
      pos.setElement(i, [
        m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
        m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
        m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
      ]);
      normal.getElement(i, n);
      normal.setElement(i, [
        m[0] * n[0] + m[4] * n[1] + m[8] * n[2],
        m[1] * n[0] + m[5] * n[1] + m[9] * n[2],
        m[2] * n[0] + m[6] * n[1] + m[10] * n[2],
      ]);
    }
    prim.setAttribute('JOINTS_0', null).setAttribute('WEIGHTS_0', null);
    trim(prim);
    const mesh = src.getRoot().listMeshes()[0].setName(name);
    for (const node of src.getRoot().listNodes()) {
      if (node.getMesh() === mesh)
        node.setSkin(null).setMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    }
    const map = mergeDocuments(out, src);
    const node = out.createNode(name).setMesh(map.get(mesh) as never);
    scene.addChild(node);
  }
  // Only the new scene stays; the merged sources' scenes, bones and skins are pruned away.
  for (const s of out.getRoot().listScenes()) if (s !== scene) s.dispose();
  for (const n of out.getRoot().listNodes()) {
    if (n.getParentNode() === null && !scene.listChildren().includes(n)) n.dispose();
  }
  const [buffer, ...extra] = out.getRoot().listBuffers();
  for (const accessor of out.getRoot().listAccessors()) accessor.setBuffer(buffer);
  extra.forEach((b) => b.dispose());
  await finish(out, 1024, 'people/hair.glb', tools);
}

/** Builds everything under `public/fore/people/`. */
export async function buildPeople(tools: PeopleTools): Promise<void> {
  await body('Superhero_Male_FullBody.gltf', 'people/golfer.glb', tools);
  await body('Superhero_Female_FullBody.gltf', 'people/caddie.glb', tools);
  await hair(tools);
  const fabric =
    await tools.polyhaven<Record<string, Record<string, Record<string, { url: string }>>>>(
      'fabric_pattern_07',
    );
  const normal = await tools.download(fabric['nor_gl']['1k'].jpg.url);
  tools.save(
    'people/fabric_normal.webp',
    await sharp(normal).resize(512, 512).webp({ quality: 80 }).toBuffer(),
    'https://polyhaven.com/a/fabric_pattern_07 (normal map, resized to 512)',
    'CC0 1.0',
  );
}
