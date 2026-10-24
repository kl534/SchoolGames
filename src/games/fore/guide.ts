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
import type { Plan } from './shot';

export interface Guide {
  object: Group;
  /** Shows the ring where a perfect shot lands, and the dotted line to it from the ball. */
  update(plan: Plan, over: Surface): void;
  setVisible(visible: boolean): void;
}

/** The ring colour for what it is over: red water, amber sand, white otherwise. */
export function ringColour(over: Surface): number {
  if (over === 'water') return 0xff4b4b;
  if (over === 'sand') return 0xffb830;
  return 0xffffff;
}

/** Radius of the ring in yards: 3, bigger far away so it can still be seen. */
export const ringRadius = (carry: number): number => Math.max(3, carry * 0.035);

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
  // A tall faint beam over the ring, so a far-off landing spot is easy to find.
  const beamMat = material(0.4);
  const beam = new Mesh(new CylinderGeometry(1, 1, 1, 20, 1, true), beamMat);
  beam.renderOrder = 17;
  object.add(ring, fill, beam);

  return {
    object,
    update(plan, over) {
      const colour = ringColour(over);
      for (const m of [ringMat, fillMat, beamMat] as Material[])
        (m as MeshBasicMaterial).color.setHex(colour);
      const r = ringRadius(plan.carry);
      ring.position.set(plan.landing.x, 0.35, plan.landing.z);
      ring.scale.setScalar(r);
      fill.position.copy(ring.position);
      fill.scale.setScalar(r);
      const beamH = 3 + r * 0.6;
      beam.scale.set(r * 0.35, beamH, r * 0.35);
      beam.position.set(plan.landing.x, beamH / 2, plan.landing.z);
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
    },
    setVisible(visible) {
      object.visible = visible;
    },
  };
}
