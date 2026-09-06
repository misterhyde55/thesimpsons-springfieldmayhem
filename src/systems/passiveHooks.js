import { RELICS } from '../data/relics.js';
import { HORROR_RULES } from '../data/horrorRules.js';
import { getActiveSynergies } from '../data/synergies.js';

// Relics, active Horror Rules, and active Character Synergies all share the
// same {hooks:{...}} shape (see the comment atop data/relics.js). This is
// the one place that knows how to find all three for a given runState and
// fire a named hook on whichever of them define it -- battleEngine.js never
// needs to know which kind of thing reacted to an event.
function activeSources(runState) {
  const relics = runState.relics.map((id) => RELICS[id]).filter(Boolean);
  const horrorRules = runState.activeHorrorRuleIds.map((id) => HORROR_RULES[id]).filter(Boolean);
  const synergies = getActiveSynergies(runState);
  return [...relics, ...horrorRules, ...synergies];
}

// Every hook is called as (runState, ...args). Results are collected (not
// short-circuited) since e.g. multiple cost-discount sources need to all
// get a chance to fire their own bookkeeping in onAbilityPlayed.
export function fireHooks(runState, hookName, ...args) {
  const results = [];
  for (const source of activeSources(runState)) {
    const hook = source.hooks && source.hooks[hookName];
    if (hook) results.push(hook(runState, ...args));
  }
  return results;
}
