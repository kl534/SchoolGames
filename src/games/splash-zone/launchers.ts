/**
 * The three launchers the ski rides off: a rolling wave, a striped kicker ramp and a towering mega
 * ramp. Each is one mesh group built once and kept in a pool; its origin is the entry line on the
 * water, and it reaches forward (-z) to its lip. The surface heights match `surfaceY` in
 * `anim.ts`, so the ski rides on exactly what is drawn.
 */
import {
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  type Material,
} from 'three';
import { LAUNCHERS, surfaceY } from './anim';
import { Kit, ribbon, ribbonMaterial } from './kit';
import type { LauncherKind } from './rules';

export interface Launcher {
  kind: LauncherKind;
  /** Its origin is the entry line on the water. */
  object: Group;
  /** x-width the launcher covers across, and how far it reaches forward of the entry line (u). */
  width: number;
  length: number;
  /** Idle motion: flags and foam. */
  ambient(time: number): void;
}

export interface LauncherPool {
  get(kind: LauncherKind): Launcher;
  hideAll(): void;
  dispose(): void;
}

/** The wave: a long swell, deeper blue than the water, with a white foam curl along its crest. */
function buildWave(kit: Kit): Launcher {
  const g = LAUNCHERS.wave;
  const object = new Group();
  const reach = 10;
  const halfW = g.width / 2;
  const plane = new PlaneGeometry(g.width, reach + 4, 40, 28);
  plane.rotateX(-Math.PI / 2);
  const pos = plane.getAttribute('position');
  const colors: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    // The plane spans z = -(reach + 2) .. +2: d runs from -2 to reach + 2 ahead of the entry line.
    const d = -pos.getZ(i);
    const inside = d >= 0 && d <= reach;
    const along = inside ? Math.sin((Math.PI * d) / reach) ** 2 : 0;
    const across = Math.max(0, 1 - Math.abs(x / halfW) ** 3);
    const h = 1.4 * along * across;
    pos.setY(i, h + 0.02);
    // Lighter toward the crest.
    const k = Math.min(h / 1.4, 1);
    // The water's own colour at the foot, a deeper blue up the swell, lighter at the crest.
    const deep = Math.min(k * 2.2, 1);
    const crest = Math.max(k * 1.6 - 0.6, 0);
    colors.push(
      0.014 + (0.02 - 0.014) * deep + 0.18 * crest,
      0.57 + (0.34 - 0.57) * deep + 0.3 * crest,
      0.53 + (0.62 - 0.53) * deep + 0.25 * crest,
    );
  }
  plane.setAttribute('color', new Float32BufferAttribute(colors, 3));
  plane.computeVertexNormals();
  const material = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.35,
    flatShading: true,
  });
  kit.materials.push(material);
  const swell = kit.mesh(plane, material, object, 0, 0, 0);
  swell.name = 'swell';
  // The foam curl along the crest: a row of white lumps.
  const foam = new Group();
  object.add(foam);
  const white = kit.lit(0xffffff, 0.9);
  const lumps: Mesh[] = [];
  for (let i = 0; i < 17; i++) {
    const x = -halfW * 0.92 + (i / 16) * halfW * 1.84;
    const across = Math.max(0, 1 - Math.abs(x / halfW) ** 3);
    const lump = kit.mesh(
      new SphereGeometry(0.24, 10, 8),
      white,
      foam,
      x,
      1.4 * across + 0.15,
      -g.lipD,
    );
    lump.scale.set(1.5, 0.6 + 0.2 * (i % 3), 0.9);
    lumps.push(lump);
  }
  return {
    kind: 'wave',
    object,
    width: g.width,
    length: reach,
    ambient(time) {
      lumps.forEach((lump, i) => {
        lump.scale.y =
          0.7 + 0.25 * ((i + Math.floor(time * 2)) % 3) + 0.08 * Math.sin(time * 4 + i);
      });
    },
  };
}

/** A solid ramp ribbon running forward (-z) from the entry line, striped along its length. */
function rampRibbon(
  kind: LauncherKind,
  thickness: number,
  step: number,
  halfWidth: number,
  colorA: number,
  colorB: number,
  kit: Kit,
  parent: Group,
): void {
  const g = LAUNCHERS[kind];
  const geometry = ribbon(
    (x) => surfaceY(kind, x),
    0,
    g.lipD,
    step,
    -thickness,
    halfWidth,
    colorA,
    colorB,
  );
  // The ribbon is built along x; turn it so x runs forward (-z).
  geometry.rotateY(Math.PI / 2);
  kit.mesh(geometry, ribbonMaterial(kit), parent);
}

function buildKicker(kit: Kit): Launcher {
  const g = LAUNCHERS.kicker;
  const object = new Group();
  rampRibbon('kicker', 0.35, 0.75, g.width / 2, 0xe8403a, 0xffffff, kit, object);
  // Two yellow pontoons along the sides that keep it afloat.
  const yellow = kit.lit(0xffd43b, 0.5);
  for (const side of [-1, 1]) {
    const pontoon = kit.mesh(
      new CylinderGeometry(0.34, 0.34, g.lipD + 0.6, 14),
      yellow,
      object,
      side * (g.width / 2 + 0.2),
      -0.12,
      -g.lipD / 2,
    );
    pontoon.rotation.x = Math.PI / 2;
  }
  return { kind: 'kicker', object, width: g.width + 1, length: g.lipD, ambient() {} };
}

function buildMegaRamp(kit: Kit): Launcher {
  const g = LAUNCHERS['mega-ramp'];
  const object = new Group();
  rampRibbon('mega-ramp', 0.6, 1, g.width / 2, 0xffd43b, 0x2b2b35, kit, object);
  // The barge it stands on: a wide dark hull with an orange band, mostly under the water.
  const hull = kit.lit(0x3a4152, 0.7);
  const band = kit.lit(0xff7a1a, 0.6);
  kit.box(7.4, 1.6, g.lipD + 3, hull, object, 0, -0.55, -g.lipD / 2 + 0.5);
  kit.box(7.5, 0.16, g.lipD + 3.05, band, object, 0, 0.1, -g.lipD / 2 + 0.5);
  // A flag at each lip corner.
  const flags: Group[] = [];
  const pole = kit.lit(0xdddddd, 0.5);
  const flagMaterials = [kit.lit(0xe8403a, 0.6), kit.lit(0x2fa4e7, 0.6)];
  [-1, 1].forEach((side, i) => {
    const post = new Group();
    post.position.set(side * (g.width / 2 + 0.15), g.lipY, -g.lipD);
    object.add(post);
    kit.mesh(new CylinderGeometry(0.04, 0.04, 2.4, 8), pole, post, 0, 1.2, 0);
    const flag = new Group();
    flag.position.set(0, 2.0, 0);
    post.add(flag);
    const cloth = new PlaneGeometry(0.9, 0.55);
    cloth.translate(0.45, 0, 0);
    const mesh = kit.mesh(cloth, flagMaterials[i], flag);
    (mesh.material as Material).side = DoubleSide;
    flags.push(flag);
  });
  return {
    kind: 'mega-ramp',
    object,
    width: 7.4,
    length: g.lipD,
    ambient(time) {
      flags.forEach((flag, i) => {
        flag.rotation.y = Math.sin(time * 6 + i * 1.7) * 0.35 + 0.2;
      });
    },
  };
}

export function createLauncherPool(): LauncherPool {
  const kit = new Kit();
  const launchers: Record<LauncherKind, Launcher> = {
    wave: buildWave(kit),
    kicker: buildKicker(kit),
    'mega-ramp': buildMegaRamp(kit),
  };
  for (const l of Object.values(launchers)) l.object.visible = false;
  return {
    get: (kind) => launchers[kind],
    hideAll() {
      for (const l of Object.values(launchers)) l.object.visible = false;
    },
    dispose() {
      for (const l of Object.values(launchers)) l.object.removeFromParent();
      kit.dispose();
    },
  };
}
