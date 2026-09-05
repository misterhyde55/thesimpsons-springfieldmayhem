import { addTimedBuff } from '../systems/timedBuffs.js';
import { grantDuffRageBurst } from './upgrades.js';

// Item registry. Items are bought at Shop board nodes (see systems/economy.js
// getShopCatalog) rather than scattered as arena pickups now that combat
// levels award their build-crafting via the level-complete upgrade choice
// instead. `category` decides how a purchase resolves:
//  - 'donut'      -> triggers the eat/save decision (still an arena pickup)
//  - 'consumable' -> applies `apply(runState)` once, immediately
//  - 'weapon'     -> swaps the player's current weapon to `weaponId`
//  - 'passive'    -> applies `apply(runState)` once and stays owned for the run
// `tags` are used by systems/synergy.js to detect combos between owned items.
export const ITEMS = {
  donut: {
    id: 'donut',
    name: 'Donut',
    emoji: '🍩',
    category: 'donut',
    description: 'Health or currency. Your call.',
  },
  krustyBurger: {
    id: 'krustyBurger',
    name: 'Krusty Burger',
    emoji: '🍔',
    category: 'consumable',
    tags: ['food'],
    description: 'Restores a big chunk of health.',
    apply(runState) {
      runState.hp = Math.min(runState.maxHp, runState.hp + 50);
    },
  },
  duffBeer: {
    id: 'duffBeer',
    name: 'Duff Beer',
    emoji: '🍺',
    category: 'passive',
    tags: ['beer'],
    description: 'Damage up, accuracy down. Woo hoo!',
    apply(runState) {
      runState.buffs.damageMult += 0.2;
      runState.buffs.accuracy -= 0.15;
      if (runState.buffs.duffRageUpgrade) grantDuffRageBurst(runState);
    },
  },
  buzzCola: {
    id: 'buzzCola',
    name: 'Buzz Cola',
    emoji: '🥤',
    category: 'passive',
    tags: ['sugar'],
    description: 'Permanently increases movement speed.',
    apply(runState) {
      runState.buffs.speedMult += 0.22;
    },
  },
  squishee: {
    id: 'squishee',
    name: 'Squishee',
    emoji: '🧊',
    category: 'consumable',
    tags: ['sugar'],
    description: 'Huge speed rush... then a sugar crash.',
    apply(runState) {
      if (runState.buffs.sugarRushOverdrive) {
        runState.buffs.speedMult += 0.35;
        return;
      }
      addTimedBuff(runState, 'speedMult', 0.6, 8000);
      setTimeout(() => addTimedBuff(runState, 'speedMult', -0.35, 5000), 8000);
    },
  },
  radioactiveRod: {
    id: 'radioactiveRod',
    name: 'Radioactive Rod',
    emoji: '☢️',
    category: 'weapon',
    weaponId: 'radioactiveRod',
    tags: ['radioactive', 'weapon:radioactiveRod'],
    description: 'A melee weapon that poisons on hit.',
  },
  bowlingBall: {
    id: 'bowlingBall',
    name: "Homer's Bowling Ball",
    emoji: '🎳',
    category: 'weapon',
    weaponId: 'bowlingBall',
    tags: ['bowling', 'weapon:bowlingBall'],
    description: 'A heavy thrown projectile weapon.',
  },
  mrPlowShovel: {
    id: 'mrPlowShovel',
    name: 'Mr. Plow Shovel',
    emoji: '🚜',
    category: 'weapon',
    weaponId: 'mrPlowShovel',
    tags: ['plow', 'weapon:mrPlowShovel'],
    description: 'A wide, hard-hitting melee weapon.',
  },
  flamingMoe: {
    id: 'flamingMoe',
    name: 'Flaming Moe',
    emoji: '🔥',
    category: 'passive',
    tags: ['fire'],
    description: 'Sets up a burn aura around you.',
    apply(runState) {
      runState.buffs.fireAura = Math.max(runState.buffs.fireAura || 0, 6);
    },
  },
  blinky: {
    id: 'blinky',
    name: 'Blinky',
    emoji: '🐟',
    category: 'passive',
    tags: ['radioactive'],
    description: 'A three-eyed fish companion that zaps nearby enemies.',
    apply(runState) {
      runState.buffs.blinky = true;
    },
  },
  malibuStacy: {
    id: 'malibuStacy',
    name: 'Malibu Stacy',
    emoji: '🪆',
    category: 'passive',
    tags: ['collectible'],
    description: 'A collectible doll. Somehow makes you tougher.',
    apply(runState) {
      runState.maxHp += 15;
      runState.hp += 15;
    },
  },
};

export function isWeaponItem(item) {
  return item.category === 'weapon';
}
