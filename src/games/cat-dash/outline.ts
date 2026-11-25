/**
 * Ink outlines by the inverted hull trick: a smooth-normal copy of each mesh, drawn inside out and
 * pushed out by a constant number of screen pixels. Hulls are children of their mesh, so they
 * follow it and hide with it.
 */
import {
  BackSide,
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  ShaderMaterial,
  Vector2,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export const OUTLINE_COLOR = 0x2a1a33;
export const OUTLINE_CAT_PX = 2.5;
export const OUTLINE_PROP_PX = 2;

export interface Outline {
  setVisible(on: boolean): void;
  dispose(): void;
}

/** Meshes thinner than this (after scale) get no outline: whiskers, glints. */
const MIN_SIZE = 0.02;

const VERTEX = /* glsl */ `
uniform vec2 uResolution;
uniform float uWidth;
void main() {
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vec2 dir = normalize((projectionMatrix * vec4(normalize(normalMatrix * normal), 0.0)).xy);
  clip.xy += dir * uWidth * 2.0 / uResolution * clip.w;
  gl_Position = clip;
}
`;

const FRAGMENT = /* glsl */ `
uniform vec3 uColor;
void main() {
  gl_FragColor = vec4(uColor, 1.0);
  #include <colorspace_fragment>
}
`;

const materials = new Map<number, ShaderMaterial>();
const resolution = new Vector2(1, 1);
let pixelRatio = 1;

function materialFor(px: number): ShaderMaterial {
  let m = materials.get(px);
  if (!m) {
    m = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        uColor: { value: new Color(OUTLINE_COLOR) },
        uResolution: { value: resolution },
        uWidth: { value: px * pixelRatio },
      },
      side: BackSide,
    });
    materials.set(px, m);
  }
  return m;
}

/** Tells every outline the drawing-buffer size (px) and pixel ratio; call it each frame. */
export function setOutlineView(width: number, height: number, ratio: number): void {
  resolution.set(Math.max(width, 1), Math.max(height, 1));
  pixelRatio = ratio;
  for (const [px, m] of materials) m.uniforms.uWidth.value = px * ratio;
}

function outlined(mesh: Mesh): boolean {
  const material = mesh.material as Material | Material[];
  if (Array.isArray(material)) return false;
  if (material.transparent || material instanceof MeshBasicMaterial || material.side === DoubleSide)
    return false;
  const geometry = mesh.geometry;
  if (geometry instanceof PlaneGeometry) return false;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) return false;
  const s = mesh.scale;
  const smallest = Math.min(
    (box.max.x - box.min.x) * Math.abs(s.x),
    (box.max.y - box.min.y) * Math.abs(s.y),
    (box.max.z - box.min.z) * Math.abs(s.z),
  );
  return smallest >= MIN_SIZE;
}

function smoothCopy(source: BufferGeometry): BufferGeometry {
  const copy = source.clone();
  copy.deleteAttribute('normal');
  copy.deleteAttribute('uv');
  const merged = mergeVertices(copy);
  merged.computeVertexNormals();
  return merged;
}

export function addOutline(root: Object3D, px: number): Outline {
  const sources: Mesh[] = [];
  root.traverse((o) => {
    if ((o as Mesh).isMesh && !o.userData.outlineHull && outlined(o as Mesh))
      sources.push(o as Mesh);
  });
  const cache = new Map<BufferGeometry, BufferGeometry>();
  const hulls: Mesh[] = [];
  const material = materialFor(px);
  for (const mesh of sources) {
    let geometry = cache.get(mesh.geometry);
    if (!geometry) {
      geometry = smoothCopy(mesh.geometry);
      cache.set(mesh.geometry, geometry);
    }
    const hull = new Mesh(geometry, material);
    hull.userData.outlineHull = true;
    hull.castShadow = false;
    hull.receiveShadow = false;
    mesh.add(hull);
    hulls.push(hull);
  }
  return {
    setVisible(on) {
      for (const h of hulls) h.visible = on;
    },
    dispose() {
      for (const h of hulls) h.removeFromParent();
      hulls.length = 0;
      for (const g of cache.values()) g.dispose();
      cache.clear();
    },
  };
}
