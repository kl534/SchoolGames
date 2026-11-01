import { shuffle, type Random } from '../random';
import type { Fact, Topic } from './types';

/** The nine US Census divisions. */
export type Division =
  | 'new-england'
  | 'middle-atlantic'
  | 'east-north-central'
  | 'west-north-central'
  | 'south-atlantic'
  | 'east-south-central'
  | 'west-south-central'
  | 'mountain'
  | 'pacific';

export interface StateCapital {
  /** Shown name, 'New York'. */
  state: string;
  /** Shown answer, 'Albany'. */
  capital: string;
  division: Division;
  /** The big city mistaken for the capital, shown as a wrong answer; `spoken` defaults to `city`. */
  trap?: { city: string; spoken?: string };
  /** How the state is said, when not its shown name. */
  spokenState?: string;
  /** How the capital is said, when not its shown name. */
  spokenCapital?: string;
}

type Row = [state: string, capital: string, division: Division, trap?: StateCapital['trap']];

const ROWS: Row[] = [
  ['Alabama', 'Montgomery', 'east-south-central'],
  ['Alaska', 'Juneau', 'pacific', { city: 'Anchorage' }],
  ['Arizona', 'Phoenix', 'mountain'],
  ['Arkansas', 'Little Rock', 'west-south-central'],
  ['California', 'Sacramento', 'pacific', { city: 'Los Angeles' }],
  ['Colorado', 'Denver', 'mountain'],
  ['Connecticut', 'Hartford', 'new-england'],
  ['Delaware', 'Dover', 'south-atlantic'],
  ['Florida', 'Tallahassee', 'south-atlantic', { city: 'Miami' }],
  ['Georgia', 'Atlanta', 'south-atlantic'],
  ['Hawaii', 'Honolulu', 'pacific'],
  ['Idaho', 'Boise', 'mountain'],
  ['Illinois', 'Springfield', 'east-north-central', { city: 'Chicago' }],
  ['Indiana', 'Indianapolis', 'east-north-central'],
  ['Iowa', 'Des Moines', 'west-north-central'],
  ['Kansas', 'Topeka', 'west-north-central'],
  ['Kentucky', 'Frankfort', 'east-south-central', { city: 'Louisville' }],
  ['Louisiana', 'Baton Rouge', 'west-south-central', { city: 'New Orleans' }],
  ['Maine', 'Augusta', 'new-england'],
  ['Maryland', 'Annapolis', 'south-atlantic', { city: 'Baltimore' }],
  ['Massachusetts', 'Boston', 'new-england'],
  ['Michigan', 'Lansing', 'east-north-central', { city: 'Detroit' }],
  ['Minnesota', 'Saint Paul', 'west-north-central'],
  ['Mississippi', 'Jackson', 'east-south-central'],
  [
    'Missouri',
    'Jefferson City',
    'west-north-central',
    { city: 'St. Louis', spoken: 'Saint Louis' },
  ],
  ['Montana', 'Helena', 'mountain'],
  ['Nebraska', 'Lincoln', 'west-north-central'],
  ['Nevada', 'Carson City', 'mountain', { city: 'Las Vegas' }],
  ['New Hampshire', 'Concord', 'new-england'],
  ['New Jersey', 'Trenton', 'middle-atlantic'],
  ['New Mexico', 'Santa Fe', 'mountain'],
  ['New York', 'Albany', 'middle-atlantic', { city: 'New York City' }],
  ['North Carolina', 'Raleigh', 'south-atlantic'],
  ['North Dakota', 'Bismarck', 'west-north-central'],
  ['Ohio', 'Columbus', 'east-north-central'],
  ['Oklahoma', 'Oklahoma City', 'west-south-central'],
  ['Oregon', 'Salem', 'pacific', { city: 'Portland' }],
  ['Pennsylvania', 'Harrisburg', 'middle-atlantic', { city: 'Philadelphia' }],
  ['Rhode Island', 'Providence', 'new-england'],
  ['South Carolina', 'Columbia', 'south-atlantic'],
  ['South Dakota', 'Pierre', 'west-north-central'],
  ['Tennessee', 'Nashville', 'east-south-central'],
  ['Texas', 'Austin', 'west-south-central', { city: 'Houston' }],
  ['Utah', 'Salt Lake City', 'mountain'],
  ['Vermont', 'Montpelier', 'new-england'],
  ['Virginia', 'Richmond', 'south-atlantic'],
  ['Washington', 'Olympia', 'pacific', { city: 'Seattle' }],
  ['West Virginia', 'Charleston', 'south-atlantic'],
  ['Wisconsin', 'Madison', 'east-north-central', { city: 'Milwaukee' }],
  ['Wyoming', 'Cheyenne', 'mountain'],
];

/** How a state or capital is said when it differs from how it is shown. */
const SPOKEN_STATE: Record<string, string> = { Washington: 'Washington State' };
const SPOKEN_CAPITAL: Record<string, string> = { 'South Dakota': 'Peer' };

/** The 50 states in alphabetical order. */
export const STATE_CAPITALS: readonly StateCapital[] = ROWS.map(
  ([state, capital, division, trap]) => ({
    state,
    capital,
    division,
    ...(trap ? { trap } : {}),
    ...(SPOKEN_STATE[state] ? { spokenState: SPOKEN_STATE[state] } : {}),
    ...(SPOKEN_CAPITAL[state] ? { spokenCapital: SPOKEN_CAPITAL[state] } : {}),
  }),
);

export const DIVISION_REGION: Record<Division, 'northeast' | 'midwest' | 'south' | 'west'> = {
  'new-england': 'northeast',
  'middle-atlantic': 'northeast',
  'east-north-central': 'midwest',
  'west-north-central': 'midwest',
  'south-atlantic': 'south',
  'east-south-central': 'south',
  'west-south-central': 'south',
  mountain: 'west',
  pacific: 'west',
};

export const kebab = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, '-');

/** The fact for one state: the state name asked, its capital answered. */
export function capitalFact(row: StateCapital): Fact {
  const state = row.spokenState ?? row.state;
  const capital = row.spokenCapital ?? row.capital;
  const fact: Fact = {
    id: kebab(row.state),
    prompt: row.state,
    answer: row.capital,
    statement: `${row.state}: ${row.capital}`,
    spokenPrompt: `What is the capital of ${state}?`,
    spokenStatement: `The capital of ${state} is ${capital}.`,
  };
  if (row.trap) {
    const city = row.trap.spoken ?? row.trap.city;
    fact.wrongLines = { [row.trap.city]: `${city} is a big city, but the capital is ${capital}.` };
  }
  return fact;
}

const ROW_BY_ID: ReadonlyMap<string, StateCapital> = new Map(
  STATE_CAPITALS.map((row) => [kebab(row.state), row]),
);

/**
 * Wrong capitals: the trap city, then capitals of the same division, then the same region, then
 * any other. Each group is shuffled.
 */
export function capitalDistractors(fact: Fact, count: number, random: Random): string[] {
  const row = ROW_BY_ID.get(fact.id);
  if (!row) return [];
  const others = STATE_CAPITALS.filter((other) => other !== row);
  const region = DIVISION_REGION[row.division];
  const sameDivision = others.filter((o) => o.division === row.division);
  const sameRegion = others.filter(
    (o) => o.division !== row.division && DIVISION_REGION[o.division] === region,
  );
  const rest = others.filter((o) => DIVISION_REGION[o.division] !== region);
  const picked = new Set<string>();
  const add = (city: string) => {
    if (city !== row.capital && picked.size < count) picked.add(city);
  };
  if (row.trap) add(row.trap.city);
  for (const group of [sameDivision, sameRegion, rest]) {
    for (const other of shuffle(group, random)) add(other.capital);
  }
  return [...picked];
}

export const stateCapitals: Topic = {
  id: 'state-capitals',
  title: 'State capitals',
  subject: 'Social Studies',
  description: 'The capital city of each of the 50 US states.',
  facts: STATE_CAPITALS.map(capitalFact),
  distractors: capitalDistractors,
};
