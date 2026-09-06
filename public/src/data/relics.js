import { STATUS } from './statusEffects.js';
import { addStatus, applyIncomingDamage } from '../systems/statusEngine.js';

// Relics are permanent, passive, always-on run items (bought at shops or
// found at events) -- unlike abilities, the player never "plays" a relic,
// it just reacts to battle events via whichever hooks it defines. Horror
// Rules (data/horrorRules.js) and Character Synergies (data/synergies.js)
// use this exact same {hooks:{...}} shape; systems/passiveHooks.js fires
// all three sources through one `fireHooks(runState, hookName, ...args)`
// call, so a relic, a horror rule, and a synergy can all react to the same
// moment without battleEngine.js knowing which kind of thing is listening.
// Every hook's first argument is `runState` and its second is the live
// `battle` state (see battleEngine's `createBattle`), so a hook can read
// cast/relics/mayhem as well as mutate battle.player / battle.enemies /
// battle.flags.
export const RELICS = {
  homersWorkBadge: {
    id: 'homersWorkBadge',
    name: "Homer's Work Badge",
    emoji: '🪪',
    description: 'The first Nuclear ability you play each battle costs 0 Energy.',
    hooks: {
      // Must stay a pure read (no mutation) -- the UI calls this to preview
      // costs on every render, not just when an ability is actually played.
      // The "used" flag only flips in onAbilityPlayed, which fires once per
      // real play.
      onAbilityCost(runState, battle, ability) {
        if (ability.archetype !== 'nuclear' || battle.flags.workBadgeUsed) return undefined;
        return 0;
      },
      onAbilityPlayed(runState, battle, ability) {
        if (ability.archetype === 'nuclear') battle.flags.workBadgeUsed = true;
      },
    },
  },
  krustySeal: {
    id: 'krustySeal',
    name: 'Krusty Brand Seal of Approval',
    emoji: '🤡',
    description: 'Food abilities heal +50%. Every 2nd food this battle also infects you with 2 Poison.',
    hooks: {
      onHealAmount(runState, battle, baseAmount) {
        return Math.round(baseAmount * 1.5);
      },
      onAteFood(runState, battle, countThisBattle) {
        if (countThisBattle > 0 && countThisBattle % 2 === 0) addStatus(battle.player, STATUS.POISON, 2);
      },
    },
  },
  blinky: {
    id: 'blinky',
    name: 'Blinky',
    emoji: '🐟',
    description: 'Whenever an enemy reaches 10+ Radiation, deal 8 damage to all enemies.',
    hooks: {
      onStatusApplied(runState, battle, holder, statusId, newTotal) {
        if (statusId !== STATUS.RADIATION || holder === battle.player || newTotal < 10) return;
        for (const enemy of battle.enemies) {
          if (enemy.hp > 0) applyIncomingDamage(enemy, 8);
        }
      },
    },
  },
  mrPlowJacket: {
    id: 'mrPlowJacket',
    name: 'Mr. Plow Jacket',
    emoji: '🧥',
    description: 'The first time you take damage each battle, gain 10 Armor.',
    hooks: {
      onDamageTaken(runState, battle) {
        if (battle.flags.plowJacketUsed) return;
        battle.flags.plowJacketUsed = true;
        addStatus(battle.player, STATUS.ARMOR, 10);
      },
    },
  },
  malibuStacy: {
    id: 'malibuStacy',
    name: 'Malibu Stacy',
    emoji: '🪆',
    description: 'Every 3rd ability you play each battle costs 0 Energy.',
    hooks: {
      // Pure read: previews whether the NEXT play would be the 3rd, without
      // advancing the counter itself (that happens once in onAbilityPlayed).
      onAbilityCost(runState, battle) {
        const nextIndex = (battle.flags.abilityPlayCount || 0) + 1;
        return nextIndex % 3 === 0 ? 0 : undefined;
      },
      onAbilityPlayed(runState, battle) {
        battle.flags.abilityPlayCount = (battle.flags.abilityPlayCount || 0) + 1;
      },
    },
  },
  // Devil Ned's optional-boss reward -- never appears in a normal shop or
  // secret-relic grant (see `exclusiveReward` filtered out in
  // getRelicShopPool below), only handed out by data/devilDeals.js.
  devilsPitchfork: {
    id: 'devilsPitchfork',
    name: "Devil's Pitchfork",
    emoji: '🔱',
    description: 'Your attacks apply 2 Poison ("Hellfire"). Mayhem now rises 50% faster.',
    exclusiveReward: true,
    hooks: {
      onAbilityPlayed(runState, battle, ability, targetEnemy) {
        if (targetEnemy && targetEnemy.hp > 0) addStatus(targetEnemy, STATUS.POISON, 2);
      },
    },
  },
  bartsSkateboard: {
    id: 'bartsSkateboard',
    name: "Bart's Skateboard",
    emoji: '🛹',
    description: 'Your first attack ability each turn grants you Dodge.',
    hooks: {
      onAbilityPlayed(runState, battle, ability, targetEnemy) {
        if (!targetEnemy || battle.flags.skateboardUsedThisTurn) return;
        battle.flags.skateboardUsedThisTurn = true;
        addStatus(battle.player, STATUS.DODGE, 1);
      },
      onPlayerTurnStart(runState, battle) {
        battle.flags.skateboardUsedThisTurn = false;
      },
    },
  },
};

export function getRelicShopPool() {
  return Object.values(RELICS).filter((r) => !r.exclusiveReward);
}
