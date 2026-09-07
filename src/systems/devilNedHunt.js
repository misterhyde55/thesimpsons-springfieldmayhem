// Once Devil Ned manifests (locationFlags.hasDevilPortal, see
// data/callbacks.js devilNedAppears), he stops being purely a fixed
// encounter waiting at Springfield Church and starts actively closing in:
// every time Homer arrives somewhere, Ned takes one road-hop toward
// wherever Homer just went. Catching up triggers the boss fight on the
// spot, wherever that happens to be -- "route planning matters" once
// avoiding (or hunting down) him becomes a real map decision.
import { getConnections } from '../data/worldMap.js';

const DEVIL_NED_START_LOCATION_ID = 'springfieldChurch';

// Breadth-first shortest path, returning just the first hop from `from`
// toward `to` (or `from` itself if already there or unreachable). Ned
// ignores blocked/gated roads -- he's not exactly bound by mundane
// obstacles -- so this walks the full road graph, not getReachableLocationIds.
function nextStepToward(from, to) {
  if (from === to) return from;
  const cameFrom = new Map([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const node = queue.shift();
    if (node === to) break;
    for (const next of getConnections(node)) {
      if (!cameFrom.has(next)) {
        cameFrom.set(next, node);
        queue.push(next);
      }
    }
  }
  if (!cameFrom.has(to)) return from;
  let step = to;
  while (cameFrom.get(step) !== from) step = cameFrom.get(step);
  return step;
}

// Called once per arrival (game.js arriveAt). Returns true if Ned just
// caught up to the location Homer arrived at -- the caller is responsible
// for dropping straight into the boss fight instead of that location's
// normal content.
export function advanceDevilNed(runState, arrivedLocationId) {
  if (!runState.world.locationFlags.hasDevilPortal || runState.world.locationFlags.devilNedDefeated) return false;
  if (!runState.world.devilNedPosition) runState.world.devilNedPosition = DEVIL_NED_START_LOCATION_ID;
  if (runState.world.devilNedPosition === arrivedLocationId) return true;
  runState.world.devilNedPosition = nextStepToward(runState.world.devilNedPosition, arrivedLocationId);
  return runState.world.devilNedPosition === arrivedLocationId;
}

// Flavor-only: lets game.js warn the player when Ned is now one hop away
// from wherever they just landed, without revealing his exact plans.
export function isDevilNedAdjacentTo(runState, locationId) {
  const pos = runState.world.devilNedPosition;
  if (!pos) return false;
  return getConnections(pos).includes(locationId);
}
