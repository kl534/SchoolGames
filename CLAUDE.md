# SchoolGames

Mobile/tablet-first browser 3D games (TypeScript, Vite multi-page, three.js, cannon-es), deployed to GitHub Pages.

## Conventions

- TypeScript strict; Prettier (single quotes, width 100) and ESLint flat config. Run `npm run lint`, `npm run format`, `npm test`, `npm run build` before finishing.
- Shared code lives in `src/shared/` (scene, input, ui, assets, manifest, topics, progress, round, session, lesson, results, audio). Games import from there; never the reverse.
- Flow: player picker → topic (`src/shared/topics/`) → game. Games get `?topic=<id>&timer=<seconds>` and must work for any topic (answers are strings, not just numbers).
- Progress is stored per player in localStorage under topic and fact ids, so never rename existing topic or fact ids.
- Games live in `src/games/<id>/` and are auto-discovered by `vite.config.ts` and the menu (`import.meta.glob`). Do not edit menu or config code to add a game.
- Use `import.meta.env.BASE_URL` for any absolute link; the site is served under `/schoolgames/`. Set `BASE_PATH` to change the base at build time (default `/`).
- Touch first: tap targets at least 48px, use pointer events (`src/shared/input.ts`), no hover-only interactions.
- Always `dispose()` the scene on `pagehide`.

## Add a game

1. Copy `src/games/penalty-kick/` to `src/games/<new-id>/` (id is lowercase kebab-case).
2. Edit `game.json` (`id` must equal the folder name; `title`, `description` required; `thumbnail` file name and `tags` optional) and the page `<title>` in `index.html`.
3. Build the game in `main.ts` using `createScene`, `createPointerInput`, `createBackButton`/`createPauseOverlay`/`createMuteButton`, and `createAssetLoader`.
4. Learning loop: `startGameSession(id)` (redirect to `menuUrl()` if it returns null) → `session.chooseFacts()` → `showLesson()` → per turn `answerOptions()`, `speak(fact.spokenPrompt)`, `session.recordAnswer()` → `createRound()` handles retries → `showResults()` with `session.recordStars(starsFor(...))`. Honour `session.timerSeconds` (start the clock after the prompt is read).
5. `npm test` validates every manifest and folder layout.

## Add a topic

Add a `Topic` to `TOPICS` in `src/shared/topics/index.ts`, either generated (see `math.ts`) or from plain pairs with `listTopic(meta, items)`. Ids are lowercase kebab-case. `npm test` checks every topic is valid and can produce four distinct answer options.
