import {
  AdditiveBlending,
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  IcosahedronGeometry,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { easeToward } from './rules';

/** Where the engines sit, either side of the tail. */
const ENGINE_X = 0.44;
const ENGINE_Y = -0.02;
const ENGINE_Z = 0.62;
/** Exhaust puffs per engine, and how long each lasts. */
const TRAIL_PUFFS = 12;
const TRAIL_LIFE = 0.3;
/** Radius of the shield bubble that flashes when the ship is hit. */
const BUBBLE_RADIUS = 1.7;

export interface Ship {
  /** The ship itself, nose towards -z. Place and tilt this. */
  object: Group;
  /** Exhaust puffs live in world space, so add this to the scene too. */
  trail: Group;
  /** World position of a wing-tip laser, 0 for the left wing and 1 for the right. */
  muzzle(side: 0 | 1, out: Vector3): Vector3;
  /** Lights up the shield bubble for a moment. */
  flashShield(): void;
  /** Hides the ship (it has blown up) or brings it back. */
  setVisible(visible: boolean): void;
  /**
   * `speed` is the world speed factor (the flames stretch with it) and `worldSpeed` how fast the
   * world streams past, in units per second, which carries the exhaust away behind the ship.
   */
  update(delta: number, elapsed: number, speed: number, worldSpeed: number): void;
}

function mesh(
  geometry: ConstructorParameters<typeof Mesh>[0],
  material: ConstructorParameters<typeof Mesh>[1],
  parent: Group,
  x = 0,
  y = 0,
  z = 0,
): Mesh {
  const m = new Mesh(geometry, material);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

/** A swept wing, flat in the xz plane, on the right of the ship (mirror it for the left). */
function wingGeometry(): ExtrudeGeometry {
  const shape = new Shape();
  // x is sideways, y becomes z (towards the tail) after the extrusion is laid flat.
  shape.moveTo(0.2, -0.35);
  shape.lineTo(1.2, 0.5);
  shape.lineTo(1.2, 0.85);
  shape.lineTo(0.2, 0.75);
  shape.closePath();
  const geometry = new ExtrudeGeometry(shape, { depth: 0.07, bevelEnabled: false });
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

/** A bright, friendly little ship built from simple shapes: white body, red nose, blue wings. */
export function createShip(): Ship {
  const white = new MeshStandardMaterial({ color: 0xf4f7ff, roughness: 0.4, metalness: 0.1 });
  const red = new MeshStandardMaterial({ color: 0xff5a4a, roughness: 0.45 });
  const blue = new MeshStandardMaterial({ color: 0x2f8bff, roughness: 0.4, metalness: 0.15 });
  const yellow = new MeshStandardMaterial({ color: 0xffd43b, roughness: 0.5 });
  const dark = new MeshStandardMaterial({ color: 0x3b4060, roughness: 0.5, metalness: 0.4 });
  const glass = new MeshStandardMaterial({
    color: 0x7fe3ff,
    emissive: 0x2a9fd6,
    emissiveIntensity: 0.6,
    roughness: 0.1,
    transparent: true,
    opacity: 0.85,
  });
  const glow = (color: number, opacity = 1) =>
    new MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      blending: AdditiveBlending,
      depthWrite: false,
    });

  const object = new Group();
  const body = new Group();
  object.add(body);

  // Fuselage, nose, cockpit and tail fin.
  const hull = mesh(new CylinderGeometry(0.28, 0.3, 1.2, 14), white, body, 0, 0, 0.1);
  hull.rotation.x = Math.PI / 2;
  const nose = mesh(new ConeGeometry(0.28, 0.8, 14), red, body, 0, 0, -0.9);
  nose.rotation.x = -Math.PI / 2;
  mesh(new SphereGeometry(0.27, 16, 12), glass, body, 0, 0.2, -0.15).scale.set(0.9, 0.85, 1.7);
  const fin = mesh(new BoxGeometry(0.07, 0.55, 0.6), red, body, 0, 0.42, 0.55);
  fin.rotation.x = -0.4;
  mesh(new BoxGeometry(0.6, 0.06, 0.3), yellow, body, 0, 0.02, 0.62);

  // Wings with a yellow stripe, and a laser cannon on each tip.
  const wing = wingGeometry();
  const muzzles: Group[] = [];
  for (const side of [-1, 1]) {
    const w = mesh(wing, blue, body, 0, -0.03, 0);
    w.scale.x = side;
    mesh(new BoxGeometry(0.7, 0.09, 0.08), yellow, body, side * 0.7, 0, 0.6).rotation.y =
      side * -0.5;
    const cannon = mesh(new CylinderGeometry(0.06, 0.07, 0.7, 8), dark, body, side * 1.18, 0, 0.35);
    cannon.rotation.x = Math.PI / 2;
    mesh(new SphereGeometry(0.075, 8, 6), glow(0xffe066), body, side * 1.18, 0, 0);
    const anchor = new Group();
    anchor.position.set(side * 1.18, 0, -0.05);
    body.add(anchor);
    muzzles.push(anchor);
  }

  // Twin engines with a hot glow and a flickering flame.
  const flames: Mesh[] = [];
  const cores: Mesh[] = [];
  const exhausts: Group[] = [];
  for (const side of [-1, 1]) {
    const engine = mesh(
      new CylinderGeometry(0.17, 0.2, 0.55, 12),
      dark,
      body,
      side * ENGINE_X,
      ENGINE_Y,
      ENGINE_Z,
    );
    engine.rotation.x = Math.PI / 2;
    const ring = mesh(
      new TorusGeometry(0.17, 0.035, 8, 16),
      glow(0xff9a3c),
      body,
      side * ENGINE_X,
      ENGINE_Y,
      ENGINE_Z + 0.28,
    );
    ring.rotation.x = 0;
    mesh(
      new SphereGeometry(0.24, 12, 8),
      glow(0xff7a1a, 0.3),
      body,
      side * ENGINE_X,
      ENGINE_Y,
      ENGINE_Z + 0.35,
    );
    const flame = mesh(
      new ConeGeometry(0.15, 1, 10, 1, true),
      glow(0xff8a2a, 0.85),
      body,
      side * ENGINE_X,
      ENGINE_Y,
      ENGINE_Z + 0.28,
    );
    flame.rotation.x = Math.PI / 2;
    flames.push(flame);
    const core = mesh(
      new ConeGeometry(0.08, 1, 8, 1, true),
      glow(0xfff2c0, 0.95),
      body,
      side * ENGINE_X,
      ENGINE_Y,
      ENGINE_Z + 0.28,
    );
    core.rotation.x = Math.PI / 2;
    cores.push(core);
    const exhaust = new Group();
    exhaust.position.set(side * ENGINE_X, ENGINE_Y, ENGINE_Z + 0.4);
    body.add(exhaust);
    exhausts.push(exhaust);
  }

  // The shield bubble, only visible in a flash.
  const bubbleMaterial = glow(0x5ad0ff, 0);
  const bubbleWire = new MeshBasicMaterial({
    color: 0xb8f0ff,
    wireframe: true,
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const bubble = new Group();
  bubble.add(
    new Mesh(new SphereGeometry(BUBBLE_RADIUS, 24, 16), bubbleMaterial),
    new Mesh(new IcosahedronGeometry(BUBBLE_RADIUS * 1.01, 2), bubbleWire),
  );
  bubble.visible = false;
  object.add(bubble);
  let shieldFlash = 0;

  // Exhaust puffs, in world space so the world carries them away behind the ship.
  const trail = new Group();
  const puffGeometry = new SphereGeometry(1, 8, 6);
  const puffs = Array.from({ length: TRAIL_PUFFS * 2 }, (_, i) => {
    const material = glow(i % 2 ? 0xff9a3c : 0xffd37a, 0);
    const puff = new Mesh(puffGeometry, material);
    puff.visible = false;
    trail.add(puff);
    return { puff, material, age: TRAIL_LIFE, drift: 0 };
  });
  let nextPuff = 0;
  let emit = 0;

  // Ease the tilt so quick drags don't snap the ship about.
  const here = new Vector3();
  let visible = true;

  const showBody = () => {
    body.visible = visible;
  };

  return {
    object,
    trail,
    muzzle: (side, out) => muzzles[side].getWorldPosition(out),
    flashShield() {
      shieldFlash = 1;
    },
    setVisible(value) {
      visible = value;
      trail.visible = value;
      showBody();
    },
    update(delta, elapsed, speed, worldSpeed) {
      // Flames stretch with speed and flicker.
      flames.forEach((flame, i) => {
        const flicker =
          0.85 + Math.sin(elapsed * 47 + i * 2.3) * 0.12 + Math.sin(elapsed * 71) * 0.08;
        const length = (0.9 + (speed - 1) * 0.9) * flicker + 0.3;
        flame.scale.set(1, length, 1);
        flame.position.z = ENGINE_Z + 0.28 + length / 2;
        cores[i].scale.set(1, length * 0.6, 1);
        cores[i].position.z = ENGINE_Z + 0.28 + (length * 0.6) / 2;
      });

      // Shield bubble flash.
      shieldFlash = easeToward(shieldFlash, 0, 5, delta);
      bubble.visible = shieldFlash > 0.02;
      bubbleMaterial.opacity = shieldFlash * 0.16;
      bubbleWire.opacity = shieldFlash * 0.9;
      bubble.scale.setScalar(1 + (1 - shieldFlash) * 0.08);

      // Exhaust puffs: a new pair every few hundredths of a second, drifting away behind.
      emit += delta;
      while (visible && emit >= 0.03) {
        emit -= 0.03;
        for (let i = 0; i < 2; i++) {
          const p = puffs[nextPuff];
          nextPuff = (nextPuff + 1) % puffs.length;
          exhausts[i].getWorldPosition(here);
          p.puff.position.copy(here);
          p.age = 0;
          p.drift = 0.4 + Math.random() * 0.3;
          p.puff.visible = true;
        }
      }
      for (const p of puffs) {
        if (!p.puff.visible) continue;
        p.age += delta;
        const k = p.age / TRAIL_LIFE;
        if (k >= 1) {
          p.puff.visible = false;
          continue;
        }
        p.puff.position.z += worldSpeed * p.drift * delta;
        p.puff.scale.setScalar(MathUtils.lerp(0.11, 0.02, k));
        p.material.opacity = 0.55 * (1 - k);
      }
    },
  };
}
