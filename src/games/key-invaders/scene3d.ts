/**
 * The 3D scene of Typo Troopers: a starfield over the whole canvas, then the field in its rectangle
 * under a fixed, tilted arcade camera. Two passes with `autoClear` off. `project` turns a world
 * point into screen pixels for the labels and pops.
 */
import {
  AmbientLight,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  Points,
  PointsMaterial,
  Scene,
  Vector2,
  Vector3,
} from 'three';
import { createScene, type SceneContext } from '../../shared/scene';
import {
  FIELD_BOX,
  FIELD_HALF,
  FOV,
  GROUND_Y,
  TILT_DEG,
  cameraDistance,
  type Rect,
} from './layout';

const STARS = 600;
const BACKGROUND = '#05060f';

export interface KeyScene {
  readonly ctx: SceneContext;
  /** Everything of the game goes in this group; it shakes. */
  readonly world: Group;
  /** Sets the rectangle (px, from the top left of the page) the field is drawn in. */
  setRect(rect: Rect): void;
  readonly rect: Rect;
  /** Screen pixels (page coordinates) of a world point. */
  project(x: number, y: number, z?: number): { x: number; y: number };
  /** The shake's offset, applied to the world. */
  shake(x: number, y: number): void;
  dispose(): void;
}

export function createKeyScene(container: HTMLElement): KeyScene {
  const ctx = createScene(container, { fov: FOV, near: 0.5, far: 150, antialias: true });
  const { renderer, scene, camera } = ctx;
  renderer.autoClear = false;
  renderer.setClearColor(new Color(BACKGROUND), 1);

  const world = new Group();
  scene.add(world);
  scene.add(new AmbientLight('#ffffff', 0.7));
  const sun = new DirectionalLight('#ffffff', 1.4);
  sun.position.set(2, 6, 10);
  scene.add(sun);

  // The ground line.
  const ground = new Mesh(
    new BoxGeometry(FIELD_HALF * 2 + 0.4, 0.05, 0.1),
    new MeshBasicMaterial({ color: '#3ddc5a' }),
  );
  ground.position.set(0, GROUND_Y - 0.03, 0);
  world.add(ground);

  // ---------- The stars: their own scene and a flat camera over the whole canvas ----------
  const starScene = new Scene();
  const starCamera = new OrthographicCamera(-1, 1, 1, -1, -1, 1);
  const positions = new Float32Array(STARS * 3);
  for (let i = 0; i < STARS; i++) {
    positions[i * 3] = Math.random() * 2 - 1;
    positions[i * 3 + 1] = Math.random() * 2 - 1;
  }
  const starGeometry = new BufferGeometry();
  starGeometry.setAttribute('position', new BufferAttribute(positions, 3));
  const starMaterial = new PointsMaterial({
    color: '#ffffff',
    size: 2,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
  });
  starScene.add(new Points(starGeometry, starMaterial));

  const rect: Rect = { x: 0, y: 0, w: 1, h: 1 };
  const centre = new Vector3(0, (FIELD_BOX.bottom + FIELD_BOX.top) / 2, 0);
  const tilt = (TILT_DEG * Math.PI) / 180;
  const size = new Vector2();
  const tmp = new Vector3();

  const applyCamera = () => {
    camera.aspect = rect.w / rect.h;
    const d = cameraDistance(FIELD_BOX, camera.aspect);
    camera.position.set(centre.x, centre.y - d * Math.sin(tilt), centre.z + d * Math.cos(tilt));
    camera.lookAt(centre);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  };

  const stop = ctx.onUpdate((delta) => {
    applyCamera();
    for (let i = 0; i < STARS; i++) {
      const j = i * 3 + 1;
      positions[j] -= delta * (0.01 + (i % 5) * 0.004);
      if (positions[j] < -1) positions[j] += 2;
    }
    starGeometry.attributes.position.needsUpdate = true;
    renderer.getSize(size);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, size.x, size.y);
    renderer.clear();
    renderer.render(starScene, starCamera);
    renderer.clearDepth();
    const gy = size.y - rect.y - rect.h;
    renderer.setScissorTest(true);
    renderer.setViewport(rect.x, gy, rect.w, rect.h);
    renderer.setScissor(rect.x, gy, rect.w, rect.h);
  });

  return {
    ctx,
    world,
    rect,
    setRect(next) {
      Object.assign(rect, next);
      applyCamera();
    },
    project(x, y, z = 0) {
      tmp.set(x, y, z).project(camera);
      return {
        x: rect.x + ((tmp.x + 1) / 2) * rect.w,
        y: rect.y + ((1 - tmp.y) / 2) * rect.h,
      };
    },
    shake(x, y) {
      world.position.set(x, y, 0);
    },
    dispose() {
      stop();
      starGeometry.dispose();
      starMaterial.dispose();
      ctx.dispose();
    },
  };
}
