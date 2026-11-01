import {
  CircleGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three';
import { BALL_R, type Vec } from './shots';

/** The ball is drawn this much bigger than its physics, so it reads on a phone. */
const DRAW = 1.4;

export interface Ball {
  object: Group;
  /** Puts the ball at a world spot (its shadow goes to the floor below). */
  setPosition(at: Vec): void;
  setVisible(on: boolean): void;
  /** Spin speed, radians per second, about the axis across the court. */
  setSpin(speed: number): void;
  update(delta: number): void;
}

/** A red rubber ball with a stripe, a spin, and a shadow on the asphalt. */
export function createBall(): Ball {
  const body = new Group();
  const red = new MeshStandardMaterial({ color: 0xe23b2e, roughness: 0.45 });
  const ball = new Mesh(new SphereGeometry(BALL_R * DRAW, 18, 14), red);
  body.add(ball);
  // A white band round the middle, so the spin shows.
  const band = new Mesh(
    new SphereGeometry(
      BALL_R * DRAW * 1.01,
      18,
      14,
      0,
      Math.PI * 2,
      Math.PI * 0.42,
      Math.PI * 0.16,
    ),
    new MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }),
  );
  body.add(band);

  const shadow = new Mesh(
    new CircleGeometry(BALL_R * DRAW * 1.1, 16),
    new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;

  let spin = 6;
  const object = new Group();
  object.add(shadow);
  object.add(body);
  return {
    object,
    setPosition(at) {
      body.position.set(at.x, at.y, at.z);
      shadow.position.set(at.x, 0.02, at.z);
      const height = Math.max(at.y - BALL_R, 0);
      const s = 1 / (1 + height * 0.8);
      shadow.scale.setScalar(s);
      (shadow.material as MeshBasicMaterial).opacity = 0.35 * s;
    },
    setVisible(on) {
      body.visible = on;
      shadow.visible = on;
    },
    setSpin(speed) {
      spin = speed;
    },
    update(delta) {
      ball.rotation.z += spin * delta;
      band.rotation.z = ball.rotation.z;
    },
  };
}
