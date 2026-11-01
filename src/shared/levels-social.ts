import type { Level } from './levels';
import { DIVISION_REGION, STATE_CAPITALS, stateCapitals } from './topics/capitals';

type Region = (typeof DIVISION_REGION)[keyof typeof DIVISION_REGION];

/** A level of the capitals of one census region, in the topic's (alphabetical) order. */
function regionLevel(title: string, region: Region): Level {
  return {
    title,
    facts: stateCapitals.facts
      .filter((_, i) => DIVISION_REGION[STATE_CAPITALS[i].division] === region)
      .map((fact) => ({ topic: stateCapitals, fact })),
  };
}

/** Social Studies levels, easiest first. Only how many are open is saved: change titles freely, never the order. Append new levels at the end. */
export const SOCIAL_STUDIES_LEVELS: Level[] = [
  regionLevel('The Northeast', 'northeast'),
  regionLevel('The Midwest', 'midwest'),
  regionLevel('The South', 'south'),
  regionLevel('The West', 'west'),
  {
    title: 'All 50 states',
    facts: stateCapitals.facts.map((fact) => ({ topic: stateCapitals, fact })),
  },
];
