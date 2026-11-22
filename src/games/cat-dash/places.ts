/** The places the cat runs through and the obstacles each one has: pure data. */

export type PlaceGroup = 'house' | 'town' | 'busy' | 'adventure';
export type PlaceId = 'living-room' | 'kitchen' | 'bathroom' | 'bedroom';
export type ObstacleId =
  | 'couch'
  | 'bookshelf'
  | 'basket'
  | 'counter'
  | 'mop'
  | 'sink'
  | 'bathtub'
  | 'paper-roll'
  | 'towel'
  | 'bed'
  | 'closet'
  | 'yarn';

export type FloorPattern =
  'planks' | 'tiles' | 'carpet' | 'grass' | 'pavement' | 'roof' | 'sand' | 'snow' | 'metal';

/** The colours of a place (hex numbers). */
export interface PlaceLook {
  indoor: boolean;
  wall: number;
  trim: number;
  floor: number;
  floorPattern: FloorPattern;
  sky: [top: number, bottom: number];
  light: number;
}

export interface Place {
  id: PlaceId;
  group: PlaceGroup;
  /** The banner (upper-cased by CSS). */
  name: string;
  /** Spoken as the cat arrives. */
  speech: string;
  obstacles: readonly [ObstacleId, ObstacleId, ObstacleId];
  look: PlaceLook;
}

/** Only the places built so far; it grows with each milestone. */
export const PLACES: readonly Place[] = [
  {
    id: 'living-room',
    group: 'house',
    name: 'The Living Room',
    speech: 'The living room!',
    obstacles: ['couch', 'bookshelf', 'basket'],
    look: {
      indoor: true,
      wall: 0xf2d9b0,
      trim: 0xffffff,
      floor: 0xb07a45,
      floorPattern: 'planks',
      sky: [0xffe9c2, 0xfff5e0],
      light: 0xfff1d6,
    },
  },
  {
    id: 'kitchen',
    group: 'house',
    name: 'The Kitchen',
    speech: 'The kitchen!',
    obstacles: ['counter', 'mop', 'sink'],
    look: {
      indoor: true,
      wall: 0xbfe6e0,
      trim: 0xffffff,
      floor: 0xe9e4d8,
      floorPattern: 'tiles',
      sky: [0xd8f3ef, 0xf1fffc],
      light: 0xf4fbff,
    },
  },
  {
    id: 'bathroom',
    group: 'house',
    name: 'The Bathroom',
    speech: 'The bathroom!',
    obstacles: ['bathtub', 'paper-roll', 'towel'],
    look: {
      indoor: true,
      wall: 0xbcd9f5,
      trim: 0xffffff,
      floor: 0x9ec9e8,
      floorPattern: 'tiles',
      sky: [0xcfe6fb, 0xeef7ff],
      light: 0xf0f6ff,
    },
  },
  {
    id: 'bedroom',
    group: 'house',
    name: 'The Bedroom',
    speech: 'The bedroom!',
    obstacles: ['bed', 'closet', 'yarn'],
    look: {
      indoor: true,
      wall: 0xc9b6f0,
      trim: 0xffffff,
      floor: 0x8a6a9e,
      floorPattern: 'carpet',
      sky: [0xd9ccf7, 0xf1eaff],
      light: 0xffeedd,
    },
  },
];

export const PLACE_IDS: readonly PlaceId[] = PLACES.map((p) => p.id);

/** The place that owns an obstacle. */
export function placeOf(obstacle: ObstacleId): Place {
  const place = PLACES.find((p) => (p.obstacles as readonly string[]).includes(obstacle));
  if (!place) throw new Error(`No place has the obstacle ${obstacle}`);
  return place;
}

export const OBSTACLE_IDS: readonly ObstacleId[] = PLACES.flatMap((p) => p.obstacles);
