import { Box3, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { createGoalie } from '../src/games/penalty-kick/goalie';

const LINE_Z = 0.5;

/** Ball positions as they reach the keeper: corners, a roll along the ground, and in between. */
const SHOTS: [string, Vector3][] = [
  ['bottom left', new Vector3(-1.9, 0.72, 0.85)],
  ['bottom right', new Vector3(1.9, 0.72, 0.85)],
  ['top left', new Vector3(-1.9, 2.35, 0.85)],
  ['top right', new Vector3(1.9, 2.35, 0.85)],
  ['roll at the keeper', new Vector3(0, 0.3, 0.85)],
  ['chest high', new Vector3(0.3, 1.3, 0.85)],
  ['over the head', new Vector3(-0.2, 2.4, 0.85)],
  ['low, just wide', new Vector3(1, 0.4, 0.85)],
];

function glovePositions(goalie: ReturnType<typeof createGoalie>) {
  return ['glove-left', 'glove-right'].map((name) => {
    const glove = goalie.object.getObjectByName(name);
    if (!glove) throw new Error(`missing ${name}`);
    return glove.getWorldPosition(new Vector3());
  });
}

describe('goalie saves', () => {
  for (const [name, ball] of SHOTS) {
    it(`gets both gloves on the ball: ${name}`, () => {
      const goalie = createGoalie(LINE_Z);
      goalie.update(0.016, 1.3); // somewhere mid-shuffle
      goalie.diveTo(ball, 0.45, { delay: 0.12 });
      goalie.update(0.12, 1.4);
      goalie.update(0.45, 1.85);

      expect(goalie.ballPosition(new Vector3()).distanceTo(ball)).toBeLessThan(0.02);
      const [left, right] = glovePositions(goalie);
      // Side by side behind the ball, close enough that it can't slip between them.
      expect(left.distanceTo(right)).toBeGreaterThan(0.2);
      expect(left.distanceTo(right)).toBeLessThan(0.36);
      for (const glove of [left, right]) {
        expect(glove.z).toBeLessThan(ball.z);
        expect(glove.distanceTo(ball)).toBeLessThan(0.32);
      }
      const body = new Box3().setFromObject(goalie.object, true);
      expect(body.min.y).toBeGreaterThan(-0.02);
    });
  }

  it('holds a caught ball between the gloves', () => {
    const goalie = createGoalie(LINE_Z);
    const ball = new Vector3(0, 0.3, 0.85);
    goalie.diveTo(ball, 0.9, { delay: 0.12, hold: true });
    goalie.update(0.12, 0);
    goalie.update(0.9, 0);
    goalie.update(0.12, 0);
    goalie.update(0.5, 0);
    const held = goalie.ballPosition(new Vector3());
    const [left, right] = glovePositions(goalie);
    expect(held.y).toBeGreaterThan(1);
    expect(held.distanceTo(left.clone().add(right).multiplyScalar(0.5))).toBeLessThan(0.01);
    expect(left.distanceTo(right)).toBeGreaterThan(0.45);
  });
});
