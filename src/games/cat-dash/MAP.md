# Cat Dash map

A side-view endless run: pick one of four cats, then run through places (house: living room, kitchen, bathroom, bedroom; town: backyard, park, street, rooftops; busy: grocery store, library, fish market, construction site; adventure: beach, snowy forest, desert, space station). Each place has three obstacles of its own and a visit is six of them (each twice). Answer right for a stylish move, wrong for a silly flop and a lost life (3 lives). After six obstacles the cat runs through a doorway into a new place.

## Files

- `main.ts`: the game loop, learning loop, picker, moves, doorway and wiring of everything below
- `rules.ts`: pure scoring, lives, `visitPlan`, `nextPlace`, approach and sprint maths, fish trails, spoken lines
- `places.ts`: the places and their obstacles as data (`PLACES`, `placeOf`, `PlaceLook`)
- `looks.ts`: the four cats' colours, the saved choice (`CAT_SETTING`, `savedCat`) and the face SVG (`catFaceSvg`)
- `layout.ts`: side-view screen fitting (`fitView`, `playBand`, `riseFor`, `FOV`)
- `moves.ts`: the 96 cat moves: the frame sampler (`moveFrame`, `moveDuration`, `moveEvents`, `MOVE_SPECS`, `MOVE_WORDS`) over the groups' move tables
- `moves/toolkit.ts`: pure animation toolkit: poses, `CatFrame`, segments (`Seg`), `arc`, `follow`, `failEnd`
- `moves/house.ts`: the 12 house obstacles' moves and the shared motions the props use (`shelfAngle`, `mopAngle`, `towelAngle`, `yarnX`, `closetDoor`)
- `moves/town.ts`: the 12 town obstacles' moves and the shared motions the props use (`swingAngle`, `padX`, `canX`, `skateX`, `snapAngle`, ...)
- `moves/busy.ts`: the 12 busy obstacles' moves and shared motions (`cartX`, `towerTilt`, `ladderX`, `barrelPose`, `beamAngle`, `hookPos`, ...)
- `moves/adventure.ts`: the 12 adventure obstacles' moves and shared motions (`waveY`, `snowX`, `duneY`, `boxCentre`, `laserOn`, `doorLift`, ...); the space station's floating boxes drift slowly (low gravity `fall`)
- `kit.ts`: prop-building helpers that remember what to dispose (`Kit`, `Prop`)
- `cat.ts`: the cat rig and its poses, faces, coats and hats (`createCat`)
- `props/house.ts`: the 12 house obstacles as meshes posed by `update(outcome, variant, t)`
- `props/house-scenery.ts`: the decor of the four house places (`HOUSE_SCENERY`, `WALL_Z`)
- `props/town.ts`: the 12 town obstacles as meshes
- `props/busy.ts`: the 12 busy obstacles as meshes
- `props/adventure.ts`: the 12 adventure obstacles as meshes
- `props/parts.ts`: small helpers the busy and adventure props share (`makeProp`, `sphere`, `cyl`, `beam`, `hash`)
- `props/town-scenery.ts`: the outdoor decor of the four town places and their far layer (`TOWN_SCENERY`, `buildOutdoorFar`)
- `props/busy-scenery.ts`: the decor of the grocery store, library, fish market (indoors) and construction site (outdoors) (`BUSY_SCENERY`)
- `props/adventure-scenery.ts`: the decor of the beach, snowy forest, desert (outdoors) and the space station (indoors, starry window) (`ADVENTURE_SCENERY`)
- `props/pool.ts`: one built prop per obstacle, pruned when a place is left (`createPropPool`, `PROP_BUILDERS`)
- `world.ts`: wall, floor pattern, lights, far layer and blob shadow of the current place (`createWorld`, `buildScenery`)
- `door.ts`: the doorways between places: house `door`, town `gate`, busy `shop-doors`, adventure `portal` (`createDoorway`, `DOOR_ICONS`)
- `effects.ts`: dust, splash, stars, poof, bubbles, feathers, sparkle, confetti as one pooled `Points` (`createEffects`)
- `hud.ts`: question panel, place strip, lives, banner, comic words, bonk flash and iris wipe (`createHud`)
- `picker.ts`: the cat picker overlay (`showCatPicker`)
- `dev.ts`: dev query hooks (`parseDev`, `devOptions`)
- `voice.ts`: every spoken line that is not a fact (`VOICE_LINES`)

## Dev hooks

- `?cat=<orange|black|tuxedo|calico>`: skip the picker with that cat. `?lives=1|2|3`.
- `?place=<id>`: start in that place (`living-room`, `kitchen`, `bathroom`, `bedroom`, `backyard`, `park`, `street`, `rooftops`, `grocery`, `library`, `fish-market`, `construction`, `beach`, `snowy-forest`, `desert`, `space-station`). `?places=a,b`: the places come in this order, then repeat. `?obstacle=<id>`: every obstacle is that one (its place is used).
- `?lab=<obstacle>:<clear|fail>:<0|1>`: move lab, loops one move with the HUD hidden. `&at=<seconds>` freezes it there (prop and effects included).
- `?door=<place>&at=<0..2.4>`: the doorway into that place frozen at that time (0 door in view, 1.2 iris closed, 1.55 open again, 2.4 banner).
- Example: `npm run shots -- "cat-dash?lab=couch:clear:0&at=0.9" "cat-dash?door=kitchen&at=1.2"`

## Where changes go

- A new obstacle: its id in `places.ts`, its moves in `moves/<group>.ts` (`HOUSE_MOVES`, `TOWN_MOVES`, `BUSY_MOVES`, `ADVENTURE_MOVES`), its builder in `props/<group>.ts` and `props/pool.ts`.
- A new place: a `Place` in `places.ts`, decor in `props/<group>-scenery.ts` (floor patterns are drawn in `world.ts`), its speech line (then `npm run voice`).
- Scoring, lives, order or approach timing: `rules.ts`. A new cat: `looks.ts` (and `cat.ts` for new parts).
- A new state that is hard to reach: extend `parseDev` in `dev.ts` and its test.

## Tests

- `tests/cat-dash.test.ts`
- `tests/cat-dash-moves.test.ts` (all 96 moves sampled every 1/60 s)
- `tests/cat-dash-sounds.test.ts` (every `sfx:` event names a sound in `src/shared/audio.ts`)
- `tests/tap-to-continue.test.ts` (tap-to-continue flow in `main.ts`)
