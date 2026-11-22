/** A part of speech: wrong answers are drawn from words of the same one. */
export type PartOfSpeech = 'noun' | 'verb' | 'adj' | 'adv';

/**
 * One vocabulary word: [head word, part of speech, synonyms, antonyms]. `synonyms[0]` is the
 * synonym answer; `antonyms[0]` (when there is one) is the antonym answer. The other words are
 * never shown: they only keep near words out of the wrong answers.
 */
export type VocabRow = [word: string, pos: PartOfSpeech, synonyms: string[], antonyms: string[]];

/** [definition, example]. The example marks the head word (or a regular form of it) as *word*, once. */
export type WordMeaning = [definition: string, example: string];
