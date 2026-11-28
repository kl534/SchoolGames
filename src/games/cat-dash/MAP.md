# Cat Dash map

A side-view endless run: pick one of ten cats, then run through places (house: living room, kitchen, bathroom, bedroom; town: backyard, park, street, rooftops; busy: grocery store, library, fish market, construction site; adventure: beach, snowy forest, desert, space station; plus the farm and the zoo in town, the jungle in adventure, the toy store in busy and the pirate ship in adventure). Each place has three obstacles of its own and a visit is six of them (each twice). Answer right for a stylish move, wrong for a silly flop and a lost life (3 lives). After six obstacles the cat runs through a doorway into a new place.

## Files

- `main.ts`: the game loop, learning loop, picker, moves, doorway and wiring of everything below
- `rules.ts`: pure scoring, lives, `visitPlan`, `nextPlace`, approach and sprint maths, fish trails, spoken lines
- `places.ts`: the places and their obstacles as data (`PLACES`, `placeOf`, `PlaceLook`)
- `looks.ts`: the ten cats' colours, their builds, the saved choice (`CAT_SETTING`, `savedCat`) and the face SVG (`catFaceSvg`)
- `layout.ts`: side-view screen fitting (`fitView`, `playBand`, `riseFor`, `FOV`)
- `moves.ts`: the 252 cat moves: the frame sampler (`moveFrame`, `moveDuration`, `moveEvents`, `MOVE_SPECS`, `MOVE_WORDS`) over the groups' move tables
- `moves/toolkit.ts`: pure animation toolkit: poses, `CatFrame`, segments (`Seg`), `arc`, `follow`, `failEnd`
- `moves/house.ts`: the 12 house obstacles' moves and the shared motions the props use (`shelfAngle`, `mopAngle`, `towelAngle`, `yarnX`, `closetDoor`)
- `moves/town.ts`: the 12 town obstacles' moves and the shared motions the props use (`swingAngle`, `padX`, `canX`, `skateX`, `snapAngle`, ...)
- `moves/busy.ts`: the 12 busy obstacles' moves and shared motions (`cartX`, `towerTilt`, `ladderX`, `barrelPose`, `beamAngle`, `hookPos`, ...)
- `moves/adventure.ts`: the 12 adventure obstacles' moves and shared motions (`waveY`, `snowX`, `duneY`, `boxCentre`, `laserOn`, `doorLift`, ...); the space station's floating boxes drift slowly (low gravity `fall`)
- `moves/extra.ts`: the 6 farm (`hay`, `scarecrow`, `chickens`) and jungle (`vine`, `stones`, `mud`) obstacles' moves and shared motions (`vineSwing`, `hayTip`, `armDrop`, `henScatter`)
- `moves/toys-pirates.ts`: the 6 toy store (`toy-train`, `blocks`, `ball-pit`) and pirate ship (`cannon`, `rigging`, `chest`) obstacles' moves and shared motions (`trainX`, `towerTopple`, `ballBounce`, `cannonRecoil`, `sailFlap`, `ropeSwing`, `lidAngle`, `coinSpray`, ...)
- `moves/zoo.ts`: the 3 zoo obstacles' (`elephant`, `giraffe`, `penguins`) 12 moves and shared motions (`trunkCurl`, `trunkJoints`, `earFlap`, `neckBend`, `neckJoints`, `giraffeHead`, `headTop`, `tongueOut`, `penguinPose`)
- `kit.ts`: prop-building helpers that remember what to dispose (`Kit`, `Prop`): bevelled boxes (`Kit.box`, plain under `BEVEL_MIN`, one bevel segment under `BEVEL_FINE`), the painted materials `wood`, `fabric`, `foliage`, `metal`, `stone`, and `castShadows` (solid parts at least `SHADOW_MIN` across cast real shadows)
- `merge.ts`: static batching: `mergeStatic` bakes a decor tile's or the ground's plain opaque meshes into one mesh per material (see-through, hidden and mirrored ones stay as they are), so a tile is a few draw calls
- `textures.ts`: the canvas painters for material grain, floors, walls, backdrops and fades (`paintGrain`, `paintFloor`, `paintWall`, `paintBackdrop`, `paintFade`); all tile seamlessly and need no three.js
- `cat.ts`: the cat rig and its poses, faces, coats and hats (`createCat`), with its ink outline (`cat.outline`)
- `cat-materials.ts`: the fur material with a rim of light (`furMaterial`)
- `quality.ts`: pure quality tiers (`high`, `medium`, `low`, and `lowest`, which draws fewer pixels than the screen and no antialiasing, for the slowest Chromebooks), the starting tier (`initialQuality`) and the governor that steps down when fps is under 45, counting frames slower than 10 fps too (`createGovernor`)
- `lighting.ts`: pure light and haze of each place (`lightFor`)
- `render.ts`: tone mapping, environment sheen, key light with its cast shadow, fill light, haze and pixel ratio (`createLook`)
- `outline.ts`: inverted-hull ink outlines (`addOutline`, `setOutlineView`)
- `props/house.ts`: the 12 house obstacles as meshes posed by `update(outcome, variant, t)`
- `props/house-scenery.ts`: the decor of the four house places (`HOUSE_SCENERY`, `WALL_Z`)
- `props/town.ts`: the 12 town obstacles as meshes
- `props/busy.ts`: the 12 busy obstacles as meshes
- `props/adventure.ts`: the 12 adventure obstacles as meshes
- `props/parts.ts`: small helpers the busy and adventure props share (`makeProp`, `sphere`, `cyl`, `beam`, `hash`)
- `props/town-scenery.ts`: the outdoor decor of the four town places and their far layer (`TOWN_SCENERY`, `buildOutdoorFar`)
- `props/busy-scenery.ts`: the decor of the grocery store, library, fish market (indoors) and construction site (outdoors) (`BUSY_SCENERY`)
- `props/adventure-scenery.ts`: the decor of the beach, snowy forest, desert (outdoors) and the space station (indoors, starry window) (`ADVENTURE_SCENERY`)
- `props/extra.ts`: the 6 farm and jungle obstacles as meshes
- `props/extra-scenery.ts`: the decor of the farm and the jungle (`EXTRA_SCENERY`)
- `props/toys-pirates.ts`: the 6 toy store and pirate ship obstacles as meshes
- `props/toys-pirates-scenery.ts`: the decor of the toy store (indoors, shelves of toys) and the pirate ship (outdoors: sea, island, rail, mast) (`TOYS_PIRATES_SCENERY`)
- `props/zoo.ts`: the 3 zoo obstacles as meshes (a trunk that curls and sprays, a neck that bends, three waddling penguins on flat ice)
- `props/zoo-scenery.ts`: the decor of the zoo (outdoors: sandy path, enclosure fences with picture signs, trees, balloon cart, pond) (`ZOO_SCENERY`)
- `props/pool.ts`: one built prop per obstacle, each with its ink outline, pruned when a place is left (`createPropPool`, `setOutlines`, `PROP_BUILDERS`)
- `world.ts`: the current place: one long textured wall and floor (`buildGround`) with baked AO bands and a lip, the decor tiles (`buildScenery`) with front-edge dressing, two parallax backdrop strips outdoors, the far layer and the blob shadow (`createWorld`)
- `door.ts`: the doorways between places: house `door`, town `gate`, busy `shop-doors`, adventure `portal` and the zoo's own `zoo-arch` (`createDoorway(kind, next)`, `DOOR_ICONS`; `doorOf(place)` in `places.ts` picks the kind)
- `fish.ts`: the fish treats: lathe body, fins, eyes, ink outline, bob and spin (`createFishSet`, `fishBob`, `fishSpin`)
- `effects.ts`: dust, splash, stars, poof, bubbles, feathers, sparkle, confetti as one pooled `Points` of soft puffs, glowing stars and rounded squares (`createEffects`, `fadeAlpha`)
- `hud.ts`: question panel, place strip, lives, banner, comic words, bonk flash and iris wipe (`createHud`)
- `picker.ts`: the cat picker overlay (`showCatPicker`)
- `dev.ts`: dev query hooks (`parseDev`, `devOptions`)
- `voice.ts`: every spoken line that is not a fact (`VOICE_LINES`)

## Sounds

- The meow (three kitten meows at random), yowl and hiss are real CC0 cat recordings in `public/sfx/cat/` (sources in its `SOURCES.md`), played by `sfx` in `src/shared/audio.ts` (`CAT_CLIPS`); `main.ts` preloads them with `preloadCatSounds()`. Until they load the synthesised ones play. The purr is still synthesised.

## Performance

- The target is a Lenovo 500e-class Chromebook (Celeron, Intel UHD, 1366x768). Decor never moves, so `world.ts` merges each tile with `mergeStatic`; keep new decor static (an animated decor part needs `userData` set, which keeps it out of the merge). Only the cat, the props and the fish are separate meshes.

## Dev hooks

- `?cat=<orange|black|tuxedo|calico|grey-tabby|british-shorthair|siamese|white|ginger-white|tortoiseshell>`: skip the picker with that cat. `?lives=1|2|3`.
- `?place=<id>`: start in that place (`living-room`, `kitchen`, `bathroom`, `bedroom`, `backyard`, `park`, `street`, `rooftops`, `farm`, `grocery`, `library`, `fish-market`, `construction`, `beach`, `snowy-forest`, `desert`, `space-station`, `jungle`, `toy-store`, `pirate-ship`, `zoo`). `?places=a,b`: the places come in this order, then repeat. `?obstacle=<id>`: every obstacle is that one (its place is used).
- `?lab=<obstacle>:<clear|fail>:<0|1>`: move lab, loops one move with the HUD hidden. `&at=<seconds>` freezes it there (prop and effects included).
- `?door=<place>&at=<0..2.4>`: the doorway into that place frozen at that time (0 door in view, 1.2 iris closed, 1.55 open again, 2.4 banner).
- `?quality=high|medium|low|lowest`: fixes the quality tier (no saved tier, no automatic step down). The tier is otherwise saved per device under `cd-quality`.
- Example: `npm run shots -- "cat-dash?lab=couch:clear:0&at=0.9" "cat-dash?door=kitchen&at=1.2"`

## Where changes go

- A new obstacle: its id in `places.ts`, its moves in `moves/<group>.ts` (`HOUSE_MOVES`, `TOWN_MOVES`, `BUSY_MOVES`, `ADVENTURE_MOVES`, `EXTRA_MOVES`, `TOYS_PIRATES_MOVES`, `ZOO_MOVES`), its builder in `props/<group>.ts` and `props/pool.ts`.
- A new place: a `Place` in `places.ts` (with `wallPattern` indoors, `backdrop` outdoors), decor in `props/<group>-scenery.ts` (floor and wall patterns are painted in `textures.ts`), its speech line (then `npm run voice`).
- Scoring, lives, order or approach timing: `rules.ts`. A new cat: `looks.ts` (and `cat.ts` for new parts).
- A new state that is hard to reach: extend `parseDev` in `dev.ts` and its test.

## Tests

- `tests/cat-dash.test.ts`
- `tests/cat-dash-graphics.test.ts` (quality, light, outlines, places, textures)
- `tests/cat-dash-props.test.ts` (prop outlines and smooth shapes, fish, particle fade)
- `tests/cat-dash-moves.test.ts` (all 252 moves sampled every 1/60 s)
- `tests/cat-dash-sounds.test.ts` (every `sfx:` event names a sound in `src/shared/audio.ts`)
- `tests/tap-to-continue.test.ts` (tap-to-continue flow in `main.ts`)
