import { getUpgradePool, RARITY_WEIGHT } from '../data/upgrades.js';
import { pickWeighted } from '../engine/collision.js';

// Picks up to `count` distinct upgrades for the level-complete reward screen,
// weighted by rarity and excluding anything already taken this run (each
// upgrade is a one-time pick).
export function rollUpgradeChoices(runState, count = 3) {
  const remaining = getUpgradePool(runState.character.id).filter((u) => !runState.upgradesChosen.has(u.id));
  const choices = [];
  while (choices.length < count && remaining.length > 0) {
    const entries = remaining.map((upgrade) => ({ weight: RARITY_WEIGHT[upgrade.rarity], upgrade }));
    const picked = pickWeighted(entries).upgrade;
    choices.push(picked);
    remaining.splice(remaining.indexOf(picked), 1);
  }
  return choices;
}

export function applyUpgrade(runState, upgrade) {
  upgrade.apply(runState);
  runState.upgradesChosen.add(upgrade.id);
}
