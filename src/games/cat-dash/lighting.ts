/**
 * The light of each place: the key light, the soft fill, the haze. Pure, so it can be tested.
 */
import { Color } from 'three';
import type { Place } from './places';

export interface PlaceLight {
  key: number;
  keyIntensity: number;
  sky: number;
  ground: number;
  fillIntensity: number;
  fog: number;
  /** Haze distances beyond the cat's plane (the owner adds the camera distance). */
  fogNear: number;
  fogFar: number;
}

const scaled = (hex: number, k: number) => new Color(hex).multiplyScalar(k).getHex();
const mixed = (a: number, b: number, t: number) => new Color(a).lerp(new Color(b), t).getHex();

export function lightFor(place: Place): PlaceLight {
  const look = place.look;
  const light: PlaceLight = look.indoor
    ? {
        key: look.light,
        keyIntensity: 2.0,
        sky: mixed(0xffffff, look.light, 0.3),
        ground: scaled(look.floor, 0.6),
        fillIntensity: 1.15,
        fog: scaled(look.wall, 0.9),
        fogNear: 60,
        fogFar: 260,
      }
    : {
        key: look.light,
        keyIntensity: 2.6,
        sky: mixed(0xffffff, look.light, 0.3),
        ground: scaled(look.floor, 0.6),
        fillIntensity: 1.0,
        fog: look.sky[1],
        fogNear: 30,
        fogFar: 140,
      };
  switch (place.id) {
    case 'desert':
      light.key = 0xffe2b0;
      light.keyIntensity = 2.9;
      break;
    case 'snowy-forest':
      light.key = 0xe8f2ff;
      light.fillIntensity = 1.3;
      break;
    case 'rooftops':
      light.key = 0xffc49a;
      light.keyIntensity = 2.2;
      light.sky = 0x9a7fc0;
      break;
    case 'space-station':
      light.key = 0xcfe4ff;
      light.keyIntensity = 1.8;
      light.sky = 0x9ec8ff;
      break;
    case 'jungle':
      light.ground = 0x2f6b3a;
      light.keyIntensity = 2.2;
      break;
    case 'beach':
      light.keyIntensity = 2.9;
      break;
    default:
      break;
  }
  return light;
}
