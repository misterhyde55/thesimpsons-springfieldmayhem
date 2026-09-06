import { getSegment, getSegmentCount } from '../data/journeys.js';

export function getCurrentSegment(runState) {
  return getSegment(runState.character.id, runState.segmentIndex);
}

export function isFinalSegment(runState) {
  return runState.segmentIndex >= getSegmentCount(runState.character.id) - 1;
}

export function getNode(runState, nodeId) {
  return getCurrentSegment(runState).nodes[nodeId];
}

export function getStartNodeId(runState) {
  return getCurrentSegment(runState).startNodeId;
}

// The node ids the player can currently choose from the board.
export function getAvailableNodeIds(runState) {
  if (runState.boardPosition === null) return [getStartNodeId(runState)];
  const current = getNode(runState, runState.boardPosition);
  return current.next;
}

export function markNodeCompleted(runState, nodeId) {
  runState.completedNodeIds.add(nodeId);
  runState.boardPosition = nodeId;
}

// True once the player has reached a node with no further destinations --
// i.e. cleared that segment's boss. game.js decides what happens next
// (advance to the next segment, or end the episode on the last one).
export function isSegmentComplete(runState) {
  if (runState.boardPosition === null) return false;
  const node = getNode(runState, runState.boardPosition);
  return node.next.length === 0;
}
