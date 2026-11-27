/**
 * Static batching: a piece of scenery that never moves on its own (a decor tile, the ground) is
 * built as many small meshes, one draw call each. `mergeStatic` bakes them into one mesh per
 * material, so a tile costs a handful of draw calls instead of a hundred and the scene graph has
 * far fewer objects to update each frame. What can't be merged safely stays as it was:
 * see-through meshes (they need sorting), hidden ones, mirrored ones, multi-material ones and
 * anything that is not a plain mesh.
 */
import { Matrix4, Mesh, type BufferGeometry, type Material, type Object3D } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Merges fewer than this many meshes of a material only when that saves nothing: leave them. */
const MIN_GROUP = 2;

function mergeable(mesh: Mesh): boolean {
  if (!mesh.isMesh || (mesh as { isInstancedMesh?: boolean }).isInstancedMesh) return false;
  if ((mesh as { isSkinnedMesh?: boolean }).isSkinnedMesh) return false;
  if (Array.isArray(mesh.material)) return false;
  const material = mesh.material as Material;
  if (material.transparent) return false;
  if (mesh.renderOrder !== 0 || !mesh.frustumCulled || mesh.children.length > 0) return false;
  if (Object.keys(mesh.userData).length > 0) return false;
  const geometry = mesh.geometry;
  // Groups only matter with an array of materials (boxes carry one per face): they are dropped.
  if (Object.keys(geometry.morphAttributes).length > 0) return false;
  return true;
}

/** Meshes can share a merged geometry only with the same attributes and indexing. */
function signature(geometry: BufferGeometry): string {
  const names = Object.keys(geometry.attributes)
    .sort()
    .map((n) => {
      const a = geometry.attributes[n];
      return `${n}:${a.itemSize}:${a.normalized ? 1 : 0}`;
    });
  return `${geometry.index ? 'i' : 'n'}|${names.join(',')}`;
}

function visibleUpTo(object: Object3D, root: Object3D): boolean {
  for (let o: Object3D | null = object; o && o !== root; o = o.parent) if (!o.visible) return false;
  return root.visible;
}

/**
 * Bakes the plain opaque meshes under `root` into one mesh per material (and attribute layout),
 * placed in `root`'s own space. Returns the new geometries (the caller disposes them). The meshes
 * merged away are removed; their geometries are left alone (they may be shared).
 */
export function mergeStatic(root: Object3D): BufferGeometry[] {
  root.updateMatrixWorld(true);
  const toRoot = new Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map<string, { material: Material; meshes: Mesh[] }>();
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (o === root || !mesh.isMesh || !mergeable(mesh) || !visibleUpTo(mesh, root)) return;
    const matrix = new Matrix4().multiplyMatrices(toRoot, mesh.matrixWorld);
    // A mirrored mesh would turn inside out (its winding flips); keep it as it is.
    if (matrix.determinant() <= 0) return;
    const material = mesh.material as Material;
    const key = `${material.uuid}|${signature(mesh.geometry)}|${mesh.castShadow ? 1 : 0}${mesh.receiveShadow ? 1 : 0}`;
    let group = groups.get(key);
    if (!group) {
      group = { material, meshes: [] };
      groups.set(key, group);
    }
    group.meshes.push(mesh);
  });

  const made: BufferGeometry[] = [];
  for (const { material, meshes } of groups.values()) {
    if (meshes.length < MIN_GROUP) continue;
    const parts = meshes.map((mesh) => {
      const part = mesh.geometry.clone();
      part.clearGroups();
      part.applyMatrix4(new Matrix4().multiplyMatrices(toRoot, mesh.matrixWorld));
      return part;
    });
    const merged = mergeGeometries(parts, false);
    parts.forEach((p) => p.dispose());
    if (!merged) continue;
    merged.computeBoundingSphere();
    const batch = new Mesh(merged, material);
    batch.castShadow = meshes[0].castShadow;
    batch.receiveShadow = meshes[0].receiveShadow;
    batch.matrixAutoUpdate = false;
    root.add(batch);
    made.push(merged);
    for (const mesh of meshes) mesh.removeFromParent();
  }
  // Groups left empty by the merge go too, so the frame's scene walk stays short.
  const empty: Object3D[] = [];
  root.traverse((o) => {
    if (o !== root && o.type === 'Group' && o.children.length === 0) empty.push(o);
  });
  for (const o of empty) o.removeFromParent();
  return made;
}
