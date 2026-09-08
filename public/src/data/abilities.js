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
// 'nuclear' ability each battle), and doubles as the Action card's visual
// category in ui/screens.js (see style.css .action-card.archetype-*).
// `rarity` feeds the drafting odds in systems/abilityDraft.js, reusing the
// same tiers/weights/colors the old upgrade system used. `icon` points into
// data/icons.js ({category, id}); `emoji` survives only as a fallback label
// for the icon registry's temporary CSS badge, never rendered directly.
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
    icon: { category: 'combat', id: 'attack' },
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
    icon: { category: 'combat', id: 'defend' },
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
    icon: { category: 'resources', id: 'donut' },
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
    icon: { category: 'combat', id: 'stun' },
    cost: 1,
    rarity: RARITY.COMMON,
    characterId: 'homer',
    archetype: 'bowling',
    target: 'enemy',
    upgradesToId: 'suckerPunchPlus',
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
    icon: { category: 'items', id: 'bowlingBall' },
    cost: 2,
    rarity: RARITY.UNCOMMON,
    characterId: 'homer',
    archetype: 'bowling',
    target: 'enemy',
    upgradesToId: 'bowlingBallPlus',
    description: 'Deal 18 damage. If the enemy is Stunned, deal +8. Chips 8 Break.',
    effect(api) {
      const bonus = api.getStatus(STATUS.STUN, 'target') > 0 ? 8 : 0;
      api.damage(18 + bonus);
      api.reduceBreak(8);
    },
  },
  // ---- Upgraded ("+") cards, reached only by upgrading the base card above
  // at Barney's Bowlarama (see data/interiors.js upgradeCardInteraction) --
  // never appear in the ordinary draft pool (getDraftPool filters out
  // `upgraded: true`), and a run can only ever hold the base id OR its
  // upgraded id in abilityDeck, never both (systems/cardUpgrades.js
  // upgradeAbility swaps the array entry in place).
  suckerPunchPlus: {
    id: 'suckerPunchPlus',
    name: 'Sucker Punch+',
    emoji: '🥊',
    icon: { category: 'combat', id: 'stun' },
    cost: 1,
    rarity: RARITY.COMMON,
    characterId: 'homer',
    archetype: 'bowling',
    target: 'enemy',
    upgraded: true,
    baseId: 'suckerPunch',
    description: 'Deal 9 damage. Apply 2 Stun.',
    effect(api) {
      api.damage(9);
      api.status(STATUS.STUN, 2, 'target');
    },
  },
  bowlingBallPlus: {
    id: 'bowlingBallPlus',
    name: 'Bowling Ball+',
    emoji: '🎳',
    icon: { category: 'items', id: 'bowlingBall' },
    cost: 2,
    rarity: RARITY.UNCOMMON,
    characterId: 'homer',
    archetype: 'bowling',
    target: 'enemy',
    upgraded: true,
    baseId: 'bowlingBall',
    description: 'Deal 24 damage. If the enemy is Stunned, deal +12. Chips 12 Break.',
    effect(api) {
      const bonus = api.getStatus(STATUS.STUN, 'target') > 0 ? 12 : 0;
      api.damage(24 + bonus);
      api.reduceBreak(12);
    },
  },
  // Zombie Ned's reward pool (data/bosses.js zombieNed / game.js's
  // encounter-reward screen for that fight).
  leftHandedUppercut: {
    id: 'leftHandedUppercut',
    name: 'Left-Handed Uppercut',
    emoji: '🥊',
    icon: { category: 'combat', id: 'heavyAttack' },
    cost: 2,
    rarity: RARITY.UNCOMMON,
    characterId: 'homer',
    archetype: 'universal',
    target: 'enemy',
    description: 'Deal 16 damage. Chips 12 Break.',
    effect(api) {
      api.damage(16);
      api.reduceBreak(12);
    },
  },
  duffCourage: {
    id: 'duffCourage',
    name: 'Duff Courage',
    emoji: '🍺',
    icon: { category: 'items', id: 'duff' },
    cost: 1,
    rarity: RARITY.COMMON,
    characterId: 'homer',
    archetype: 'duff',
    target: 'self',
    upgradesToId: 'duffCouragePlus',
    description: 'Gain 5 Strength this battle. Become Tipsy (+10% damage taken).',
    effect(api) {
      api.status(STATUS.STRENGTH, 5, 'self');
      api.status(STATUS.TIPSY, 1, 'self');
    },
  },
  duffCouragePlus: {
    id: 'duffCouragePlus',
    name: 'Duff Courage+',
    emoji: '🍺',
    icon: { category: 'items', id: 'duff' },
    cost: 1,
    rarity: RARITY.COMMON,
    characterId: 'homer',
    archetype: 'duff',
    target: 'self',
    upgraded: true,
    baseId: 'duffCourage',
    description: 'Gain 8 Strength this battle. Become Tipsy (+10% damage taken).',
    effect(api) {
      api.status(STATUS.STRENGTH, 8, 'self');
      api.status(STATUS.TIPSY, 1, 'self');
    },
  },
  nuclearUppercut: {
    id: 'nuclearUppercut',
    name: 'Nuclear Uppercut',
    emoji: '☢️',
    icon: { category: 'items', id: 'radioactiveRod' },
    cost: 3,
    rarity: RARITY.RARE,
    characterId: 'homer',
    archetype: 'nuclear',
    target: 'enemy',
    upgradesToId: 'nuclearUppercutPlus',
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
    icon: { category: 'items', id: 'radioactiveRod' },
    cost: 2,
    rarity: RARITY.EPIC,
    characterId: 'homer',
    archetype: 'nuclear',
    target: 'enemy',
    upgradesToId: 'meltdownPlus',
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
    icon: { category: 'items', id: 'radioactiveRod' },
    cost: 1,
    rarity: RARITY.COMMON,
    characterId: 'homer',
    archetype: 'nuclear',
    target: 'enemy',
    upgradesToId: 'radiationLeakPlus',
    description: 'Deal 4 damage. Apply 4 Radiation.',
    effect(api) {
      api.damage(4);
      api.status(STATUS.RADIATION, 4, 'target');
    },
  },
  // ---- Upgraded ("+") cards -- reached only via the Nuclear Plant's
  // upgrade station (data/interiors.js), which also risks a stack of
  // Radiation on Homer himself for the privilege (REDESIGN COMBAT
  // GAMEPLAY: "upgrade NUCLEAR cards but risk Radiation").
  nuclearUppercutPlus: {
    id: 'nuclearUppercutPlus',
    name: 'Nuclear Uppercut+',
    emoji: '☢️',
    icon: { category: 'items', id: 'radioactiveRod' },
    cost: 2,
    rarity: RARITY.RARE,
    characterId: 'homer',
    archetype: 'nuclear',
    target: 'enemy',
    upgraded: true,
    baseId: 'nuclearUppercut',
    description: 'Deal 28 damage. Apply 4 Radiation.',
    effect(api) {
      api.damage(28);
      api.status(STATUS.RADIATION, 4, 'target');
    },
  },
  meltdownPlus: {
    id: 'meltdownPlus',
    name: 'Meltdown+',
    emoji: '🌋',
    icon: { category: 'items', id: 'radioactiveRod' },
    cost: 1,
    rarity: RARITY.EPIC,
    characterId: 'homer',
    archetype: 'nuclear',
    target: 'enemy',
    upgraded: true,
    baseId: 'meltdown',
    description: "Consume the enemy's Radiation. Deal 4 damage per stack consumed.",
    effect(api) {
      const stacks = api.consumeStatus(STATUS.RADIATION, 'target');
      api.damage(stacks * 4);
    },
  },
  radiationLeakPlus: {
    id: 'radiationLeakPlus',
    name: 'Radiation Leak+',
    emoji: '🟢',
    icon: { category: 'items', id: 'radioactiveRod' },
    cost: 1,
    rarity: RARITY.COMMON,
    characterId: 'homer',
    archetype: 'nuclear',
    target: 'enemy',
    upgraded: true,
    baseId: 'radiationLeak',
    description: 'Deal 6 damage. Apply 6 Radiation.',
    effect(api) {
      api.damage(6);
      api.status(STATUS.RADIATION, 6, 'target');
    },
  },
  secondHelping: {
    id: 'secondHelping',
    name: 'Second Helping',
    emoji: '🍗',
    icon: { category: 'resources', id: 'donut' },
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
    icon: { category: 'resources', id: 'donut' },
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
    icon: { category: 'combat', id: 'defend' },
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
    icon: { category: 'items', id: 'duff' },
    cost: 2,
    rarity: RARITY.RARE,
    characterId: 'homer',
    archetype: 'duff',
    target: 'self',
    upgradesToId: 'duffChugPlus',
    description: 'Gain 10 Strength this battle. Become Tipsy x2.',
    effect(api) {
      api.status(STATUS.STRENGTH, 10, 'self');
      api.status(STATUS.TIPSY, 2, 'self');
    },
  },
  duffChugPlus: {
    id: 'duffChugPlus',
    name: 'Duff Chug+',
    emoji: '🍻',
    icon: { category: 'items', id: 'duff' },
    cost: 1,
    rarity: RARITY.RARE,
    characterId: 'homer',
    archetype: 'duff',
    target: 'self',
    upgraded: true,
    baseId: 'duffChug',
    description: 'Gain 10 Strength this battle. Become Tipsy x2.',
    effect(api) {
      api.status(STATUS.STRENGTH, 10, 'self');
      api.status(STATUS.TIPSY, 2, 'self');
    },
  },
  // ---- Duff synergy: duffCourage/duffChug stack Tipsy on Homer as a
  // drawback (+10% damage taken per stack, statusEffects.js); these three
  // instead treat those same stacks as fuel, so committing to Duff during a
  // fight becomes a real build identity rather than a one-off panic button.
  drunkenHaymaker: {
    id: 'drunkenHaymaker',
    name: 'Drunken Haymaker',
    emoji: '🥊',
    icon: { category: 'items', id: 'duff' },
    cost: 1,
    rarity: RARITY.COMMON,
    characterId: 'homer',
    archetype: 'duff',
    target: 'enemy',
    upgradesToId: 'drunkenHaymakerPlus',
    description: 'Deal 8 damage, +5 for each stack of Tipsy you have.',
    effect(api) {
      api.damage(8 + api.getStatus(STATUS.TIPSY, 'self') * 5);
    },
  },
  drunkenHaymakerPlus: {
    id: 'drunkenHaymakerPlus',
    name: 'Drunken Haymaker+',
    emoji: '🥊',
    icon: { category: 'items', id: 'duff' },
    cost: 1,
    rarity: RARITY.COMMON,
    characterId: 'homer',
    archetype: 'duff',
    target: 'enemy',
    upgraded: true,
    baseId: 'drunkenHaymaker',
    description: 'Deal 12 damage, +5 for each stack of Tipsy you have.',
    effect(api) {
      api.damage(12 + api.getStatus(STATUS.TIPSY, 'self') * 5);
    },
  },
  beerBelly: {
    id: 'beerBelly',
    name: 'Beer Belly',
    emoji: '🛡️',
    icon: { category: 'items', id: 'duff' },
    cost: 1,
    rarity: RARITY.UNCOMMON,
    characterId: 'homer',
    archetype: 'duff',
    target: 'self',
    upgradesToId: 'beerBellyPlus',
    description: 'Gain 5 Armor, +3 for each stack of Tipsy you have.',
    effect(api) {
      api.status(STATUS.ARMOR, 5 + api.getStatus(STATUS.TIPSY, 'self') * 3, 'self');
    },
  },
  beerBellyPlus: {
    id: 'beerBellyPlus',
    name: 'Beer Belly+',
    emoji: '🛡️',
    icon: { category: 'items', id: 'duff' },
    cost: 1,
    rarity: RARITY.UNCOMMON,
    characterId: 'homer',
    archetype: 'duff',
    target: 'self',
    upgraded: true,
    baseId: 'beerBelly',
    description: 'Gain 8 Armor, +3 for each stack of Tipsy you have.',
    effect(api) {
      api.status(STATUS.ARMOR, 8 + api.getStatus(STATUS.TIPSY, 'self') * 3, 'self');
    },
  },
  duffRage: {
    id: 'duffRage',
    name: 'Duff Rage',
    emoji: '😤',
    icon: { category: 'items', id: 'duff' },
    cost: 1,
    rarity: RARITY.UNCOMMON,
    characterId: 'homer',
    archetype: 'duff',
    target: 'self',
    upgradesToId: 'duffRagePlus',
    description: 'Gain 3 Strength for each stack of Tipsy you have (minimum 3).',
    effect(api) {
      api.status(STATUS.STRENGTH, Math.max(3, api.getStatus(STATUS.TIPSY, 'self') * 3), 'self');
    },
  },
  duffRagePlus: {
    id: 'duffRagePlus',
    name: 'Duff Rage+',
    emoji: '😤',
    icon: { category: 'items', id: 'duff' },
    cost: 1,
    rarity: RARITY.UNCOMMON,
    characterId: 'homer',
    archetype: 'duff',
    target: 'self',
    upgraded: true,
    baseId: 'duffRage',
    description: 'Gain 4 Strength for each stack of Tipsy you have (minimum 4).',
    effect(api) {
      api.status(STATUS.STRENGTH, Math.max(4, api.getStatus(STATUS.TIPSY, 'self') * 4), 'self');
    },
  },
  holdMyBeer: {
    id: 'holdMyBeer',
    name: 'Hold My Beer',
    emoji: '🍺',
    icon: { category: 'items', id: 'duff' },
    cost: 2,
    rarity: RARITY.EPIC,
    characterId: 'homer',
    archetype: 'duff',
    target: 'enemy',
    upgradesToId: 'holdMyBeerPlus',
    description: 'Deal 24 damage. Become Tipsy x3. "Watch this."',
    effect(api) {
      api.damage(24);
      api.status(STATUS.TIPSY, 3, 'self');
    },
  },
  holdMyBeerPlus: {
    id: 'holdMyBeerPlus',
    name: 'Hold My Beer+',
    emoji: '🍺',
    icon: { category: 'items', id: 'duff' },
    cost: 2,
    rarity: RARITY.EPIC,
    characterId: 'homer',
    archetype: 'duff',
    target: 'enemy',
    upgraded: true,
    baseId: 'holdMyBeer',
    description: 'Deal 32 damage. Become Tipsy x3. "Watch THIS."',
    effect(api) {
      api.damage(32);
      api.status(STATUS.TIPSY, 3, 'self');
    },
  },
  berserkerSwing: {
    id: 'berserkerSwing',
    name: 'Berserker Swing',
    emoji: '😤',
    icon: { category: 'status', id: 'rage' },
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
    icon: { category: 'status', id: 'rage' },
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
    icon: { category: 'combat', id: 'heavyAttack' },
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
    icon: { category: 'combat', id: 'heal' },
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
  // ---- Cast abilities: unlocked once that Springfield resident has joined
  // the episode cast (state/gameState.js runState.cast). Recruiting a
  // character is a build decision, not just a story beat -- their kit
  // should be worth drafting.
  lastCall: {
    id: 'lastCall',
    name: 'Last Call',
    emoji: '🍸',
    icon: { category: 'items', id: 'duff' },
    cost: 2,
    rarity: RARITY.UNCOMMON,
    characterId: 'moe',
    archetype: 'duff',
    target: 'enemy',
    upgradesToId: 'lastCallPlus',
    description: 'Deal 16 damage.',
    effect(api) {
      api.damage(16);
    },
  },
  lastCallPlus: {
    id: 'lastCallPlus',
    name: 'Last Call+',
    emoji: '🍸',
    icon: { category: 'items', id: 'duff' },
    cost: 2,
    rarity: RARITY.UNCOMMON,
    characterId: 'moe',
    archetype: 'duff',
    target: 'enemy',
    upgraded: true,
    baseId: 'lastCall',
    description: 'Deal 22 damage.',
    effect(api) {
      api.damage(22);
    },
  },
  onTheHouse: {
    id: 'onTheHouse',
    name: 'On the House',
    emoji: '🍻',
    icon: { category: 'items', id: 'duff' },
    cost: 1,
    rarity: RARITY.COMMON,
    characterId: 'moe',
    archetype: 'duff',
    target: 'self',
    upgradesToId: 'onTheHousePlus',
    description: 'Heal 12 HP.',
    effect(api) {
      api.heal(12, 'self');
    },
  },
  onTheHousePlus: {
    id: 'onTheHousePlus',
    name: 'On the House+',
    emoji: '🍻',
    icon: { category: 'items', id: 'duff' },
    cost: 1,
    rarity: RARITY.COMMON,
    characterId: 'moe',
    archetype: 'duff',
    target: 'self',
    upgraded: true,
    baseId: 'onTheHouse',
    description: 'Heal 18 HP.',
    effect(api) {
      api.heal(18, 'self');
    },
  },
  nervousWreck: {
    id: 'nervousWreck',
    name: 'Nervous Wreck',
    emoji: '😰',
    icon: { category: 'combat', id: 'defend' },
    cost: 1,
    rarity: RARITY.COMMON,
    characterId: 'milhouse',
    archetype: 'universal',
    target: 'self',
    description: 'Gain 6 Armor.',
    effect(api) {
      api.status(STATUS.ARMOR, 6, 'self');
    },
  },
  everybodyLovesMilhouse: {
    id: 'everybodyLovesMilhouse',
    name: 'Everybody Loves Milhouse',
    emoji: '🤓',
    icon: { category: 'combat', id: 'attack' },
    cost: 2,
    rarity: RARITY.UNCOMMON,
    characterId: 'milhouse',
    archetype: 'universal',
    target: 'enemy',
    description: 'Deal 10 damage. Apply 2 Weak.',
    effect(api) {
      api.damage(10);
      api.status(STATUS.WEAK, 2, 'target');
    },
  },
  // Bart's own cast-gated abilities (WHERE'S BART?, data/quests.js) --
  // mischief/offense, same "found him, now his tricks are yours" payoff as
  // Milhouse's above.
  slingshot: {
    id: 'slingshot',
    name: 'Slingshot',
    emoji: '🎯',
    icon: { category: 'combat', id: 'stun' },
    cost: 1,
    rarity: RARITY.COMMON,
    characterId: 'bart',
    archetype: 'universal',
    target: 'enemy',
    description: 'Deal 8 damage. 35% chance to Stun.',
    effect(api) {
      api.damage(8);
      if (Math.random() < 0.35) api.status(STATUS.STUN, 1, 'target');
    },
  },
  cowabunga: {
    id: 'cowabunga',
    name: 'Cowabunga',
    emoji: '🛹',
    icon: { category: 'combat', id: 'dodge' },
    cost: 1,
    rarity: RARITY.UNCOMMON,
    characterId: 'bart',
    archetype: 'universal',
    target: 'enemy',
    description: 'Gain 1 Dodge. Deal 6 damage.',
    effect(api) {
      api.status(STATUS.DODGE, 1, 'self');
      api.damage(6);
    },
  },
};

// `castIds` is every character currently in the episode cast (always
// includes the main character; see state/gameState.js). An ability with
// characterId: null is universal; anything else needs that resident to
// have joined the run first.
export function getDraftPool(castIds) {
  return Object.values(ABILITIES).filter(
    // Upgraded ("+") cards are never drafted directly -- they're only ever
    // reached by upgrading the owned base card (systems/cardUpgrades.js) at
    // an upgrade station (Bowlarama, Moe's, Nuclear Plant).
    (a) => !a.upgraded && !STARTER_ABILITY_IDS.includes(a.id) && (a.characterId === null || castIds.includes(a.characterId))
  );
}
