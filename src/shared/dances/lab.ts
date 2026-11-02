/**
 * Dev-only lab for the victory dances (not part of the build). Query: `dance=<id>` (default
 * `floss`) shows one big dancer looping; `view=all` shows all ten in a 5x2 grid with their names;
 * `at=<s>` freezes every dancer at that time (else they play); `side=1` turns the camera 90
 * degrees to check front and back depth (the floss).
 */
import { AmbientLight, DirectionalLight, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three';
import { createScene } from '../scene';
import { createPerson, neutralPose, PERSON_SCALE } from '../hockey/person';
import { DANCES, writeDance, type DanceId } from './index';

const params = new URLSearchParams(location.search);
const all = params.get('view') === 'all';
const side = params.get('side') === '1';
const atParam = params.get('at');
const at = atParam !== null && atParam !== '' && Number(atParam) >= 0 ? Number(atParam) : null;
const one = DANCES.find((id) => id === params.get('dance')) ?? 'floss';

const container = document.getElementById('stage')!;
const ctx = createScene(container, { fov: 40 });
const { scene, camera } = ctx;
scene.add(new AmbientLight(0xffffff, 1.6));
const sun = new DirectionalLight(0xffffff, 2.2);
sun.position.set(2, 5, 6);
scene.add(sun);
const floor = new Mesh(
  new PlaneGeometry(40, 20),
  new MeshStandardMaterial({ color: 0x3b4a7a, roughness: 1 }),
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const ids: DanceId[] = all ? [...DANCES] : [one];
const COLS = all ? 5 : 1;
const SPACING = 1.6;
const dancers = ids.map((id, i) => {
  const person = createPerson({ shirt: 0x2f6fe0, pants: 0x2a2f45, hatColor: 0x2f6fe0 });
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  person.root.scale.setScalar(PERSON_SCALE);
  person.root.position.set((col - (COLS - 1) / 2) * SPACING, 0, row === 0 && all ? -1.2 : 0);
  if (all && row === 1) person.root.position.z = 0.4;
  scene.add(person.root);
  return { id, person, pose: neutralPose() };
});

const labels = all
  ? ids.map((id) => {
      const el = document.createElement('div');
      el.className = 'name';
      el.textContent = id;
      document.body.appendChild(el);
      return el;
    })
  : [];

const lookY = all ? 1.15 : 1.1;
const fit = () => {
  // Distance that frames the whole grid (or one dancer) at this aspect.
  const halfW = all ? (COLS * SPACING) / 2 + 0.2 : 1.1;
  const halfH = all ? 1.95 : 1.15;
  const tan = Math.tan((camera.fov * Math.PI) / 360);
  const dist = Math.max(halfH / tan, halfW / (tan * camera.aspect)) + 1.2;
  if (side) camera.position.set(dist, lookY, 0);
  else camera.position.set(0, lookY, dist);
  camera.lookAt(0, lookY, 0);
  dancers.forEach((d, i) => {
    if (!labels[i]) return;
    const p = d.person.root.position.clone();
    p.y = 0;
    p.project(camera);
    labels[i].style.left = `${((p.x + 1) / 2) * innerWidth}px`;
    labels[i].style.top = `${((1 - p.y) / 2) * innerHeight + 4}px`;
  });
};

ctx.onUpdate((_delta, elapsed) => {
  fit();
  for (const d of dancers) {
    writeDance(d.pose, d.id, at ?? elapsed);
    d.person.apply(d.pose);
  }
});
ctx.start();
window.addEventListener('pagehide', () => {
  ctx.dispose();
  labels.forEach((l) => l.remove());
});
