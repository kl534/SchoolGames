/**
 * Dev-only lab for the maps (not part of the build). Query: `state=<id>` (default `ohio`) or
 * `country=<id>` (e.g. `italy`: its continent), `wrong=<name>` (the miss look: right one green,
 * this one red), `view=big|thumbs|countries` (thumbs: all 50 states, countries: all 60 countries).
 */
import { factMapThumb, showFactMap } from '.';
import { kebab, STATE_CAPITALS } from '../topics/capitals';
import { COUNTRIES } from '../topics/countries';
import { locationFact, stateLocations } from '../topics/locations';
import { countryFact, countryLocations } from '../topics/world';

const params = new URLSearchParams(location.search);
const view = params.get('view');
const wrong = params.get('wrong') ?? undefined;
const country = params.get('country');

if (view === 'thumbs' || view === 'countries') {
  const grid = document.getElementById('thumbs')!;
  const facts = view === 'thumbs' ? stateLocations.facts : countryLocations.facts;
  for (const fact of facts) grid.appendChild(factMapThumb(fact)!);
} else if (country) {
  const row = COUNTRIES.find((c) => kebab(c.name) === country) ?? COUNTRIES[0];
  showFactMap(countryFact(row), wrong ? { wrong } : undefined);
} else {
  const id = params.get('state') ?? 'ohio';
  const row = STATE_CAPITALS.find((r) => kebab(r.state) === id) ?? STATE_CAPITALS[0];
  showFactMap(locationFact(row), { wrong });
}
