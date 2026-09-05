import { getJourney } from '../data/journeys.js';

export function getNode(characterId, nodeId) {
  const journey = getJourney(characterId);
  return journey.nodes[nodeId];
}

export function getStartNodeId(characterId) {
  return getJourney(characterId).startNodeId;
}

// The node ids the player can currently choose from the board.
export function getAvailableNodeIds(runState) {
  const characterId = runState.character.id;
  if (runState.boardPosition === null) return [getStartNodeId(characterId)];
  const current = getNode(characterId, runState.boardPosition);
  return current.next;
}

export function markNodeCompleted(runState, nodeId) {
  runState.completedNodeIds.add(nodeId);
  runState.boardPosition = nodeId;
}

export function isJourneyComplete(runState) {
  if (runState.boardPosition === null) return false;
  const node = getNode(runState.character.id, runState.boardPosition);
  return node.next.length === 0;
}
