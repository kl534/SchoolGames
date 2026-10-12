# SchoolGames

Mobile/tablet-first browser 3D games (TypeScript, Vite multi-page, three.js, cannon-es), deployed to GitHub Pages.

## Conventions

- TypeScript strict; Prettier (single quotes, width 100) and ESLint flat config. Run `npm run lint`, `npm run format`, `npm test`, `npm run build` before finishing.
- Shared code lives in `src/shared/` (scene, input, ui, assets, manifest). Games import from there; never the reverse.
- Games live in `src/games/<id>/` and are auto-discovered by `vite.config.ts` and the menu (`import.meta.glob`). Do not edit menu or config code to add a game.
- Use `import.meta.env.BASE_URL` for any absolute link; the site is served under `/schoolgames/`. Set `BASE_PATH` to change the base at build time (default `/`).
- Touch first: tap targets at least 48px, use pointer events (`src/shared/input.ts`), no hover-only interactions.
- Always `dispose()` the scene on `pagehide`.

## Add a game

1. Copy `src/games/penalty-kick/` to `src/games/<new-id>/` (id is lowercase kebab-case).
2. Edit `game.json` (`id` must equal the folder name; `title`, `description` required; `thumbnail` file name and `tags` optional) and the page `<title>` in `index.html`.
3. Build the game in `main.ts` using `createScene`, `createPointerInput`, `createBackButton`/`createPauseOverlay`, and `createAssetLoader`.
4. `npm test` validates every manifest and folder layout.
