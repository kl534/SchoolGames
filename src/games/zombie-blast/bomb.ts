import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  type Object3D,
} from 'three';

export const BOMB_RADIUS = 0.2;

export interface Bomb {
  object: Group;
  /** Flickers the spark on the end of the fuse. */
  update(elapsed: number): void;
}

/** A cartoon bomb: black ball, a little cap and a curly fuse with a sparkling tip. */
export function createBomb(): Bomb {
  const black = new MeshStandardMaterial({ color: 0x23232b, roughness: 0.35, metalness: 0.2 });
  const cap = new MeshStandardMaterial({ color: 0x777b88, roughness: 0.4, metalness: 0.5 });
  const fuseMat = new MeshStandardMaterial({ color: 0xd9b778, roughness: 0.9 });
  const shine = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
  const sparkMat = new MeshBasicMaterial({ color: 0xffd43b });
  const sparkHot = new MeshBasicMaterial({ color: 0xff7a1a });

  const object = new Group();
  object.add(new Mesh(new SphereGeometry(BOMB_RADIUS, 20, 14), black));
  const highlight = new Mesh(new SphereGeometry(0.045, 8, 6), shine);
  highlight.position.set(-0.08, 0.09, 0.14);
  highlight.scale.set(1, 0.6, 0.5);
  object.add(highlight);
  const neck = new Mesh(new CylinderGeometry(0.06, 0.075, 0.07, 12), cap);
  neck.position.y = BOMB_RADIUS + 0.01;
  object.add(neck);

  // A short curl of fuse, then the spark.
  const curl = new Mesh(new TorusGeometry(0.07, 0.014, 6, 12, Math.PI * 1.2), fuseMat);
  curl.position.set(0.07, BOMB_RADIUS + 0.1, 0);
  curl.rotation.z = Math.PI * 0.55;
  object.add(curl);

  const spark = new Group();
  spark.position.set(0.15, BOMB_RADIUS + 0.2, 0);
  object.add(spark);
  spark.add(new Mesh(new SphereGeometry(0.04, 8, 6), sparkMat));
  const rays: Object3D[] = [];
  for (let i = 0; i < 3; i++) {
    const ray = new Mesh(new BoxGeometry(0.15, 0.015, 0.015), i === 1 ? sparkHot : sparkMat);
    ray.rotation.z = (i / 3) * Math.PI;
    spark.add(ray);
    rays.push(ray);
  }

  return {
    object,
    update(elapsed) {
      const flicker = 0.75 + Math.sin(elapsed * 40) * 0.25;
      spark.scale.setScalar(flicker);
      spark.rotation.z = elapsed * 7;
      rays.forEach((ray, i) => (ray.visible = Math.sin(elapsed * 30 + i * 2.1) > -0.4));
    },
  };
}
