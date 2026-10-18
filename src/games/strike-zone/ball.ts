import {
  CanvasTexture,
  CircleGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
} from 'three';
import { BALL_R, DECK_BACK_Z, type Vec } from './geometry';
import type { BodyPose } from './physics';

export interface Ball {
  object: Group;
  /** Puts the ball's centre at `p`; the blob shadow lies on the floor at `floorY` below it. */
  place(p: Vec, floorY?: number): void;
  /** Turns the ball as if it rolled by (dx, dz) metres along the floor. */
  rollBy(dx: number, dz: number): void;
  /** Takes the pose of the physics body. */
  setPose(pose: BodyPose): void;
  setVisible(visible: boolean): void;
}

/** A blue ball with lighter swirls and three finger holes, drawn on a canvas. */
function swirlTexture(): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const g = canvas.getContext('2d');
  if (!g) return null;
  g.fillStyle = '#2a5fd1';
  g.fillRect(0, 0, 256, 128);
  g.strokeStyle = '#6fa0ff';
  g.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    g.lineWidth = 6 + (i % 3) * 3;
    g.globalAlpha = 0.5;
    g.beginPath();
    g.moveTo(-10, 14 * i);
    g.bezierCurveTo(70, 14 * i - 40, 150, 14 * i + 50, 270, 14 * i - 10);
    g.stroke();
  }
  g.globalAlpha = 1;
  // The finger holes, on the front of the ball (the middle of the texture).
  g.fillStyle = '#0a1230';
  for (const [x, y] of [
    [118, 60],
    [138, 60],
    [128, 82],
  ]) {
    g.beginPath();
    g.arc(x, y, 6, 0, Math.PI * 2);
    g.fill();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function createBall(): Ball {
  const object = new Group();
  const ball = new Group();
  const map = swirlTexture();
  const material = new MeshStandardMaterial({
    color: map ? 0xffffff : 0x2a5fd1,
    map: map ?? undefined,
    roughness: 0.18,
    metalness: 0.1,
  });
  ball.add(new Mesh(new SphereGeometry(BALL_R, 32, 24), material));
  const shadow = new Mesh(
    new CircleGeometry(BALL_R * 1.25, 20),
    new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  object.add(ball, shadow);

  const axis = new Vector3();
  const turn = new Quaternion();
  return {
    object,
    place(p, floorY = 0) {
      ball.position.set(p.x, p.y, p.z);
      shadow.visible = true;
      shadow.position.set(p.x, floorY + 0.004, p.z);
      const near = 1 / (1 + Math.max(p.y - floorY - BALL_R, 0) * 1.5);
      shadow.scale.setScalar(near);
    },
    rollBy(dx, dz) {
      const distance = Math.hypot(dx, dz);
      if (distance < 1e-9) return;
      axis.set(dz, 0, -dx).normalize();
      turn.setFromAxisAngle(axis, distance / BALL_R);
      ball.quaternion.premultiply(turn);
    },
    setPose(pose) {
      ball.position.set(pose.x, pose.y, pose.z);
      ball.quaternion.set(pose.qx, pose.qy, pose.qz, pose.qw);
      shadow.visible = pose.z > DECK_BACK_Z && pose.y > 0.02;
      shadow.position.set(pose.x, 0.004, pose.z);
      shadow.scale.setScalar(pose.y > 0.01 ? 1 / (1 + Math.max(pose.y - BALL_R, 0) * 1.5) : 1);
    },
    setVisible(visible) {
      object.visible = visible;
    },
  };
}
