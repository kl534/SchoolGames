# <Game or area>: <feature> — design

Status: agreed with the owner on <YYYY-MM-DD>. Implement exactly this. Anything marked **(default)**
was not discussed explicitly and may be adjusted if it plays or looks badly; say so in the summary.

Read `CLAUDE.md` first. <Where the work lives, e.g. "Everything here lives in `src/games/<id>/` and
`tests/<id>.test.ts`; nothing in `src/shared/` needs to change.">. Games never import from each
other. <A reference implementation to mirror, if one exists, and what not to import from it.>

## 1. What changes, in one paragraph

<How it works now and how it will work after this. Written for someone who has never seen the game.>

## 2. Decisions from the interview

| Topic | Decision |
| ----- | -------- |
| …     | …        |

## 3. Rules and numbers (pure, `rules.ts`)

<Types, signatures, constants with values, tables. Pure functions only: no three.js, no DOM. Every
spoken line written out.>

## 4. Flow

<What happens step by step, from page load through preview, each turn (right, wrong, timeout,
retry), to results and "play again". How it fits the learning loop in CLAUDE.md.>

## 5. <Feature-specific sections: visuals, characters, animation, camera, physics…>

<As many sections as needed. Exact sizes, colours, timings and positions.>

## 6. Screen layout (touch first)

<What is where at 390×844, 844×390, 1024×768 and 1366×1024. Tap targets ≥ 48px. HUD clearance.>

## 7. HUD and voice

<Banners, subtitles, sounds. Every new line for `voice.ts`, and a reminder to run `npm run voice`.>

## 8. Milestones (one PR each; each ships playable)

<Leave this out for a single-PR feature. Otherwise for each milestone: name, branch, what it
includes, what it removes, its tests. Each later milestone branches from the milestone before it
until that one merges, and the PR says so.>

### M1: <name> (`<branch-name>`)

- …
- Tests: …

## 9. Files

| File | Change |
| ---- | ------ |
| …    | …      |

## 10. Tests

<Case by case: what each test checks, and which invariants are checked over many random inputs.
Tests that become obsolete and must be removed.>

## 11. Definition of done (for every milestone)

1. `npm run lint`, `npm run format`, `npm test` and `npm run build` all pass. Tests need Node 22
   (see `.nvmrc`).
2. Run it in headless Chromium at 390×844, 844×390, 1024×768 and 1366×1024 and check from
   screenshots: <the exact states to reach and what each must show>. Drive answers by reading the
   question and clicking the right button. <Any dev-only hook to force a state.>
3. <Feature-specific checks: timings, nothing left hanging, the next turn starts normally.>
4. Commit in small steps in the repo's style, push, and open the PR.
