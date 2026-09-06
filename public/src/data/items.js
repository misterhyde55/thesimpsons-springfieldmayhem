// Shop consumables, bought with donut currency at 'shop' board nodes (see
// systems/economy.js). Permanent run-modifying items are relics
// (data/relics.js) now, not items -- these are one-time-use heals/currency,
// applied immediately on purchase via `apply(runState)`.
export const ITEMS = {
  krustyBurger: {
    id: 'krustyBurger',
    name: 'Krusty Burger',
    emoji: '🍔',
    description: 'Restores 30 HP.',
    apply(runState) {
      runState.hp = Math.min(runState.maxHp, runState.hp + 30);
    },
  },
  duffBeer: {
    id: 'duffBeer',
    name: 'Duff Beer',
    emoji: '🍺',
    description: 'Restores 15 HP. Slightly unwise before a boss fight.',
    apply(runState) {
      runState.hp = Math.min(runState.maxHp, runState.hp + 15);
    },
  },
  squishee: {
    id: 'squishee',
    name: 'Squishee',
    emoji: '🧊',
    description: 'Restores 20 HP.',
    apply(runState) {
      runState.hp = Math.min(runState.maxHp, runState.hp + 20);
    },
  },
  // Rare/bizarre Kwik-E-Mart finds (economy.js's rollKwikEMartInventory).
  // Unlike the staples above, buying one of these doesn't apply it on the
  // spot -- it goes into runState.consumables (a small held-item bag) so it
  // can be saved for the right moment, used later via any interior's "USE
  // AN ITEM", or sold back to Apu. `apply` still means "the effect of using
  // it," it just fires on USE instead of on purchase.
  radioactiveDonut: {
    id: 'radioactiveDonut',
    name: 'Radioactive Donut',
    emoji: '☢️',
    description: 'Restores 35 HP. Glows a little too green. (+2 Infection)',
    rare: true,
    apply(runState) {
      runState.hp = Math.min(runState.maxHp, runState.hp + 35);
      runState.infection = (runState.infection || 0) + 2;
    },
  },
  cursedMonkeyPaw: {
    id: 'cursedMonkeyPaw',
    name: 'Cursed Monkey Paw',
    emoji: '🐒',
    description: 'Grants a wish: +25 Max HP. Wishes have a way of costing something back. (-15 HP now)',
    rare: true,
    apply(runState) {
      runState.maxHp += 25;
      runState.hp = Math.max(1, runState.hp - 15);
    },
  },
  mysteriousKey: {
    id: 'mysteriousKey',
    name: 'Mysterious Key',
    emoji: '🗝️',
    description: "Fits a lock somewhere in Springfield. You'll know it when you see it.",
    rare: true,
    apply(runState) {
      runState.world.locationFlags.hasMysteriousKey = true;
    },
  },
  krustyEmergencyKit: {
    id: 'krustyEmergencyKit',
    name: 'Krusty Brand Emergency Kit',
    emoji: '🧰',
    description: 'Restores 20 HP and clears 3 Infection. FDA approval pending.',
    rare: true,
    apply(runState) {
      runState.hp = Math.min(runState.maxHp, runState.hp + 20);
      runState.infection = Math.max(0, (runState.infection || 0) - 3);
    },
  },
  // Devil Ned's optional-boss reward -- never appears in a normal shop,
  // only handed out by data/devilDeals.js's victoryReward.
  forbiddenDonut: {
    id: 'forbiddenDonut',
    name: 'Forbidden Donut',
    emoji: '🍩',
    description: 'A donut that should not exist. +40 Max HP and a full heal, permanently.',
    exclusiveReward: true,
    apply(runState) {
      runState.maxHp += 40;
      runState.hp = runState.maxHp;
    },
  },
};
