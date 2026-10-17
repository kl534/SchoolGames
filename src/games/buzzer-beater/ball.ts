import {
  CanvasTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  SRGBColorSpace,
} from 'three';
import { BALL_RADIUS, type Vec } from './geometry';

export interface Ball {
  object: Group;
  place(p: Vec, scale?: number): void;
  spin(delta: number, rate: number): void;
  setVisible(visible: boolean): void;
}

/** An orange ball with black seams, drawn on a canvas. */
function seamTexture(): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const g = canvas.getContext('2d');
  if (!g) return null;
  g.fillStyle = '#e8742a';
  g.fillRect(0, 0, 256, 128);
  g.strokeStyle = '#1b1008';
  g.lineWidth = 5;
  g.lineCap = 'round';
  // The equator and the two meridians, and a curve on each side.
  g.beginPath();
  g.moveTo(0, 64);
  g.lineTo(256, 64);
  for (const x of [0, 64, 128, 192, 256]) {
    g.moveTo(x, 0);
    g.lineTo(x, 128);
  }
  g.stroke();
  g.lineWidth = 4;
  for (const x of [32, 96, 160, 224]) {
    g.beginPath();
    g.ellipse(x, 64, 22, 60, 0, 0, Math.PI * 2);
    g.stroke();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function createBall(): Ball {
  const object = new Group();
  const ball = new Group();
  const map = seamTexture();
  const material = new MeshStandardMaterial({
    color: map ? 0xffffff : 0xe8742a,
    map: map ?? undefined,
    roughness: 0.6,
  });
  ball.add(new Mesh(new SphereGeometry(BALL_RADIUS, 24, 16), material));
  const shadow = new Mesh(
    new SphereGeometry(1, 14, 8),
    new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }),
  );
  shadow.scale.set(BALL_RADIUS * 1.3, 0.004, BALL_RADIUS * 1.3);
  object.add(ball, shadow);
  return {
    object,
    place(p, scale = 1) {
      ball.position.set(p.x, p.y, p.z);
      ball.scale.setScalar(scale);
      const near = 1 / (1 + Math.max(p.y - BALL_RADIUS, 0) * 0.12);
      shadow.position.set(p.x, 0.02, p.z);
      shadow.scale.set(BALL_RADIUS * 1.4 * near * scale, 0.004, BALL_RADIUS * 1.4 * near * scale);
    },
    spin(delta, rate) {
      ball.rotation.x += delta * rate;
      ball.rotation.z += delta * rate * 0.4;
    },
    setVisible(visible) {
      object.visible = visible;
    },
  };
}
