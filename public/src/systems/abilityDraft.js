import { getDraftPool, RARITY_WEIGHT } from '../data/abilities.js';
import { pickWeighted } from '../engine/collision.js';

// Rolls `count` distinct abilities the player doesn't already own, weighted
// by rarity, for the post-battle "choose one" reward. Milestone rewards
// (guaranteed story-tied unlocks, see data/journeys.js `milestoneAbilityId`)
// bypass this and hand back a single fixed ability instead.
export function rollAbilityChoices(runState, count) {
  const owned = new Set(runState.abilityDeck);
  const pool = getDraftPool(runState.cast).filter((a) => !owned.has(a.id));
  const choices = [];
  const remaining = [...pool];
  for (let i = 0; i < count && remaining.length > 0; i += 1) {
    const weighted = remaining.map((a) => ({ ...a, weight: RARITY_WEIGHT[a.rarity] }));
    const picked = pickWeighted(weighted);
    choices.push(picked);
    const idx = remaining.findIndex((a) => a.id === picked.id);
    remaining.splice(idx, 1);
  }
  return choices;
}

export function learnAbility(runState, ability) {
  if (runState.abilityDeck.includes(ability.id)) return;
  runState.abilityDeck.push(ability.id);
}
