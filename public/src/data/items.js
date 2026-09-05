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
};
