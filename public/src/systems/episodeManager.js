import { getImplementedModifiers, generateEpisodeTitle } from '../data/episodes.js';
import { getJourney } from '../data/journeys.js';
import { pickRandom } from '../engine/collision.js';

// Picks the run's horror scenario (Zombie Springfield, ...) and title. The
// journey/board itself comes from systems/board.js + data/journeys.js.
export function generateEpisode(character) {
  const modifier = pickRandom(getImplementedModifiers());
  const journey = getJourney(character.id);
  return {
    modifierId: modifier.id,
    modifierName: modifier.name,
    newsText: modifier.newsText,
    title: generateEpisodeTitle(character.name),
    characterId: character.id,
    objective: journey.objective,
  };
}
