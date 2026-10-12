import { AudioLoader, LoadingManager, Texture, TextureLoader } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** Called with a 0..1 fraction as assets finish loading. */
export type ProgressCallback = (progress: number) => void;

export interface AssetLoader {
  loadGLTF(url: string): Promise<GLTF>;
  loadTexture(url: string): Promise<Texture>;
  loadAudio(url: string): Promise<AudioBuffer>;
}

/** Pure helper so progress maths is testable. */
export function toProgress(loaded: number, total: number): number {
  return total <= 0 ? 1 : Math.min(Math.max(loaded / total, 0), 1);
}

export function createAssetLoader(onProgress?: ProgressCallback): AssetLoader {
  const manager = new LoadingManager();
  manager.onProgress = (_url, loaded, total) => onProgress?.(toProgress(loaded, total));
  manager.onLoad = () => onProgress?.(1);

  const gltf = new GLTFLoader(manager);
  const textures = new TextureLoader(manager);
  const audio = new AudioLoader(manager);

  return {
    loadGLTF: (url) => gltf.loadAsync(url),
    loadTexture: (url) => textures.loadAsync(url),
    loadAudio: (url) => audio.loadAsync(url),
  };
}

export interface ProgressBar {
  update: ProgressCallback;
  remove(): void;
}

/** Simple full-screen loading bar; pass `update` as the loader's progress callback. */
export function createProgressBar(container: HTMLElement): ProgressBar {
  const wrap = document.createElement('div');
  wrap.className = 'sg-progress';
  wrap.setAttribute('role', 'progressbar');
  wrap.setAttribute('aria-valuemin', '0');
  wrap.setAttribute('aria-valuemax', '100');
  wrap.setAttribute('aria-label', 'Loading');
  wrap.style.cssText =
    'position:fixed;left:10%;right:10%;top:50%;height:12px;border-radius:6px;background:#2a2f4a;overflow:hidden;z-index:50';
  const fill = document.createElement('div');
  fill.style.cssText = 'height:100%;width:0;background:#4cc38a;transition:width 0.15s';
  wrap.appendChild(fill);
  container.appendChild(wrap);

  return {
    update(progress) {
      const pct = Math.round(progress * 100);
      fill.style.width = `${pct}%`;
      wrap.setAttribute('aria-valuenow', String(pct));
    },
    remove: () => wrap.remove(),
  };
}
