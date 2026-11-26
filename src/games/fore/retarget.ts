/**
 * Pure maths for putting a skinned model's limbs where the hidden rig's are (three.js math types
 * only): a two-bone solver and the constant turn between a rig joint's rest and the model bone's.
 */
import { Quaternion, Vector3 } from 'three';

const EPS = 1e-6;
const a = new Vector3();
const b = new Vector3();
const axis = new Vector3();
const perp = new Vector3();
const mid1 = new Vector3();
const end1 = new Vector3();
const end2 = new Vector3();

/**
 * The two world-frame rotations that put a limb's end on `target`. The first turns the whole limb
 * about `root`, the second then turns the lower bone about the new middle joint, so apply them as
 * `root * old` and `mid * root * old`. The bone lengths are kept; the middle joint bends towards the
 * point `pole`; a target beyond the limb's reach (or inside its fold) gets a straight (or fully
 * folded) limb pointing at it. Positions are world points and are not changed.
 */
export function twoBoneIK(
  root: Vector3,
  mid: Vector3,
  end: Vector3,
  target: Vector3,
  pole: Vector3,
): [Quaternion, Quaternion] {
  const upper = a.subVectors(mid, root).length();
  const lower = b.subVectors(end, mid).length();
  axis.subVectors(target, root);
  const reach = Math.min(
    Math.max(axis.length(), Math.abs(upper - lower) + EPS),
    upper + lower - EPS,
  );
  if (axis.lengthSq() < EPS) axis.set(0, 0, 1);
  axis.normalize();
  // The bend plane holds the axis and the pole.
  perp.subVectors(pole, root);
  perp.addScaledVector(axis, -perp.dot(axis));
  if (perp.lengthSq() < 1e-10) {
    perp.set(0, 1, 0).addScaledVector(axis, -axis.y);
    if (perp.lengthSq() < 1e-10) perp.set(1, 0, 0).addScaledVector(axis, -axis.x);
  }
  perp.normalize();
  const along = (upper * upper - lower * lower + reach * reach) / (2 * reach);
  const height = Math.sqrt(Math.max(upper * upper - along * along, 0));
  mid1.copy(root).addScaledVector(axis, along).addScaledVector(perp, height);
  end2.copy(root).addScaledVector(axis, reach);
  // Turn the upper bone onto the new middle joint, then the lower bone onto the end point.
  const turnRoot = new Quaternion().setFromUnitVectors(
    a.subVectors(mid, root).normalize(),
    b.subVectors(mid1, root).normalize(),
  );
  end1.subVectors(end, root).applyQuaternion(turnRoot).add(root);
  const turnMid = new Quaternion().setFromUnitVectors(
    a.subVectors(end1, mid1).normalize(),
    b.subVectors(end2, mid1).normalize(),
  );
  return [turnRoot, turnMid];
}

/**
 * The turn that takes a rig joint's rest orientation to the model bone's rest orientation, so that
 * `rigNow * offset` is where the bone goes when the rig joint is at `rigNow` (all in the same
 * frame). `rigRest * restOffset(rigRest, boneRest)` equals `boneRest`.
 */
export function restOffset(rigRest: Quaternion, boneRest: Quaternion): Quaternion {
  return rigRest.clone().invert().multiply(boneRest);
}
