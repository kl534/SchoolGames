# Penalty Kick map

The starter game: answer a question, then swipe to kick a physics ball past a goalie into a goal.

## Files

- `main.ts`: the game loop, learning loop, kick input, physics world and HUD in one file
- `field.ts`: pitch, goal and net meshes plus the goal's physics bodies (`buildField`, `buildGoalBodies`, `GOAL_WIDTH`)
- `goalie.ts`: the goalkeeper figure and his dives (`createGoalie`, `DiveOptions`)

## Dev hooks

None.

## Where changes go

- Pitch or goal size: `field.ts` (`GOAL_WIDTH`, `GOAL_HEIGHT`, `NET_DEPTH`).
- Goalie look or dive behaviour: `goalie.ts`.
- Kick feel, scoring or flow: `main.ts`.
- This is the template other games are copied from: keep it small and simple.

## Tests

- `tests/goalie.test.ts`
- `tests/tap-to-continue.test.ts` (checks the tap-to-continue flow in `main.ts`)
