# Type Brawl map

A side-on 3D beat-'em-up (Double Dragon style) for typing. The hero (a kid) walks right through a scrolling city; every few seconds a scrap starts and up to 3 enemies (toy robots and goofy monsters; "thug", "bruiser" and "boss" stay the internal kinds) walk in from both sides and stop in punching range. Nobody gets hurt: hits clang or squish with comic words (`HIT_WORDS`), a finisher launches the enemy and it pops apart (robots into bolts, springs and confetti; monsters into stars and puffs), and when an enemy hits the hero it is a silly bonk (stars circle his head, a yellow flash, no red). A stage is 3 scraps and then a boss scrap; there are four stages (street, docks, dojo, rooftop) and then they loop, each loop a little harder. Each thug shows a block of keys above its head. The first key locks the hero onto that thug (the hero turns to face them); typing the block, ending with the space bar, throws one move at them. A thug has 1 to 3 blocks (a combo of different moves: a thug has 1, a bruiser 2), the last block is the knock-out finisher that launches them away. A wrong key makes the locked enemy bonk the hero (8 HP, once per key position); being too slow does too: a wind-up ring over the one attacking thug fills and when full they hit (12 HP). Health is one bar of 100; 0 ends the run. Clearing a stage (its boss) gives back 40 HP; a scrap gives nothing back. Points are multiplied by level × level (`multiplier`) and by a streak multiplier (×2 from 5 perfect knock-outs in a row, ×3 from 10, ×4 from 20).

The pace is very slow to start (rings of about 3× the player's seconds per key) and only tightens once the level being played is mastered (`slackFor(rampSteps)`; `rampSteps` counts stages cleared on a mastered level and resets when a new level opens).

It is the third game of the Typing path (`"section": "typing"` in `game.json`), so the menu lists it only when Typing is chosen. The course, key stats, lesson, level picker and test-out are `src/shared/typing/` (read its `MAP.md`); progress made here counts in Type Rider and Typo Troopers and the other way round. There is no keyboard picture on screen.
Stages, bosses, items and dances:

- **Stages** (`STAGES` in `rules.ts`, palettes and props; `street.ts` is built from one): scrap 1 to 3 of a stage have `scrapSize(scrap, loop)` thugs (bruisers from scrap 3, or from scrap 1 after stage 1), the 4th is the boss scrap: "Boss: <name>" banner and `sfx.alarm()` for 1 s, then the boss walks in alone and 2 thugs follow at 2 s intervals. Each loop adds a thug to every scrap (8 at the most). The stage number counts across loops (`stageInfo`); the HUD reads "Stage 2 · 1/3" or "Stage 2 · Boss".
- **Bosses** (Giga-Bot, a silver-blue robot; Fuzzball King, a purple fuzzball with a crown and cape; Slime Duke, a green jelly in a top hat and monocle; Robo-Rex, a teal toy dinosaur): kind `boss`, blocks 2, 3, 3, 4, 5, a ring hit of 20, scale 1.4 (body, species and colour are on the `StageDef`), label font floor 17 px (`BOSS_FONT_FLOOR`).
- **Enemies** (`lookFor` in `fighters.ts`, pieces in `bodies.ts`): a thug is a `toy-robot` (wind-up key that turns, faster while its ring runs) or a fuzzy `monster` (cyclops or two eyes, horns, buck teeth, tail), a bruiser (scale 1.2) a `box-robot` or a `big-monster`, in a bright colour. They turn a little to the camera so their faces show. Species picks the comic words, the bits and the hit sound (robot light/medium `slap`, monster `glove`, heavy `thud`, finisher `boom`).
- **Moves**: 13 (jab, cross; hook, kick, elbow, knee, headbutt; uppercut, roundhouse, back-elbow; flying-kick, spin-kick, throw). The pop: after the air and lying phases the enemy vanishes and `effects.pop` bursts 14 bits (`sfx.fizz()`); the flight is capped so the pop lands inside the picture.
- **Bonk and hero down**: a hit on the hero shows `createBonkStars` (0.8 s), a "BONK!" word and the yellow `br-flash`; at 0 HP the hero sits down dizzy with the stars ("Bonked out!") until the results.
- **Stage clear** (`clearStage` in `main.ts`): the bonus (3 scrap bonuses), 40 HP back, the hero dances (`chooseDance()`, `DANCE_SECONDS`, mode `dance` of the fighter), then the level-up check and its lesson, then the next stage's walk (the street is rebuilt when the look changes).
- **Items**: a thug or bruiser drops one with probability 0.25 (cola +20 HP, pizza +40, star: the next 3 knock-outs are perfect for the streak and score only). The block is 2 keys and a space on a floating label with the emoji; typing it makes the hero jog over and grab it. A wrong key only buzzes. Items are locked after thugs, stay until the next fight starts (the scrap clear waits 2 s more while one is on the street) and are typeable in the fighting and scrap-clear phases.

Voice rule (owner): only the lesson's finger explanations are spoken, by the lesson itself. Nothing in this folder calls `speak()` except to hand it to `showKeyLesson`: fights, level-ups, the test-out and the results are text and sound effects only.

CSS prefix: `br-` (the shared typing styles already own `tb-`).

## Files

- `main.ts`: wiring and flow: `startTypingSession`, the start screen (`openPicker`, `showTestOut`, the lesson), the phases (`start`, `walking`, `entering`, `fighting`, `scrapclear`, `stageclear`, `over`), thugs (slot, block, label, ring), the hero's strike queue (step up, move, contact), `onKey` (lock-on, right, wrong, items), the rings and hits, the boss entrance, items and the grab jog, scrap clear, stage clear with the dance and the level-up check, labels placement, `showResults` and the "needs a keyboard" note
- `rules.ts`: pure: blocks and moves (`BLOCKS`, `moveClassOf`, `pickMove`), species, bodies and comic words (`Species`, `Body`, `HIT_WORDS`, `pickWord`, `THUG_BODIES`), scrap size and kinds (`scrapSize`, `scrapKinds`, `bossScrapKinds`), the stages (`STAGES`, `stageInfo`, `stageBonus`), items (`pickItem`, `dropsItem`, `ITEM_HEAL`), ring seconds and the pace (`slackFor`, `ringSeconds`, `mastered`), `lockThug`, `attackerOf`, points, health, the speed levels' groups, the run's stats and the results line
- `layout.ts`: pure: the camera (`halfWidthFor`, `fovFor`, `lookYFor`), the four slots, `pickSlot`, speeds, and where labels may go under the HUD (`labelMinY`, `clampLabelY`)
- `moves.ts`: pure keyframes: the hero's 13 moves (`MOVES`, `moveFrame`, `moveSpin`, `mirrorPose`), what an enemy does when hit (`reactionFrame`) or launched (`launchPath`, `flyingPose`), the swing, recoil and sit-down poses (`downPose`), `POP_AT` and `LAUNCH_SECONDS`
- `person.ts`: the jointed cartoon person (copied from En Garde, trimmed): `createPerson` (a style with `body` hides the kid's face, hair and torso and adds a robot or monster; `tick` moves the key, tails and googly pupils), `Pose`, `runPose`, `createAnimator`, `mixPose`; hats `headband`, `crown`, `tophat`
- `bodies.ts`: the toy robot and monster pieces built on a person's torso and head (`buildBody`), and the limb colours of each body (`bodyPalette`)
- `fighters.ts`: dresses and poses a person: `HERO_LOOK`, `lookFor` (every kind: body, species, colour), `speciesOf`, `createFighter` with `setMode` (idle, walk, move, swing, hurt, react, launch, down, dance), `disposeFighter`
- `street.ts`: the scenery of a stage (`createStreet(scene, stage)`): sky gradient, ground, the strip behind (sidewalk, or water on the docks), buildings and the stage's props in 12-unit chunks spawned ahead of the camera and recycled behind it
- `effects.ts`: 24 pooled bits (`hit` by species, `pop`), the camera shake, `createBonkStars` and the comic words (`createWords`)
- `labels.ts`: the DOM labels of keys above the thugs (keys, pips, wind-up ring) and over items (an emoji, no ring), and the pops of text; pure `staggerLabels` and `labelFontPx`
- `hud.ts`: the panel under the buttons: avatar, health bar with the ghost chunk, score, streak badge, star badge, level, stage and fight, and best; the yellow edge flash (`hurt(hold?)`)
- `dev.ts`: `devOptions()` / `parseDev` (below)
- `voice.ts`: `VOICE_LINES`: the lesson's finger explanations (`TYPING_VOICE_LINES`) and nothing else
- `index.html`, `game.json`, `thumbnail.svg`: the page (styles of the HUD, labels, pops, comic words and the note), the manifest and the menu picture

## Dev hooks

- `?level=<1-40>`: play that level (open in memory; the keys of the levels before it count as learned).
- `?start=1`: skip the picker and the lesson (play again still shows the picker). `?lesson=1`: show the level's lesson even if it was seen.
- `?spk=<seconds>`: seconds per key to start with. `?chunk=<text>`: every block is this text (`%20` is a space); the closing space is added.
- `?thugs=<1-3>`: the size of the first scrap. `?kind=thug|bruiser`: the kind of every thug; `?kind=boss`: the first fight is the stage's boss scrap (`thugs=1` is the boss alone).
- `?stage=<1-4>`: start at that stage; `?loop=<n>`: after n loops of the four. `?scrap=<1-4>`: the fight in the stage (4 is the boss).
- `?item=cola|pizza|star`: an item of that type is on the street when the first fight starts and every drop is that type.
- `?win=dance`: the first fight is skipped, the stage clears at once and the dance holds for ever (with `?at=<s>` it holds at that time; `?dance=<id>` picks the dance).
- `?lock=<1-4>`: the thug in that slot (near right, near left, far right, far left) starts locked; `?typed=<n>`: with it, n keys done. `?wrong=1`: holds the red flash on the locked label and a ghost chunk on the health bar.
- `?hp=<1-100>`: start with that health. `?ramp=<0-20>`: start `rampSteps`. `?ring=<0-1>`: the attacker's ring starts this full.
- `?species=robot|monster`: every thug and bruiser is that species (bosses unchanged). `?bonk=1`: the hero's bonk (stars, BONK!, yellow flash) holds once the fight starts. `?pop=1`: the first finisher holds 0.15 s into its pop.
- `?freeze=1`: the walk, thugs, rings and particles hold; thugs start in their slots; keys still work.
- `?move=<id>`: the hero always uses this move. `?at=<seconds>`: the first move (and the hit it lands) holds at that time.
- `?levelup=1`: the first stage clear passes the level (its lesson shows).
- `?keys=<text>`: once the fight starts, these keys (at most 12, `%20` is a space) are typed in order.
- With any hook nothing is saved. To play through a boss by hand: `type-brawl?start=1&level=1&kind=boss&thugs=1&chunk=f&keys=f%20f%20f%20f%20f%20`.
- Examples: `npm run shots -- "type-brawl?start=1&level=1&freeze=1&kind=boss&thugs=3" "type-brawl?start=1&level=1&freeze=1&thugs=3&stage=3" "type-brawl?start=1&level=1&freeze=1&win=dance&at=0.6&dance=floss&stage=2" "type-brawl?start=1&level=1&freeze=1&thugs=2&item=pizza"`; and for the fight: `npm run shots -- "type-brawl?start=1&level=1&freeze=1&thugs=3&lock=2&typed=1" "type-brawl?start=1&level=1&freeze=1&thugs=1&chunk=fjf&keys=fjf%20&move=flying-kick&at=0.55" "type-brawl?start=1&level=5&freeze=1&thugs=3&ring=0.85"`; and for the robots and monsters: `npm run shots -- "type-brawl?start=1&level=1&freeze=1&thugs=3&species=robot&lock=1&typed=1" "type-brawl?start=1&level=1&freeze=1&kind=boss&stage=2" "type-brawl?start=1&level=1&freeze=1&thugs=1&species=monster&chunk=fjf&keys=fjf%20&move=flying-kick&pop=1" "type-brawl?start=1&level=1&freeze=1&thugs=1&chunk=fj&keys=fj%20&move=headbutt&at=0.22" "type-brawl?start=1&level=1&freeze=1&thugs=2&bonk=1"`

## Where changes go

- Block lengths, points, the pace of the rings, hits, health, stages (palettes, props, bosses) and items: `rules.ts` (tested in `tests/type-brawl.test.ts`).
- The planned chunks of keys: `src/shared/typing/chunks.ts`. Levels, lessons, key stats, seconds per key: `src/shared/typing/`.
- What a move looks like and when it lands: `moves.ts`; the people and their modes: `fighters.ts`, `person.ts`; what a robot or monster looks like: `bodies.ts`.
- What a scrap does, the keys, hits, the start screen and the results: `main.ts`.
- Camera, slots and label room: `layout.ts`; the HUD, labels and pops styles: `index.html`.

## Tests

`tests/type-brawl.test.ts` (dev hooks, moves, blocks, ring pace, lock-on, attackers, points, scraps, stages, bosses, items, chunks, layout, labels, voice lines and that only the lesson speaks), `tests/key-invaders.test.ts` (the shared chunk planner through its re-export), `tests/typing-screens.test.ts` (the lesson and picker line options), `tests/menu-choices.test.ts` (the Typing choice).
