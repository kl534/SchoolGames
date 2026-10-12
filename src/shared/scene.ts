import { PerspectiveCamera, Scene, WebGLRenderer } from 'three';

export const MAX_PIXEL_RATIO = 2;
/** Longest frame step (s) passed to update callbacks, so tab switches don't cause jumps. */
export const MAX_DELTA = 0.1;

export type UpdateCallback = (delta: number, elapsed: number) => void;

export interface SceneContext {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  /** Registers a per-frame callback; returns an unsubscribe function. */
  onUpdate(callback: UpdateCallback): () => void;
  start(): void;
  stop(): void;
  dispose(): void;
}

export interface SceneOptions {
  fov?: number;
  near?: number;
  far?: number;
  antialias?: boolean;
}

export function clampPixelRatio(ratio: number, max = MAX_PIXEL_RATIO): number {
  return Math.min(Math.max(ratio, 1), max);
}

/** Creates a renderer sized to `container`, plus a scene, camera and render loop. */
export function createScene(container: HTMLElement, options: SceneOptions = {}): SceneContext {
  const renderer = new WebGLRenderer({ antialias: options.antialias ?? true });
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.touchAction = 'none';
  container.appendChild(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(
    options.fov ?? 60,
    1,
    options.near ?? 0.1,
    options.far ?? 200,
  );
  const callbacks = new Set<UpdateCallback>();

  const resize = () => {
    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    renderer.setPixelRatio(clampPixelRatio(window.devicePixelRatio));
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  resize();

  const observer = new ResizeObserver(resize);
  observer.observe(container);
  window.addEventListener('orientationchange', resize);

  let running = false;
  let lastTime = 0;
  let elapsed = 0;

  const frame = (time: number) => {
    if (!running) return;
    const delta = Math.min((time - lastTime) / 1000, MAX_DELTA);
    lastTime = time;
    elapsed += delta;
    callbacks.forEach((cb) => cb(delta, elapsed));
    renderer.render(scene, camera);
  };

  return {
    renderer,
    scene,
    camera,
    onUpdate(callback) {
      callbacks.add(callback);
      return () => callbacks.delete(callback);
    },
    start() {
      if (running) return;
      running = true;
      lastTime = performance.now();
      renderer.setAnimationLoop(frame);
    },
    stop() {
      running = false;
      renderer.setAnimationLoop(null);
    },
    dispose() {
      this.stop();
      observer.disconnect();
      window.removeEventListener('orientationchange', resize);
      callbacks.clear();
      scene.traverse((obj) => {
        const mesh = obj as Partial<{ geometry: { dispose(): void }; material: unknown }>;
        mesh.geometry?.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((m) => (m as { dispose?: () => void } | undefined)?.dispose?.());
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
