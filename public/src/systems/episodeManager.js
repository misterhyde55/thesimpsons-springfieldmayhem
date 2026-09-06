import { getJourney } from '../data/journeys.js';
import { generateEpisodeTitle } from '../data/episodes.js';

// Generates the whole episode up front: its Treehouse-of-Horror title and
// the three segment titles ("Tonight's Terrifying Tales"). The segments
// themselves (locations, enemies, horror rule) already live in
// data/journeys.js -- this just packages the framing text runState.episode
// carries around. `episodeNumber` feeds the Roman-numeral title
// (meta.totalEpisodes + 1, i.e. it counts across the player's whole
// history, not just this season).
export function generateEpisode(character, episodeNumber) {
  const journey = getJourney(character.id);
  return {
    title: generateEpisodeTitle(episodeNumber),
    segmentTitles: journey.segments.map((s) => s.segmentTitle),
    characterId: character.id,
    objective: journey.segments[0].objective,
  };
}
