// Rolled once per road hop (see game.js travelTo) -- "Traveling between
// buildings can itself create encounters." 'nothing' is heavily weighted
// so the map doesn't feel like a slot machine; most trips are quiet.
// `apply` runs immediately and returns {text, blocked?} for the travel
// screen to show, or null for a silent no-op. A `blocked: true` result
// closes the road it fired on for the rest of the run (data/worldMap.js
// blockRoad), which is what makes a route decision matter later --
// the cemetery<->plant road can wash out in a zombie outbreak, forcing the
// long way around through the school.
import { blockRoad } from './worldMap.js';

export const TRAVEL_EVENTS = {
  nothing: {
    id: 'nothing',
    weight: 6,
    condition: () => true,
    apply() {
      return null;
    },
  },
  zombieRoadblock: {
    id: 'zombieRoadblock',
    weight: 3,
    condition: (runState, fromId, toId) =>
      runState.activeHorrorRuleIds.includes('zombieOutbreak') &&
      [fromId, toId].includes('springfieldCemetery') &&
      [fromId, toId].includes('nuclearPlant'),
    apply(runState, fromId, toId) {
      blockRoad(runState, fromId, toId);
      return { text: 'A shambling mass fills the road ahead, packed in too tight to push through. This route is a dead end now -- literally.', blocked: true };
    },
  },
  smallFind: {
    id: 'smallFind',
    weight: 2,
    condition: () => true,
    apply(runState) {
      runState.donutsCurrency += 2;
      return { text: 'A couple of stray donuts sit untouched on the curb. (+2 donuts)' };
    },
  },
  roughPatch: {
    id: 'roughPatch',
    weight: 1,
    condition: (runState) => runState.mayhem >= 30,
    apply(runState) {
      runState.hp = Math.max(1, runState.hp - 8);
      return { text: 'Something takes a swipe at you out of the dark before vanishing again. (-8 HP)' };
    },
  },
};

export function rollTravelEvent(runState, fromId, toId) {
  const pool = Object.values(TRAVEL_EVENTS).filter((e) => e.condition(runState, fromId, toId));
  const totalWeight = pool.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const event of pool) {
    roll -= event.weight;
    if (roll <= 0) return event;
  }
  return TRAVEL_EVENTS.nothing;
}
