import { getSegment, getSegmentCount } from '../data/journeys.js';

// How many non-boss locations the player must visit this segment before
// the boss location becomes travelable -- keeps a segment from being
// beelined in one hop while staying short enough for a ~10-15 minute
// segment (see data/journeys.js content tables).
const BOSS_UNLOCK_VISIT_COUNT = 2;

export function getCurrentSegment(runState) {
  return getSegment(runState.character.id, runState.segmentIndex);
}

export function isFinalSegment(runState) {
  return runState.segmentIndex >= getSegmentCount(runState.character.id) - 1;
}

export function markLocationVisited(runState, locationId) {
  if (!runState.world.segmentVisitedLocationIds.includes(locationId)) {
    runState.world.segmentVisitedLocationIds.push(locationId);
  }
  if (!runState.world.visitedLocationIds.includes(locationId)) {
    runState.world.visitedLocationIds.push(locationId);
  }
}

export function isBossLocationUnlocked(runState) {
  const segment = getCurrentSegment(runState);
  const exploredElsewhere = runState.world.segmentVisitedLocationIds.filter((id) => id !== segment.bossLocationId);
  return exploredElsewhere.length >= BOSS_UNLOCK_VISIT_COUNT;
}

// True once the player has reached (and cleared) this segment's boss
// location -- game.js decides what happens next (Commercial Break into the
// next segment, or the episode ends on the last one).
export function isSegmentComplete(runState) {
  return runState.world.segmentVisitedLocationIds.includes(getCurrentSegment(runState).bossLocationId);
}
