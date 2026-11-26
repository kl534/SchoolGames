/**
 * The gallery behind each green: a rope on white stakes along an arc on the side away from the cart
 * path, and spectators a few yards behind it, who sway and clap when a ball is holed or comes to
 * rest within 2 yd of the pin. They are clones of the golfer's and caddie's bodies (shared
 * geometry), seen only when the camera is within 150 yd of the green, and the ball never meets
 * them (no collision). Needs the loaded people; a tier with `gallery` 0 builds none.
 */
import {
  CatmullRomCurve3,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  TubeGeometry,
  Vector3,
  type BufferGeometry,
  type SkinnedMesh,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { seededRandom } from '../../shared/random';
import { GREEN_R, type Hole } from './course';
import { litTree, type Look } from './ground';
import { createSpectator, type Spectator } from './skin';
import type { Result } from './shot';
import { groundY } from './terrain';

/** The rope's radius round the pin, yards. */
export const ROPE_R = GREEN_R + 12;
/** Half the arc's width, degrees. */
export const ARC_HALF = 55;
/** The camera must be this close to the green for the crowd to be drawn, yards. */
export const GALLERY_RANGE = 150;
/** How long a clap lasts, seconds. */
export const CLAP_SECONDS = 1.5;
/** A ball resting this near the pin brings applause, yards. */
export const CLAP_NEAR = 2;

const STAKE_EVERY = 3;
const SAG = 0.1;
const ROPE_HEIGHT = 0.95;

interface XZ {
  x: number;
  z: number;
}

export interface Spot extends XZ {
  /** Turned to face the pin (0 faces +z). */
  yaw: number;
  /** Yards, 1.75 to 2. */
  height: number;
  male: boolean;
  /** Hairstyle mesh names from `hair.glb`. */
  hair: string[];
  shirt: number;
  trousers: number;
  skin: number;
  hairColour: number;
  cap: number | null;
  /** Where its sway starts (radians), its rate (Hz) and how late it joins a clap (seconds). */
  phase: number;
  rate: number;
  late: number;
}

export interface GalleryLayout {
  stakes: XZ[];
  spots: Spot[];
}

const SHIRTS = [0x6b8ba4, 0xa46b6b, 0x8aa46b, 0xa49a6b, 0x7a6ba4, 0x6ba49a, 0xa4806b, 0x8c8c8c];
const TROUSERS = [0x2f3a4f, 0x8f8266, 0x4b4f55, 0x55604a, 0x6a5d4a];
const SKINS = [0xffffff, 0xe6c4a6, 0xc59a76, 0x9b7150, 0x6e4c34];
const HAIRS = [0x2a1b10, 0x5a3a22, 0x8a6a3c, 0x1a1a1a, 0x6e6a64];
const CAPS = [0xf0f0f0, 0x2f5a3a, 0x1f2f4f, 0x8f2f2f];
const STYLES = ['Hair_Buzzed', 'Hair_Long', 'Hair_SimpleParted'];

/** The angle (radians from +z towards +x) the arc is centred on: the side away from the cart path. */
export function arcCentre(groveSide: -1 | 1): number {
  return (-groveSide * ARC_HALF * Math.PI) / 180;
}

/** Whether a point is on a hazard (with a yard's room) or in the way of a gameplay tree. */
function blocked(h: Hole, p: XZ): boolean {
  const room = 1.5;
  const inEllipse = (e: { x: number; z: number; rx: number; rz: number }) =>
    ((p.x - e.x) / (e.rx + room)) ** 2 + ((p.z - e.z) / (e.rz + room)) ** 2 < 1;
  return (
    h.hazards.some((hz) => inEllipse(hz.at)) ||
    h.trees.some((t) => Math.hypot(p.x - t.x, p.z - t.z) < t.r + room)
  );
}

/** Rope stakes and `count` spectators round the pin; pure and seeded by the hole. */
export function galleryLayout(h: Hole, groveSide: -1 | 1, count: number): GalleryLayout {
  const rand = seededRandom(Math.round(h.length * 17 + h.bend * 311 + 4242));
  const centre = arcCentre(groveSide);
  const half = (ARC_HALF * Math.PI) / 180;
  const at = (theta: number, r: number): XZ => ({
    x: h.pin.x + Math.sin(theta) * r,
    z: h.pin.z + Math.cos(theta) * r,
  });

  const stakeCount = Math.floor((2 * half * ROPE_R) / STAKE_EVERY) + 1;
  const stakes: XZ[] = [];
  for (let i = 0; i < stakeCount; i++) {
    stakes.push(at(centre - half + (i / (stakeCount - 1)) * 2 * half, ROPE_R));
  }

  const spots: Spot[] = [];
  const step = (2 * half) / Math.max(count, 1);
  for (let i = 0; i < count; i++) {
    const theta = centre - half + (i + 0.5 + (rand() - 0.5) * 0.6) * step;
    const p = at(theta, ROPE_R + 2 + rand() * 3);
    if (blocked(h, p)) continue;
    const male = rand() < 0.5;
    const style = STYLES[Math.floor(rand() * STYLES.length)];
    const hair = male && rand() < 0.4 ? [style, 'Hair_Beard'] : [style];
    spots.push({
      ...p,
      yaw: Math.atan2(h.pin.x - p.x, h.pin.z - p.z),
      height: 1.75 + rand() * 0.25,
      male,
      hair,
      shirt: SHIRTS[Math.floor(rand() * SHIRTS.length)],
      trousers: TROUSERS[Math.floor(rand() * TROUSERS.length)],
      skin: SKINS[Math.floor(rand() * SKINS.length)],
      hairColour: HAIRS[Math.floor(rand() * HAIRS.length)],
      cap: rand() < 0.25 ? CAPS[Math.floor(rand() * CAPS.length)] : null,
      phase: rand() * Math.PI * 2,
      rate: 0.2 + rand() * 0.2,
      late: rand() * 0.3,
    });
  }
  return { stakes, spots };
}

/** Whether a shot's result earns applause: holed, or resting within 2 yd of the pin. */
export function shouldClap(result: Result, pin: XZ): boolean {
  if (result.kind === 'holed') return true;
  return (
    result.kind === 'rest' && Math.hypot(result.at.x - pin.x, result.at.z - pin.z) <= CLAP_NEAR
  );
}

/** How far into a clap it is, 0 to 1, `since` seconds after it began (ramps in and out). */
export function clapAmount(since: number): number {
  if (since < 0 || since > CLAP_SECONDS) return 0;
  return Math.min(since / 0.15, (CLAP_SECONDS - since) / 0.25, 1);
}

export interface Gallery {
  object: Group;
  /** Poses the crowd at time `t` and shows it only while `camera` is within 150 yd of the green. */
  update(t: number, camera: Vector3): void;
  /** Starts the applause now (`t` as in `update`). */
  clap(t: number): void;
  /** The angle the arc is centred on (radians from +z towards +x, seen from the pin). */
  centre: number;
  /** How many spectators and meshes it draws, and bones it moves (for the frame cost). */
  stats: { spectators: number; meshes: number; bones: number };
  dispose(): void;
}

export function buildGallery(h: Hole, groveSide: -1 | 1, look: Look): Gallery | null {
  const people = look.assets.people;
  const count = look.settings.gallery;
  if (!people || count <= 0) return null;
  const { stakes, spots } = galleryLayout(h, groveSide, count);
  const object = new Group();
  object.name = 'gallery';

  const geometries: BufferGeometry[] = [];
  const materials: MeshStandardMaterial[] = [];

  // The stakes: one instanced mesh; the rope: thin tubes sagging between them.
  const white = new MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.6 });
  materials.push(white);
  const stakeGeometry = new CylinderGeometry(0.035, 0.035, ROPE_HEIGHT + 0.1, 6);
  stakeGeometry.translate(0, (ROPE_HEIGHT + 0.1) / 2, 0);
  geometries.push(stakeGeometry);
  const post = new InstancedMesh(stakeGeometry, white, stakes.length);
  const m = new Matrix4();
  stakes.forEach((s, i) => {
    post.setMatrixAt(i, m.makeTranslation(s.x, groundY(h, s.x, s.z), s.z));
  });
  post.frustumCulled = false;
  post.castShadow = look.shadows;
  object.add(post);
  const spans: BufferGeometry[] = [];
  for (let i = 0; i + 1 < stakes.length; i++) {
    const a = stakes[i];
    const b = stakes[i + 1];
    const points = [0, 0.25, 0.5, 0.75, 1].map((u) => {
      const x = a.x + (b.x - a.x) * u;
      const z = a.z + (b.z - a.z) * u;
      return new Vector3(x, groundY(h, x, z) + ROPE_HEIGHT - SAG * 4 * u * (1 - u), z);
    });
    spans.push(new TubeGeometry(new CatmullRomCurve3(points), 6, 0.022, 4));
  }
  const rope = mergeGeometries(spans);
  spans.forEach((g) => g.dispose());
  geometries.push(rope);
  const ropeMesh = new Mesh(rope, white);
  ropeMesh.castShadow = look.shadows;
  object.add(ropeMesh);

  // The crowd.
  const crowd: { person: Spectator; spot: Spot }[] = [];
  for (const spot of spots) {
    const person = createSpectator(spot.male ? people.golfer : people.caddie, {
      outfit: {
        shirt: spot.shirt,
        trousers: spot.trousers,
        shoes: 0x2a2a2e,
        accent: 0xffffff,
        accentOn: false,
      },
      accent: spot.male ? 'glove' : 'bib',
      cap: spot.cap,
      hair: spot.hair.map((style) => ({ style, colour: spot.hairColour })),
      hairSource: people.hair,
      weave: people.weave,
      height: spot.height,
      face: false,
      skin: spot.skin,
      phase: spot.phase,
      rate: spot.rate,
    });
    person.root.position.set(spot.x, groundY(h, spot.x, spot.z), spot.z);
    person.root.rotation.y = spot.yaw;
    object.add(person.root);
    crowd.push({ person, spot });
  }
  litTree(look.csm, object);
  if (look.shadows) {
    object.traverse((o) => {
      if ((o as { isMesh?: boolean }).isMesh) o.castShadow = true;
    });
  }

  let meshes = 0;
  let bones = 0;
  object.traverse((o) => {
    if ((o as Mesh).isMesh) meshes++;
    const skinned = o as SkinnedMesh;
    if (skinned.isSkinnedMesh && skinned.visible) bones += skinned.skeleton.bones.length;
  });
  let clapAt = -Infinity;
  const pin = new Vector3(h.pin.x, 0, h.pin.z);
  return {
    object,
    centre: arcCentre(groveSide),
    stats: { spectators: crowd.length, meshes, bones },
    update(t, camera) {
      const near = camera.distanceTo(pin) <= GALLERY_RANGE;
      object.visible = near;
      if (!near) return;
      const since = t - clapAt;
      for (const { person, spot } of crowd) {
        const late = since - spot.late;
        person.pose(t, clapAmount(late), late);
      }
    },
    clap(t) {
      clapAt = t;
    },
    dispose() {
      crowd.forEach((c) => c.person.dispose());
      materials.forEach((x) => x.dispose());
      geometries.forEach((g) => g.dispose());
      post.dispose();
      object.clear();
      object.removeFromParent();
    },
  };
}
