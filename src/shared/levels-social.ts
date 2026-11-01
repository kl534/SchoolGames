import type { Level } from './levels';
import { DIVISION_REGION, STATE_CAPITALS, stateCapitals } from './topics/capitals';
import { stateLocations } from './topics/locations';
import type { Topic } from './topics';

type Region = (typeof DIVISION_REGION)[keyof typeof DIVISION_REGION];

/** A level of one census region's facts of `topic` (both topics share the order of STATE_CAPITALS). */
function regionLevel(title: string, region: Region, topic: Topic): Level {
  return {
    title,
    facts: topic.facts
      .filter((_, i) => DIVISION_REGION[STATE_CAPITALS[i].division] === region)
      .map((fact) => ({ topic, fact })),
  };
}

/** Social Studies levels, easiest first. Only how many are open is saved: change titles freely, never the order. Append new levels at the end. */
export const SOCIAL_STUDIES_LEVELS: Level[] = [
  regionLevel('The Northeast', 'northeast', stateCapitals),
  regionLevel('The Midwest', 'midwest', stateCapitals),
  regionLevel('The South', 'south', stateCapitals),
  regionLevel('The West', 'west', stateCapitals),
  {
    title: 'All 50 states',
    facts: stateCapitals.facts.map((fact) => ({ topic: stateCapitals, fact })),
  },
  regionLevel('Find the Northeast', 'northeast', stateLocations),
  regionLevel('Find the Midwest', 'midwest', stateLocations),
  regionLevel('Find the South', 'south', stateLocations),
  regionLevel('Find the West', 'west', stateLocations),
  {
    title: 'Find all 50 states',
    facts: stateLocations.facts.map((fact) => ({ topic: stateLocations, fact })),
  },
];
