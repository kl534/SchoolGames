/**
 * Fur: a standard material with a soft rim of light at the silhouette, so the cat glows a little
 * against any background. All fur materials share one shader program.
 */
import { Color, MeshStandardMaterial } from 'three';

export const RIM_STRENGTH = 0.4;
/** How far towards white the rim colour is lightened. */
const RIM_LIGHTEN = 0.35;

export interface FurMaterial extends MeshStandardMaterial {
  /** Sets the rim colour from the fur colour (lightened). Call it whenever `color` changes. */
  setRim(color: Color): void;
}

export function furMaterial(params: { roughness?: number } = {}): FurMaterial {
  const rim = new Color(1, 1, 1);
  const material = new MeshStandardMaterial({ roughness: params.roughness ?? 0.8 }) as FurMaterial;
  material.setRim = (color) => {
    rim.copy(color).lerp(new Color(1, 1, 1), RIM_LIGHTEN);
  };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRimColor = { value: rim };
    shader.uniforms.uRimStrength = { value: RIM_STRENGTH };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        'uniform vec3 uRimColor;\nuniform float uRimStrength;\nvoid main() {',
      )
      .replace(
        '#include <opaque_fragment>',
        `outgoingLight += uRimColor * pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 2.5) * uRimStrength;
#include <opaque_fragment>`,
      );
  };
  material.customProgramCacheKey = () => 'cat-fur-rim';
  return material;
}
