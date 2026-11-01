import { shuffle, type Random } from '../random';
import { WORLD_NEIGHBORS } from '../maps/world-data';
import { COUNTRIES, type Country } from './countries';
import type { Fact, Topic } from './types';

export const COUNTRY_PROMPT = 'Which country?';
export const COUNTRY_SPOKEN_PROMPT = 'Which country is this?';

const kebab = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const said = (country: Country): string => country.spoken ?? country.name;

/** The fact for one country: it is shown lit on its continent and its name is answered. */
export function countryFact(country: Country): Fact {
  return {
    id: `world-${kebab(country.name)}`,
    prompt: COUNTRY_PROMPT,
    answer: country.name,
    statement: country.name,
    spokenPrompt: COUNTRY_SPOKEN_PROMPT,
    spokenStatement: `This is ${said(country)}.`,
    wrongLines: Object.fromEntries(
      COUNTRIES.filter((other) => other !== country).map((other) => [
        other.name,
        `That's ${said(other)}.`,
      ]),
    ),
    map: { kind: 'world', country: kebab(country.name), continent: country.continent },
  };
}

const ROW_BY_ID: ReadonlyMap<string, Country> = new Map(
  COUNTRIES.map((row) => [`world-${kebab(row.name)}`, row]),
);
const ROW_BY_KEY: ReadonlyMap<string, Country> = new Map(
  COUNTRIES.map((row) => [kebab(row.name), row]),
);

/** Wrong countries: the ones bordering it, then the rest of its continent, then any other. Each group is shuffled. */
export function countryDistractors(fact: Fact, count: number, random: Random): string[] {
  const row = ROW_BY_ID.get(fact.id);
  if (!row) return [];
  const others = COUNTRIES.filter((other) => other !== row);
  const borders = (WORLD_NEIGHBORS[kebab(row.name)] ?? [])
    .map((id) => ROW_BY_KEY.get(id))
    .filter((r): r is Country => !!r);
  const sameContinent = others.filter((o) => o.continent === row.continent && !borders.includes(o));
  const rest = others.filter((o) => o.continent !== row.continent && !borders.includes(o));
  const picked = new Set<string>();
  for (const group of [borders, sameContinent, rest]) {
    for (const other of shuffle(group, random)) {
      if (picked.size < count) picked.add(other.name);
    }
  }
  return [...picked];
}

export const countryLocations: Topic = {
  id: 'country-locations',
  title: 'Find the country',
  subject: 'Social Studies',
  description: 'Find countries of the world on the map.',
  facts: COUNTRIES.map(countryFact),
  distractors: countryDistractors,
};
