// Atmospheric backdrop/text shown while traveling between Springfield
// locations (see game.js showTravelScreen). No uploaded scene art exists
// yet -- getAssetUrl-style lookups would go through data/assets.js the
// moment real images land in public/assets/scenes/, but until then this
// falls back to the same emoji-driven look every other unillustrated
// entity in the game already uses. Scenes are chosen by which Horror
// Rule(s) are active, never rotated just for variety, so the backdrop
// always reinforces what's actually happening in the run.
export const SCENES = {
  quietStreet: {
    id: 'quietStreet',
    emoji: '🌃',
    horrorRuleIds: [],
    lines: ['The streets are unusually quiet.', 'A dog barks twice, then stops.', 'A screen door bangs somewhere in the wind.'],
  },
  zombieStreet: {
    id: 'zombieStreet',
    emoji: '🧟',
    horrorRuleIds: ['zombieOutbreak'],
    lines: ['Something shuffles between the streetlights.', 'A single shoe sits in the middle of the road.', 'The smell hits before anything else does.'],
  },
  alienSky: {
    id: 'alienSky',
    emoji: '🛸',
    horrorRuleIds: ['alienInvasion'],
    lines: ['The sky is the wrong color tonight.', 'A light passes overhead, far too slow to be a plane.', 'Every dog on the street is pointed the same direction.'],
  },
  collision: {
    id: 'collision',
    emoji: '☠️',
    horrorRuleIds: ['zombieOutbreak', 'alienInvasion'],
    lines: ['Springfield does not look like Springfield anymore.', 'Something groans. Something else answers from above.', 'Nothing about tonight is following the old rules.'],
  },
};

// Prefers a scene tagged for exactly the current set of active rules, then
// any scene tagged for at least one of them, then the plain "nothing's
// wrong yet" scene.
export function pickTravelScene(runState) {
  const active = runState.activeHorrorRuleIds;
  const exact = Object.values(SCENES).find(
    (s) =>
      s.horrorRuleIds.length === active.length &&
      s.horrorRuleIds.every((id) => active.includes(id)) &&
      active.every((id) => s.horrorRuleIds.includes(id))
  );
  if (exact) return exact;
  const partial = Object.values(SCENES).filter((s) => s.horrorRuleIds.some((id) => active.includes(id)));
  if (partial.length) return partial[Math.floor(Math.random() * partial.length)];
  return SCENES.quietStreet;
}

export function pickSceneLine(scene) {
  return scene.lines[Math.floor(Math.random() * scene.lines.length)];
}
