// Hand-authored road waypoints (REDESIGN SPRINGFIELD MAP: "routes should
// follow roads via authored waypoints, not straight lines through
// buildings"). Keyed the same way as data/worldMap.js's ROADS
// (roadKey(a,b) = [a,b].sort().join('|')), normalized (0-1) against the
// same SpringfieldMap_Clean.png art. A pair with no entry here just falls
// back to the old straight point-to-point line in ui/worldMapView.js's
// renderRoute -- most of Springfield's 16 locations don't have an authored
// route yet, which is fine; add one whenever a specific connection reads
// badly, using Map Edit Mode (Ctrl+Shift+M on the map screen) to record it
// instead of guessing coordinates by eye.
import { roadKey } from './worldMap.js';

export const ROUTE_WAYPOINTS = {
  // Calibrated by tracing the actual paved-road pixels in
  // SpringfieldMap_Clean.png (color-masked + shortest-path along the
  // street network, then simplified) so these hug real streets instead of
  // cutting through rooftops the way a straight line would.
  [roadKey('simpsonHouse', 'flandersHouse')]: [
    { x: 0.2202, y: 0.3789 },
    { x: 0.244, y: 0.3749 },
    { x: 0.3287, y: 0.4549 },
    { x: 0.426, y: 0.4823 },
    { x: 0.4498, y: 0.4347 },
    { x: 0.3952, y: 0.3526 },
    { x: 0.3024, y: 0.2786 },
  ],
  [roadKey('simpsonHouse', 'kwikEMart')]: [
    { x: 0.2202, y: 0.3789 },
    { x: 0.244, y: 0.3749 },
    { x: 0.3287, y: 0.4549 },
    { x: 0.426, y: 0.4823 },
    { x: 0.4498, y: 0.4438 },
    { x: 0.4523, y: 0.387 },
    { x: 0.4975, y: 0.3293 },
  ],
  [roadKey('simpsonHouse', 'moesTavern')]: [
    { x: 0.2202, y: 0.3789 },
    { x: 0.244, y: 0.3749 },
    { x: 0.3287, y: 0.4549 },
    { x: 0.426, y: 0.4823 },
    { x: 0.4718, y: 0.3556 },
    { x: 0.5345, y: 0.31 },
    { x: 0.5966, y: 0.3323 },
  ],
  [roadKey('flandersHouse', 'moesTavern')]: [
    { x: 0.3024, y: 0.2786 },
    { x: 0.3281, y: 0.2806 },
    { x: 0.3683, y: 0.3374 },
    { x: 0.4015, y: 0.3374 },
    { x: 0.4341, y: 0.3718 },
    { x: 0.4624, y: 0.3708 },
    { x: 0.5345, y: 0.31 },
    { x: 0.5966, y: 0.3323 },
  ],
};

export function getRouteWaypoints(a, b) {
  return ROUTE_WAYPOINTS[roadKey(a, b)] || null;
}
