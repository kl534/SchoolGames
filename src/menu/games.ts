import { parseManifest, type GameManifest } from '../shared/manifest';

export interface GameEntry extends GameManifest {
  href: string;
  thumbnailUrl?: string;
}

const manifests = import.meta.glob<unknown>('/src/games/*/game.json', {
  eager: true,
  import: 'default',
});
const thumbnails = import.meta.glob<string>('/src/games/*/*.{png,jpg,jpeg,webp,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
});

/** Builds menu entries from every src/games/<id>/game.json, sorted by title. */
export function discoverGames(baseUrl: string = import.meta.env.BASE_URL): GameEntry[] {
  return Object.entries(manifests)
    .map(([path, raw]) => {
      const manifest = parseManifest(raw);
      const folder = path.slice(0, path.lastIndexOf('/'));
      return {
        ...manifest,
        href: `${baseUrl}src/games/${manifest.id}/index.html`,
        thumbnailUrl: manifest.thumbnail
          ? thumbnails[`${folder}/${manifest.thumbnail}`]
          : undefined,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}
