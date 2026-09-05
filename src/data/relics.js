import { STATUS } from './statusEffects.js';
import { addStatus, applyIncomingDamage } from '../systems/statusEngine.js';

// Relics are permanent, passive, always-on run items (bought at shops or
// found at events) -- unlike abilities, the player never "plays" a relic,
// it just reacts to battle events via whichever hooks it defines.
// systems/battleEngine.js calls `fireRelicHook(runState, hookName, ...args)`
// at the relevant moment; a relic that doesn't care about a hook simply
// doesn't define it. Every hook's first argument is the live `battle` state
// (see battleEngine's `createBattle`), so a hook can read/mutate
// battle.player / battle.enemies / battle.flags freely.
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
      onAbilityCost(battle, ability) {
        if (ability.archetype !== 'nuclear' || battle.flags.workBadgeUsed) return undefined;
        return 0;
      },
      onAbilityPlayed(battle, ability) {
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
      onHealAmount(battle, baseAmount) {
        return Math.round(baseAmount * 1.5);
      },
      onAteFood(battle, countThisBattle) {
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
      onStatusApplied(battle, holder, statusId, newTotal) {
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
      onDamageTaken(battle) {
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
      onAbilityCost(battle) {
        const nextIndex = (battle.flags.abilityPlayCount || 0) + 1;
        return nextIndex % 3 === 0 ? 0 : undefined;
      },
      onAbilityPlayed(battle) {
        battle.flags.abilityPlayCount = (battle.flags.abilityPlayCount || 0) + 1;
      },
    },
  },
  bartsSkateboard: {
    id: 'bartsSkateboard',
    name: "Bart's Skateboard",
    emoji: '🛹',
    description: 'Your first attack ability each turn grants you Dodge.',
    hooks: {
      onAbilityPlayed(battle, ability, targetEnemy) {
        if (!targetEnemy || battle.flags.skateboardUsedThisTurn) return;
        battle.flags.skateboardUsedThisTurn = true;
        addStatus(battle.player, STATUS.DODGE, 1);
      },
      onPlayerTurnStart(battle) {
        battle.flags.skateboardUsedThisTurn = false;
      },
    },
  },
};

export function getRelicShopPool() {
  return Object.values(RELICS);
}
