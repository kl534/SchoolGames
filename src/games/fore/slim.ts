/**
 * Slims a Quaternius superhero body into an ordinary adult, once per loaded model, in its bind
 * pose: a warp applied to the vertices and the bones together, then the skeleton is re-bound
 * (`calculateInverses`), so the skinning stays exact and the IK has real bone lengths.
 *
 * Chest and spine thickness x and z 0.88, shoulders x 0.85 (the arms move in with them), upper
 * arms, forearms and thighs 0.85 across the bone only. The arms are 1.15 times longer than the
 * pack's, because the hidden rig's grip is farther from the shoulders than a short-armed model
 * can reach.
 */
import { Vector3, type Bone, type SkinnedMesh } from 'three';

export const SLIM = {
  /** Chest and spine, across the body. */
  chest: 0.88,
  /** The hips, a little less than the chest so the trousers still sit on a waist. */
  pelvis: 0.94,
  /** Clavicles and the shoulders they carry: narrower, in x. */
  shoulderX: 0.85,
  /** Upper arms and forearms, across the bone. */
  arm: 0.8,
  /** Along the arm bones. */
  armLength: 1.15,
  /** Thighs, across the bone; calves are a little thinner too. */
  thigh: 0.85,
  calf: 0.9,
} as const;

interface Shape {
  /** The bone's end (the next bone) and what the vertices skinned to it are scaled by. */
  across: number;
  along: number;
  next: string;
}

const SHAPES: Record<string, Shape> = {
  pelvis: { across: SLIM.pelvis, along: 1, next: 'spine_01' },
  spine_01: { across: SLIM.chest, along: 1, next: 'spine_02' },
  spine_02: { across: SLIM.chest, along: 1, next: 'spine_03' },
  spine_03: { across: SLIM.chest, along: 1, next: 'neck_01' },
  thigh_l: { across: SLIM.thigh, along: 1, next: 'calf_l' },
  thigh_r: { across: SLIM.thigh, along: 1, next: 'calf_r' },
  calf_l: { across: SLIM.calf, along: 1, next: 'foot_l' },
  calf_r: { across: SLIM.calf, along: 1, next: 'foot_r' },
  upperarm_l: { across: SLIM.arm, along: SLIM.armLength, next: 'lowerarm_l' },
  upperarm_r: { across: SLIM.arm, along: SLIM.armLength, next: 'lowerarm_r' },
  lowerarm_l: { across: SLIM.arm, along: SLIM.armLength, next: 'hand_l' },
  lowerarm_r: { across: SLIM.arm, along: SLIM.armLength, next: 'hand_r' },
};

/** The bones that move rigidly with the hand. */
const isHandPart = (name: string) =>
  /^(hand|index_\d\d|middle_\d\d|ring_\d\d|pinky_\d\d|thumb_\d\d)(_leaf)?_[lr]$/.test(name);

/** The skinned meshes under `root` that share one skeleton, and that skeleton's bones by name. */
export function bonesOf(root: { traverse(fn: (o: unknown) => void): void }): {
  meshes: SkinnedMesh[];
  bones: Map<string, Bone>;
} {
  const meshes: SkinnedMesh[] = [];
  const bones = new Map<string, Bone>();
  root.traverse((o) => {
    const m = o as SkinnedMesh;
    if (!m.isSkinnedMesh) return;
    meshes.push(m);
    for (const b of m.skeleton.bones) bones.set(b.name, b);
  });
  return { meshes, bones };
}

/** Warps the model (see the file comment). The scene's matrices must be current. */
export function slimBody(root: {
  updateMatrixWorld(force?: boolean): void;
  traverse(fn: (o: unknown) => void): void;
}): void {
  root.updateMatrixWorld(true);
  const { meshes, bones } = bonesOf(root);
  const at = (name: string) => new Vector3().setFromMatrixPosition(bones.get(name)!.matrixWorld);

  // Bind-pose origins and axes of every shaped bone, and where its origin ends up.
  const origin = new Map<string, Vector3>();
  const axisOf = new Map<string, Vector3>();
  const lengthOf = new Map<string, number>();
  const moved = new Map<string, Vector3>();
  for (const [name, s] of Object.entries(SHAPES)) {
    const o = at(name);
    const axis = at(s.next).sub(o);
    origin.set(name, o);
    lengthOf.set(name, axis.length());
    axisOf.set(name, axis.normalize());
  }
  // The shoulder moves in with the clavicle; each arm bone then starts where the one before ends.
  for (const side of ['l', 'r']) {
    const upper = `upperarm_${side}`;
    const lower = `lowerarm_${side}`;
    const hand = `hand_${side}`;
    const o = origin.get(upper)!;
    const shoulder = new Vector3(o.x * SLIM.shoulderX, o.y, o.z);
    moved.set(upper, shoulder);
    moved.set(
      lower,
      shoulder.clone().addScaledVector(axisOf.get(upper)!, lengthOf.get(upper)! * SLIM.armLength),
    );
    moved.set(
      hand,
      moved
        .get(lower)!
        .clone()
        .addScaledVector(axisOf.get(lower)!, lengthOf.get(lower)! * SLIM.armLength),
    );
    origin.set(hand, at(hand));
  }
  for (const [name, o] of origin) if (!moved.has(name)) moved.set(name, o.clone());

  const p = new Vector3();
  const rel = new Vector3();
  const sum = new Vector3();
  const part = new Vector3();
  const names = (m: SkinnedMesh) => m.skeleton.bones.map((b) => b.name);
  const done = new Set<unknown>();
  for (const mesh of meshes) {
    const geo = mesh.geometry;
    if (done.has(geo)) continue;
    done.add(geo);
    const pos = geo.getAttribute('position');
    const index = geo.getAttribute('skinIndex');
    const weight = geo.getAttribute('skinWeight');
    const boneNames = names(mesh);
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i);
      sum.set(0, 0, 0);
      let total = 0;
      for (let k = 0; k < 4; k++) {
        const w = weight.getComponent(i, k);
        if (w <= 0) continue;
        const name = boneNames[index.getComponent(i, k)];
        const shape = SHAPES[name];
        if (shape) {
          const o = origin.get(name)!;
          const axis = axisOf.get(name)!;
          rel.subVectors(p, o);
          const along = rel.dot(axis);
          part.copy(moved.get(name)!).addScaledVector(axis, along * shape.along);
          rel.addScaledVector(axis, -along);
          part.addScaledVector(rel, shape.across);
        } else if (/^clavicle_[lr]$/.test(name)) {
          part.set(p.x * SLIM.shoulderX, p.y, p.z);
        } else if (isHandPart(name)) {
          const side = name.endsWith('_l') ? 'l' : 'r';
          part.copy(p).add(rel.subVectors(moved.get(`hand_${side}`)!, origin.get(`hand_${side}`)!));
        } else {
          part.copy(p);
        }
        sum.addScaledVector(part, w);
        total += w;
      }
      if (total > 0) pos.setXYZ(i, sum.x / total, sum.y / total, sum.z / total);
    }
    pos.needsUpdate = true;
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
  }

  // The bones: the upper arm moves in with the shoulder, the arm bones lengthen along their Y.
  for (const side of ['l', 'r']) {
    const upper = bones.get(`upperarm_${side}`)!;
    const parent = upper.parent!;
    parent.updateWorldMatrix(true, false);
    upper.position.copy(parent.worldToLocal(moved.get(`upperarm_${side}`)!.clone()));
    for (const name of [`lowerarm_${side}`, `hand_${side}`]) {
      bones.get(name)!.position.multiplyScalar(SLIM.armLength);
    }
  }
  root.updateMatrixWorld(true);
  for (const skeleton of new Set(meshes.map((m) => m.skeleton))) {
    skeleton.calculateInverses();
  }
}
