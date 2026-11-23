/** The five cats: colours, saved choice and the face picture for the picker and the lives. Pure. */

export type CatId = 'orange' | 'black' | 'tuxedo' | 'calico' | 'grey-tabby';
export const CAT_IDS: readonly CatId[] = ['orange', 'black', 'tuxedo', 'calico', 'grey-tabby'];

export interface CatLook {
  id: CatId;
  name: string;
  fur: number;
  /** Darker stripes on the back, head and tail; null for none. */
  stripes: number | null;
  /** Belly, chest, paws and muzzle. */
  belly: number;
  patches: { color: number; where: 'back' | 'head' | 'tail' }[];
  eyes: number;
  nose: number;
}

export const CAT_LOOKS: Record<CatId, CatLook> = {
  orange: {
    id: 'orange',
    name: 'Orange Tabby',
    fur: 0xe8892e,
    stripes: 0xb85c14,
    belly: 0xfbe3c0,
    patches: [],
    eyes: 0x6fbf3a,
    nose: 0xf48fa8,
  },
  black: {
    id: 'black',
    name: 'Black Cat',
    fur: 0x26262c,
    stripes: null,
    belly: 0x34343c,
    patches: [],
    eyes: 0xf2d33a,
    nose: 0xd9788f,
  },
  tuxedo: {
    id: 'tuxedo',
    name: 'Grey Tuxedo',
    fur: 0x7a7f87,
    stripes: null,
    belly: 0xffffff,
    patches: [],
    eyes: 0x4fa3e0,
    nose: 0xf48fa8,
  },
  'grey-tabby': {
    id: 'grey-tabby',
    name: 'Grey Tabby',
    fur: 0x9aa0a8,
    stripes: 0x4b5058,
    belly: 0xe4e6e9,
    patches: [],
    eyes: 0xd9b43a,
    nose: 0xf0a0b0,
  },
  calico: {
    id: 'calico',
    name: 'Calico',
    fur: 0xfaf6ee,
    stripes: null,
    belly: 0xfaf6ee,
    patches: [
      { color: 0xe0812f, where: 'back' },
      { color: 0xe0812f, where: 'head' },
      { color: 0x2c2a2a, where: 'back' },
      { color: 0x2c2a2a, where: 'tail' },
    ],
    eyes: 0xd9a23a,
    nose: 0xf48fa8,
  },
};

export const CAT_SETTING = (playerId: string | null) => `cat-dash:cat:${playerId ?? 'guest'}`;

/** The saved cat id; an unknown or missing value is the orange tabby. */
export function savedCat(raw: string | null): CatId {
  return (CAT_IDS as readonly string[]).includes(raw ?? '') ? (raw as CatId) : 'orange';
}

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/**
 * The cat's face as SVG markup (64 by 64). `lost` is a grey face with X eyes, for a life that
 * has gone.
 */
export function catFaceSvg(look: CatLook, lost = false): string {
  const fur = lost ? '#9a9aa3' : hex(look.fur);
  const belly = lost ? '#c9c9d0' : hex(look.belly);
  const stripe = look.stripes === null || lost ? null : hex(look.stripes);
  const ink = '#1b1226';
  const parts: string[] = [];
  // Ears behind the head, with a pink inside.
  parts.push(`<path d="M10 30 12 5 29 15Z" fill="${fur}"/>`);
  parts.push(`<path d="M54 30 52 5 35 15Z" fill="${fur}"/>`);
  parts.push(`<path d="M14 24 15 11 24 17Z" fill="#f6a5b8"/>`);
  parts.push(`<path d="M50 24 49 11 40 17Z" fill="#f6a5b8"/>`);
  parts.push(`<ellipse cx="32" cy="36" rx="25" ry="22" fill="${fur}"/>`);
  if (!lost) {
    for (const p of look.patches) {
      if (p.where === 'head') {
        parts.push(
          `<path d="M32 14C44 14 54 22 52 32 44 30 36 26 32 14Z" fill="${hex(p.color)}"/>`,
        );
      }
    }
  }
  if (stripe) {
    parts.push(
      `<path d="M32 15v8M24 17l2 7M40 17l-2 7" stroke="${stripe}" stroke-width="3" stroke-linecap="round"/>`,
    );
    parts.push(
      `<path d="M8 34h8M9 41h7M56 34h-8M55 41h-7" stroke="${stripe}" stroke-width="3" stroke-linecap="round"/>`,
    );
  }
  parts.push(`<ellipse cx="32" cy="45" rx="12" ry="9" fill="${belly}"/>`);
  if (lost) {
    parts.push(
      `<path d="M17 28l10 10M27 28 17 38M37 28l10 10M47 28 37 38" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`,
    );
  } else {
    const eye = hex(look.eyes);
    parts.push(`<ellipse cx="22" cy="33" rx="6" ry="7" fill="${eye}"/>`);
    parts.push(`<ellipse cx="42" cy="33" rx="6" ry="7" fill="${eye}"/>`);
    parts.push(`<ellipse cx="22" cy="33" rx="2.4" ry="5" fill="${ink}"/>`);
    parts.push(`<ellipse cx="42" cy="33" rx="2.4" ry="5" fill="${ink}"/>`);
    parts.push(
      `<circle cx="24" cy="30" r="1.6" fill="#fff"/><circle cx="44" cy="30" r="1.6" fill="#fff"/>`,
    );
  }
  if (!lost) {
    parts.push(
      `<ellipse cx="14" cy="43" rx="4.5" ry="3" fill="#ff7f9e" opacity="0.55"/><ellipse cx="50" cy="43" rx="4.5" ry="3" fill="#ff7f9e" opacity="0.55"/>`,
    );
  }
  parts.push(`<path d="M28 42h8l-4 4Z" fill="${lost ? '#b8b8c0' : hex(look.nose)}"/>`);
  parts.push(
    `<path d="M32 46v2M32 48c-2 3-6 3-8 1M32 48c2 3 6 3 8 1" fill="none" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/>`,
  );
  parts.push(
    `<path d="M4 42l12 2M4 48l12-2M60 42l-12 2M60 48l-12-2" stroke="${lost ? '#8a8a92' : '#ffffff'}" stroke-width="1.4" stroke-linecap="round" opacity="0.85"/>`,
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true">${parts.join('')}</svg>`;
}
