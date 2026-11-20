/**
 * The effects of the field: the bolt of each right key, the beam of a kill, the cubes of an
 * explosion, the bombs and the camera shake. Everything is pooled: nothing is allocated per frame.
 */
import {
  BoxGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  type Object3D,
} from 'three';
import { GROUND_Y } from './layout';
import { LOCK_COLOR } from './invaders';

const BOLTS = 6;
const BEAMS = 3;
const BOMBS = 6;
const BLAST_CUBES = 24;
const BLASTS = 8;
const BOLT_SECONDS = 0.1;
const BEAM_SECONDS = 0.15;
const BLAST_SECONDS = 0.7;
const GRAVITY = -9;
const BOMB_SPEED = 5;
const SHAKE_KILL = { amp: 0.05, seconds: 0.15 };
const SHAKE_HIT = { amp: 0.3, seconds: 0.4 };

export interface Effects {
  readonly group: Group;
  /** A bolt from the cannon's tip to a target, 0.1 s. */
  bolt(fromX: number, fromY: number, toX: number, toY: number): void;
  /** The blast of a kill: a beam from the cannon that fades in 0.15 s. */
  beam(fromX: number, fromY: number, toX: number, toY: number): void;
  /** 24 cubes of `color` fly out from a point. */
  explode(x: number, y: number, color: string): void;
  /** A few small grey cubes (a bomb on the ground). */
  puff(x: number, y: number): void;
  /** A bomb starts falling from (x, y). */
  bomb(x: number, y: number): void;
  /** Camera shake: a kill's (0.05) or a hit's (0.3). */
  shake(kind: 'kill' | 'hit'): void;
  /** The shake's offset now, valid until the next `update`. */
  readonly offset: { x: number; y: number };
  /**
   * Moves everything on by `dt`. `bombHit(x, y)` is asked each frame of each bomb and says whether
   * the bomb struck something (a bunker) there. With `hold`, bombs and particles do not move.
   */
  update(dt: number, bombHit: (x: number, y: number) => boolean, hold?: boolean): void;
  /** Clears every bomb and particle at once. */
  clear(): void;
  /** Clears the bombs only. */
  clearBombs(): void;
  /** How many bombs are falling. */
  bombCount(): number;
}

interface Flight {
  active: boolean;
  t: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

const flight = (): Flight => ({ active: false, t: 0, fromX: 0, fromY: 0, toX: 0, toY: 0 });

export function createEffects(parent: Object3D): Effects {
  const group = new Group();
  parent.add(group);

  // ---------- Bolts ----------
  const boltGeometry = new BoxGeometry(0.06, 0.3, 0.06);
  const boltMaterial = new MeshBasicMaterial({ color: LOCK_COLOR });
  const bolts = Array.from({ length: BOLTS }, () => {
    const mesh = new Mesh(boltGeometry, boltMaterial);
    mesh.visible = false;
    group.add(mesh);
    return { mesh, f: flight() };
  });
  let boltNext = 0;

  // ---------- Beams ----------
  const beamGeometry = new BoxGeometry(0.08, 1, 0.08);
  const beams = Array.from({ length: BEAMS }, () => {
    const material = new MeshBasicMaterial({ color: '#ffffff', transparent: true });
    const mesh = new Mesh(beamGeometry, material);
    mesh.visible = false;
    group.add(mesh);
    return { mesh, material, f: flight() };
  });
  let beamNext = 0;

  // ---------- Cubes (explosions and puffs) ----------
  const cubeCount = BLAST_CUBES * BLASTS;
  const cubes = new InstancedMesh(
    new BoxGeometry(1, 1, 1),
    new MeshBasicMaterial({ color: '#ffffff' }),
    cubeCount,
  );
  cubes.frustumCulled = false;
  group.add(cubes);
  const cx = new Float32Array(cubeCount);
  const cy = new Float32Array(cubeCount);
  const cz = new Float32Array(cubeCount);
  const vx = new Float32Array(cubeCount);
  const vy = new Float32Array(cubeCount);
  const vz = new Float32Array(cubeCount);
  const life = new Float32Array(cubeCount);
  const size = new Float32Array(cubeCount);
  const matrix = new Matrix4();
  const color = new Color();
  let blastNext = 0;
  const zero = new Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < cubeCount; i++) {
    cubes.setMatrixAt(i, zero);
    cubes.setColorAt(i, color.set('#ffffff'));
  }

  const spawnCubes = (x: number, y: number, hex: string, n: number, speed: [number, number]) => {
    const first = blastNext * BLAST_CUBES;
    blastNext = (blastNext + 1) % BLASTS;
    color.set(hex);
    for (let k = 0; k < n; k++) {
      const i = first + k;
      const angle = Math.random() * Math.PI * 2;
      const power = speed[0] + Math.random() * (speed[1] - speed[0]);
      cx[i] = x;
      cy[i] = y;
      cz[i] = 0;
      vx[i] = Math.cos(angle) * power;
      vy[i] = Math.sin(angle) * power + 1;
      vz[i] = (Math.random() - 0.3) * power * 0.5;
      life[i] = BLAST_SECONDS;
      size[i] = 0.07 + Math.random() * 0.06;
      cubes.setColorAt(i, color);
    }
    for (let k = n; k < BLAST_CUBES; k++) life[first + k] = 0;
    if (cubes.instanceColor) cubes.instanceColor.needsUpdate = true;
  };

  // ---------- Bombs ----------
  const bombGeometry = new BoxGeometry(0.1, 0.3, 0.1);
  const bombMaterial = new MeshBasicMaterial({ color: '#ff8a3d' });
  const bombs = Array.from({ length: BOMBS }, () => {
    const mesh = new Mesh(bombGeometry, bombMaterial);
    mesh.visible = false;
    group.add(mesh);
    return { mesh, active: false, x: 0, y: 0, t: 0 };
  });
  let bombNext = 0;

  // ---------- Shake ----------
  let shakeAmp = 0;
  let shakeLeft = 0;
  let shakeSeconds = 1;
  const offset = { x: 0, y: 0 };

  const effects: Effects = {
    group,
    offset,
    bolt(fromX, fromY, toX, toY) {
      const b = bolts[boltNext];
      boltNext = (boltNext + 1) % BOLTS;
      Object.assign(b.f, { active: true, t: 0, fromX, fromY, toX, toY });
      b.mesh.visible = true;
    },
    beam(fromX, fromY, toX, toY) {
      const b = beams[beamNext];
      beamNext = (beamNext + 1) % BEAMS;
      Object.assign(b.f, { active: true, t: 0, fromX, fromY, toX, toY });
      const dx = toX - fromX;
      const dy = toY - fromY;
      b.mesh.visible = true;
      b.mesh.position.set((fromX + toX) / 2, (fromY + toY) / 2, 0.1);
      b.mesh.scale.set(1, Math.hypot(dx, dy), 1);
      b.mesh.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
      b.material.opacity = 1;
    },
    explode(x, y, hex) {
      spawnCubes(x, y, hex, BLAST_CUBES, [3, 6]);
    },
    puff(x, y) {
      spawnCubes(x, y, '#9aa3b8', 6, [1, 2.5]);
    },
    bomb(x, y) {
      const b = bombs[bombNext];
      bombNext = (bombNext + 1) % BOMBS;
      Object.assign(b, { active: true, x, y, t: 0 });
      b.mesh.visible = true;
      b.mesh.position.set(x, y, 0);
    },
    shake(kind) {
      const s = kind === 'kill' ? SHAKE_KILL : SHAKE_HIT;
      if (s.amp >= shakeAmp * (shakeLeft / shakeSeconds)) {
        shakeAmp = s.amp;
        shakeSeconds = s.seconds;
        shakeLeft = s.seconds;
      }
    },
    update(dt, bombHit, hold = false) {
      for (const b of bolts) {
        if (!b.f.active) continue;
        b.f.t += dt;
        const k = Math.min(b.f.t / BOLT_SECONDS, 1);
        b.mesh.position.set(
          b.f.fromX + (b.f.toX - b.f.fromX) * k,
          b.f.fromY + (b.f.toY - b.f.fromY) * k,
          0.1,
        );
        if (b.f.t >= BOLT_SECONDS) {
          b.f.active = false;
          b.mesh.visible = false;
        }
      }
      for (const b of beams) {
        if (!b.f.active) continue;
        b.f.t += dt;
        b.material.opacity = Math.max(0, 1 - b.f.t / BEAM_SECONDS);
        if (b.f.t >= BEAM_SECONDS) {
          b.f.active = false;
          b.mesh.visible = false;
        }
      }
      if (!hold) {
        let dirty = false;
        for (let i = 0; i < cubeCount; i++) {
          if (life[i] <= 0) continue;
          dirty = true;
          life[i] -= dt;
          if (life[i] <= 0) {
            cubes.setMatrixAt(i, zero);
            continue;
          }
          vy[i] += GRAVITY * dt;
          cx[i] += vx[i] * dt;
          cy[i] += vy[i] * dt;
          cz[i] += vz[i] * dt;
          const s = size[i] * Math.min(1, life[i] / 0.25);
          matrix.makeScale(s, s, s);
          matrix.setPosition(cx[i], cy[i], cz[i]);
          cubes.setMatrixAt(i, matrix);
        }
        if (dirty) cubes.instanceMatrix.needsUpdate = true;

        for (const b of bombs) {
          if (!b.active) continue;
          b.t += dt;
          b.y -= BOMB_SPEED * dt;
          const x = b.x + Math.sin(b.t * 14) * 0.1;
          b.mesh.position.set(x, b.y, 0);
          const struck = bombHit(x, b.y - 0.15);
          if (struck || b.y - 0.15 <= GROUND_Y) {
            b.active = false;
            b.mesh.visible = false;
            if (!struck) effects.puff(x, GROUND_Y + 0.05);
          }
        }
      }
      if (shakeLeft > 0) {
        shakeLeft = Math.max(0, shakeLeft - dt);
        const a = shakeAmp * (shakeLeft / shakeSeconds);
        offset.x = (Math.random() * 2 - 1) * a;
        offset.y = (Math.random() * 2 - 1) * a;
      } else {
        offset.x = 0;
        offset.y = 0;
      }
    },
    clearBombs() {
      for (const b of bombs) {
        b.active = false;
        b.mesh.visible = false;
      }
    },
    clear() {
      effects.clearBombs();
      for (let i = 0; i < cubeCount; i++) {
        life[i] = 0;
        cubes.setMatrixAt(i, zero);
      }
      cubes.instanceMatrix.needsUpdate = true;
    },
    bombCount() {
      return bombs.filter((b) => b.active).length;
    },
  };
  return effects;
}
