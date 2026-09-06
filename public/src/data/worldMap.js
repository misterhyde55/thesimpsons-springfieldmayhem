// Springfield is now a single, persistent map shared across all three
// segments of an episode, rather than a fresh branching path per segment
// (see data/journeys.js SEGMENT_CONTENT). Roads connect locations; the
// player travels node-to-node rather than freely walking around, but which
// roads are open can change mid-run (see blockRoad / data/travelEvents.js),
// so the same seven-location map can feel different by Segment III.
//
// Coordinates are normalized (0-1) the same way the old board-view nodes
// were, so ui/worldMapView.js can reuse simple canvas-scaling math.
export const WORLD_LOCATIONS = {
  simpsonHouse: { x: 0.5, y: 0.88 },
  flandersHouse: { x: 0.22, y: 0.8 },
  kwikEMart: { x: 0.78, y: 0.68 },
  moesTavern: { x: 0.48, y: 0.6 },
  springfieldElementary: { x: 0.2, y: 0.38 },
  springfieldCemetery: { x: 0.76, y: 0.36 },
  nuclearPlant: { x: 0.48, y: 0.12 },
  // ---- Map expansion: 9 additional locations, each with its own gameplay
  // identity (data/journeys.js / data/events.js) rather than just being
  // another combat node. With BOSS_UNLOCK_VISIT_COUNT staying at 2 (see
  // systems/board.js), a run through this much bigger Springfield only ever
  // touches a handful of these -- that's the point, not a gap to fill.
  policeStation: { x: 0.66, y: 0.8 },
  krustyBurger: { x: 0.94, y: 0.62 },
  androidsDungeon: { x: 0.92, y: 0.3 },
  bowlarama: { x: 0.68, y: 0.5 },
  springfieldHospital: { x: 0.34, y: 0.58 },
  burnsManor: { x: 0.06, y: 0.55 },
  retirementCastle: { x: 0.05, y: 0.82 },
  springfieldChurch: { x: 0.58, y: 0.22 },
  // Secret: no un-gated road leads here (see ROADS below) -- it stays
  // rendered as an unexplored "???" node until the Kwik-E-Mart's
  // Mysterious Key (data/items.js) opens the one road in.
  springfieldSewer: { x: 0.36, y: 0.42 },
};

const ROADS = [
  ['simpsonHouse', 'flandersHouse'],
  ['simpsonHouse', 'kwikEMart'],
  ['simpsonHouse', 'moesTavern'],
  ['flandersHouse', 'moesTavern'],
  ['kwikEMart', 'springfieldElementary'],
  ['moesTavern', 'springfieldElementary'],
  ['moesTavern', 'springfieldCemetery'],
  ['springfieldElementary', 'nuclearPlant'],
  ['springfieldCemetery', 'nuclearPlant'],
  ['simpsonHouse', 'policeStation'],
  ['kwikEMart', 'policeStation'],
  ['kwikEMart', 'krustyBurger'],
  ['krustyBurger', 'androidsDungeon'],
  ['androidsDungeon', 'bowlarama'],
  ['bowlarama', 'moesTavern'],
  ['moesTavern', 'springfieldHospital'],
  ['flandersHouse', 'springfieldHospital'],
  ['flandersHouse', 'burnsManor'],
  ['burnsManor', 'retirementCastle'],
  ['springfieldElementary', 'springfieldChurch'],
  ['springfieldCemetery', 'springfieldChurch'],
  // Gated: only travelable once runState.world.locationFlags.hasMysteriousKey
  // is set (see isRoadBlocked below) -- a real secret/dangerous shortcut
  // straight to the Nuclear Plant, per the "safe vs. dangerous vs. secret
  // route" design goal.
  ['moesTavern', 'springfieldSewer', { requiresFlag: 'hasMysteriousKey' }],
  ['springfieldSewer', 'nuclearPlant'],
];

export const START_LOCATION_ID = 'simpsonHouse';

export function roadKey(a, b) {
  return [a, b].sort().join('|');
}

export function getAllRoads() {
  return ROADS;
}

export function getConnections(locationId) {
  const out = [];
  for (const [a, b] of ROADS) {
    if (a === locationId) out.push(b);
    else if (b === locationId) out.push(a);
  }
  return out;
}

function findRoad(a, b) {
  return ROADS.find(([ra, rb]) => roadKey(ra, rb) === roadKey(a, b));
}

export function isRoadBlocked(runState, a, b) {
  if (runState.world.blockedRoads.includes(roadKey(a, b))) return true;
  const road = findRoad(a, b);
  const requiresFlag = road && road[2] && road[2].requiresFlag;
  if (requiresFlag) return !runState.world.locationFlags[requiresFlag];
  return false;
}

// Springfield remembers a blocked road for the rest of the run (see
// data/travelEvents.js zombieRoadblock) -- it never quietly reopens.
export function blockRoad(runState, a, b) {
  const key = roadKey(a, b);
  if (!runState.world.blockedRoads.includes(key)) runState.world.blockedRoads.push(key);
}

// The locations directly reachable from wherever the player currently is
// (or the starting house, at the top of a fresh segment), minus anything
// blocked. game.js is the one that additionally gates the segment's boss
// location behind "explored enough of the map first".
export function getReachableLocationIds(runState) {
  const from = runState.world.currentLocationId || START_LOCATION_ID;
  return getConnections(from).filter((id) => !isRoadBlocked(runState, from, id));
}
