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
  // Zombie Ned's reward pool (data/bosses.js zombieNed / game.js's
  // encounter-reward screen for that fight). battle.flags resets fresh
  // every createBattle, so the "used" flag needs no explicit reset hook.
  neighborlyShield: {
    id: 'neighborlyShield',
    name: 'Neighborly Shield',
    emoji: '🛡️',
    description: 'The first Armor you gain each combat is +4 stronger.',
    hooks: {
      onStatusApplied(runState, battle, target, statusId, newValue) {
        if (target !== battle.player || statusId !== STATUS.ARMOR || battle.flags.neighborlyShieldUsed) return;
        battle.flags.neighborlyShieldUsed = true;
        addStatus(battle.player, STATUS.ARMOR, 4);
      },
    },
  },
  // Snake's Kwik-E-Mart Robbery event reward pool (data/events.js
  // kwikEMartRobbery, INTERVENE -> victory) -- these two plus the
  // hotDogPunch ability (data/abilities.js) are the SPRINGFIELD PERKS/
  // SKILLS the event grants, mechanically implemented as relics since
  // relics already ARE exactly "a run-only passive bonus earned through
  // exploration" -- see systems/passiveHooks.js's fireHooks, which battle-
  // Engine.js's createBattle already calls with a new 'onFirstTurnExtraDraw'
  // hook name for this one.
  quickHands: {
    id: 'quickHands',
    name: 'Quick Hands',
    emoji: '⚡',
    description: 'Draw 1 additional card on the first turn of combat.',
    // Fixes a real leak: without this, getRelicShopPool below would let
    // Snake's dedicated reward show up randomly via the Kwik-E-Mart shop,
    // mysteriousPortal, or Ralph's blessing too.
    exclusiveReward: true,
    hooks: {
      onFirstTurnExtraDraw() {
        return 1;
      },
    },
  },
  // No combat hook -- read directly by systems/economy.js's
  // apuPriceModifier, since shop pricing happens outside any battle.
  kwikEDiscount: {
    id: 'kwikEDiscount',
    name: 'Kwik-E Discount',
    emoji: '💸',
    description: '20% off Kwik-E-Mart prices for the rest of this episode.',
    exclusiveReward: true,
  },
  // ---- SPRINGFIELD PERKS: ordinary (non-exclusive) relics, so they flow
  // through every distribution channel that already exists -- the Kwik-E-
  // Mart shop (systems/economy.js rollKwikEMartInventory), the
  // mysteriousPortal travel event, and Ralph's GIVE HIM A DONUT blessing
  // (data/travelEvents.js) -- all three already draw from
  // getRelicShopPool() below, so adding these here is the entire
  // "grant" wiring; no new distribution code needed anywhere.
  kwikERegular: {
    id: 'kwikERegular',
    name: 'Kwik-E Regular',
    emoji: '🌭',
    description: 'Hot Dogs heal +5 additional HP.',
    // No combat hook -- read directly by data/interiors.js's
    // eatAHotDogInteraction, since it heals outside any battle.
  },
  moesFavoriteCustomer: {
    id: 'moesFavoriteCustomer',
    name: "Moe's Favorite Customer",
    emoji: '🍺',
    description: 'Beer heals +10 additional HP.',
    // No combat hook -- read directly by data/interiors.js's
    // haveABeerInteraction, same reason as kwikERegular above.
  },
  springfieldSurvivor: {
    id: 'springfieldSurvivor',
    name: 'Springfield Survivor',
    emoji: '🎖️',
    description: 'Start Elite encounters with 5 Block.',
    hooks: {
      onBattleStart(runState, battle) {
        if (battle.isElite) addStatus(battle.player, STATUS.ARMOR, 5);
      },
    },
  },
  bowlingLeagueChamp: {
    id: 'bowlingLeagueChamp',
    name: 'Bowling League Champ',
    emoji: '🎳',
    description: 'Bowling cards deal +2 Damage.',
    hooks: {
      onDamageDealt(runState, battle, source) {
        if (source?.kind === 'ability' && source.archetype === 'bowling') return 2;
      },
    },
  },
  // Otto's travel encounter reward (data/travelEvents.js ottoEncounter,
  // HELP OTTO -> victory, granted via combatContent.grantRelicId --
  // game.js onBattleVictory). Named/specific like quickHands/kwikEDiscount
  // above, so it's exclusive to its own source rather than diluting the
  // general shop/portal/Ralph pool.
  ottosMixtape: {
    id: 'ottosMixtape',
    name: "Otto's Mixtape",
    emoji: '📼',
    description: 'The first card you play each combat costs 1 less Energy.',
    exclusiveReward: true,
    hooks: {
      // Same "pure read, mark used only on the real play" split
      // homersWorkBadge above uses -- onAbilityCost previews on every
      // render, not just when a card is actually played.
      onAbilityCost(runState, battle, ability) {
        if (battle.flags.ottosMixtapeUsed) return undefined;
        return Math.max(0, ability.cost - 1);
      },
      onAbilityPlayed(runState, battle) {
        battle.flags.ottosMixtapeUsed = true;
      },
    },
  },
  // Grandpa's travel encounter reward (data/travelEvents.js
  // grandpaEncounter, HELP GRANDPA HOME) -- same exclusivity reasoning as
  // ottosMixtape above.
  grandpasWarStory: {
    id: 'grandpasWarStory',
    name: "Grandpa's War Story",
    emoji: '👴',
    description: 'The first time Homer drops below 25% HP each combat, gain 6 Armor.',
    exclusiveReward: true,
    hooks: {
      onDamageTaken(runState, battle) {
        if (battle.flags.warStoryUsed || battle.player.hp / battle.player.maxHp >= 0.25) return;
        battle.flags.warStoryUsed = true;
        addStatus(battle.player, STATUS.ARMOR, 6);
      },
    },
  },
};

export function getRelicShopPool() {
  return Object.values(RELICS).filter((r) => !r.exclusiveReward);
}
