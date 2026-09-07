// Dynamic "this location is under attack right now" crises -- distinct from
// a location's own scripted per-Horror-Rule interior state. An invasion is
// temporary board-level pressure: it starts randomly while Springfield is
// already falling apart (Segment II+), gives the player a short window to
// travel there and fight it off, and permanently downgrades the location
// (locationStates[id] = 'overrun', handled by interiors.js's existing
// locationStates override) if they don't make it in time or lose the fight.
import { LOCATIONS } from '../data/locations.js';

// Per-location flavor: which enemies show up, and which relationship (if
// any) improves when the player saves it.
export const INVASION_CONFIG = {
  moesTavern: { enemyIds: ['zombieBarfly', 'zombieBarfly', 'zombieMobGuy'], npc: 'moe' },
  kwikEMart: { enemyIds: ['zombieBarfly', 'zombieMobGuy'], npc: 'apu' },
};

const TRIGGER_CHANCE = 0.14;
const TURNS_TO_RESPOND = 2;

// Called once per arrival at any location -- gives every crisis-eligible
// location a small rolling chance to flare up, but never stacks two at
// once (the map would stop reading as "respond to this one thing now").
export function maybeTriggerLocationInvasion(runState) {
  if (runState.segmentIndex < 1) return null; // Segment I stays comparatively safe, per design.
  if (Object.keys(runState.world.locationInvasions).length > 0) return null;
  const candidates = Object.keys(INVASION_CONFIG).filter((id) => {
    if (!runState.world.visitedLocationIds.includes(id)) return false;
    const override = runState.world.locationStates[id];
    return override !== 'overrun' && override !== 'underAttack';
  });
  if (candidates.length === 0) return null;
  if (Math.random() >= TRIGGER_CHANCE) return null;
  const locationId = candidates[Math.floor(Math.random() * candidates.length)];
  runState.world.locationInvasions[locationId] = { turnsLeft: TURNS_TO_RESPOND };
  return locationId;
}

// Called after maybeTriggerLocationInvasion, on every arrival. Any active
// invasion the player didn't just arrive to address loses a turn; hitting
// zero permanently overruns it. Returns the ids that were just overrun so
// the caller can announce them.
export function tickLocationInvasions(runState, arrivedLocationId) {
  const overrun = [];
  for (const [id, invasion] of Object.entries(runState.world.locationInvasions)) {
    if (id === arrivedLocationId) continue;
    invasion.turnsLeft -= 1;
    if (invasion.turnsLeft <= 0) {
      delete runState.world.locationInvasions[id];
      runState.world.locationStates[id] = 'overrun';
      overrun.push(id);
    }
  }
  return overrun;
}

export function overrunAnnouncement(locationId) {
  return `💥 ${LOCATIONS[locationId].name.toUpperCase()}: OVERRUN. You didn't make it in time.`;
}
