// Episode endings. `condition(runState, result)` is checked in priority
// order (highest first) at the very end of a run; the first match wins, so
// put more specific/rarer endings above the generic win/loss fallbacks.
// `result` is the summary object game.js builds in finalizeRun (stats,
// victory, etc.) -- see there for its exact shape.
export const ENDINGS = {
  treehouseTranscendence: {
    id: 'treehouseTranscendence',
    name: 'TREEHOUSE MODE',
    priority: 10,
    description: 'Reality itself gave up trying to make sense. You won anyway.',
    condition: (runState, result) => result.victory && result.stats.peakMayhem >= 100,
  },
  kangKodosWin: {
    id: 'kangKodosWin',
    name: 'KANG & KODOS WIN',
    priority: 5,
    description: 'Springfield is annexed. Somewhere, Kang is already bored of running it.',
    condition: (runState, result) => !result.victory && runState.activeHorrorRuleIds.includes('alienInvasion') && result.stats.peakMayhem >= 60,
  },
  zombieEnding: {
    id: 'zombieEnding',
    name: 'ZOMBIE SPRINGFIELD',
    priority: 4,
    description: 'The infection wins. Springfield shuffles on, forever hungry.',
    condition: (runState, result) => !result.victory && runState.activeHorrorRuleIds.includes('zombieOutbreak'),
  },
  springfieldSaved: {
    id: 'springfieldSaved',
    name: 'SPRINGFIELD SAVED',
    priority: 1,
    description: 'Against all odds -- and all logic -- Springfield survives to see another sunrise.',
    condition: (runState, result) => result.victory,
  },
  everyoneDies: {
    id: 'everyoneDies',
    name: 'EVERYONE DIES',
    priority: 0,
    description: 'Roll credits. There is no one left to watch them.',
    condition: (runState, result) => !result.victory,
  },
};

export function resolveEnding(runState, result) {
  const matches = Object.values(ENDINGS)
    .filter((e) => e.condition(runState, result))
    .sort((a, b) => b.priority - a.priority);
  return matches[0] || ENDINGS.everyoneDies;
}
