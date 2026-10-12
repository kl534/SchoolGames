import {
  BoxGeometry,
  CylinderGeometry,
  DirectionalLight,
  GridHelper,
  AmbientLight,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
} from 'three';
import { Body, Plane, Sphere, Vec3, World } from 'cannon-es';
import { createScene } from '../../shared/scene';
import { createBackButton, createPauseOverlay } from '../../shared/ui';

const BALL_RADIUS = 0.22;

const container = document.getElementById('game');
if (!container) throw new Error('Missing #game container');

const ctx = createScene(container);
const { scene, camera } = ctx;
scene.background = null;
ctx.renderer.setClearColor(0x87ceeb);

camera.position.set(0, 1.6, 12);
camera.lookAt(0, 1.2, 0);

scene.add(new AmbientLight(0xffffff, 1.2));
const sun = new DirectionalLight(0xffffff, 2);
sun.position.set(5, 10, 8);
scene.add(sun);

// Pitch
const pitch = new Mesh(new PlaneGeometry(40, 40), new MeshStandardMaterial({ color: 0x2e8b3d }));
pitch.rotation.x = -Math.PI / 2;
scene.add(pitch);

// Goal: two posts, crossbar and a translucent net
const goalWidth = 7.32;
const goalHeight = 2.44;
const frameMaterial = new MeshStandardMaterial({ color: 0xffffff });
const postGeometry = new CylinderGeometry(0.06, 0.06, goalHeight, 12);
for (const side of [-1, 1]) {
  const post = new Mesh(postGeometry, frameMaterial);
  post.position.set((side * goalWidth) / 2, goalHeight / 2, 0);
  scene.add(post);
}
const crossbar = new Mesh(new CylinderGeometry(0.06, 0.06, goalWidth, 12), frameMaterial);
crossbar.rotation.z = Math.PI / 2;
crossbar.position.set(0, goalHeight, 0);
scene.add(crossbar);

const net = new Mesh(
  new BoxGeometry(goalWidth, goalHeight, 1.5),
  new MeshStandardMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.35 }),
);
net.position.set(0, goalHeight / 2, -0.75);
scene.add(net);

const spot = new GridHelper(0.5, 1, 0xffffff, 0xffffff);
spot.position.set(0, 0.01, 7);
scene.add(spot);

// Ball: physics body dropped onto the ground to prove cannon-es wiring
const ball = new Mesh(
  new SphereGeometry(BALL_RADIUS, 24, 16),
  new MeshStandardMaterial({ color: 0xffffff }),
);
scene.add(ball);

const world = new World({ gravity: new Vec3(0, -9.82, 0) });
const ground = new Body({ mass: 0, shape: new Plane() });
ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(ground);
const ballBody = new Body({ mass: 0.43, shape: new Sphere(BALL_RADIUS), linearDamping: 0.1 });
ballBody.position.set(0, 2, 7);
world.addBody(ballBody);

ctx.onUpdate((delta) => {
  world.step(1 / 60, delta, 3);
  ball.position.set(ballBody.position.x, ballBody.position.y, ballBody.position.z);
  ball.quaternion.set(
    ballBody.quaternion.x,
    ballBody.quaternion.y,
    ballBody.quaternion.z,
    ballBody.quaternion.w,
  );
});

// UI
createBackButton();
const pause = createPauseOverlay({ onPause: () => ctx.stop(), onResume: () => ctx.start() });

const banner = document.createElement('div');
banner.textContent = 'Coming soon';
banner.style.cssText =
  'position:fixed;left:50%;top:18%;transform:translateX(-50%);padding:12px 28px;border-radius:12px;background:rgba(15,18,32,0.75);color:#fff;font:700 clamp(24px,6vw,48px) system-ui,sans-serif;pointer-events:none;z-index:10';
document.body.appendChild(banner);

ctx.start();

window.addEventListener('pagehide', () => {
  pause.dispose();
  ctx.dispose();
});
