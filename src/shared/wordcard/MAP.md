# Word card map (`src/shared/wordcard/`)

After a miss on a vocabulary fact (`fact.meaning`, built in `src/shared/topics/vocabulary/index.ts` from `meanings-grade-<id>.ts`), `tapFlow` shows this card where the math miss pictures go: the asked word and its part of speech, a short definition, an example sentence with the word in yellow, and the answer ("Synonym: glad"). It says nothing: the miss reading is unchanged and `start(onDone)` calls `onDone` at once. A word without a meaning keeps the plain caption.

## Files

- `index.ts`: `createWordCard(fact)` (a `MissPicture`, or null without `fact.meaning`) and `devWordCard()`
- `card.ts`: `createWordCardElement(meaning, answer)`: the DOM (`sg-wc-` classes) and its `fit` (font scales `FIT_SCALES`, drops the answer line then the part of speech when short of room), `WORD_CARD_MAX_WIDTH`
- `wordcard.css`: the card's look
- `lab.html`, `lab.ts`: dev-only lab

## Dev

- `?wordcard=off` (any game, dev build): no word cards.
- Lab: `npm run shots -- "/src/shared/wordcard/lab.html?word=happy&kind=synonym"`; `kind=synonym|antonym`, `answers=row|grid`, `green=0..3`; `view=all&grade=<id>` lists every card of a grade.
