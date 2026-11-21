# Type Brawl map

A side-on 3D beat-'em-up (Double Dragon style) for typing. The hero walks right through a scrolling city; every few seconds a scrap starts and up to 3 thugs walk in from both sides and stop in punching range. Each thug shows a block of keys above its head. The first key locks the hero onto that thug (the hero turns to face them); typing the block, ending with the space bar, throws one move at them. A thug has 1 to 3 blocks (a combo of different moves: a thug has 1, a bruiser 2), the last block is the knock-out finisher that launches them away. A wrong key makes the locked thug hit the hero (8 HP, once per key position); being too slow does too: a wind-up ring over the one attacking thug fills and when full they hit (12 HP). Health is one bar of 100; 0 ends the run. Clearing a scrap gives back 15 HP. Points are multiplied by level × level (`multiplier`) and by a streak multiplier (×2 from 5 perfect knock-outs in a row, ×3 from 10, ×4 from 20).

The pace is very slow to start (rings of about 3× the player's seconds per key) and only tightens once the level being played is mastered (`slackFor(rampSteps)`; `rampSteps` counts scraps cleared on a mastered level and resets when a new level opens).

It is the third game of the Typing path (`"section": "typing"` in `game.json`), so the menu lists it only when Typing is chosen. The course, key stats, lesson, level picker and test-out are `src/shared/typing/` (read its `MAP.md`); progress made here counts in Type Rider and Typo Troopers and the other way round. There is no keyboard picture on screen. The planned stages, bosses, items and victory dances (M2) are in the doc `docs/type-brawl.md` of the main checkout (not committed).

Voice rule (owner): only the lesson's finger explanations are spoken, by the lesson itself. Nothing in this folder calls `speak()` except to hand it to `showKeyLesson`: fights, level-ups, the test-out and the results are text and sound effects only.

CSS prefix: `br-` (the shared typing styles already own `tb-`).

## Files

- `main.ts`: wiring and flow: `startTypingSession`, the start screen (`openPicker`, `showTestOut`, the lesson), the phases (`start`, `walking`, `entering`, `fighting`, `scrapclear`, `over`), thugs (slot, block, label, ring), the hero's strike queue (step up, move, contact), `onKey` (lock-on, right, wrong), the rings and hits, scrap clear and level-ups, labels placement, `showResults` and the "needs a keyboard" note
- `rules.ts`: pure: blocks and moves (`BLOCKS`, `moveClassOf`, `pickMove`), scrap size and kinds, ring seconds and the pace (`slackFor`, `ringSeconds`, `mastered`), `lockThug`, `attackerOf`, points, health, the speed levels' groups, the run's stats and the results line
- `layout.ts`: pure: the camera (`halfWidthFor`, `fovFor`, `lookYFor`), the four slots, `pickSlot`, speeds, and where labels may go under the HUD (`labelMinY`, `clampLabelY`)
- `moves.ts`: pure keyframes: the hero's ten moves (`MOVES`, `moveFrame`, `moveSpin`, `mirrorPose`), what a thug does when hit (`reactionFrame`) or launched (`launchPath`, `flyingPose`), the swing, recoil and fall poses
- `person.ts`: the jointed cartoon person (copied from En Garde, trimmed): `createPerson`, `Pose`, `runPose`, `createAnimator`, `mixPose`
- `fighters.ts`: dresses and poses a person: `HERO_LOOK`, `lookFor` (thug, bruiser), `createFighter` with `setMode` (idle, walk, move, swing, hurt, react, launch, down), `disposeFighter`
- `street.ts`: the scenery: sky gradient, asphalt, sidewalk, buildings and props in 12-unit chunks spawned ahead of the camera and recycled behind it
- `effects.ts`: 24 pooled star and cube bits, the camera shake, and the comic words (`createWords`)
- `labels.ts`: the DOM labels of keys above the thugs (keys, pips, wind-up ring) and the pops of text; pure `staggerLabels` and `labelFontPx`
- `hud.ts`: the panel under the buttons: avatar, health bar with the ghost chunk, score, streak badge, level, fight and best; the red edge flash
- `dev.ts`: `devOptions()` / `parseDev` (below)
- `voice.ts`: `VOICE_LINES`: the lesson's finger explanations (`TYPING_VOICE_LINES`) and nothing else
- `index.html`, `game.json`, `thumbnail.svg`: the page (styles of the HUD, labels, pops, comic words and the note), the manifest and the menu picture

## Dev hooks

- `?level=<1-40>`: play that level (open in memory; the keys of the levels before it count as learned).
- `?start=1`: skip the picker and the lesson (play again still shows the picker). `?lesson=1`: show the level's lesson even if it was seen.
- `?spk=<seconds>`: seconds per key to start with. `?chunk=<text>`: every block is this text (`%20` is a space); the closing space is added.
- `?thugs=<1-3>`: the size of the first scrap. `?kind=thug|bruiser`: the kind of every thug.
- `?lock=<1-4>`: the thug in that slot (near right, near left, far right, far left) starts locked; `?typed=<n>`: with it, n keys done. `?wrong=1`: holds the red flash on the locked label and a ghost chunk on the health bar.
- `?hp=<1-100>`: start with that health. `?scrap=<n>`: start at fight n. `?ramp=<0-20>`: start `rampSteps`. `?ring=<0-1>`: the attacker's ring starts this full.
- `?freeze=1`: the walk, thugs, rings and particles hold; thugs start in their slots; keys still work.
- `?move=<id>`: the hero always uses this move. `?at=<seconds>`: the first move (and the hit it lands) holds at that time.
- `?levelup=1`: the first scrap clear passes the level (its lesson shows).
- `?keys=<text>`: once the fight starts, these keys (at most 12, `%20` is a space) are typed in order.
- With any hook nothing is saved.
- Examples: `npm run shots -- "type-brawl?start=1&level=1&freeze=1&thugs=3&lock=2&typed=1" "type-brawl?start=1&level=1&freeze=1&thugs=1&chunk=fjf&keys=fjf%20&move=flying-kick&at=0.55" "type-brawl?start=1&level=5&freeze=1&thugs=3&ring=0.85"`

## Where changes go

- Block lengths, points, the pace of the rings, hits and health: `rules.ts` (tested in `tests/type-brawl.test.ts`).
- The planned chunks of keys: `src/shared/typing/chunks.ts`. Levels, lessons, key stats, seconds per key: `src/shared/typing/`.
- What a move looks like and when it lands: `moves.ts`; the people and their modes: `fighters.ts`, `person.ts`.
- What a scrap does, the keys, hits, the start screen and the results: `main.ts`.
- Camera, slots and label room: `layout.ts`; the HUD, labels and pops styles: `index.html`.

## Tests

`tests/type-brawl.test.ts` (dev hooks, moves, blocks, ring pace, lock-on, attackers, points, scraps, chunks, layout, labels, voice lines and that only the lesson speaks), `tests/key-invaders.test.ts` (the shared chunk planner through its re-export), `tests/typing-screens.test.ts` (the lesson and picker line options), `tests/menu-choices.test.ts` (the Typing choice).
