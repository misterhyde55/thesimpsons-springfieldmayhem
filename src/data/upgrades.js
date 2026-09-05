import { addTimedBuff } from '../systems/timedBuffs.js';

// The level-complete "pick one of three" reward pool. `characterId: null`
// means any character can roll it; otherwise it's exclusive to that
// character's pool. Adding Bart/Lisa/Marge-specific upgrades later is just
// more entries here with their id.
export const RARITY = {
  COMMON: 'common',
  UNCOMMON: 'uncommon',
  RARE: 'rare',
  EPIC: 'epic',
  LEGENDARY: 'legendary',
};

export const RARITY_WEIGHT = {
  common: 100,
  uncommon: 55,
  rare: 25,
  epic: 10,
  legendary: 3,
};

export const RARITY_COLOR = {
  common: '#b7b7c0',
  uncommon: '#3ec24c',
  rare: '#3b9dff',
  epic: '#b34bf0',
  legendary: '#f6d217',
};

export const UPGRADES = {
  duffPower: {
    id: 'duffPower',
    name: 'DUFF POWER',
    rarity: RARITY.COMMON,
    characterId: null,
    emoji: '🍺',
    description: '+20% damage.',
    apply(runState) {
      runState.buffs.damageMult += 0.2;
    },
  },
  sugarRush: {
    id: 'sugarRush',
    name: 'SUGAR RUSH',
    rarity: RARITY.COMMON,
    characterId: null,
    emoji: '🥤',
    description: '+15% movement speed.',
    apply(runState) {
      runState.buffs.speedMult += 0.15;
    },
  },
  ironStomach: {
    id: 'ironStomach',
    name: 'IRON STOMACH',
    rarity: RARITY.COMMON,
    characterId: null,
    emoji: '🍔',
    description: '+25 max health, healed on pickup.',
    apply(runState) {
      runState.maxHp += 25;
      runState.hp += 25;
    },
  },
  nuclearGlow: {
    id: 'nuclearGlow',
    name: 'NUCLEAR GLOW',
    rarity: RARITY.UNCOMMON,
    characterId: null,
    emoji: '☢️',
    description: 'Attacks have a 25% chance to inflict radiation.',
    apply(runState) {
      runState.buffs.radiationChance = Math.min(1, (runState.buffs.radiationChance || 0) + 0.25);
    },
  },
  donutArmor: {
    id: 'donutArmor',
    name: 'DONUT ARMOR',
    rarity: RARITY.UNCOMMON,
    characterId: 'homer',
    emoji: '🍩',
    description: 'Eating food grants a temporary shield.',
    apply(runState) {
      runState.buffs.donutArmorUpgrade = true;
    },
  },
  duffRage: {
    id: 'duffRage',
    name: 'DUFF RAGE',
    rarity: RARITY.RARE,
    characterId: 'homer',
    emoji: '😡',
    description: 'Drinking Duff Beer grants a burst of attack speed.',
    apply(runState) {
      runState.buffs.duffRageUpgrade = true;
    },
  },
  bowlingNight: {
    id: 'bowlingNight',
    name: 'BOWLING NIGHT',
    rarity: RARITY.EPIC,
    characterId: 'homer',
    emoji: '🎳',
    description: 'Bowling balls bounce between enemies.',
    apply(runState) {
      runState.buffs.bowlingNightUpgrade = true;
    },
  },
  homersLuck: {
    id: 'homersLuck',
    name: "HOMER'S LUCK",
    rarity: RARITY.LEGENDARY,
    characterId: 'homer',
    emoji: '🍀',
    description: '+40 max health and +10% damage. Somehow, it all works out.',
    apply(runState) {
      runState.maxHp += 40;
      runState.hp += 40;
      runState.buffs.damageMult += 0.1;
    },
  },
};

export function getUpgradePool(characterId) {
  return Object.values(UPGRADES).filter((u) => u.characterId === null || u.characterId === characterId);
}

// A short attack-speed window; used by items.js when Duff Rage is owned.
export function grantDuffRageBurst(runState) {
  addTimedBuff(runState, 'cooldownMult', -0.3, 10000);
}
