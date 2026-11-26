import {
  CircleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  type Material,
} from 'three';
import type { Surface } from './course';
import { isPutt, type Plan, type Result } from './shot';

export interface Guide {
  object: Group;
  /**
   * Shows the ring where the ball lands, the dotted line to it from the ball (red when a perfect
   * flight would hit a tree) and, past the ring, the dotted tail and hollow dot where it should
   * stop (`rest` is the predicted result).
   */
  update(plan: Plan, over: Surface, rest: Result, treeStop: boolean): void;
  setVisible(visible: boolean): void;
}

/** The ring colour for what it is over: red water, amber sand, white otherwise. */
export function ringColour(over: Surface): number {
  if (over === 'water') return 0xff4b4b;
  if (over === 'sand') return 0xffb830;
  return 0xffffff;
}

const TAIL_DOTS = 24;
const TAIL_SPACING = 2;
/** A roll shorter than this (yards) gets no tail. */
const MIN_TAIL = 0.5;
const RED = 0xff4b4b;

const DOTS = 40;

export function createGuide(): Guide {
  const object = new Group();
  const material = (opacity: number): MeshBasicMaterial =>
    new MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity,
      depthTest: false,
      depthWrite: false,
    });
  const ringMat = material(0.95);
  const fillMat = material(0.22);
  const dotMat = material(0.85);
  const tailMat = material(0.9);

  const ring = new Mesh(new RingGeometry(0.82, 1, 40), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.renderOrder = 20;
  const fill = new Mesh(new CircleGeometry(0.82, 32), fillMat);
  fill.rotation.x = -Math.PI / 2;
  fill.renderOrder = 19;
  const dotGeometry = new CircleGeometry(0.28, 8);
  const dots: Mesh[] = [];
  for (let i = 0; i < DOTS; i++) {
    const dot = new Mesh(dotGeometry, dotMat);
    dot.rotation.x = -Math.PI / 2;
    dot.renderOrder = 18;
    dots.push(dot);
    object.add(dot);
  }
  const tailGeometry = new CircleGeometry(0.22, 8);
  const tail: Mesh[] = [];
  for (let i = 0; i < TAIL_DOTS; i++) {
    const dot = new Mesh(tailGeometry, tailMat);
    dot.rotation.x = -Math.PI / 2;
    dot.renderOrder = 18;
    tail.push(dot);
    object.add(dot);
  }
  // The hollow dot where the ball should stop.
  const restDot = new Mesh(new RingGeometry(0.6, 0.9, 20), tailMat);
  restDot.rotation.x = -Math.PI / 2;
  restDot.renderOrder = 18;
  object.add(restDot);
  // A tall faint beam over the ring, so a far-off landing spot is easy to find.
  const beamMat = material(0.4);
  const beam = new Mesh(new CylinderGeometry(1, 1, 1, 20, 1, true), beamMat);
  beam.renderOrder = 17;
  object.add(ring, fill, beam);

  return {
    object,
    update(plan, over, rest, treeStop) {
      const colour = ringColour(over);
      for (const m of [ringMat, fillMat, beamMat] as Material[])
        (m as MeshBasicMaterial).color.setHex(colour);
      const r = plan.ringR;
      ring.position.set(plan.landing.x, 0.35, plan.landing.z);
      ring.scale.setScalar(r);
      fill.position.copy(ring.position);
      fill.scale.setScalar(r);
      const beamH = 3 + r * 0.6;
      beam.scale.set(r * 0.35, beamH, r * 0.35);
      beam.position.set(plan.landing.x, beamH / 2, plan.landing.z);
      dotMat.color.setHex(treeStop ? RED : 0xffffff);
      const dx = plan.landing.x - plan.from.x;
      const dz = plan.landing.z - plan.from.z;
      const len = Math.hypot(dx, dz);
      const usable = Math.max(len - r, 0);
      const shown = Math.min(DOTS, Math.max(Math.floor(usable / 4), 0));
      dots.forEach((dot, i) => {
        dot.visible = i < shown;
        if (!dot.visible) return;
        const s = ((i + 1) / (shown + 1)) * usable + 1.5;
        dot.position.set(plan.from.x + (dx / len) * s, 0.3, plan.from.z + (dz / len) * s);
        dot.scale.setScalar(0.6 + (s / Math.max(len, 1)) * 1.6);
      });
      // The tail: where the ball runs on to after it lands.
      const stop =
        rest.kind === 'rest' && rest.tree === undefined
          ? rest.at
          : rest.kind === 'water'
            ? rest.splash
            : null;
      const roll = stop ? Math.hypot(stop.x - plan.landing.x, stop.z - plan.landing.z) : 0;
      const showTail = !!stop && !isPutt(plan) && roll >= MIN_TAIL;
      restDot.visible = showTail;
      const bad = rest.kind === 'water' || (rest.kind === 'rest' && rest.surface === 'sand');
      tailMat.color.setHex(bad ? RED : 0xffffff);
      tail.forEach((dot, i) => {
        const s = (i + 1) * TAIL_SPACING;
        dot.visible = showTail && s < roll - 0.9;
        if (!dot.visible || !stop) return;
        const k = s / roll;
        dot.position.set(
          plan.landing.x + (stop.x - plan.landing.x) * k,
          0.3,
          plan.landing.z + (stop.z - plan.landing.z) * k,
        );
      });
      if (showTail && stop) restDot.position.set(stop.x, 0.3, stop.z);
    },
    setVisible(visible) {
      object.visible = visible;
    },
  };
}
