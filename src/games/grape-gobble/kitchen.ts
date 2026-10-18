import {
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  type Object3D,
} from 'three';
import { GRAPE_R, TABLE_Y } from './gags';
import { BUNCH_SIZE, PLATE_MAX, plateSpot } from './rules';

export const BOWL_POS = { x: -1.05, y: TABLE_Y, z: 0.45 };
export const PLATE_POS = { x: 1.15, y: TABLE_Y, z: 0.45 };
export const GRAPE_COLOR = 0x9be15d;

export const flat = (
  color: number,
  extra: Partial<ConstructorParameters<typeof MeshStandardMaterial>[0]> = {},
) => new MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...extra });

/** One grape with a paler highlight, shared by the bunch and the flying grape. */
export function createGrapeMesh(): Group {
  const group = new Group();
  const body = new Mesh(new SphereGeometry(GRAPE_R, 16, 12), flat(GRAPE_COLOR));
  const shine = new Mesh(new SphereGeometry(GRAPE_R * 0.28, 8, 6), flat(0xd4f7a8));
  shine.position.set(-GRAPE_R * 0.4, GRAPE_R * 0.45, GRAPE_R * 0.6);
  group.add(body, shine);
  return group;
}

function canvasTexture(size: number, draw: (g: CanvasRenderingContext2D) => void, repeat = [1, 1]) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  if (g) draw(g);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  return texture;
}

const woodTexture = () =>
  canvasTexture(
    128,
    (g) => {
      const colors = ['#d9a066', '#c98c52'];
      for (let i = 0; i < 8; i++) {
        g.fillStyle = colors[i % 2];
        g.fillRect(0, (i * 128) / 8, 128, 128 / 8);
        g.fillStyle = 'rgba(80,40,10,0.35)';
        g.fillRect(0, (i * 128) / 8, 128, 2);
      }
    },
    [6, 6],
  );

const ginghamTexture = (repeat: [number, number]) =>
  canvasTexture(
    128,
    (g) => {
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, 128, 128);
      g.fillStyle = 'rgba(224,48,56,0.55)';
      g.fillRect(0, 0, 128, 64);
      g.fillRect(0, 0, 64, 128);
      g.fillStyle = 'rgba(224,48,56,0.55)';
      g.fillRect(64, 64, 64, 64);
    },
    repeat,
  );

export interface Kitchen {
  object: Object3D;
  /** Shows the first `n` grapes of the bunch (the top-most go first). */
  setBunch(n: number): void;
  /** Shows `n` eaten-grape skins on the plate (up to PLATE_MAX). */
  setPlate(n: number): void;
  update(elapsed: number): void;
}

export function createKitchen(): Kitchen {
  const root = new Group();

  // ---------- Lights ----------
  root.add(new HemisphereLight(0xffffff, 0xffd9a8, 3.0));
  const sun = new DirectionalLight(0xfff1d6, 1.3);
  sun.position.set(-3, 5, 5);
  root.add(sun);

  // ---------- Room ----------
  const floor = new Mesh(new PlaneGeometry(24, 30), flat(0xffffff, { map: woodTexture() }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = 10;
  root.add(floor);

  const wall = new Mesh(new PlaneGeometry(24, 12), flat(0xffe9bf));
  wall.position.set(0, 6, -2.4);
  root.add(wall);

  const windowGroup = new Group();
  windowGroup.position.set(-2.2, 2.3, -2.38);
  const frame = new Mesh(new BoxGeometry(1.5, 1.2, 0.05), flat(0xffffff));
  const pane = new Mesh(
    new BoxGeometry(1.3, 1.0, 0.06),
    flat(0xbfe6ff, { emissive: 0x7fb8e8, emissiveIntensity: 0.25 }),
  );
  const barV = new Mesh(new BoxGeometry(0.06, 1.0, 0.08), flat(0xffffff));
  const barH = new Mesh(new BoxGeometry(1.3, 0.06, 0.08), flat(0xffffff));
  const sunDisc = new Mesh(
    new CircleGeometry(0.2, 20),
    flat(0xffe066, { emissive: 0xffd24a, emissiveIntensity: 0.8 }),
  );
  sunDisc.position.set(0.32, 0.22, 0.04);
  windowGroup.add(frame, pane, barV, barH, sunDisc);
  root.add(windowGroup);

  const shelf = new Group();
  shelf.position.set(2.4, 1.9, -2.3);
  shelf.add(new Mesh(new BoxGeometry(1.6, 0.06, 0.3), flat(0xb87333)));
  [0xff8a8a, 0xffd166, 0x8ecae6].forEach((color, i) => {
    const jar = new Group();
    jar.position.set(-0.5 + i * 0.5, 0.2, 0);
    jar.add(new Mesh(new CylinderGeometry(0.13, 0.13, 0.32, 14), flat(color)));
    const lid = new Mesh(new CylinderGeometry(0.14, 0.14, 0.06, 14), flat(0xffffff));
    lid.position.y = 0.19;
    jar.add(lid);
    shelf.add(jar);
  });
  root.add(shelf);

  // ---------- Table ----------
  const cloth = flat(0xffffff, { map: ginghamTexture([6, 2]) });
  const clothSide = flat(0xffffff, { map: ginghamTexture([2, 1]) });
  const top = new Mesh(new BoxGeometry(3.8, 0.08, 1.2), [
    clothSide,
    clothSide,
    cloth,
    clothSide,
    clothSide,
    clothSide,
  ]);
  top.position.set(0, 0.76, 0.55);
  root.add(top);
  // The cloth hangs to the floor on every side, so whatever is under the table stays hidden.
  const skirt = flat(0xffffff, { map: ginghamTexture([6, 1]), side: DoubleSide });
  const front = new Mesh(new PlaneGeometry(3.8, TABLE_Y), skirt);
  front.position.set(0, TABLE_Y / 2, 1.16);
  root.add(front);
  for (const side of [-1, 1]) {
    const end = new Mesh(new PlaneGeometry(1.2, TABLE_Y), skirt);
    end.rotation.y = Math.PI / 2;
    end.position.set(side * 1.91, TABLE_Y / 2, 0.55);
    root.add(end);
  }

  // ---------- Chair ----------
  const chair = new Group();
  chair.add(new Mesh(new BoxGeometry(1.0, 1.3, 0.1), flat(0xff8a3d)));
  chair.position.set(0, 1.25, -1.0);
  root.add(chair);

  // ---------- Bowl and bunch ----------
  const bowl = new Group();
  bowl.position.set(BOWL_POS.x, BOWL_POS.y, BOWL_POS.z);
  const bowlShell = new Mesh(
    new SphereGeometry(0.4, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    flat(0x4a90d9, { side: DoubleSide }),
  );
  bowlShell.scale.y = 0.55;
  bowlShell.position.y = 0.22;
  const lip = new Mesh(new TorusGeometry(0.4, 0.03, 8, 28), flat(0x3a78bd));
  lip.rotation.x = Math.PI / 2;
  lip.position.y = 0.22;
  bowl.add(bowlShell, lip);

  const rows: [number, number, number][] = [
    [5, 0.2, 0.17],
    [4, 0.13, 0.34],
    [3, 0.1, 0.5],
    [2, 0.06, 0.64],
  ];
  const grapes: Group[] = [];
  rows.forEach(([count, radius, y], r) => {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + r * 0.7;
      const grape = createGrapeMesh();
      grape.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      bowl.add(grape);
      grapes.push(grape);
    }
  });
  const stem = new Mesh(new CylinderGeometry(0.018, 0.026, 0.16, 6), flat(0x6b4423));
  stem.position.set(0, 0.76, 0);
  bowl.add(stem);
  root.add(bowl);

  // ---------- Plate and skins ----------
  const plate = new Group();
  plate.position.set(PLATE_POS.x, PLATE_POS.y, PLATE_POS.z);
  const dish = new Mesh(new CylinderGeometry(0.42, 0.36, 0.03, 28), flat(0xffffff));
  dish.position.y = 0.015;
  const rim = new Mesh(new TorusGeometry(0.4, 0.025, 8, 32), flat(0xe8eef5));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.03;
  plate.add(dish, rim);
  const skinGeometry = new SphereGeometry(0.085, 10, 8);
  const skinMaterial = flat(0x4f8a2b);
  const skins: Mesh[] = [];
  for (let i = 0; i < PLATE_MAX; i++) {
    const spot = plateSpot(i);
    const skin = new Mesh(skinGeometry, skinMaterial);
    skin.scale.set(1.2, 0.6, 1.2);
    skin.position.set(spot.x * 0.34, 0.05 + spot.layer * 0.07, spot.z * 0.34);
    skin.rotation.y = ((i * 7919) % 100) / 16;
    skin.visible = false;
    plate.add(skin);
    skins.push(skin);
  }
  root.add(plate);

  const setBunch = (n: number) => {
    const count = Math.max(0, Math.min(n, BUNCH_SIZE));
    grapes.forEach((grape, i) => (grape.visible = i < count));
    stem.visible = count >= BUNCH_SIZE - 1;
  };
  const setPlate = (n: number) => {
    const count = Math.max(0, Math.min(n, PLATE_MAX));
    skins.forEach((skin, i) => (skin.visible = i < count));
  };
  setBunch(BUNCH_SIZE);
  setPlate(0);

  return {
    object: root,
    setBunch,
    setPlate,
    update(elapsed) {
      const s = 1 + 0.04 * Math.sin(elapsed * 1.1);
      sunDisc.scale.set(s, s, 1);
    },
  };
}
