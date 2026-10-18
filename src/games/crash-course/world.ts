/**
 * The stunt-park fairground: sunny sky, hills, a big top and a ferris wheel, trees and balloons,
 * bunting, a crowd in the stands, and the road itself. All procedural; nothing to load.
 */
import {
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Shape,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
  type Scene,
} from 'three';

export type Mood = 'idle' | 'cheer' | 'groan';

/** The road is a slab: top at y = 0, front face towards the camera, and thick enough to fill the screen bottom. */
export const ROAD_Z_FRONT = 1.2;
export const ROAD_Z_BACK = -3;
export const ROAD_DEPTH = 14;
const ROAD_FROM = -25;
const ROAD_TO = 85;
export const SKY_TOP = 0x4fb8f4;
export const SKY_BOTTOM = 0xcdeeff;

export type Cut = readonly [from: number, to: number];

export interface World {
  /** Moves the road and the scenery to cover the view around `camX`. */
  update(camX: number, cuts: readonly Cut[], delta: number, distance: number, camY: number): void;
  /** The crowd cheers or groans for `seconds`, then goes back to watching. */
  setMood(mood: Mood, seconds: number): void;
  /** The blob shadow under the bike. */
  setShadow(x: number, visible: boolean, scale: number): void;
  dispose(): void;
}

const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

function gradientTexture(): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  if (!g) return null;
  const fill = g.createLinearGradient(0, 0, 0, 256);
  fill.addColorStop(0, `#${SKY_TOP.toString(16)}`);
  fill.addColorStop(0.7, `#${SKY_BOTTOM.toString(16)}`);
  fill.addColorStop(1, '#eaf8ff');
  g.fillStyle = fill;
  g.fillRect(0, 0, 4, 256);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function createWorld(scene: Scene): World {
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const track = <T extends BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const lit = (color: number, roughness = 0.8) => {
    const m = new MeshStandardMaterial({ color, roughness });
    materials.push(m);
    return m;
  };
  const flat = (color: number, opacity = 1) => {
    const m = new MeshBasicMaterial({ color, transparent: opacity < 1, opacity });
    materials.push(m);
    return m;
  };
  const add = (
    parent: Object3D,
    geometry: BufferGeometry,
    material: Material,
    x = 0,
    y = 0,
    z = 0,
  ): Mesh => {
    const mesh = new Mesh(track(geometry), material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };

  // ---------- Sky and light ----------
  const sky = gradientTexture();
  scene.background = sky ?? new Color(SKY_BOTTOM);
  const lights = new Group();
  lights.add(new HemisphereLight(0xdcecff, 0x8aa070, 1.6));
  lights.add(new AmbientLight(0xffffff, 0.45));
  const sun = new DirectionalLight(0xfff0d6, 2.3);
  sun.position.set(-8, 18, 14);
  lights.add(sun);
  scene.add(lights);

  // ---------- The road ----------
  const roadMaterial = lit(0x4b4f5c, 0.9);
  const roadTop = lit(0x5d6272, 0.9);
  const dirt = lit(0xb77b45, 1);
  const bands = lit(0x8d5a2e, 1);
  const road = new Group();
  scene.add(road);
  /** A slab from x = 0 to 1 that is scaled to length. */
  const slabs: Group[] = [];
  const unit = track(new BoxGeometry(1, ROAD_DEPTH, ROAD_Z_FRONT - ROAD_Z_BACK));
  const topUnit = track(new BoxGeometry(1, 0.06, ROAD_Z_FRONT - ROAD_Z_BACK - 0.5));
  const bandUnit = track(new BoxGeometry(1, 0.22, 0.05));
  for (let i = 0; i < 4; i++) {
    const slab = new Group();
    const body = new Mesh(unit, dirt);
    body.position.set(0.5, -ROAD_DEPTH / 2, (ROAD_Z_FRONT + ROAD_Z_BACK) / 2);
    slab.add(body);
    // The asphalt top, a touch proud of the dirt, and the darker layers on the cut face.
    const top = new Mesh(topUnit, roadTop);
    top.position.set(0.5, -0.03, (ROAD_Z_FRONT + ROAD_Z_BACK) / 2 - 0.25);
    slab.add(top);
    for (const y of [-1.4, -2.8, -4.6, -7, -10]) {
      const band = new Mesh(bandUnit, bands);
      band.position.set(0.5, y, ROAD_Z_FRONT + 0.025);
      slab.add(band);
    }
    const edge = new Mesh(topUnit, roadMaterial);
    edge.scale.set(1, 3, 0.18);
    edge.position.set(0.5, -0.1, ROAD_Z_FRONT - 0.1);
    slab.add(edge);
    slab.visible = false;
    road.add(slab);
    slabs.push(slab);
  }

  // Dashed line and red-and-white kerb: pooled instances moved along with the camera.
  const KERBS = 140;
  const DASHES = 40;
  const kerbRed = new InstancedMesh(
    track(new BoxGeometry(1, 0.16, 0.34)),
    lit(0xe8403a, 0.7),
    KERBS,
  );
  const kerbWhite = new InstancedMesh(
    track(new BoxGeometry(1, 0.16, 0.34)),
    lit(0xf4f4f4, 0.7),
    KERBS,
  );
  const dashes = new InstancedMesh(track(new BoxGeometry(1.6, 0.02, 0.16)), flat(0xffe066), DASHES);
  for (const m of [kerbRed, kerbWhite, dashes]) {
    m.frustumCulled = false;
    road.add(m);
  }
  materials.push(kerbRed.material as Material, kerbWhite.material as Material);
  const matrix = new Matrix4();
  const hideMatrix = new Matrix4().makeScale(0, 0, 0);
  let roadKey = '';

  const inCut = (x: number, cuts: readonly Cut[], pad = 0) =>
    cuts.some(([a, b]) => x > a - pad && x < b + pad);

  const layoutRoad = (camX: number, cuts: readonly Cut[]) => {
    // Road slabs between the cuts.
    const from = camX + ROAD_FROM;
    const to = camX + ROAD_TO;
    let start = from;
    let used = 0;
    const sorted = [...cuts].sort((a, b) => a[0] - b[0]);
    const place = (a: number, b: number) => {
      if (b - a < 0.01 || used >= slabs.length) return;
      const slab = slabs[used++];
      slab.visible = true;
      slab.position.set(a, 0, 0);
      slab.scale.set(b - a, 1, 1);
    };
    for (const [a, b] of sorted) {
      if (b <= start) continue;
      place(start, Math.min(a, to));
      start = Math.max(start, b);
    }
    place(start, to);
    for (let i = used; i < slabs.length; i++) slabs[i].visible = false;

    // Kerb stripes every unit along the front edge, hidden over a cut.
    const first = Math.floor(from);
    let r = 0;
    let w = 0;
    for (let k = 0; k < KERBS; k++) {
      const x = first + k + 0.5;
      if (inCut(x, cuts, 0.5)) continue;
      matrix.makeTranslation(x, 0.02, ROAD_Z_FRONT - 0.15);
      if (k % 2 === 0) kerbRed.setMatrixAt(r++, matrix);
      else kerbWhite.setMatrixAt(w++, matrix);
    }
    for (let i = r; i < KERBS; i++) kerbRed.setMatrixAt(i, hideMatrix);
    for (let i = w; i < KERBS; i++) kerbWhite.setMatrixAt(i, hideMatrix);
    kerbRed.instanceMatrix.needsUpdate = true;
    kerbWhite.instanceMatrix.needsUpdate = true;
    const firstDash = Math.floor(from / 4);
    let d = 0;
    for (let k = 0; k < DASHES; k++) {
      const x = (firstDash + k) * 4 + 2;
      if (inCut(x, cuts, 1)) continue;
      matrix.makeTranslation(x, 0.035, ROAD_Z_BACK + 1.9);
      dashes.setMatrixAt(d++, matrix);
    }
    for (let i = d; i < DASHES; i++) dashes.setMatrixAt(i, hideMatrix);
    dashes.instanceMatrix.needsUpdate = true;
  };

  // ---------- A blob shadow ----------
  const shadow = new Mesh(track(new SphereGeometry(1, 16, 8)), flat(0x000000, 0.28));
  shadow.scale.set(1.2, 0.02, 0.5);
  shadow.position.set(0, 0.03, 0);
  shadow.renderOrder = 1;
  materials.push(shadow.material as Material);
  scene.add(shadow);

  // ---------- Tiled scenery layers ----------
  interface Layer {
    group: Group;
    tiles: Group[];
    tileW: number;
    z: number;
    /** Screen speed as a fraction of the road's; null = fixed in the world. */
    pt: number | null;
    /** How big the layer is drawn, as a fraction of its natural size. */
    size: number;
    wheels: Group[];
  }
  const layers: Layer[] = [];

  const makeLayer = (
    z: number,
    tileW: number,
    pt: number | null,
    build: (tile: Group) => void,
    count = 4,
    size = 1,
  ) => {
    const group = new Group();
    const tiles: Group[] = [];
    const wheels: Group[] = [];
    for (let i = 0; i < count; i++) {
      const tile = new Group();
      build(tile);
      tile.position.x = (i - 1) * tileW;
      group.add(tile);
      tiles.push(tile);
      tile.traverse((o) => {
        if (o.name === 'wheel') wheels.push(o as Group);
      });
    }
    group.position.z = z;
    scene.add(group);
    layers.push({ group, tiles, tileW, z, pt, size, wheels });
  };

  // Soft clouds.
  makeLayer(-95, 90, 0.03, (tile) => {
    const white = flat(0xffffff, 0.92);
    for (const [x, y, s] of [
      [12, 30, 1.2],
      [48, 38, 0.9],
      [74, 27, 1.1],
    ] as const) {
      for (const [dx, dy, r] of [
        [0, 0, 4],
        [4, -0.8, 3.2],
        [-4, -0.8, 3],
        [1.5, 1.6, 3],
      ] as const) {
        add(tile, new SphereGeometry(r * s, 14, 10), white, x + dx * s, y + dy * s, 0).scale.z =
          0.4;
      }
    }
  });

  // Far and near hills.
  const hillTile = (tile: Group, color: number, height: number, phase: number, width: number) => {
    const shape = new Shape();
    shape.moveTo(0, -30);
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * width;
      const u = (i / steps) * Math.PI * 2;
      const y = height * (0.55 + 0.3 * Math.sin(u + phase) + 0.15 * Math.sin(u * 2 + phase * 1.7));
      shape.lineTo(x, y);
    }
    shape.lineTo(width, -30);
    const mesh = add(
      tile,
      new ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false }),
      lit(color, 1),
    );
    mesh.position.x = -width / 2;
  };
  makeLayer(-82, 90, 0.05, (tile) => hillTile(tile, 0x9bd6c4, 14, 0.5, 90));
  makeLayer(-62, 70, 0.1, (tile) => hillTile(tile, 0x7bd07a, 9, 2.4, 70));

  // The big top and the ferris wheel.
  makeLayer(
    -48,
    120,
    0.2,
    (tile) => {
      const tent = new Group();
      const stripeA = lit(0xe8403a, 0.8);
      const stripeB = lit(0xffffff, 0.8);
      add(tent, new CylinderGeometry(6, 6.4, 4.4, 20), stripeB, 0, 2.2, 0);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        add(
          tent,
          new BoxGeometry(2.4, 4.45, 0.3),
          stripeA,
          Math.sin(a) * 6.05,
          2.2,
          Math.cos(a) * 6.05,
        ).rotation.y = a;
      }
      add(tent, new ConeGeometry(7, 4.5, 20), stripeA, 0, 6.65, 0);
      add(tent, new CylinderGeometry(0.1, 0.1, 2.6, 6), lit(0x444444), 0, 10.1, 0);
      const flag = add(tent, new ConeGeometry(0.6, 1.2, 3), stripeA, 0.7, 11, 0);
      flag.rotation.z = -Math.PI / 2;
      tent.position.set(-14, 0, 0);
      tile.add(tent);

      const wheel = new Group();
      wheel.position.set(22, 8.6, 0);
      const steel = lit(0xdfe6ee, 0.5);
      const spin = new Group();
      spin.name = 'wheel';
      wheel.add(spin);
      add(spin, new TorusGeometry(7, 0.22, 8, 36), steel);
      add(spin, new TorusGeometry(3, 0.18, 8, 24), steel);
      const colors = [0xff5a5a, 0xffd43b, 0x4dd0e1, 0x7be07b, 0xff8fd0, 0xb28dff];
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const spoke = add(spin, new BoxGeometry(14, 0.1, 0.1), steel);
        spoke.rotation.z = a;
        if (i < 6) continue;
      }
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const pod = new Group();
        pod.userData.angle = a;
        pod.position.set(Math.cos(a) * 7, Math.sin(a) * 7, 0);
        add(pod, new BoxGeometry(1.5, 1.1, 1.1), lit(colors[i % colors.length], 0.6), 0, -0.7, 0);
        spin.add(pod);
      }
      for (const side of [-1, 1]) {
        const leg = add(
          wheel,
          new BoxGeometry(0.45, 10.4, 0.45),
          lit(0x7a8696),
          side * 3.6,
          -4.2,
          0,
        );
        leg.rotation.z = -side * 0.34;
      }
      tile.add(wheel);
    },
    4,
    0.5,
  );

  // Trees and balloon clusters.
  makeLayer(
    -26,
    36,
    0.45,
    (tile) => {
      const trunk = lit(0x7a5230);
      const leaves = [lit(0x3fae52), lit(0x58c46a), lit(0x2f9a4a)];
      for (const [x, h] of [
        [-12, 5],
        [4, 6.5],
        [14, 4.2],
      ] as const) {
        add(tile, new CylinderGeometry(0.28, 0.35, h * 0.4, 8), trunk, x, h * 0.2, 0);
        add(
          tile,
          new SphereGeometry(h * 0.38, 12, 10),
          leaves[(Math.abs(x) % 3) | 0],
          x,
          h * 0.62,
          0,
        );
        add(tile, new SphereGeometry(h * 0.28, 12, 10), leaves[1], x + h * 0.2, h * 0.45, 0.4);
      }
      const strings = flat(0x666666);
      const balloonColors = [0xff5a5a, 0xffd43b, 0x4dd0e1, 0xff8fd0, 0x7be07b];
      for (const [cx, cy] of [
        [-4, 11],
        [20, 13],
      ] as const) {
        for (let i = 0; i < 5; i++) {
          const bx = cx + (i - 2) * 1.1;
          const by = cy + (i % 2) * 0.8;
          const balloon = add(
            tile,
            new SphereGeometry(0.75, 12, 10),
            lit(balloonColors[i], 0.35),
            bx,
            by,
            0,
          );
          balloon.scale.y = 1.2;
          add(tile, new BoxGeometry(0.03, 3.4, 0.03), strings, cx + (i - 2) * 0.3, by - 2.2, 0);
        }
      }
    },
    4,
    0.65,
  );

  // Bunting along a line above the road, fixed in the world.
  makeLayer(
    -5,
    12,
    null,
    (tile) => {
      const pole = lit(0x8a6a44);
      const colors = [0xff5a5a, 0xffd43b, 0x4dd0e1, 0xff8fd0, 0x7be07b];
      add(tile, new CylinderGeometry(0.08, 0.1, 9.2, 6), pole, 0, 4.6, 0);
      const stringMaterial = flat(0x5c4630);
      for (let i = 0; i < 12; i++) {
        const u0 = i / 12;
        const u1 = (i + 1) / 12;
        const y = (u: number) => 9.0 - 1.4 * Math.sin(u * Math.PI);
        const dx = 12 * (u1 - u0);
        const seg = add(
          tile,
          new BoxGeometry(Math.hypot(dx, y(u1) - y(u0)), 0.04, 0.04),
          stringMaterial,
          12 * (u0 + u1) * 0.5,
          (y(u0) + y(u1)) / 2,
          0,
        );
        seg.rotation.z = Math.atan2(y(u1) - y(u0), dx);
        const flag = add(
          tile,
          new ConeGeometry(0.3, 0.6, 3),
          lit(colors[i % colors.length], 0.7),
          12 * (u0 + u1) * 0.5,
          (y(u0) + y(u1)) / 2 - 0.35,
          0,
        );
        flag.rotation.x = Math.PI;
        flag.rotation.y = Math.PI / 2;
        flag.scale.z = 0.3;
      }
    },
    6,
  );

  // ---------- The crowd ----------
  const TIERS = 3;
  const PER_TIER = 9;
  const TILE_W = 12;
  const SLOTS = 5;
  const COUNT = SLOTS * TIERS * PER_TIER;
  const stands = new Group();
  scene.add(stands);
  const wood = lit(0x9a7650, 0.9);
  const woodDark = lit(0x7d5c3a, 0.9);
  const tierZ = [-6.5, -7.7, -8.9];
  const tierTop = [0.9, 1.9, 2.9];
  const tiers: Mesh[] = [];
  for (let t = 0; t < TIERS; t++) {
    const height = tierTop[t];
    const box = add(stands, new BoxGeometry(SLOTS * TILE_W, height, 1.2), t % 2 ? woodDark : wood);
    box.position.set(0, height / 2, tierZ[t]);
    tiers.push(box);
  }

  const headMesh = new InstancedMesh(
    track(new SphereGeometry(0.2, 10, 8)),
    lit(0xf1b48a, 0.8),
    COUNT,
  );
  const bodyMesh = new InstancedMesh(
    track(new CapsuleGeometry(0.21, 0.34, 4, 8)),
    lit(0xffffff, 0.8),
    COUNT,
  );
  const armMesh = new InstancedMesh(
    track(new CapsuleGeometry(0.06, 0.34, 3, 6)),
    lit(0xffffff, 0.8),
    COUNT * 2,
  );
  for (const m of [headMesh, bodyMesh, armMesh]) {
    m.frustumCulled = false;
    stands.add(m);
    materials.push(m.material as Material);
  }
  const palette = [0xff5a5a, 0xffd43b, 0x4dd0e1, 0x7be07b, 0xff8fd0, 0xb28dff, 0xff9f1c, 0x4f86f7];
  const skins = [0xf1b48a, 0xd9966b, 0x8d5a3a, 0xffd5b0, 0xc68642];
  const color = new Color();
  let standsFirst = Number.NaN;
  const dummy = new Object3D();
  const quat = new Quaternion();
  const v = new Vector3();
  let mood: Mood = 'idle';
  let moodLeft = 0;
  let time = 0;
  let moodBlend = 0;

  const assignColours = (first: number) => {
    for (let slot = 0; slot < SLOTS; slot++) {
      for (let t = 0; t < TIERS; t++) {
        for (let p = 0; p < PER_TIER; p++) {
          const i = (slot * TIERS + t) * PER_TIER + p;
          const h = hash((first + slot) * 97 + t * 13 + p * 3.1);
          color.setHex(palette[Math.floor(h * palette.length)]);
          bodyMesh.setColorAt(i, color);
          armMesh.setColorAt(i * 2, color);
          armMesh.setColorAt(i * 2 + 1, color);
          color.setHex(skins[Math.floor(hash(h * 91) * skins.length)]);
          headMesh.setColorAt(i, color);
        }
      }
    }
    for (const m of [headMesh, bodyMesh, armMesh]) {
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  };

  const animateCrowd = (first: number) => {
    // 0 = watching, 1 = cheering, -1 = groaning, blended smoothly.
    const goal = mood === 'cheer' ? 1 : mood === 'groan' ? -1 : 0;
    moodBlend += (goal - moodBlend) * 0.2;
    for (let slot = 0; slot < SLOTS; slot++) {
      const x0 = (first + slot) * TILE_W;
      for (let t = 0; t < TIERS; t++) {
        for (let p = 0; p < PER_TIER; p++) {
          const i = (slot * TIERS + t) * PER_TIER + p;
          const h = hash((first + slot) * 97 + t * 13 + p * 3.1);
          const x = x0 + (p + 0.25 + 0.5 * hash(h * 7)) * (TILE_W / PER_TIER);
          const base = tierTop[t];
          const z = tierZ[t];
          const bob =
            Math.max(moodBlend, 0) * Math.abs(Math.sin(time * 9 + h * 20)) * 0.45 +
            Math.sin(time * 1.6 + h * 30) * 0.03 -
            Math.max(-moodBlend, 0) * 0.14;
          const lean = Math.max(-moodBlend, 0) * (0.25 + 0.2 * Math.sin(h * 9));
          // Body.
          dummy.position.set(x, base + 0.42 + bob * 0.8, z);
          dummy.rotation.set(0, 0, lean * (h > 0.5 ? 1 : -1));
          dummy.scale.setScalar(1);
          dummy.updateMatrix();
          bodyMesh.setMatrixAt(i, dummy.matrix);
          // Head.
          dummy.position.set(
            x + Math.sin(lean) * (h > 0.5 ? -0.25 : 0.25),
            base + 0.98 + bob - lean * 0.2,
            z,
          );
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          headMesh.setMatrixAt(i, dummy.matrix);
          // Arms: hang down, or fly up when cheering.
          const up = Math.max(moodBlend, 0);
          for (const side of [-1, 1]) {
            const swing = up * (2.6 + Math.sin(time * 12 + h * 40 + side) * 0.4);
            dummy.position.set(x + side * 0.27, base + 0.7 + bob * 0.8 + up * 0.1, z + 0.05);
            quat.setFromAxisAngle(v.set(0, 0, 1), side * (0.15 + swing));
            dummy.quaternion.copy(quat);
            dummy.updateMatrix();
            armMesh.setMatrixAt(i * 2 + (side < 0 ? 0 : 1), dummy.matrix);
          }
          dummy.quaternion.identity();
        }
      }
    }
    headMesh.instanceMatrix.needsUpdate = true;
    bodyMesh.instanceMatrix.needsUpdate = true;
    armMesh.instanceMatrix.needsUpdate = true;
  };

  return {
    update(camX, cuts, delta, distance, camY) {
      time += delta;
      if (moodLeft > 0) {
        moodLeft -= delta;
        if (moodLeft <= 0) mood = 'idle';
      }
      const key = `${Math.floor(camX)}|${cuts.map((c) => `${c[0].toFixed(2)},${c[1].toFixed(2)}`).join(';')}`;
      if (key !== roadKey) {
        roadKey = key;
        layoutRoad(camX, cuts);
      }
      // Scenery layers: far ones are scaled up so they look the same size, and slide slower.
      for (const layer of layers) {
        const depth = -layer.z;
        const s = layer.pt === null ? 1 : ((distance + depth) / distance) * layer.size;
        const natural = distance / (distance + depth);
        const follow = layer.pt === null ? 0 : Math.min(Math.max(1 - layer.pt / natural, 0), 1);
        const tileWorld = layer.tileW * s;
        const pattern = camX * follow;
        const k = Math.floor((camX - pattern) / tileWorld);
        layer.group.scale.setScalar(s);
        layer.group.position.x = pattern + k * tileWorld;
        layer.group.position.y = layer.pt === null ? 0 : camY * (1 - s);
        for (const wheel of layer.wheels) {
          wheel.rotation.z += delta * 0.12;
          for (const pod of wheel.children) {
            if (pod.userData.angle !== undefined) pod.rotation.z = -wheel.rotation.z;
          }
        }
      }
      // The stands cover a few tiles around the camera.
      const first = Math.floor(camX / TILE_W) - 1;
      const centre = (first + SLOTS / 2) * TILE_W;
      stands.position.x = centre;
      for (const tier of tiers) tier.position.x = 0;
      if (first !== standsFirst) {
        standsFirst = first;
        assignColours(first);
      }
      // Spectator positions are in world space, so undo the group's offset.
      stands.position.x = 0;
      for (const tier of tiers) tier.position.x = centre;
      animateCrowd(first);
    },
    setMood(next, seconds) {
      mood = next;
      moodLeft = seconds;
    },
    setShadow(x, visible, scale) {
      shadow.visible = visible;
      shadow.position.x = x - 0.1;
      shadow.scale.set(1.2 * scale, 0.02, 0.5);
    },
    dispose() {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      sky?.dispose();
      for (const m of [headMesh, bodyMesh, armMesh, kerbRed, kerbWhite, dashes]) m.dispose();
      void DoubleSide;
      for (const object of [road, stands, lights, shadow, ...layers.map((l) => l.group)]) {
        object.removeFromParent();
      }
    },
  };
}
