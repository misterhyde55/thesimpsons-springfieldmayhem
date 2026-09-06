// Springfield is now a single, persistent map shared across all three
// segments of an episode, rather than a fresh branching path per segment
// (see data/journeys.js SEGMENT_CONTENT). Roads connect locations; the
// player travels node-to-node rather than freely walking around, but which
// roads are open can change mid-run (see blockRoad / data/travelEvents.js),
// so the same seven-location map can feel different by Segment III.
//
// Coordinates are normalized (0-1) against the real Springfieldmap2.png
// artwork's own natural size (1594x986 -- see data/assets.js ui.springfieldMap
// and ui/worldMapView.js, which positions every hotspot with plain
// percentage left/top inside the image's own box, so they stay correct at
// any pan/zoom). Measured directly off the art's baked-in building icons,
// not guessed -- when new locations are added later, measure them the same
// way rather than picking round numbers.
export const WORLD_LOCATIONS = {
  simpsonHouse: { x: 0.217, y: 0.401 },
  flandersHouse: { x: 0.29, y: 0.304 },
  kwikEMart: { x: 0.489, y: 0.304 },
  moesTavern: { x: 0.627, y: 0.304 },
  springfieldElementary: { x: 0.496, y: 0.091 },
  springfieldCemetery: { x: 0.143, y: 0.756 },
  nuclearPlant: { x: 0.897, y: 0.193 },
  // ---- Map expansion: 9 additional locations, each with its own gameplay
  // identity (data/journeys.js / data/events.js) rather than just being
  // another combat node. With BOSS_UNLOCK_VISIT_COUNT staying at 2 (see
  // systems/board.js), a run through this much bigger Springfield only ever
  // touches a handful of these -- that's the point, not a gap to fill.
  policeStation: { x: 0.538, y: 0.756 },
  krustyBurger: { x: 0.681, y: 0.177 },
  androidsDungeon: { x: 0.765, y: 0.401 },
  bowlarama: { x: 0.712, y: 0.548 },
  springfieldHospital: { x: 0.916, y: 0.644 },
  // Not pictured on the art itself -- placed on a quiet, iconless patch of
  // map (the far corner / open lawn respectively) rather than crowding an
  // existing building, which doubles as a nice "off the beaten path" /
  // "nothing marks it until you find it" fit for these two specifically.
  burnsManor: { x: 0.038, y: 0.152 },
  retirementCastle: { x: 0.917, y: 0.87 },
  springfieldChurch: { x: 0.188, y: 0.619 },
  // Secret: no un-gated road leads here (see ROADS below), and it has no
  // baked-in icon on the art either -- it stays rendered as an unexplored
  // "???" node until the Kwik-E-Mart's Mysterious Key (data/items.js) opens
  // the one road in.
  springfieldSewer: { x: 0.376, y: 0.659 },
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
