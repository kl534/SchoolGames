# School Games

Browser-based 3D games built for phones, tablets and school Chromebooks/iPads. Built with TypeScript, Vite, three.js and cannon-es, and hosted on GitHub Pages at `https://<user>.github.io/schoolgames/`.

## Local development

Requires Node 22 (`nvm use`).

```bash
npm install
npm run dev           # dev server with hot reload
npm run build         # type-check + production build into dist/
npm run preview       # serve the built output
npm run lint          # ESLint
npm run format        # Prettier (write)
npm run format:check  # Prettier (check only)
npm test              # Vitest
```

Set `BASE_PATH` to build for a sub-path, e.g. `BASE_PATH=/schoolgames/ npm run build`. The default is `/`.

## Project structure

```
index.html            Game menu page
src/menu/             Menu UI; builds cards from game manifests
src/shared/           scene, input, ui, assets, manifest helpers, plus the learning layer:
                      topics/ (fact sets), progress (players + per-fact stats), round,
                      session (URL params), lesson, results, audio (speech + sound effects)
src/games/<id>/       One folder per game: index.html, main.ts, game.json
tests/                Unit tests (including a check of every game folder)
.github/workflows/    ci.yml and deploy.yml
```

## How it works

1. **Who's playing?** Kids pick or add a profile (name and emoji). Profiles and progress stay in the browser's localStorage on that device.
2. **Pick a topic**, e.g. Addition 1–10, Subtraction 1–10, or a single times table. Each topic card shows how many of its facts the player has learned.
3. **Pick a game.** The topic page lists every game with the player's best stars. Every question has a clock: 15 seconds for a new or just-missed fact, 10 after one correct answer in a row, 5 after two or more. Games open with `?topic=<id>`.
4. **Lesson.** The round's facts appear one card at a time with counting dots and are read aloud. Kids can skip to the game.
5. **Play.** 10 questions, each read aloud. A missed fact is shown and spoken with its answer, then comes back 3 turns later. Facts the player often misses are picked more often in later rounds.
6. **Results.** Stars (9+ right = 3, 7+ = 2, 5+ = 1), facts to practice, and buttons for Play again, Other games, or All topics.

### Add a topic

Topics live in `src/shared/topics/`. Add one to `TOPICS` in `index.ts`. Generate math facts the way `math.ts` does, or use `listTopic` for anything with text answers:

```ts
listTopic(
  { id: 'sight-words-1', title: 'Sight words 1', subject: 'Reading', description: 'Common words.' },
  [
    { prompt: '🔊', spokenPrompt: 'the', answer: 'the' },
    { prompt: '🔊', spokenPrompt: 'said', answer: 'said' },
    // ...
  ],
);
```

Wrong answers come from the other items in the topic, or you can supply a `distractors` function. Progress is saved by topic and fact id, so don't rename them once they've shipped.

## How to add a new game

1. Copy `src/games/penalty-kick/` to `src/games/<your-id>/`. The id is lowercase kebab-case, for example `space-runner`.
2. Edit `game.json`:
   - `id` (required): must equal the folder name.
   - `title` (required): shown on the menu card.
   - `description` (required): one short sentence.
   - `thumbnail` (optional): file name of an image (png, jpg, webp, svg) in the game folder.
   - `tags` (optional): array of short strings.
3. Update the `<title>` in the game's `index.html`.
4. Write the game in `main.ts` using the shared library:
   - `createScene(container)` gives a renderer, scene, camera, delta-time loop (`onUpdate`, `start`, `stop`) and `dispose()`. Pixel ratio is capped at 2 and resizing is handled.
   - `createPointerInput(element, { onTap, onSwipe, onDrag })` handles touch and mouse.
   - `createBackButton()` and `createPauseOverlay()` add the back-to-menu link and a pause dialog.
   - `createAssetLoader(onProgress)` loads GLTF models, textures and audio; `createProgressBar()` shows progress.
   - `startGameSession(gameId)` reads the topic and current player from the URL. `chooseFacts()`, `recordAnswer()` and `recordStars()` save progress, and `timerSecondsFor(fact)` gives the seconds allowed for a question (15, 10 or 5 by the fact's streak).
   - `showLesson()`, `createRound()`, `answerOptions()`, `showResults()`, `speak()`/`sfx` and `createMuteButton()` cover the learning loop. `src/games/penalty-kick/main.ts` is the reference.
5. Run `npm run dev`. The game appears on the menu automatically; no menu or config edits are needed. `npm test` checks the manifest and folder layout.

## Deploys

- `ci.yml` runs on pull requests and on pushes to branches other than `main` and `production`: `npm ci`, lint, format check, tests, build.
- `deploy.yml` runs on pushes to `main` and manual dispatch. It runs `npm ci`, lint, tests and a build with `BASE_PATH=/<repo-name>/`, adds `.nojekyll`, then force-pushes the contents of `dist/` as the only commit on the `production` branch. Only one deploy runs at a time, and because the workflow only triggers on `main`, pushing to `production` never re-triggers it.

### One-time setup

In the GitHub repo go to Settings > Pages > Source: Deploy from a branch, then choose `production` / `(root)` and save. The first successful deploy creates the `production` branch, so run the workflow once (push to `main` or use "Run workflow") before selecting it.
