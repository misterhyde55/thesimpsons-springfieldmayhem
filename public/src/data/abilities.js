import { STATUS } from './statusEffects.js';

// Turn-based abilities. `cost` is Energy (systems/battleEngine.js gives the
// player 3 per turn). `target` decides who `effect(api)` acts on by default:
// 'enemy' (the player-chosen enemy), 'self', or 'allEnemies'. `effect`
// receives a small bound API from the battle engine rather than mutating
// battle state directly, so the data here stays declarative -- see
// systems/battleEngine.js's `buildAbilityApi` for what each api.* call does.
//
// `archetype` groups abilities into the build identities characters lean
// into (food/duff/nuclear/bowling/rage for Homer) -- relics and other
// abilities can key off it (e.g. Homer's Work Badge discounts the first
// 'nuclear' ability each battle). `rarity` feeds the drafting odds in
// systems/abilityDraft.js, reusing the same tiers/weights/colors the old
// upgrade system used.
export const RARITY = {
  COMMON: 'common',
  UNCOMMON: 'uncommon',
  RARE: 'rare',
  EPIC: 'epic',
};

export const RARITY_WEIGHT = {
  common: 100,
  uncommon: 55,
  rare: 25,
  epic: 10,
};

export const RARITY_COLOR = {
  common: '#b7b7c0',
  uncommon: '#3ec24c',
  rare: '#3b9dff',
  epic: '#b34bf0',
};

// Every run starts with these already known -- not part of the drafted
// pool. state/gameState.js seeds a fresh runState.abilityDeck with these ids.
export const STARTER_ABILITY_IDS = ['haymaker', 'duckAndCover', 'emergencyDonut'];

export const ABILITIES = {
  haymaker: {
    id: 'haymaker',
    name: 'Haymaker',
    emoji: '👊',
    cost: 1,
    rarity: RARITY.COMMON,
    characterId: 'homer',
    archetype: 'universal',
    target: 'enemy',
    description: 'Deal 12 damage.',
    effect(api) {
      api.damage(12);
    },
  },
  duckAndCover: {
    id: 'duckAndCover',
    name: 'Duck and Cover',
    emoji: '🙈',
    cost: 1,
    rarity: RARITY.COMMON,
    characterId: 'homer',
    archetype: 'universal',
    target: 'self',
    description: 'Gain 8 Armor.',
    effect(api) {
      api.status(STATUS.ARMOR, 8, 'self');
    },
  },
  emergencyDonut: {
    id: 'emergencyDonut',
    name: 'Emergency Donut',
    emoji: '🍩',
    cost: 1,
    rarity: RARITY.COMMON,
    characterId: 'homer',
    archetype: 'food',
    target: 'self',
    description: 'Heal 10 HP.',
    effect(api) {
      api.heal(10, 'self');
      api.ateFood();
    },
  },
  suckerPunch: {
    id: 'suckerPunch',
    name: 'Sucker Punch',
    emoji: '🥊',
    cost: 1,
    rarity: RARITY.COMMON,
    characterId: 'homer',
    archetype: 'bowling',
    target: 'enemy',
    description: 'Deal 6 damage. Apply 1 Stun.',
    effect(api) {
      api.damage(6);
      api.status(STATUS.STUN, 1, 'target');
    },
  },
  bowlingBall: {
    id: 'bowlingBall',
    name: 'Bowling Ball',
    emoji: '🎳',
    cost: 2,
    rarity: RARITY.UNCOMMON,
    characterId: 'homer',
    archetype: 'bowling',
    target: 'enemy',
    description: 'Deal 18 damage. If the enemy is Stunned, deal +8.',
    effect(api) {
      const bonus = api.getStatus(STATUS.STUN, 'target') > 0 ? 8 : 0;
      api.damage(18 + bonus);
    },
  },
  duffCourage: {
    id: 'duffCourage',
    name: 'Duff Courage',
    emoji: '🍺',
    cost: 1,
    rarity: RARITY.COMMON,
    characterId: 'homer',
    archetype: 'duff',
    target: 'self',
    description: 'Gain 5 Strength this battle. Become Tipsy (+10% damage taken).',
    effect(api) {
      api.status(STATUS.STRENGTH, 5, 'self');
      api.status(STATUS.TIPSY, 1, 'self');
    },
  },
  nuclearUppercut: {
    id: 'nuclearUppercut',
    name: 'Nuclear Uppercut',
    emoji: '☢️',
    cost: 3,
    rarity: RARITY.RARE,
    characterId: 'homer',
    archetype: 'nuclear',
    target: 'enemy',
    description: 'Deal 22 damage. Apply 3 Radiation.',
    effect(api) {
      api.damage(22);
      api.status(STATUS.RADIATION, 3, 'target');
    },
  },
  meltdown: {
    id: 'meltdown',
    name: 'Meltdown',
    emoji: '🌋',
    cost: 2,
    rarity: RARITY.EPIC,
    characterId: 'homer',
    archetype: 'nuclear',
    target: 'enemy',
    description: "Consume the enemy's Radiation. Deal 3 damage per stack consumed.",
    effect(api) {
      const stacks = api.consumeStatus(STATUS.RADIATION, 'target');
      api.damage(stacks * 3);
    },
  },
  radiationLeak: {
    id: 'radiationLeak',
    name: 'Radiation Leak',
    emoji: '🟢',
    cost: 1,
    rarity: RARITY.COMMON,
    characterId: 'homer',
    archetype: 'nuclear',
    target: 'enemy',
    description: 'Deal 4 damage. Apply 4 Radiation.',
    effect(api) {
      api.damage(4);
      api.status(STATUS.RADIATION, 4, 'target');
    },
  },
  secondHelping: {
    id: 'secondHelping',
    name: 'Second Helping',
    emoji: '🍗',
    cost: 2,
    rarity: RARITY.UNCOMMON,
    characterId: 'homer',
    archetype: 'food',
    target: 'self',
    description: 'Heal 15 HP. If this is your 2nd+ food this battle, also gain 5 Strength.',
    effect(api) {
      api.heal(15, 'self');
      const alreadyAte = api.ateFood();
      if (alreadyAte >= 2) api.status(STATUS.STRENGTH, 5, 'self');
    },
  },
  lardLadSpecial: {
    id: 'lardLadSpecial',
    name: 'Lard Lad Special',
    emoji: '🍩',
    cost: 2,
    rarity: RARITY.UNCOMMON,
    characterId: 'homer',
    archetype: 'food',
    target: 'enemy',
    description: 'Deal 16 damage. Heal 8 HP.',
    effect(api) {
      api.damage(16);
      api.heal(8, 'self');
      api.ateFood();
    },
  },
  couchPotato: {
    id: 'couchPotato',
    name: 'Couch Potato',
    emoji: '📺',
    cost: 1,
    rarity: RARITY.UNCOMMON,
    characterId: 'homer',
    archetype: 'universal',
    target: 'self',
    description: 'Gain 15 Armor. Your next attack this turn deals +50% damage.',
    effect(api) {
      api.status(STATUS.ARMOR, 15, 'self');
      api.setNextAttackBonus(0.5);
    },
  },
  duffChug: {
    id: 'duffChug',
    name: 'Duff Chug',
    emoji: '🍻',
    cost: 2,
    rarity: RARITY.RARE,
    characterId: 'homer',
    archetype: 'duff',
    target: 'self',
    description: 'Gain 10 Strength this battle. Become Tipsy x2.',
    effect(api) {
      api.status(STATUS.STRENGTH, 10, 'self');
      api.status(STATUS.TIPSY, 2, 'self');
    },
  },
  berserkerSwing: {
    id: 'berserkerSwing',
    name: 'Berserker Swing',
    emoji: '😤',
    cost: 2,
    rarity: RARITY.RARE,
    characterId: 'homer',
    archetype: 'rage',
    target: 'enemy',
    description: 'Deal 14 damage, +1 for every 10 damage you have taken this battle.',
    effect(api) {
      api.damage(14 + Math.floor(api.damageTakenThisBattle() / 10));
    },
  },
  angryDad: {
    id: 'angryDad',
    name: 'Angry Dad',
    emoji: '😡',
    cost: 1,
    rarity: RARITY.UNCOMMON,
    characterId: 'homer',
    archetype: 'rage',
    target: 'self',
    description: 'Gain 4 Strength. Gain 4 more if you are below half HP.',
    effect(api) {
      api.status(STATUS.STRENGTH, 4, 'self');
      if (api.self().hp < api.self().maxHp / 2) api.status(STATUS.STRENGTH, 4, 'self');
    },
  },
  throwTv: {
    id: 'throwTv',
    name: 'Throw the TV',
    emoji: '📴',
    cost: 2,
    rarity: RARITY.RARE,
    characterId: 'homer',
    archetype: 'universal',
    target: 'allEnemies',
    description: 'Deal 20 damage to ALL enemies.',
    effect(api) {
      api.damageAll(20);
    },
  },
  secondWind: {
    id: 'secondWind',
    name: 'Second Wind',
    emoji: '😮‍💨',
    cost: 1,
    rarity: RARITY.UNCOMMON,
    characterId: 'homer',
    archetype: 'universal',
    target: 'self',
    description: 'Heal 12 HP. Remove all Weak and Vulnerable from yourself.',
    effect(api) {
      api.heal(12, 'self');
      api.clearStatus(STATUS.WEAK, 'self');
      api.clearStatus(STATUS.VULNERABLE, 'self');
    },
  },
};

export function getDraftPool(characterId) {
  return Object.values(ABILITIES).filter(
    (a) => !STARTER_ABILITY_IDS.includes(a.id) && (a.characterId === null || a.characterId === characterId)
  );
}
