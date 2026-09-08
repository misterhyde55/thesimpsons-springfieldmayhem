// Card upgrading (REDESIGN COMBAT GAMEPLAY: "locations around Springfield
// should interact with the deck... BOWLARAMA: Upgrade BOWLING BALL... MOE'S:
// Upgrade DUFF RAGE... NUCLEAR PLANT: Upgrade NUCLEAR cards but risk
// Radiation"). An upgrade swaps a base ability's id for its `+` id
// (data/abilities.js `upgradesToId`) directly inside runState.abilityDeck --
// there's no separate "card instance" model to track (see
// systems/battleEngine.js's HAND_SIZE comment), so the deck array itself is
// the only place an upgrade needs to happen.
import { ABILITIES } from '../data/abilities.js';

// Every owned, not-yet-upgraded ability of a given archetype -- what an
// upgrade station's "UPGRADE A CARD" interaction offers as choices.
// `archetype` of null/undefined means "any archetype" (Moe's general
// upgrade, as opposed to Bowlarama/Nuclear Plant's archetype-locked ones).
export function getUpgradableAbilities(runState, archetype) {
  return runState.abilityDeck
    .map((id) => ABILITIES[id])
    .filter((ability) => ability && (!archetype || ability.archetype === archetype) && ability.upgradesToId);
}

// Replaces `baseId` with its `+` id in place. Returns the new (upgraded)
// ability, or null if baseId isn't owned or has no upgrade defined.
export function upgradeAbility(runState, baseId) {
  const base = ABILITIES[baseId];
  if (!base || !base.upgradesToId) return null;
  const idx = runState.abilityDeck.indexOf(baseId);
  if (idx === -1) return null;
  runState.abilityDeck[idx] = base.upgradesToId;
  return ABILITIES[base.upgradesToId];
}
