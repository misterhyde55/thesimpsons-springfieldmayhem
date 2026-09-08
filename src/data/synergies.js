// Character Synergies activate automatically once every character they
// `requires` is in the episode cast (state/gameState.js runState.cast,
// always including the main character). Same {hooks:{...}} shape as
// relics/horror rules -- see systems/passiveHooks.js for how all three
// get fired together. Discovering which cast combinations click is meant
// to be part of the roguelike experience, so these aren't announced
// anywhere before they trigger.
export const SYNERGIES = {
  homerMoe: {
    id: 'homerMoe',
    name: 'Regular Customer',
    icon: '🍺',
    requires: ['homer', 'moe'],
    description: 'Duff abilities cost 1 less Energy (minimum 0).',
    hooks: {
      onAbilityCost(runState, battle, ability) {
        return ability.archetype === 'duff' ? Math.max(0, ability.cost - 1) : undefined;
      },
    },
  },
  homerMilhouse: {
    id: 'homerMilhouse',
    name: 'Unlikely Wingman',
    icon: '🤝',
    requires: ['homer', 'milhouse'],
    description: 'Whenever you apply Weak to an enemy, also apply 1 Vulnerable.',
    hooks: {
      onStatusApplied(runState, battle, holder, statusId, newTotal) {
        if (statusId !== 'weak' || holder === battle.player || battle.flags.milhouseSynergyLock) return;
        battle.flags.milhouseSynergyLock = true;
        holder.statuses.vulnerable = (holder.statuses.vulnerable || 0) + 1;
        battle.flags.milhouseSynergyLock = false;
      },
    },
  },
  homerBart: {
    id: 'homerBart',
    name: 'Like Father, Like Son',
    icon: '🛹',
    requires: ['homer', 'bart'],
    description: 'Whenever you apply Stun to an enemy, also apply 1 Vulnerable.',
    hooks: {
      onStatusApplied(runState, battle, holder, statusId, newTotal) {
        if (statusId !== 'stun' || holder === battle.player || battle.flags.bartSynergyLock) return;
        battle.flags.bartSynergyLock = true;
        holder.statuses.vulnerable = (holder.statuses.vulnerable || 0) + 1;
        battle.flags.bartSynergyLock = false;
      },
    },
  },
  homerLisa: {
    id: 'homerLisa',
    name: 'Straight-A Backup',
    icon: '🎷',
    requires: ['homer', 'lisa'],
    description: 'Whenever you apply Vulnerable to an enemy, also apply 1 Weak.',
    hooks: {
      onStatusApplied(runState, battle, holder, statusId, newTotal) {
        if (statusId !== 'vulnerable' || holder === battle.player || battle.flags.lisaSynergyLock) return;
        battle.flags.lisaSynergyLock = true;
        holder.statuses.weak = (holder.statuses.weak || 0) + 1;
        battle.flags.lisaSynergyLock = false;
      },
    },
  },
  homerMarge: {
    id: 'homerMarge',
    name: 'Never Alone',
    icon: '🧹',
    requires: ['homer', 'marge'],
    description: 'Below 50% HP, healing is increased by 50%.',
    hooks: {
      onHealAmount(runState, battle, baseAmount) {
        if (battle.player.hp / battle.player.maxHp >= 0.5) return undefined;
        return Math.round(baseAmount * 1.5);
      },
    },
  },
};

export function getActiveSynergies(runState) {
  return Object.values(SYNERGIES).filter((s) => s.requires.every((id) => runState.cast.includes(id)));
}
