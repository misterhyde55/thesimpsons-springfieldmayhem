import { getImplementedModifiers, generateEpisodeTitle } from '../data/episodes.js';
import { LOCATIONS } from '../data/locations.js';
import { pickRandom } from '../engine/collision.js';

// The skeleton every run walks through. 'branch' stages let the player pick between
// two locations (procedural route selection); everything else is fixed. Extend the
// game by lengthening this array or adding more options per branch.
export const ROUTE_TEMPLATE = [
  { stageIndex: 0, kind: 'fixed', locationId: 'simpsonHouse' },
  { stageIndex: 1, kind: 'branch', options: ['kwikEMart', 'flandersHouse'] },
  { stageIndex: 2, kind: 'fixed', locationId: 'springfieldElementary' },
  { stageIndex: 3, kind: 'branch', options: ['krustyBurger', 'androidsDungeon'] },
  { stageIndex: 4, kind: 'fixed', locationId: 'downtownSpringfield' },
  { stageIndex: 5, kind: 'fixed', locationId: 'moesTavern' },
  { stageIndex: 6, kind: 'boss', locationId: 'bossArena' },
];

export function generateEpisode(character) {
  const modifier = pickRandom(getImplementedModifiers());
  return {
    modifierId: modifier.id,
    modifierName: modifier.name,
    newsText: modifier.newsText,
    bossId: modifier.bossId,
    title: generateEpisodeTitle(character.name),
    characterId: character.id,
    objective: "Get to Moe's Tavern",
    twistTriggered: false,
  };
}

export function getStageTemplate(stageIndex) {
  return ROUTE_TEMPLATE[stageIndex];
}

export function resolveStageLocation(stageTemplate, chosenLocationId) {
  const id = stageTemplate.kind === 'branch' ? chosenLocationId : stageTemplate.locationId;
  return LOCATIONS[id];
}

export function isFinalStage(stageIndex) {
  return stageIndex >= ROUTE_TEMPLATE.length - 1;
}
