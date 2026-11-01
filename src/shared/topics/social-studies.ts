import { stateCapitals } from './capitals';
import { stateLocations } from './locations';
import { countryLocations } from './world';
import type { Topic } from './types';

/** Every social studies topic, in menu order. Add new social studies topics here. */
export const SOCIAL_STUDIES_TOPICS: Topic[] = [stateCapitals, stateLocations, countryLocations];
