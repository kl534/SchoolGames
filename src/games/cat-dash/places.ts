/** The places the cat runs through and the obstacles each one has: pure data. */

export type PlaceGroup = 'house' | 'town' | 'busy' | 'adventure';
export type PlaceId =
  | 'living-room'
  | 'kitchen'
  | 'bathroom'
  | 'bedroom'
  | 'backyard'
  | 'park'
  | 'street'
  | 'rooftops'
  | 'grocery'
  | 'library'
  | 'fish-market'
  | 'construction'
  | 'beach'
  | 'snowy-forest'
  | 'desert'
  | 'space-station'
  | 'farm'
  | 'jungle'
  | 'toy-store'
  | 'pirate-ship'
  | 'zoo';
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
  | 'yarn'
  | 'fence'
  | 'sprinkler'
  | 'flowers'
  | 'slide'
  | 'pond'
  | 'swings'
  | 'mailbox'
  | 'trash-can'
  | 'hopscotch'
  | 'chimney'
  | 'roof-gap'
  | 'clothesline'
  | 'cart'
  | 'cereal'
  | 'milk'
  | 'books'
  | 'ladder'
  | 'book-cart'
  | 'crates'
  | 'barrels'
  | 'net'
  | 'girder'
  | 'mixer'
  | 'crane-hook'
  | 'sandcastle'
  | 'crab'
  | 'wave'
  | 'log'
  | 'snowball'
  | 'ice'
  | 'cactus'
  | 'tumbleweed'
  | 'dune'
  | 'boxes'
  | 'lasers'
  | 'airlock'
  | 'hay'
  | 'scarecrow'
  | 'chickens'
  | 'vine'
  | 'stones'
  | 'mud'
  | 'toy-train'
  | 'blocks'
  | 'ball-pit'
  | 'cannon'
  | 'rigging'
  | 'chest'
  | 'elephant'
  | 'giraffe'
  | 'penguins';

export type FloorPattern =
  'planks' | 'tiles' | 'carpet' | 'grass' | 'pavement' | 'roof' | 'sand' | 'snow' | 'metal';

export type WallPattern = 'stripes' | 'dots' | 'tiles' | 'panels' | 'wainscot';
export type BackdropKind =
  | 'hills'
  | 'treeline'
  | 'skyline'
  | 'cranes'
  | 'sea'
  | 'island'
  | 'mountains'
  | 'pines'
  | 'mesas'
  | 'dunes'
  | 'canopy';
/** One silhouette strip painted behind an outdoor place. */
export interface Backdrop {
  kind: BackdropKind;
  color: number;
}

/** The colours of a place (hex numbers). */
export interface PlaceLook {
  indoor: boolean;
  wall: number;
  trim: number;
  floor: number;
  floorPattern: FloorPattern;
  sky: [top: number, bottom: number];
  light: number;
  /** What the indoor wall is painted with. */
  wallPattern?: WallPattern;
  /** The two silhouette strips behind an outdoor place (far, then near). */
  backdrop?: readonly [far: Backdrop, near: Backdrop];
}

export interface Place {
  id: PlaceId;
  group: PlaceGroup;
  /** The banner (upper-cased by CSS). */
  name: string;
  /** Spoken as the cat arrives. */
  speech: string;
  obstacles: readonly [ObstacleId, ObstacleId, ObstacleId];
  /** Its own doorway instead of the group's. */
  door?: DoorKind;
  look: PlaceLook;
}

/** The doorway kinds between places. */
export type DoorKind = 'door' | 'gate' | 'shop-doors' | 'portal' | 'zoo-arch';
export const GROUP_DOORS: Record<PlaceGroup, DoorKind> = {
  house: 'door',
  town: 'gate',
  busy: 'shop-doors',
  adventure: 'portal',
};
/** The doorway into a place. */
export function doorOf(place: Place): DoorKind {
  return place.door ?? GROUP_DOORS[place.group];
}

/**
 * All 21 places: four groups of four, then the farm (town), the jungle (adventure), the toy store
 * (busy), the pirate ship (adventure) and the zoo (town, with its own zoo arch doorway).
 */
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
      wallPattern: 'wainscot',
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
      wallPattern: 'tiles',
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
      wallPattern: 'tiles',
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
      wallPattern: 'dots',
    },
  },
  {
    id: 'backyard',
    group: 'town',
    name: 'The Backyard',
    speech: 'The backyard!',
    obstacles: ['fence', 'sprinkler', 'flowers'],
    look: {
      indoor: false,
      wall: 0x6fb85a,
      trim: 0xffffff,
      floor: 0x5cae4a,
      floorPattern: 'grass',
      sky: [0x6ec6ff, 0xdff3ff],
      light: 0xfff6e0,
      backdrop: [
        { kind: 'hills', color: 0x8fc48a },
        { kind: 'treeline', color: 0x5f9e5a },
      ],
    },
  },
  {
    id: 'park',
    group: 'town',
    name: 'The Park',
    speech: 'The park!',
    obstacles: ['slide', 'pond', 'swings'],
    look: {
      indoor: false,
      wall: 0x4a9a52,
      trim: 0xffffff,
      floor: 0x68b954,
      floorPattern: 'grass',
      sky: [0x7fd0ff, 0xe8f7ff],
      light: 0xfffbe8,
      backdrop: [
        { kind: 'hills', color: 0x8fc48a },
        { kind: 'treeline', color: 0x5f9e5a },
      ],
    },
  },
  {
    id: 'street',
    group: 'town',
    name: 'The Street',
    speech: 'The street!',
    obstacles: ['mailbox', 'trash-can', 'hopscotch'],
    look: {
      indoor: false,
      wall: 0xd9a577,
      trim: 0xf4ede0,
      floor: 0x8d9199,
      floorPattern: 'pavement',
      sky: [0x9cd3ff, 0xeaf5ff],
      light: 0xfff4e0,
      backdrop: [
        { kind: 'skyline', color: 0x9fb3c8 },
        { kind: 'skyline', color: 0x7d8fa6 },
      ],
    },
  },
  {
    id: 'rooftops',
    group: 'town',
    name: 'The Rooftops',
    speech: 'The rooftops!',
    obstacles: ['chimney', 'roof-gap', 'clothesline'],
    look: {
      indoor: false,
      wall: 0x5a4a6a,
      trim: 0x3d3350,
      floor: 0x9a5a48,
      floorPattern: 'roof',
      sky: [0x3a4a8a, 0xf6a46f],
      light: 0xffd2a8,
      backdrop: [
        { kind: 'skyline', color: 0x6a5a8a },
        { kind: 'skyline', color: 0x4a3f66 },
      ],
    },
  },
  {
    id: 'grocery',
    group: 'busy',
    name: 'The Grocery Store',
    speech: 'The grocery store!',
    obstacles: ['cart', 'cereal', 'milk'],
    look: {
      indoor: true,
      wall: 0xfbe9b7,
      trim: 0xe0504a,
      floor: 0xd9d4c4,
      floorPattern: 'tiles',
      sky: [0xfff0c8, 0xfffaf0],
      light: 0xfffbe8,
      wallPattern: 'panels',
    },
  },
  {
    id: 'library',
    group: 'busy',
    name: 'The Library',
    speech: 'The library!',
    obstacles: ['books', 'ladder', 'book-cart'],
    look: {
      indoor: true,
      wall: 0xb98a5e,
      trim: 0x5a3a24,
      floor: 0x8f3a3a,
      floorPattern: 'carpet',
      sky: [0xe8c79a, 0xf7e8cf],
      light: 0xffe2b0,
      wallPattern: 'wainscot',
    },
  },
  {
    id: 'fish-market',
    group: 'busy',
    name: 'The Fish Market',
    speech: 'The fish market!',
    obstacles: ['crates', 'barrels', 'net'],
    look: {
      indoor: true,
      wall: 0xb8d8e0,
      trim: 0xffffff,
      floor: 0x8fb3be,
      floorPattern: 'tiles',
      sky: [0xcfe9f0, 0xeef9fc],
      light: 0xeaf6ff,
      wallPattern: 'tiles',
    },
  },
  {
    id: 'construction',
    group: 'busy',
    name: 'The Construction Site',
    speech: 'The construction site!',
    obstacles: ['girder', 'mixer', 'crane-hook'],
    look: {
      indoor: false,
      wall: 0xf2c230,
      trim: 0x3a3a40,
      floor: 0x9a9aa0,
      floorPattern: 'pavement',
      sky: [0x7fcfff, 0xe8f6ff],
      light: 0xfff4d8,
      backdrop: [
        { kind: 'skyline', color: 0xa8b4c0 },
        { kind: 'cranes', color: 0x7f8a96 },
      ],
    },
  },
  {
    id: 'beach',
    group: 'adventure',
    name: 'The Beach',
    speech: 'The beach!',
    obstacles: ['sandcastle', 'crab', 'wave'],
    look: {
      indoor: false,
      wall: 0xf6d68a,
      trim: 0xffffff,
      floor: 0xf2d98a,
      floorPattern: 'sand',
      sky: [0x5ec8ff, 0xd8f4ff],
      light: 0xfffbe0,
      backdrop: [
        { kind: 'sea', color: 0x7cc4e8 },
        { kind: 'island', color: 0x6fae6a },
      ],
    },
  },
  {
    id: 'snowy-forest',
    group: 'adventure',
    name: 'The Snowy Forest',
    speech: 'The snowy forest!',
    obstacles: ['log', 'snowball', 'ice'],
    look: {
      indoor: false,
      wall: 0x2f6a4a,
      trim: 0xffffff,
      floor: 0xf4f8ff,
      floorPattern: 'snow',
      sky: [0xaed4ee, 0xf2f8ff],
      light: 0xeef4ff,
      backdrop: [
        { kind: 'mountains', color: 0xc8d8ea },
        { kind: 'pines', color: 0x7f9fb8 },
      ],
    },
  },
  {
    id: 'desert',
    group: 'adventure',
    name: 'The Desert',
    speech: 'The desert!',
    obstacles: ['cactus', 'tumbleweed', 'dune'],
    look: {
      indoor: false,
      wall: 0xd88a4a,
      trim: 0xf4d9a0,
      floor: 0xe8c27a,
      floorPattern: 'sand',
      sky: [0x7ac8f5, 0xfbe3b0],
      light: 0xffe6b8,
      backdrop: [
        { kind: 'mesas', color: 0xe0b088 },
        { kind: 'dunes', color: 0xd9a66b },
      ],
    },
  },
  {
    id: 'space-station',
    group: 'adventure',
    name: 'The Space Station',
    speech: 'The space station!',
    obstacles: ['boxes', 'lasers', 'airlock'],
    look: {
      indoor: true,
      wall: 0x4a5470,
      trim: 0x8aa0c8,
      floor: 0x6a7488,
      floorPattern: 'metal',
      sky: [0x151a33, 0x2a3358],
      light: 0xcfe0ff,
      wallPattern: 'panels',
    },
  },
  {
    id: 'farm',
    group: 'town',
    name: 'The Farm',
    speech: 'The farm!',
    obstacles: ['hay', 'scarecrow', 'chickens'],
    look: {
      indoor: false,
      wall: 0x9bc86a,
      trim: 0xc0392b,
      floor: 0x6fae45,
      floorPattern: 'grass',
      sky: [0x74c0f2, 0xe2f5ff],
      light: 0xfff5d8,
      backdrop: [
        { kind: 'hills', color: 0x8fc48a },
        { kind: 'treeline', color: 0x5f9e5a },
      ],
    },
  },
  {
    id: 'jungle',
    group: 'adventure',
    name: 'The Jungle',
    speech: 'The jungle!',
    obstacles: ['vine', 'stones', 'mud'],
    look: {
      indoor: false,
      wall: 0x1f6b3a,
      trim: 0x8bd36a,
      floor: 0x4f8a3a,
      floorPattern: 'grass',
      sky: [0x5fb89a, 0xcdeec0],
      light: 0xf4ffd8,
      backdrop: [
        { kind: 'hills', color: 0x4f8f5a },
        { kind: 'canopy', color: 0x2f6b3a },
      ],
    },
  },
  {
    id: 'toy-store',
    group: 'busy',
    name: 'The Toy Store',
    speech: 'The toy store!',
    obstacles: ['toy-train', 'blocks', 'ball-pit'],
    look: {
      indoor: true,
      wall: 0xffd6e8,
      trim: 0x5aa9f0,
      floor: 0xf2c94c,
      floorPattern: 'tiles',
      sky: [0xbfe6ff, 0xffffff],
      light: 0xfff4e0,
      wallPattern: 'stripes',
    },
  },
  {
    id: 'pirate-ship',
    group: 'adventure',
    name: 'The Pirate Ship',
    speech: 'The pirate ship!',
    obstacles: ['cannon', 'rigging', 'chest'],
    look: {
      indoor: false,
      wall: 0x2f7fb8,
      trim: 0x7a4a26,
      floor: 0x9a6a3c,
      floorPattern: 'planks',
      sky: [0x5fb2ee, 0xdff2ff],
      light: 0xfff3d6,
      backdrop: [
        { kind: 'sea', color: 0x7cc4e8 },
        { kind: 'island', color: 0x6fae6a },
      ],
    },
  },
  {
    id: 'zoo',
    group: 'town',
    name: 'The Zoo',
    speech: 'The zoo!',
    obstacles: ['elephant', 'giraffe', 'penguins'],
    door: 'zoo-arch',
    look: {
      indoor: false,
      wall: 0x8ccf6a,
      trim: 0xd9a05b,
      floor: 0x74b84e,
      floorPattern: 'grass',
      sky: [0x6cbcf0, 0xe4f6ff],
      light: 0xfff6dc,
      backdrop: [
        { kind: 'hills', color: 0x8fc48a },
        { kind: 'treeline', color: 0x5f9e5a },
      ],
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
