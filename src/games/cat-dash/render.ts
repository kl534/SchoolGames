/**
 * How the scene is drawn: tone mapping, a soft environment sheen, the key light with its cast
 * shadow, the fill light, haze and the pixel ratio of each quality tier.
 */
import {
  DirectionalLight,
  Fog,
  HemisphereLight,
  Material,
  Object3D,
  NeutralToneMapping,
  PCFShadowMap,
  PCFSoftShadowMap,
  PMREMGenerator,
  Vector2,
  Vector3,
  type Texture,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { SceneContext } from '../../shared/scene';
import type { Fit } from './layout';
import { lightFor } from './lighting';
import type { Place } from './places';
import { QUALITY_SETTINGS, type Quality } from './quality';
import { setOutlineView } from './outline';
import type { World } from './world';

export const EXPOSURE = 1.05;
export const ENVIRONMENT_INTENSITY = 0.35;
/** The key light stands this far from its target (up, left and towards the camera). */
const KEY_OFFSET = new Vector3(-7, 15, 11);
const SHADOW_TOP = 9;
const SHADOW_BOTTOM = -2;

export interface Look {
  setQuality(quality: Quality): void;
  setPlace(place: Place): void;
  /** Call each frame after the camera is aimed. */
  frame(camX: number, fit: Fit): void;
  dispose(): void;
}

export function createLook(ctx: SceneContext, world: World): Look {
  const { renderer, scene } = ctx;
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = EXPOSURE;

  // The environment: a soft studio, built once.
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment: Texture = pmrem.fromScene(room, 0.04).texture;
  scene.environment = environment;
  scene.environmentIntensity = ENVIRONMENT_INTENSITY;
  room.dispose();
  pmrem.dispose();

  const key = new DirectionalLight(0xffffff, 2.4);
  key.castShadow = true;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.03;
  key.shadow.radius = 3;
  const cam = key.shadow.camera;
  cam.near = 1;
  cam.far = 45;
  cam.top = SHADOW_TOP;
  cam.bottom = SHADOW_BOTTOM;
  const fill = new HemisphereLight(0xffffff, 0x998877, 1);
  scene.add(key, key.target, fill);

  let quality: Quality = 'high';
  let fogNear = 30;
  let fogFar = 140;
  let distance = 20;
  let viewW = 0;

  const lightDir = KEY_OFFSET.clone().normalize();
  // The shadow camera's own axes, to snap its centre to whole shadow texels.
  const axisX = new Vector3(0, 1, 0).cross(lightDir).normalize();
  const axisY = lightDir.clone().cross(axisX).normalize();
  const centre = new Vector3();
  const buffer = new Vector2();

  const refreshMaterials = () => {
    scene.traverse((o: Object3D) => {
      const material = (o as { material?: Material | Material[] }).material;
      if (!material) return;
      for (const m of Array.isArray(material) ? material : [material]) m.needsUpdate = true;
    });
  };

  const look: Look = {
    setQuality(next) {
      quality = next;
      const s = QUALITY_SETTINGS[next];
      renderer.shadowMap.enabled = s.shadowMapSize > 0;
      renderer.shadowMap.type = s.softShadows ? PCFSoftShadowMap : PCFShadowMap;
      key.castShadow = s.shadowMapSize > 0;
      if (s.shadowMapSize > 0) key.shadow.mapSize.set(s.shadowMapSize, s.shadowMapSize);
      key.shadow.map?.dispose();
      key.shadow.map = null;
      world.setBlobOpacity(s.shadowMapSize > 0 ? 0.22 : 0.45);
      refreshMaterials();
    },
    setPlace(place) {
      const light = lightFor(place);
      key.color.setHex(light.key);
      key.intensity = light.keyIntensity;
      fill.color.setHex(light.sky);
      fill.groundColor.setHex(light.ground);
      fill.intensity = light.fillIntensity;
      fogNear = light.fogNear;
      fogFar = light.fogFar;
      scene.fog = new Fog(light.fog, distance + fogNear, distance + fogFar);
    },
    frame(camX, fit) {
      distance = fit.distance;
      if (scene.fog instanceof Fog) {
        scene.fog.near = distance + fogNear;
        scene.fog.far = distance + fogFar;
      }
      // Pixel ratio: the shared resize resets it, so correct it here.
      const wanted = Math.min(
        window.devicePixelRatio || 1,
        QUALITY_SETTINGS[quality].maxPixelRatio,
      );
      if (renderer.getPixelRatio() !== wanted) renderer.setPixelRatio(wanted);
      renderer.getDrawingBufferSize(buffer);
      setOutlineView(buffer.x, buffer.y, renderer.getPixelRatio());
      // Key light and its shadow camera follow the view.
      if (viewW !== fit.viewW) {
        viewW = fit.viewW;
        cam.left = -(viewW / 2 + 4);
        cam.right = viewW / 2 + 4;
        cam.updateProjectionMatrix();
      }
      const mapSize = QUALITY_SETTINGS[quality].shadowMapSize || 1024;
      const texelX = (cam.right - cam.left) / mapSize;
      const texelY = (cam.top - cam.bottom) / mapSize;
      centre.set(camX, 0, 0);
      const a = Math.round(centre.dot(axisX) / texelX) * texelX - centre.dot(axisX);
      const b = Math.round(centre.dot(axisY) / texelY) * texelY - centre.dot(axisY);
      centre.addScaledVector(axisX, a).addScaledVector(axisY, b);
      key.target.position.copy(centre);
      key.position.copy(centre).add(KEY_OFFSET);
      key.target.updateMatrixWorld();
      key.updateMatrixWorld();
    },
    dispose() {
      key.removeFromParent();
      key.target.removeFromParent();
      fill.removeFromParent();
      key.shadow.map?.dispose();
      scene.environment = null;
      scene.fog = null;
      environment.dispose();
    },
  };
  return look;
}
