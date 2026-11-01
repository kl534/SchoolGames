import { shuffle, type Random } from '../random';
import { US_STATE_NEIGHBORS } from '../maps/us-states-data';
import { DIVISION_REGION, kebab, STATE_CAPITALS, type StateCapital } from './capitals';
import type { Fact, Topic } from './types';

export const LOCATION_PROMPT = 'Which state?';
export const LOCATION_SPOKEN_PROMPT = 'Which state is this?';

const said = (row: StateCapital): string => row.spokenState ?? row.state;

/** The fact for one state: it is shown lit on a map and its name is answered. */
export function locationFact(row: StateCapital): Fact {
  return {
    id: `map-${kebab(row.state)}`,
    prompt: LOCATION_PROMPT,
    answer: row.state,
    statement: row.state,
    spokenPrompt: LOCATION_SPOKEN_PROMPT,
    spokenStatement: `This is ${said(row)}.`,
    wrongLines: Object.fromEntries(
      STATE_CAPITALS.filter((other) => other !== row).map((other) => [
        other.state,
        `That's ${said(other)}.`,
      ]),
    ),
    map: { kind: 'us-state', state: kebab(row.state) },
  };
}

const ROW_BY_ID: ReadonlyMap<string, StateCapital> = new Map(
  STATE_CAPITALS.map((row) => [`map-${kebab(row.state)}`, row]),
);
const ROW_BY_STATE: ReadonlyMap<string, StateCapital> = new Map(
  STATE_CAPITALS.map((row) => [kebab(row.state), row]),
);

/**
 * Wrong states: the ones bordering it, then the rest of the same division, then the same region,
 * then any other. Each group is shuffled.
 */
export function locationDistractors(fact: Fact, count: number, random: Random): string[] {
  const row = ROW_BY_ID.get(fact.id);
  if (!row) return [];
  const others = STATE_CAPITALS.filter((other) => other !== row);
  const region = DIVISION_REGION[row.division];
  const borders = (US_STATE_NEIGHBORS[kebab(row.state)] ?? [])
    .map((id) => ROW_BY_STATE.get(id))
    .filter((r): r is StateCapital => !!r);
  const sameDivision = others.filter((o) => o.division === row.division);
  const sameRegion = others.filter(
    (o) => o.division !== row.division && DIVISION_REGION[o.division] === region,
  );
  const rest = others.filter((o) => DIVISION_REGION[o.division] !== region);
  const picked = new Set<string>();
  for (const group of [borders, sameDivision, sameRegion, rest]) {
    for (const other of shuffle(group, random)) {
      if (picked.size < count) picked.add(other.state);
    }
  }
  return [...picked];
}

export const stateLocations: Topic = {
  id: 'state-locations',
  title: 'Find the state',
  subject: 'Social Studies',
  description: 'Find each of the 50 US states on the map.',
  facts: STATE_CAPITALS.map(locationFact),
  distractors: locationDistractors,
};
