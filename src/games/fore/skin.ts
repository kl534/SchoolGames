/**
 * A realistic skinned body that follows the hidden jointed rig. `createSkinnedPerson` dresses a
 * Quaternius body (slimmed, shirt, trousers, shoes, cap, glove or bib, hair), hides the rig's
 * meshes and, every `update()`, copies the rig's pelvis, chest, neck, head and feet onto the
 * model's bones (rest offsets, `restOffset`) and reaches the model's hands and ankles to the rig's
 * hand and ankle joints with `twoBoneIK`, the rig's elbows and knees as poles. The club stays on
 * the rig's hands, so it is exactly where the swing code puts it.
 */
import {
  Box3,
  CylinderGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
  type Bone,
  type BufferGeometry,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { clothMaterial, CLOTH_PUSH, regionAttribute, type Accent, type Outfit } from './clothes';
import { RIG, type Person } from './person';
import { restOffset, twoBoneIK } from './retarget';
import { bonesOf, slimBody } from './slim';

/** Anything with a `scene` (a loaded GLTF, or a hand-built stand-in in tests). */
export interface ModelSource {
  scene: Object3D;
}

export const GOLFER_OUTFIT: Outfit = {
  shirt: 0x1f2f4f,
  trousers: 0xc9b994,
  shoes: 0xf2f2f2,
  accent: 0xffffff,
  accentOn: true,
};
export const CADDIE_OUTFIT: Outfit = {
  shirt: 0x2f5a3a,
  trousers: 0xb9a46f,
  shoes: 0x4a3f33,
  accent: 0xf4f4f4,
  accentOn: true,
};

export interface SkinOptions {
  outfit: Outfit;
  accent: Accent;
  /** Cap colour; null for a bare head. */
  cap: number | null;
  /** Hairstyles from `hair.glb` (mesh names) and their colour (a beard goes with a haircut). */
  hair: { style: string; colour: number }[];
  /** A tint for the skin (white leaves the picture as it is). */
  skin?: number;
  hairSource: ModelSource | null;
  weave: Texture | null;
  /** Standing height, yards, cap included. */
  height: number;
  /** Eyes and eyebrows (left out of far-off spectators). */
  face: boolean;
}

/** What a skinned person offers the code that poses it. */
export interface Skinned {
  /** The model; a child of `person.root`. */
  root: Group;
  /** Poses the model after `person.apply`. `grip` (0..1) closes the hands round a shaft. */
  update(shaft?: Vector3 | null, grip?: number): void;
  setShadows(on: boolean): void;
  /** How far each shoulder joint slid towards its hand on the last update, model metres. */
  readonly slide: { L: number; R: number; shift: number };
  /**
   * How far (world) the club should move from the rig's hands to sit in the model's, which
   * reach most of the swing exactly and fall a little short at the finish.
   */
  readonly clubShift: Vector3;
  /** Where the model's palm centre is, world, for a side (to check it is on the rig's hand). */
  palm(side: 'L' | 'R', out: Vector3): Vector3;
  dispose(): void;
}

/** The cap sits this far above the skull, metres. */
const CAP_RISE = 0.045;
/** From the wrist bone to the middle of the palm, metres. */
const PALM = 0.06;
/** How the shaft crosses the palm: its angle to the fingers, radians. */
const GRIP_ANGLE = 0.7;
/** The most the model's body is moved to put its shoulders on the rig's, in model metres. */
const MAX_SHIFT = 0.07;
/** The most the club follows the model's hands from the rig's, metres. */
const MAX_CLUB_SHIFT = 0.12;
/** How much of the rig's chest turn each spine bone takes (the rig turns about its pelvis). */
const SPINE_SHARE = [0.6, 0.9] as const;
/** How far a shoulder joint may slide towards a hand that is out of reach, metres. */
const SHOULDER_REACH = 0.07;

interface Template {
  scene: Object3D;
  /** Standing height of the model, metres, cap included. */
  standing: number;
  accent: Accent;
}
const templates = new WeakMap<Object3D, Template>();

function prepare(source: ModelSource, accent: Accent): Template {
  const known = templates.get(source.scene);
  if (known) return known;
  const scene = source.scene;
  scene.updateMatrixWorld(true);
  slimBody(scene);
  const { meshes, bones } = bonesOf(scene);
  const rest = new Map<string, Vector3>();
  for (const [name, bone] of bones)
    rest.set(name, new Vector3().setFromMatrixPosition(bone.matrixWorld));
  let box: Box3 | null = null;
  for (const mesh of meshes) {
    mesh.frustumCulled = false;
    const material = mesh.material as Material;
    if (/Superhero/i.test(material.name)) {
      mesh.geometry.setAttribute(
        'aRegion',
        regionAttribute(mesh.geometry, mesh.skeleton.bones, rest, accent),
      );
      mesh.geometry.computeBoundingBox();
      box = mesh.geometry.boundingBox;
    }
  }
  const standing = box ? box.max.y - box.min.y + CAP_RISE : 1.85;
  const made = { scene, standing, accent };
  templates.set(source.scene, made);
  return made;
}

const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
/** The model's hand hanging with the palm to the thigh: 180 degrees about the bone frame's z. */
const HANG = new Quaternion(0, 0, 1, 0);
const CURLS = [
  ['index', 1.1],
  ['middle', 1.2],
  ['ring', 1.2],
  ['pinky', 1.2],
] as const;

const tmpA = new Vector3();
const tmpB = new Vector3();
const tmpC = new Vector3();
const tmpD = new Vector3();
const qa = new Quaternion();
const qb = new Quaternion();
const qc = new Quaternion();

/** Sets a bone's world rotation (its parent's matrices must be current). */
function setWorldQuat(bone: Bone, world: Quaternion): void {
  const parent = bone.parent!;
  parent.updateWorldMatrix(true, false);
  parent.getWorldQuaternion(qc).invert();
  bone.quaternion.copy(qc).multiply(world);
  bone.updateWorldMatrix(false, false);
}

interface Body {
  root: Group;
  model: Object3D;
  k: number;
  bone(name: string): Bone;
  bones: Map<string, Bone>;
  owned: Material[];
  geometries: BufferGeometry[];
}

/**
 * Clones a prepared body under `parent` (scaled so it stands `options.height` yards tall inside a
 * parent scaled by `parentScale`), dresses it and gives it hair and a cap.
 */
function dressBody(
  source: ModelSource,
  options: SkinOptions,
  parent: Object3D,
  parentScale: number,
): Body {
  const template = prepare(source, options.accent);
  const root = new Group();
  const model = cloneSkinned(template.scene);
  root.add(model);
  parent.add(root);
  const k = options.height / template.standing / parentScale;
  root.scale.setScalar(k);
  parent.updateMatrixWorld(true);

  const { meshes, bones } = bonesOf(model);
  const bone = (name: string) => bones.get(name)!;

  // Materials: the body is dressed; eyes, brows and hair keep the pack's.
  const owned: Material[] = [];
  const own = <T extends Material>(m: T): T => {
    owned.push(m);
    return m;
  };
  for (const mesh of meshes) {
    const material = mesh.material as MeshStandardMaterial;
    if (/Superhero/i.test(material.name)) {
      const m = own(clothMaterial(material, options.outfit, options.weave, CLOTH_PUSH / k));
      if (options.skin !== undefined) m.color.setHex(options.skin);
      mesh.material = m;
    } else if (!options.face) {
      mesh.visible = false;
    } else {
      mesh.material = own(material.clone());
    }
  }

  // Hair and cap ride the head bone.
  const head = bone('Head');
  const geometries: BufferGeometry[] = [];
  for (const style of options.hair) {
    const hair = options.hairSource?.scene.getObjectByName(style.style) as Mesh | undefined;
    if (!hair) continue;
    const material = own((hair.material as MeshStandardMaterial).clone());
    material.color.setHex(style.colour);
    const piece = new Mesh(hair.geometry, material);
    piece.frustumCulled = false;
    head.add(piece);
  }
  if (options.cap !== null) {
    const material = own(new MeshStandardMaterial({ color: options.cap, roughness: 0.7 }));
    // An ellipsoid over the skull (the head is about 0.17 wide, 0.19 deep and 0.23 tall).
    const dome = new SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, 1.38);
    const crown = new Mesh(dome, material);
    crown.scale.set(0.118, 0.172, 0.134);
    crown.position.set(0, 0.104, -0.01);
    const peak = new Mesh(
      new CylinderGeometry(0.105, 0.105, 0.006, 16, 1, false, 0, Math.PI),
      material,
    );
    peak.position.set(0, 0.136, 0.095);
    peak.rotation.set(0.1, -Math.PI / 2, 0);
    head.add(crown, peak);
    geometries.push(dome, peak.geometry);
  }
  return { root, model, k, bone, bones, owned, geometries };
}

export function createSkinnedPerson(
  source: ModelSource,
  person: Person,
  options: SkinOptions,
): Skinned {
  // Hide the rig (its joints still pose and carry the club); the blob shadow stays.
  const hidden: Object3D[] = [];
  person.root.traverse((o) => {
    const m = o as Mesh;
    if (m.isMesh && m.name !== 'blob' && m.visible) {
      m.visible = false;
      hidden.push(m);
    }
  });
  const { root, model, bone, bones, owned, geometries } = dressBody(
    source,
    options,
    person.root,
    person.scale,
  );

  // ----- Rest data -----
  model.updateMatrixWorld(true);
  const restWorldQ = (b: Bone, out = new Quaternion()) => b.getWorldQuaternion(out);
  const names = [
    'pelvis',
    'spine_01',
    'spine_02',
    'spine_03',
    'neck_01',
    'Head',
    'foot_l',
    'foot_r',
  ];
  // The model's rest turns, against the rig's, which are the identity (neutral, upright and
  // facing +z) relative to its root, so the root's own turn cancels out.
  const rootQ0 = person.root.getWorldQuaternion(new Quaternion()).invert();
  const restQ = new Map<string, Quaternion>(
    names.map((n) => [
      n,
      restOffset(new Quaternion(), rootQ0.clone().multiply(restWorldQ(bone(n)))),
    ]),
  );
  const localRest = new Map<string, Quaternion>();
  const localPos = new Map<string, Vector3>();
  for (const b of bones.values()) {
    localRest.set(b.name, b.quaternion.clone());
    localPos.set(b.name, b.position.clone());
  }
  const hipMid = tmpA
    .copy(bone('thigh_l').getWorldPosition(tmpB))
    .add(bone('thigh_r').getWorldPosition(tmpC))
    .multiplyScalar(0.5);
  const hipLocal = bone('pelvis').worldToLocal(hipMid.clone());
  const hipHeight = hipMid.y;
  const rootScale = person.root.getWorldScale(new Vector3()).x;
  // The model's hips are wider than the rig's, yards.
  const hipExtra =
    bone('thigh_l')
      .getWorldPosition(new Vector3())
      .distanceTo(bone('thigh_r').getWorldPosition(new Vector3())) /
      2 -
    RIG.hipX * rootScale;
  const groundY0 = person.root.getWorldPosition(new Vector3()).y;
  // The model's hips stand higher than the rig's (its legs are longer, its trunk shorter).
  const hipRaise = hipHeight - groundY0 - RIG.hipY * rootScale;
  const modelAnkle = bone('foot_l').getWorldPosition(new Vector3()).y - groundY0;
  // The rig's ankle stands hipY - thigh - shin above its feet, times its scale.
  const rigAnkle = (RIG.hipY - RIG.thigh - RIG.shin) * person.root.getWorldScale(new Vector3()).y;

  // Finger curl axes: the hand's z (the thumb's side) at rest, in each finger bone's frame.
  const fingers: { bone: Bone; axis: Vector3; amount: number; left: boolean }[] = [];
  for (const side of ['l', 'r']) {
    const hand = bone(`hand_${side}`);
    const handQ = hand.getWorldQuaternion(new Quaternion());
    const z = Z.clone().applyQuaternion(handQ);
    for (const [name, amount] of CURLS) {
      for (let i = 1; i <= 3; i++) {
        const f = bones.get(`${name}_0${i}_${side}`);
        if (!f) continue;
        const axis = z.clone().applyQuaternion(f.getWorldQuaternion(qa).invert());
        fingers.push({ bone: f, axis, amount: amount / 1.2, left: side === 'l' });
      }
    }
  }

  // ----- Per frame -----
  const rigQ = new Quaternion();
  const rigQ2 = new Quaternion();
  const want = new Quaternion();
  const upper = new Vector3();
  const mid = new Vector3();
  const end = new Vector3();
  const target = new Vector3();
  const pole = new Vector3();
  const shaftDir = new Vector3();
  const palmN = new Vector3();
  const handY = new Vector3();
  const handX = new Vector3();
  const handZ = new Vector3();
  const gripQ = new Quaternion();
  const followQ = new Quaternion();
  const finalQ = new Quaternion();
  const m4 = new Matrix4();
  const worldScale = new Vector3();
  let kw = 1;
  const slid = { L: 0, R: 0, shift: 0 };
  const shift = new Vector3();
  const tmpOffset = new Vector3();
  const sideway = new Vector3();
  const forward = new Vector3();
  const rootQ = new Quaternion();

  const lean = (to: Bone, a: number) => {
    rigQ.copy(person.pelvis.getWorldQuaternion(rigQ2));
    person.torso.getWorldQuaternion(want);
    rigQ.slerp(want, a);
    want.copy(rigQ).multiply(restQ.get(to.name)!);
    setWorldQuat(to, want);
  };

  const reachLimb = (
    rootBone: Bone,
    midBone: Bone,
    endBone: Bone,
    goal: Vector3,
    elbowAt: Vector3,
    assist = 0,
  ) => {
    rootBone.quaternion.copy(localRest.get(rootBone.name)!);
    midBone.quaternion.copy(localRest.get(midBone.name)!);
    rootBone.position.copy(localPos.get(rootBone.name)!);
    rootBone.updateWorldMatrix(true, true);
    rootBone.getWorldPosition(upper);
    midBone.getWorldPosition(mid);
    endBone.getWorldPosition(end);
    if (assist > 0) {
      // A shoulder reaches forward a little: when the arm falls short, the joint moves towards
      // the hand by the shortfall (up to `assist` metres), as a blade slides round the ribs.
      const limb = upper.distanceTo(mid) + mid.distanceTo(end);
      const short = upper.distanceTo(goal) - limb * 0.995;
      if (short > 0) {
        const slide = Math.min(short, assist * kw);
        slid[rootBone.name.endsWith('_l') ? 'L' : 'R'] = slide / kw;
        tmpA.subVectors(goal, upper).normalize().multiplyScalar(slide);
        upper.add(tmpA);
        rootBone.parent!.updateWorldMatrix(true, false);
        rootBone.position.copy(rootBone.parent!.worldToLocal(upper.clone()));
        rootBone.updateWorldMatrix(true, true);
        midBone.getWorldPosition(mid);
        endBone.getWorldPosition(end);
      }
    }
    const [dRoot, dMid] = twoBoneIK(upper, mid, end, goal, elbowAt);
    rootBone.getWorldQuaternion(qa);
    midBone.getWorldQuaternion(qb);
    setWorldQuat(rootBone, rigQ.copy(dRoot).multiply(qa));
    setWorldQuat(midBone, rigQ2.copy(dMid).multiply(dRoot).multiply(qb));
  };

  const palmAt = (side: 'L' | 'R', out: Vector3) => {
    const hand = bone(side === 'L' ? 'hand_l' : 'hand_r');
    hand.updateWorldMatrix(true, false);
    hand.getWorldPosition(out);
    const y = tmpC.set(0, 1, 0).applyQuaternion(hand.getWorldQuaternion(qa));
    root.getWorldScale(worldScale);
    return out.addScaledVector(y, PALM * worldScale.x);
  };

  const update = (shaft: Vector3 | null = null, grip = 0) => {
    person.root.updateMatrixWorld(true);
    person.root.getWorldQuaternion(rootQ);
    slid.L = slid.R = 0;
    shift.set(0, 0, 0);
    root.getWorldScale(worldScale);
    kw = worldScale.x;

    // Pelvis: turn it, then stand it so the model's hips are on the rig's.
    const pelvis = bone('pelvis');
    person.pelvis.getWorldQuaternion(rigQ);
    want.copy(rigQ).multiply(restQ.get('pelvis')!);
    setWorldQuat(pelvis, want);
    person.pelvis.getWorldPosition(tmpA);
    tmpA.y += hipRaise;
    tmpB.copy(hipLocal).multiplyScalar(kw).applyQuaternion(want);
    tmpA.sub(tmpB);
    pelvis.parent!.updateWorldMatrix(true, false);
    pelvis.position.copy(pelvis.parent!.worldToLocal(tmpA));
    pelvis.updateWorldMatrix(false, false);

    // Spine: the chest turn shared over three bones; neck and head follow the rig's head.
    lean(bone('spine_01'), SPINE_SHARE[0]);
    lean(bone('spine_02'), SPINE_SHARE[1]);
    lean(bone('spine_03'), 1);
    person.head.getWorldQuaternion(rigQ);
    person.torso.getWorldQuaternion(rigQ2);
    rigQ2.slerp(rigQ, 0.5);
    want.copy(rigQ2).multiply(restQ.get('neck_01')!);
    setWorldQuat(bone('neck_01'), want);
    want.copy(rigQ).multiply(restQ.get('Head')!);
    setWorldQuat(bone('Head'), want);
    model.updateMatrixWorld(true);

    // The hands' reach is measured from the rig's shoulders, so the model's go where the rig's
    // are (the hips give a few centimetres; the legs' reach to the rig's ankles takes it up).
    person.shoulderL.getWorldPosition(tmpA).add(person.shoulderR.getWorldPosition(tmpB));
    bone('upperarm_l').getWorldPosition(tmpC).add(bone('upperarm_r').getWorldPosition(tmpD));
    tmpA.sub(tmpC).multiplyScalar(0.5);
    tmpA.y = 0;
    slid.shift = tmpA.length() / kw;
    if (tmpA.length() > MAX_SHIFT * kw) tmpA.setLength(MAX_SHIFT * kw);
    pelvis.getWorldPosition(tmpB).add(tmpA);
    pelvis.parent!.updateWorldMatrix(true, false);
    pelvis.position.copy(pelvis.parent!.worldToLocal(tmpB));
    model.updateMatrixWorld(true);

    // Legs: ankles on the rig's, knees towards its knees, feet turned as its feet.
    for (const side of ['L', 'R'] as const) {
      const s = side.toLowerCase();
      const leg = person.legs[side];
      leg.ankle.getWorldPosition(target);
      target.y += modelAnkle - rigAnkle;
      // The model's hips are wider than the rig's: the feet stand as wide, or the legs cross.
      target.addScaledVector(
        sideway.set(side === 'L' ? 1 : -1, 0, 0).applyQuaternion(rootQ),
        hipExtra,
      );
      // Knee towards where the rig's bends: its offset from the hip-ankle line (and a little
      // forward, so a straight rig leg still bends the model's the right way).
      leg.hip.getWorldPosition(tmpD);
      leg.ankle.getWorldPosition(tmpA);
      leg.knee.getWorldPosition(pole).addScaledVector(tmpD.add(tmpA), -0.5);
      bone(`thigh_${s}`).getWorldPosition(tmpB);
      pole.addScaledVector(tmpB.add(target), 0.5);
      pole.addScaledVector(forward.set(0, 0, 1).applyQuaternion(rootQ), 0.2);
      reachLimb(bone(`thigh_${s}`), bone(`calf_${s}`), bone(`foot_${s}`), target, pole);
      leg.ankle.getWorldQuaternion(rigQ);
      want.copy(rigQ).multiply(restQ.get(`foot_${s}`)!);
      setWorldQuat(bone(`foot_${s}`), want);
    }

    // Arms: the wrist goes where the palm must be so the palm centre is on the rig's hand (moved
    // by `offset`, the common error the first pass leaves, so each hand is within a few
    // centimetres of the club at the finish too).
    const arms = (offset: Vector3) => {
      for (const side of ['L', 'R'] as const) {
        const s = side.toLowerCase();
        const hand = bone(`hand_${s}`);
        const rigHand = side === 'L' ? person.handL : person.handR;
        const elbow = side === 'L' ? person.elbowL : person.elbowR;
        person.handWorld(side, tmpD);
        const palmGoal = tmpD.clone().add(offset);
        elbow.getWorldPosition(pole);
        // The hand direction: along the forearm unless a shaft is held.
        handY.subVectors(palmGoal, pole).normalize();
        let finalQuat: Quaternion;
        for (let pass = 0; pass < 2; pass++) {
          target.copy(palmGoal).addScaledVector(handY, -PALM * kw);
          reachLimb(
            bone(`upperarm_${s}`),
            bone(`lowerarm_${s}`),
            hand,
            target,
            pole,
            SHOULDER_REACH,
          );
          // Hanging orientation, following the rig's hand.
          rigHand.getWorldQuaternion(rigQ);
          followQ.copy(rigQ).multiply(HANG);
          finalQuat = followQ;
          if (shaft && grip > 0) {
            // Palm to the shaft: left palm faces the trail side, right palm the target.
            person.root.getWorldQuaternion(qa);
            palmN.set(side === 'L' ? -1 : 1, 0, 0).applyQuaternion(qa);
            shaftDir.copy(shaft);
            shaftDir.addScaledVector(palmN, -shaftDir.dot(palmN)).normalize();
            tmpA.crossVectors(palmN, shaftDir);
            // Fingers lie across the shaft, turned from it towards the ground.
            const a = Math.cos(GRIP_ANGLE);
            const b = Math.sin(GRIP_ANGLE);
            handY.copy(shaftDir).multiplyScalar(a).addScaledVector(tmpA, b);
            tmpB.copy(shaftDir).multiplyScalar(a).addScaledVector(tmpA, -b);
            if (tmpB.y < handY.y) handY.copy(tmpB);
            handY.normalize();
            handX.copy(palmN).multiplyScalar(side === 'L' ? 1 : -1);
            handZ.crossVectors(handX, handY);
            m4.makeBasis(handX, handY, handZ);
            gripQ.setFromRotationMatrix(m4);
            finalQuat = finalQ.copy(followQ).slerp(gripQ, Math.min(grip, 1));
          }
          handY.set(0, 1, 0).applyQuaternion(finalQuat);
        }
        // The forearm takes half of the hand's roll about its own axis; the wrist the rest.
        const fore = bone(`lowerarm_${s}`);
        fore.getWorldQuaternion(qa);
        qb.copy(qa).invert().multiply(finalQuat!);
        const roll = 2 * Math.atan2(qb.y, qb.w);
        qc.setFromAxisAngle(Y, roll * 0.5);
        setWorldQuat(fore, qa.multiply(qc));
        setWorldQuat(hand, finalQuat!);
        // Fingers curl round the grip; at rest they hang a little curled.
        const g = shaft ? Math.min(grip, 1) : 0;
        for (const f of fingers) {
          if (f.left !== (side === 'L')) continue;
          const angle = (0.25 + 0.95 * g) * f.amount;
          f.bone.quaternion.copy(localRest.get(f.bone.name)!);
          f.bone.quaternion.multiply(qa.setFromAxisAngle(f.axis, f.left ? -angle : angle));
        }
        hand.updateWorldMatrix(false, true);
      }
      model.updateMatrixWorld(true);
    };
    arms(tmpOffset.set(0, 0, 0));
    // The palms' mean error against the rig's hands moves the goals (and the club) with them.
    for (const side of ['L', 'R'] as const) {
      palmAt(side, tmpA);
      person.handWorld(side, tmpB);
      shift.add(tmpA.sub(tmpB));
    }
    shift.multiplyScalar(0.5);
    if (shift.length() > 0.004) {
      shift.clampLength(0, MAX_CLUB_SHIFT * kw);
      arms(tmpOffset.copy(shift));
    } else shift.set(0, 0, 0);
  };

  return {
    root,
    update,
    slide: slid,
    setShadows(on) {
      root.traverse((o) => {
        if ((o as Mesh).isMesh && o.visible) o.castShadow = on;
      });
    },
    palm: (side, out) => palmAt(side, out),
    clubShift: shift,
    dispose() {
      owned.forEach((m) => m.dispose());
      geometries.forEach((g) => g.dispose());
      root.removeFromParent();
      hidden.forEach((o) => (o.visible = true));
    },
  };
}

/** A spectator: a dressed body that stands with its arms down, sways and can clap. */
export interface Spectator {
  /** At the feet; turn it with `rotation.y` (0 faces +z). */
  root: Group;
  /** `clap` is how far into a clap it is (0 none, 1 full) and `since` seconds since it began. */
  pose(t: number, clap: number, since: number): void;
  dispose(): void;
}

export interface SpectatorOptions extends SkinOptions {
  /** Where in its sway this one is (radians) and how fast (Hz, 0.2 to 0.4). */
  phase: number;
  rate: number;
}

const SWAY = (3 * Math.PI) / 180;
const CLAP_SWING = (25 * Math.PI) / 180;
const CLAP_HZ = 3;
const AX = new Vector3(1, 0, 0);
const AY = new Vector3(0, 1, 0);
const AZ = new Vector3(0, 0, 1);

export function createSpectator(source: ModelSource, options: SpectatorOptions): Spectator {
  const holder = new Group();
  const { root, model, bone, owned, geometries } = dressBody(source, options, holder, 1);
  model.updateMatrixWorld(true);
  const worldQ = (b: Object3D) => b.getWorldQuaternion(new Quaternion());
  const spine = bone('spine_02');
  const spineRest = spine.quaternion.clone();
  const arms = (['l', 'r'] as const).map((s) => {
    const upper = bone(`upperarm_${s}`);
    const fore = bone(`lowerarm_${s}`);
    return {
      left: s === 'l',
      upper,
      fore,
      upperQ: worldQ(upper),
      foreQ: worldQ(fore),
      parentQ: worldQ(upper.parent!),
    };
  });
  const q1 = new Quaternion();
  const q2 = new Quaternion();
  const q3 = new Quaternion();
  const pose = (t: number, clap: number, since: number) => {
    spine.quaternion
      .copy(spineRest)
      .multiply(
        q1.setFromAxisAngle(AZ, Math.sin(t * Math.PI * 2 * options.rate + options.phase) * SWAY),
      );
    for (const a of arms) {
      const side = a.left ? -1 : 1;
      // Arms hang (about 75 degrees down from the bind pose's T), the forearms a little forward;
      // a clap lifts the elbows forward and the forearms up and together.
      const down = q1.setFromAxisAngle(AZ, side * 1.3);
      const lift = q2.setFromAxisAngle(AX, -0.7 * clap);
      const upperWorld = new Quaternion().copy(lift).multiply(down).multiply(a.upperQ);
      a.upper.quaternion.copy(q3.copy(a.parentQ).invert()).multiply(upperWorld);
      const yaw = side * (0.5 * clap + clap * CLAP_SWING * Math.sin(since * Math.PI * 2 * CLAP_HZ));
      const bend = q3.setFromAxisAngle(AX, -(0.35 + 1.0 * clap));
      const turn = new Quaternion().setFromAxisAngle(AY, yaw);
      const foreWorld = turn.multiply(bend).multiply(down).multiply(a.foreQ);
      a.fore.quaternion.copy(upperWorld.invert()).multiply(foreWorld);
    }
  };
  pose(0, 0, 0);
  return {
    root: holder,
    pose,
    dispose() {
      owned.forEach((m) => m.dispose());
      geometries.forEach((g) => g.dispose());
      root.removeFromParent();
    },
  };
}
