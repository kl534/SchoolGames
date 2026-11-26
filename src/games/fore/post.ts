/**
 * The post-processing chain for the medium and high tiers: a multisampled half-float target, then
 * ambient occlusion (high), bloom, depth of field (high, only while it is wanted) and the tone-map
 * output. The low tier skips all of it and renders straight to the screen.
 */
import {
  HalfFloatType,
  Vector2,
  WebGLRenderTarget,
  type Camera,
  type Scene,
  type WebGLRenderer,
} from 'three';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import type { GfxSettings } from './quality';

/** The depth-of-field numbers at full strength, and how long it takes to ease in or out. */
export const DOF_APERTURE = 0.0006;
export const DOF_MAXBLUR = 0.008;
export const DOF_EASE_SECONDS = 0.3;

/**
 * Bloom starts at this brightness (linear, before exposure). The doc's 0.92 veils every sunlit
 * lawn under this sun, so only the tracer and sun glints, which are brighter, bloom.
 */
export const BLOOM_THRESHOLD = 1.6;

export interface Post {
  /** Renders one frame through the chain. */
  render(delta: number): void;
  /** Resizes every pass; `width` x `height` in CSS pixels. */
  setSize(width: number, height: number): void;
  /** Depth of field on or off, focused `focus` yards from the camera (eased in over 0.3 s). */
  setDof(on: boolean, focus: number): void;
  dispose(): void;
}

export function createPost(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: Camera,
  s: GfxSettings,
  width: number,
  height: number,
): Post {
  const ratio = renderer.getPixelRatio();
  const target = new WebGLRenderTarget(width * ratio, height * ratio, {
    type: HalfFloatType,
    samples: s.msaa,
  });
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(ratio);
  composer.setSize(width, height);
  composer.addPass(new RenderPass(scene, camera));

  let ao: GTAOPass | null = null;
  if (s.ao) {
    ao = new GTAOPass(scene, camera, width, height);
    ao.updateGtaoMaterial({ radius: 0.6, scale: 0.9 });
    ao.blendIntensity = 0.9;
    composer.addPass(ao);
  }
  let bloom: UnrealBloomPass | null = null;
  if (s.bloom) {
    bloom = new UnrealBloomPass(new Vector2(width, height), 0.25, 0.4, BLOOM_THRESHOLD);
    composer.addPass(bloom);
  }
  let bokeh: BokehPass | null = null;
  let bokehUniforms: Record<string, { value: number }> = {};
  if (s.dof) {
    bokeh = new BokehPass(scene, camera, { focus: 5, aperture: 0, maxblur: 0 });
    bokehUniforms = bokeh.uniforms as Record<string, { value: number }>;
    bokeh.enabled = false;
    composer.addPass(bokeh);
  }
  composer.addPass(new OutputPass());

  let wantDof = false;
  let amount = 0;
  return {
    render(delta) {
      if (bokeh) {
        const goal = wantDof ? 1 : 0;
        const step = delta / DOF_EASE_SECONDS;
        amount = amount < goal ? Math.min(goal, amount + step) : Math.max(goal, amount - step);
        bokeh.enabled = amount > 0.01;
        bokehUniforms['aperture'].value = DOF_APERTURE * amount;
        bokehUniforms['maxblur'].value = DOF_MAXBLUR * amount;
      }
      composer.render(delta);
    },
    setSize(w, h) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
      ao?.setSize(w, h);
      bloom?.setSize(w, h);
    },
    setDof(on, focus) {
      wantDof = on && !!bokeh;
      if (bokeh) bokehUniforms['focus'].value = focus;
    },
    dispose() {
      composer.passes.forEach((p) => p.dispose?.());
      composer.renderTarget1.dispose();
      composer.renderTarget2.dispose();
    },
  };
}
