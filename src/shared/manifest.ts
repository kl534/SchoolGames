export interface GameManifest {
  id: string;
  title: string;
  description: string;
  /** File name of an image inside the game's folder. */
  thumbnail?: string;
  tags?: string[];
}

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

/** Returns a list of problems; empty means the manifest is valid. */
export function validateManifest(value: unknown): string[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return ['manifest must be an object'];
  }
  const m = value as Record<string, unknown>;
  const errors: string[] = [];

  if (!isNonEmptyString(m.id) || !ID_PATTERN.test(m.id)) {
    errors.push('id must be a lowercase kebab-case string');
  }
  if (!isNonEmptyString(m.title)) errors.push('title must be a non-empty string');
  if (!isNonEmptyString(m.description)) errors.push('description must be a non-empty string');
  if (m.thumbnail !== undefined && !isNonEmptyString(m.thumbnail)) {
    errors.push('thumbnail must be a non-empty string when present');
  }
  if (m.tags !== undefined && !(Array.isArray(m.tags) && m.tags.every(isNonEmptyString))) {
    errors.push('tags must be an array of non-empty strings when present');
  }
  return errors;
}

export function isGameManifest(value: unknown): value is GameManifest {
  return validateManifest(value).length === 0;
}

/** Throws with a readable message when invalid. */
export function parseManifest(value: unknown): GameManifest {
  const errors = validateManifest(value);
  if (errors.length > 0) throw new Error(`Invalid game manifest: ${errors.join('; ')}`);
  return value as GameManifest;
}
