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
import { getRelicShopPool } from './relics.js';

export const TRAVEL_EVENTS = {
  nothing: {
    id: 'nothing',
    // Bumped up from 6 to keep roughly the same "most trips are quiet"
    // ratio (~60%) now that ~11 more short "Springfield moments" (below)
    // are in the pool too -- "do not make every trip an interruption."
    weight: 30,
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

  // ---- ~10 short "random Springfield moments" (Priority 6) -- mostly pure
  // flavor, a few with a small mechanical nudge, none of them a real
  // decision (that's what location events are for). The point is texture:
  // "Springfield should feel ALIVE," not a second layer of choices on top
  // of the road itself.
  carCrash: {
    id: 'carCrash',
    weight: 2,
    condition: () => true,
    apply(runState) {
      runState.donutsCurrency += 2;
      return { text: "A car alarm blares, then cuts off mid-note. The car's abandoned, doors open, radio still playing. You help yourself to the change in the cupholder. (+2 donuts)" };
    },
  },
  distantScream: {
    id: 'distantScream',
    weight: 2,
    condition: () => true,
    apply() {
      return { text: 'A scream echoes from a few blocks over. Then nothing. You keep walking.' };
    },
  },
  phoneBooth: {
    id: 'phoneBooth',
    weight: 2,
    condition: () => true,
    apply(runState) {
      runState.hp = Math.min(runState.maxHp, runState.hp + 6);
      return { text: 'A payphone rings. It\'s Marge, somehow, just checking in. Hearing her voice helps more than it should. (+6 HP)' };
    },
  },
  duffTruck: {
    id: 'duffTruck',
    weight: 2,
    condition: () => true,
    apply(runState) {
      runState.hp = Math.min(runState.maxHp, runState.hp + 10);
      return { text: 'A Duff Beer truck lies jackknifed across a driveway, completely unguarded. You take a "structural integrity sample." (+10 HP)' };
    },
  },
  zombieGlassDoor: {
    id: 'zombieGlassDoor',
    weight: 2,
    condition: (runState) => runState.activeHorrorRuleIds.includes('zombieOutbreak'),
    apply() {
      return { text: 'A zombie shambles face-first into a sliding glass door. Then does it again. You leave it to its business.' };
    },
  },
  alienShipFlicker: {
    id: 'alienShipFlicker',
    weight: 2,
    condition: (runState) => runState.activeHorrorRuleIds.includes('alienInvasion'),
    apply() {
      return { text: 'A saucer-shaped shadow flickers across the moon, there and gone. The streetlights dim for exactly as long as it takes to notice.' };
    },
  },
  mysteriousPortal: {
    id: 'mysteriousPortal',
    weight: 1,
    condition: () => true,
    apply(runState) {
      const pool = getRelicShopPool().filter((r) => !runState.relics.includes(r.id));
      if (pool.length && Math.random() < 0.5) {
        const relic = pool[Math.floor(Math.random() * pool.length)];
        runState.relics.push(relic.id);
        return `Something shimmers at the end of the alley. You reach through without thinking too hard about it and pull back with: ${relic.emoji} ${relic.name}.`;
      }
      return 'Something shimmers at the end of the alley. By the time you get there, it\'s just an alley.';
    },
  },
  dogWithItem: {
    id: 'dogWithItem',
    weight: 2,
    condition: () => true,
    apply(runState) {
      runState.donutsCurrency += 1;
      return "A dog trots past carrying something shiny in its mouth. It won't give it up, but it drops a donut on the way, apparently as a consolation prize. (+1 donut)";
    },
  },
  tvInWindow: {
    id: 'tvInWindow',
    weight: 2,
    condition: () => true,
    apply() {
      return { text: 'A TV flickers on by itself in a dark, empty-looking house. It\'s just static. You decide not to think about it.' };
    },
  },
  alleyVoice: {
    id: 'alleyVoice',
    weight: 2,
    condition: () => true,
    apply() {
      return { text: 'Someone calls your name from a dark alley. You don\'t recognize the voice. You keep walking.' };
    },
  },
  roadDonut: {
    id: 'roadDonut',
    weight: 2,
    condition: () => true,
    apply(runState) {
      runState.donutsCurrency += 2;
      return { text: 'A donut sits in the middle of the road, suspiciously undisturbed. You take it anyway. (+2 donuts)' };
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
