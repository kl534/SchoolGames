import { CylinderGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { createAnimator, createPerson, type Person } from './person';
import type { Reaction } from './rules';

/** How long a cheer or a groan lasts before the caddie stands easy again, seconds. */
export const REACTION_SECONDS = 1.3;

export interface Caddie {
  root: Group;
  person: Person;
  /** Starts a reaction now; `idle` does nothing. It ends by itself after REACTION_SECONDS. */
  react(reaction: Reaction): void;
  /** Poses the caddie; call every frame with the frame time. */
  update(delta: number): void;
  /**
   * Stands 2 yd behind the golfer's back (away from the ball line) and 0.5 yd further along the
   * line, facing the same way as the golfer, who is side-on to a shot along `dir`.
   */
  stand(golfer: { x: number; z: number }, dir: number): void;
}

/** A standing figure with the golf bag at his feet, who cheers or groans after a shot. */
export function createCaddie(): Caddie {
  const person = createPerson({
    shirt: 0x3a7bd5,
    pants: 0xc9b78a,
    hat: 'cap',
    hatColor: 0x3a7bd5,
    trousers: true,
    shoe: 0x4a3f33,
    height: 1.9,
  });
  const root = person.root;
  const animator = createAnimator(person);

  // The bag stands at his feet, with three clubs sticking out of the top.
  const bag = new Group();
  const body = new Mesh(
    new CylinderGeometry(0.14, 0.17, 0.9, 12),
    new MeshStandardMaterial({ color: 0x2f4a3a, roughness: 0.8 }),
  );
  body.position.y = 0.45;
  bag.add(body);
  for (const [x, tilt] of [
    [-0.06, -0.18],
    [0.0, 0.02],
    [0.07, 0.2],
  ]) {
    const shaft = new Mesh(
      new CylinderGeometry(0.006, 0.006, 0.45, 5),
      new MeshStandardMaterial({ color: 0xc9ced6, metalness: 0.5, roughness: 0.4 }),
    );
    shaft.position.set(x, 1.05, 0);
    shaft.rotation.z = tilt;
    bag.add(shaft);
  }
  bag.position.set(-0.45, 0, 0.05);
  root.add(bag);

  let move: Reaction = 'idle';
  let since = 0;
  let now = 0;
  let last: Reaction | null = null;

  return {
    root,
    person,
    react(reaction) {
      if (reaction === 'idle') return;
      move = reaction;
      since = now;
    },
    update(delta) {
      now += delta;
      if (move !== 'idle' && now - since >= REACTION_SECONDS) move = 'idle';
      if (move !== last) {
        animator.transition(0.12);
        last = move;
      }
      const t = now - since;
      animator.step(delta, (p) => {
        switch (move) {
          case 'idle':
            p.lift = Math.sin(now * 1.6) * 0.004;
            p.armL.raise = 0.05;
            p.armR.raise = 0.05;
            p.armL.out = 0.08;
            p.armR.out = 0.08;
            p.legL.out = p.legR.out = 0.06;
            break;
          case 'cheer':
            p.armL.raise = p.armR.raise = 2.6 + Math.sin(t * 12) * 0.2;
            p.armL.out = p.armR.out = 0.35;
            p.lift = Math.abs(Math.sin(t * 9)) * 0.08;
            p.headPitch = 0.2;
            break;
          case 'groan':
            p.lean = 0.35;
            p.headPitch = -0.6;
            p.armL.raise = p.armR.raise = 0.15;
            p.armL.out = p.armR.out = 0.05;
            p.lift = -0.03;
            p.roll = Math.sin(t * 6) * 0.06;
            break;
        }
      });
    },
    stand(golfer, dir) {
      // The golfer faces (-cos dir, sin dir); his back is the other way.
      const back = { x: Math.cos(dir), z: -Math.sin(dir) };
      const along = { x: Math.sin(dir), z: Math.cos(dir) };
      root.position.set(
        golfer.x + back.x * 2 + along.x * 0.5,
        0,
        golfer.z + back.z * 2 + along.z * 0.5,
      );
      root.rotation.y = dir - Math.PI / 2;
    },
  };
}
