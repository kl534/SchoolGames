# En Garde! map

A backyard birthday-party duel, seen side-on. You (left) and a party kid (right) fight with balloon-animal swords. A right answer pokes the rival (one of four cartoon reactions); a wrong answer or a time-out lets the rival poke you. Land the rival's `pokesToWin` (8 to 12) before you take 3 pokes. The final poke launches the loser into the birthday cake. There are 5 rivals on a ladder per topic; a win climbs a rung, a loss drops one, and beating the 5th makes you Party Champion for good (then every bout is a rematch against a random rival).

## Files

- `main.ts`: the flow (VS card, preview, "En garde!", turns, pokes, finisher, results), the question clock, camera and wiring
- `rules.ts`: pure bout and ladder rules (`step`, `nextRung`, `rivalFor`, `boutStars`), the five `RIVALS`, poke words and calls, `outcomeText`, the fixed spoken lines
- `moves.ts`: every move as pure keyframes (`pokeFrame`, `finishFrame`, `restFrame`, `POKE_AIM`) and the timings (`CONTACT_T`, `POKE_TOTAL`, `NEXT_GAP`, `FINISH_SPLAT`)
- `layout.ts`: camera fit for the party, using a subject box (`fitCamera`, `playBand`)
- `person.ts`: the jointed kid rig, copied from Buzzer Beater and extended with hats, cape, eyepatch, box armour, scale and cross eyes
- `fighters.ts`: a fighter from the rig and a sword, dressed from a `FighterLook` (`US_LOOK`, `RIVAL_LOOKS`), posed from a `FighterFrame`
- `sword.ts`: the balloon sword with its two-joint wobbling blade (`createSword`)
- `party.ts`: lawn, fence, bunting, balloons, cake table and cake, the watching kids (`buildParty`)
- `effects.ts`: confetti and cream (`createEffects`), dizzy stars, and the DOM comic words (`createWords`)
- `hud.ts`: the two fighting-game health bars (`createHealthBars`)
- `vs.ts`: the VS card with the ladder (`showVs`, class `eg-vs`, not `sg-overlay`)
- `dev.ts`: dev query hooks
- `voice.ts`: every spoken line that is not a fact (`VOICE_LINES`)

The ladder rung is saved per topic and game with `session.ladderRung()` and `session.recordLadderRung()` (see `src/shared/session.ts`).

## Dev hooks

- `?rung=0..5`: the ladder place, instead of the saved one (results still save normally).
- `?rival=1..5`: face that rival.
- `?pokes=<landed>-<taken>`: the starting counts, ignored if they would already end the bout.
- `?poke=belly|head|nose|bottom`: every poke is that kind.
- `?vs=skip`: skip the VS card.
- `?auto=right|wrong`: answer the first question 0.3 s after its reading ends; skips the VS card, the preview and the "En garde!" wait.
- `?at=<s>`: freeze the first poke or finisher at that time; the HUD stays. A poke that has already ended by then just carries on.
- Examples: `npm run shots -- "en-garde?rung=5&rival=4"` (the crowned VS card), `"en-garde?auto=right&poke=head&at=0.6"`, `"en-garde?pokes=7-0&auto=right&at=2.2"` (rival in the cake), `"en-garde?pokes=3-2&auto=wrong&at=2.2"` (you in the cake).

## Where changes go

- Rules, rivals, ladder, the words on screen: `rules.ts` (then `voice.ts` and `npm run voice` for spoken lines).
- How a poke or the finisher looks and its timing: `moves.ts`, then `fighters.ts` for how a frame becomes a pose.
- A rival's costume: `RIVAL_LOOKS` in `fighters.ts`; a new hat or accessory: `person.ts`.
- The party scenery and the watching kids: `party.ts`.
- Health bars and the question pill: `hud.ts` and `style.css`; the VS card: `vs.ts`.
- Camera framing on phones or tablets: `layout.ts`.

## Tests

- `tests/en-garde.test.ts`
- `tests/session.test.ts` and `tests/progress.test.ts` (the saved ladder rung)
