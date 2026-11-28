/**
 * Clothes for the bare Quaternius bodies: each vertex gets a weight for shirt, trousers, shoes and
 * an accent (the golfer's glove, the caddie's bib) from the bones that skin it, and a standard
 * material paints those regions in flat cloth colours with a woven normal, roughness to suit and
 * the cloth pushed 0.008 yd out of the skin so no skin shows through at a bend.
 */
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  ShaderChunk,
  Vector3,
  type MeshStandardMaterial,
  type Texture,
  type WebGLProgramParametersWithUniforms,
} from 'three';

export type Accent = 'glove' | 'bib';

export interface Outfit {
  shirt: number;
  trousers: number;
  shoes: number;
  /** The glove or bib colour. */
  accent: number;
  /** Whether the accent is worn at all (spectators wear neither). */
  accentOn: boolean;
  /** The accent is a loose bib (pushed out and smoothed), not a glove. */
  bib?: boolean;
}

/** How far cloth stands off the skin, yards. */
export const CLOTH_PUSH = 0.008;
/** Repeats of the cloth normal picture over the body's UVs. */
const WEAVE_REPEAT = 9;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/** The shoulder joint's distance from the middle on the body the bib was tuned on. */
const BIB_SHOULDER = 0.129;

/**
 * Per-vertex region weights as a 4-component attribute (shirt, trousers, shoes, accent). `bones`
 * are the skeleton's bones in order, `rest` the bind-pose positions of the upper arms and elbows
 * (by bone name) that split the sleeve at mid upper arm.
 */
export function regionAttribute(
  geometry: BufferGeometry,
  bones: { name: string }[],
  rest: Map<string, Vector3>,
  accent: Accent,
): Float32BufferAttribute {
  const index = geometry.getAttribute('skinIndex');
  const weight = geometry.getAttribute('skinWeight');
  const pos = geometry.getAttribute('position');
  const out = new Float32Array(pos.count * 4);
  const axis = new Vector3();
  const v = new Vector3();
  // The bib's side edges scale with the shoulders, so it fits a broad body as well as a narrow one
  // (tuned on the female body, shoulder joint 0.129 out: edges 0.1 to 0.16).
  const shoulder = Math.abs(rest.get('upperarm_l')?.x ?? BIB_SHOULDER);
  const bibIn = (0.1 / BIB_SHOULDER) * shoulder;
  const bibOut = (0.16 / BIB_SHOULDER) * shoulder;
  for (let i = 0; i < pos.count; i++) {
    let shirt = 0;
    let trousers = 0;
    let shoes = 0;
    let acc = 0;
    v.fromBufferAttribute(pos, i);
    for (let k = 0; k < 4; k++) {
      const w = weight.getComponent(i, k);
      if (w <= 0) continue;
      const name = bones[index.getComponent(i, k)].name;
      if (/^(spine_0[123]|clavicle_[lr])$/.test(name)) {
        shirt += w;
        if (accent === 'bib' && /^spine_0[23]$/.test(name))
          acc += w * (1 - smooth(bibIn, bibOut, Math.abs(v.x)));
      } else if (/^upperarm_[lr]$/.test(name)) {
        const from = rest.get(name);
        const to = rest.get(name.replace('upperarm', 'lowerarm'));
        let t = 0;
        if (from && to) {
          axis.subVectors(to, from);
          t = v.sub(from).dot(axis) / axis.lengthSq();
        }
        shirt += w * (1 - smooth(0.4, 0.6, t));
      } else if (/^(pelvis|thigh_[lr]|calf_[lr])$/.test(name)) {
        trousers += w;
      } else if (/^(foot|ball|ball_leaf)_[lr]$/.test(name)) {
        shoes += w;
      } else if (
        accent === 'glove' &&
        /^(hand|index_\d\d|middle_\d\d|ring_\d\d|pinky_\d\d|thumb_\d\d)(_leaf)?_l$/.test(name)
      ) {
        acc += w;
      }
    }
    out.set([shirt, trousers, shoes, acc], i * 4);
  }
  return new Float32BufferAttribute(out, 4);
}

/**
 * A copy of `source` that paints the regions in the outfit's colours. `weave` is the cloth normal
 * picture (none: plain cloth); `push` is the cloth's stand-off in the mesh's own units.
 */
export function clothMaterial(
  source: MeshStandardMaterial,
  outfit: Outfit,
  weave: Texture | null,
  push: number,
): MeshStandardMaterial {
  const m = source.clone();
  // The pack's muscle lines are in the skin picture: show them less.
  m.normalScale.multiplyScalar(0.5);
  const uniforms = {
    uShirt: { value: new Color(outfit.shirt) },
    uTrousers: { value: new Color(outfit.trousers) },
    uShoes: { value: new Color(outfit.shoes) },
    uAccent: { value: new Color(outfit.accent) },
    uAccentOn: { value: outfit.accentOn ? 1 : 0 },
    uWeave: { value: weave },
    uWeaveOn: { value: weave ? 1 : 0 },
    uPush: { value: push },
    uBib: { value: outfit.bib ? 1 : 0 },
  };
  m.userData.cloth = uniforms;
  const patched = ShaderChunk.normal_fragment_maps.replace(
    'mapN.xy *= normalScale;',
    `mapN.xy *= normalScale * (1.0 - 0.8 * gCloth);
	{
		vec2 weave = texture2D( uWeave, vNormalMapUv * ${WEAVE_REPEAT}.0 ).xy * 2.0 - 1.0;
		mapN.xy += weave * 0.9 * gCloth * uWeaveOn;
	}`,
  );
  m.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        'void main() {',
        'attribute vec4 aRegion;\nvarying vec4 vRegion;\nuniform float uPush;\nuniform float uBib;\nvoid main() {',
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
	float bibW = smoothstep( 0.35, 0.65, aRegion.w ) * uBib;
	vec3 origNormal = objectNormal;
	vec3 flatN = normalize( vec3( objectNormal.x * 0.35, objectNormal.y * 0.2, objectNormal.z >= 0.0 ? 1.0 : -1.0 ) );
	objectNormal = normalize( mix( objectNormal, flatN, 0.9 * bibW ) );`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
	vRegion = aRegion;
	float cloth = max( smoothstep( 0.35, 0.65, aRegion.x ), 3.5 * smoothstep( 0.35, 0.65, aRegion.y ) );
	vec3 nrm = normalize( origNormal );
	transformed += normalize( mix( nrm, flatN, bibW ) ) * uPush * max( cloth, bibW * 5.0 );
	// Hang it like a tabard: the bust is smoothed towards a plane in front, and one behind.
	float plane = nrm.z >= 0.0 ? 0.1 : -0.08;
	transformed.z = mix( transformed.z, plane, 0.85 * bibW );`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        `varying vec4 vRegion;
uniform vec3 uShirt;
uniform vec3 uTrousers;
uniform vec3 uShoes;
uniform vec3 uAccent;
uniform float uAccentOn;
uniform sampler2D uWeave;
uniform float uWeaveOn;
float gCloth = 0.0;
float gShoe = 0.0;
void main() {`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
	{
		float mS = smoothstep( 0.4, 0.6, vRegion.x );
		float mT = smoothstep( 0.4, 0.6, vRegion.y );
		float mH = smoothstep( 0.4, 0.6, vRegion.z );
		float mA = smoothstep( 0.4, 0.6, vRegion.w ) * uAccentOn;
		vec3 c = diffuseColor.rgb;
		c = mix( c, uShirt, mS );
		c = mix( c, uTrousers, mT );
		c = mix( c, uShoes, mH );
		c = mix( c, uAccent, mA );
		diffuseColor.rgb = c;
		gCloth = max( max( mS, mT ), mA );
		gShoe = mH;
	}`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
	roughnessFactor = mix( roughnessFactor, 0.85, gCloth );
	roughnessFactor = mix( roughnessFactor, 0.5, gShoe );`,
      )
      .replace('#include <normal_fragment_maps>', patched);
  };
  m.customProgramCacheKey = () => 'fore-cloth';
  return m;
}

/** Sets the colours of a cloth material made by `clothMaterial`. */
export function dress(m: MeshStandardMaterial, outfit: Outfit): void {
  const u = m.userData.cloth as Record<string, { value: Color | number }>;
  (u.uShirt.value as Color).setHex(outfit.shirt);
  (u.uTrousers.value as Color).setHex(outfit.trousers);
  (u.uShoes.value as Color).setHex(outfit.shoes);
  (u.uAccent.value as Color).setHex(outfit.accent);
  u.uAccentOn.value = outfit.accentOn ? 1 : 0;
}
