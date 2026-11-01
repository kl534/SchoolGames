/**
 * Dev-only lab for the US map (not part of the build). Query: `state=<id>` (default `ohio`),
 * `wrong=<state name>` (the miss look: right state green, this one red),
 * `view=big|thumbs` (thumbs: all 50 thumbnails in a grid).
 */
import { factMapThumb, showFactMap } from '.';
import { STATE_CAPITALS } from '../topics/capitals';
import { locationFact, stateLocations } from '../topics/locations';

const params = new URLSearchParams(location.search);
const id = params.get('state') ?? 'ohio';

if (params.get('view') === 'thumbs') {
  const grid = document.getElementById('thumbs')!;
  for (const fact of stateLocations.facts) grid.appendChild(factMapThumb(fact)!);
} else {
  const row = STATE_CAPITALS.find((r) => locationFact(r).map!.state === id) ?? STATE_CAPITALS[0];
  showFactMap(locationFact(row), { wrong: params.get('wrong') ?? undefined });
}
