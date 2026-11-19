/**
 * The water: a big flat-shaded plane that follows the ski (snapped to its grid so it does not
 * swim), its heights from `swell` on the CPU, and a V-shaped foam wake that trails the ski's last
 * 12 u of path while it is on the water.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
} from 'three';
import { swell } from './anim';

export const WATER_W = 160;
export const WATER_D = 240;
export const WATER_SEGMENTS_X = 48;
export const WATER_SEGMENTS_Z = 72;
/** The wake trails this far behind the ski, as this many samples. */
export const WAKE_LENGTH = 12;
const WAKE_SAMPLES = 26;

export interface Water {
  object: Group;
  /** Re-centres the plane on (x, z) and heaves it with the chop at `time`. */
  update(time: number, centreX: number, centreZ: number): void;
  /** Adds a point to the wake behind a ski at (x, z); with `wet` false the trail dies away. */
  setWake(x: number, z: number, wet: boolean): void;
  clearWake(): void;
  setColor(hex: number): void;
  dispose(): void;
}

export function createWater(color: number): Water {
  const object = new Group();
  const geometry = new PlaneGeometry(WATER_W, WATER_D, WATER_SEGMENTS_X, WATER_SEGMENTS_Z);
  geometry.rotateX(-Math.PI / 2);
  const material = new MeshStandardMaterial({ color, roughness: 0.35, flatShading: true });
  const plane = new Mesh(geometry, material);
  plane.frustumCulled = false;
  object.add(plane);
  const position = geometry.getAttribute('position') as BufferAttribute;
  const baseX = new Float32Array(position.count);
  const baseZ = new Float32Array(position.count);
  for (let i = 0; i < position.count; i++) {
    baseX[i] = position.getX(i);
    baseZ[i] = position.getZ(i);
  }
  const stepX = WATER_W / WATER_SEGMENTS_X;
  const stepZ = WATER_D / WATER_SEGMENTS_Z;

  // The wake: two foam strips that spread out behind the ski in a V and fade away.
  const trail: { x: number; z: number }[] = [];
  const wakeGeometry = new BufferGeometry();
  const verts = WAKE_SAMPLES * 4;
  const wakePosition = new Float32Array(verts * 3);
  const wakeColor = new Float32Array(verts * 4);
  const indices: number[] = [];
  for (let strip = 0; strip < 2; strip++) {
    for (let i = 0; i < WAKE_SAMPLES - 1; i++) {
      const a = strip * WAKE_SAMPLES * 2 + i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  wakeGeometry.setIndex(indices);
  wakeGeometry.setAttribute('position', new BufferAttribute(wakePosition, 3));
  wakeGeometry.setAttribute('color', new BufferAttribute(wakeColor, 4));
  const wakeMaterial = new MeshBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
  });
  const wake = new Mesh(wakeGeometry, wakeMaterial);
  wake.frustumCulled = false;
  wake.renderOrder = 2;
  wake.visible = false;
  object.add(wake);

  let time = 0;

  const rebuildWake = () => {
    wake.visible = trail.length >= 2;
    if (!wake.visible) return;
    // Sample the trail evenly along its length, head first.
    const n = trail.length;
    for (let i = 0; i < WAKE_SAMPLES; i++) {
      const k = (i / (WAKE_SAMPLES - 1)) * (n - 1);
      const a = trail[Math.floor(k)];
      const b = trail[Math.min(Math.floor(k) + 1, n - 1)];
      const f = k - Math.floor(k);
      const x = a.x + (b.x - a.x) * f;
      const z = a.z + (b.z - a.z) * f;
      // Heading along the trail, from older to newer (the way the ski went).
      const older = trail[Math.min(Math.floor(k) + 1, n - 1)];
      let dx = a.x - older.x;
      let dz = a.z - older.z;
      const len = Math.hypot(dx, dz);
      if (len < 1e-6) {
        dx = 0;
        dz = -1;
      } else {
        dx /= len;
        dz /= len;
      }
      const px = -dz;
      const pz = dx;
      const age = i / (WAKE_SAMPLES - 1);
      const spread = 0.35 + 1.5 * age;
      const width = 0.18 + 0.22 * age;
      const alpha = 0.85 * (1 - age) ** 1.3;
      const y = swell(x, z, time) + 0.05;
      for (let strip = 0; strip < 2; strip++) {
        const side = strip === 0 ? -1 : 1;
        for (let edge = 0; edge < 2; edge++) {
          const v = strip * WAKE_SAMPLES * 2 + i * 2 + edge;
          const offset = side * spread + (edge === 0 ? -width : width);
          wakePosition[v * 3] = x + px * offset;
          wakePosition[v * 3 + 1] = y;
          wakePosition[v * 3 + 2] = z + pz * offset;
          wakeColor[v * 4] = 1;
          wakeColor[v * 4 + 1] = 1;
          wakeColor[v * 4 + 2] = 1;
          wakeColor[v * 4 + 3] = alpha;
        }
      }
    }
    (wakeGeometry.getAttribute('position') as BufferAttribute).needsUpdate = true;
    (wakeGeometry.getAttribute('color') as BufferAttribute).needsUpdate = true;
  };

  return {
    object,
    update(t, centreX, centreZ) {
      time = t;
      const cx = Math.round(centreX / stepX) * stepX;
      const cz = Math.round(centreZ / stepZ) * stepZ;
      plane.position.set(cx, 0, cz);
      for (let i = 0; i < position.count; i++) {
        position.setY(i, swell(cx + baseX[i], cz + baseZ[i], t));
      }
      position.needsUpdate = true;
      rebuildWake();
    },
    setWake(x, z, wet) {
      if (!wet) {
        // Out of the water: the trail shortens from the far end.
        if (trail.length > 0) trail.pop();
        return;
      }
      const head = trail[0];
      if (head && Math.hypot(x - head.x, z - head.z) < 0.35) return;
      trail.unshift({ x, z });
      // Keep the last WAKE_LENGTH of path.
      let length = 0;
      for (let i = 1; i < trail.length; i++) {
        length += Math.hypot(trail[i].x - trail[i - 1].x, trail[i].z - trail[i - 1].z);
        if (length > WAKE_LENGTH) {
          trail.length = i + 1;
          break;
        }
      }
    },
    clearWake() {
      trail.length = 0;
      wake.visible = false;
    },
    setColor(hex) {
      material.color.setHex(hex);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      wakeGeometry.dispose();
      wakeMaterial.dispose();
      object.removeFromParent();
    },
  };
}
