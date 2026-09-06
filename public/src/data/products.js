// Commercial Break "sponsor products" -- the reward screen shown at the
// boundary between segments (see game.js showCommercialBreak). Mechanically
// these are one-time effects, same shape as data/items.js shop consumables
// (`apply(runState)`), just reflavored in-universe as ridiculous ads rather
// than a generic "level up" screen.
import { getRelicShopPool } from './relics.js';
import { getDraftPool, RARITY } from './abilities.js';

export const PRODUCTS = {
  mysteryMeat: {
    id: 'mysteryMeat',
    name: 'Krusty Brand Mystery Meat',
    emoji: '🍖',
    description: '+20 Max HP. Fully heals you. Ingredients unknown.',
    apply(runState) {
      runState.maxHp += 20;
      runState.hp = runState.maxHp;
    },
  },
  actionFigure: {
    id: 'actionFigure',
    name: 'Radioactive Man Action Figure',
    emoji: '🦸',
    description: "Gain a relic you don't already own.",
    apply(runState) {
      const pool = getRelicShopPool().filter((r) => !runState.relics.includes(r.id));
      if (pool.length) runState.relics.push(pool[Math.floor(Math.random() * pool.length)].id);
    },
  },
  tradingCard: {
    id: 'tradingCard',
    name: 'Laramie Jr. Cigarette Trading Card',
    emoji: '🚬',
    description: 'Learn a random rare ability. Lose 10 HP.',
    apply(runState) {
      const pool = getDraftPool(runState.cast).filter((a) => a.rarity === RARITY.RARE && !runState.abilityDeck.includes(a.id));
      if (pool.length) runState.abilityDeck.push(pool[Math.floor(Math.random() * pool.length)].id);
      runState.hp = Math.max(1, runState.hp - 10);
    },
  },
  squishee: {
    id: 'squishee',
    name: 'Extra-Large Squishee',
    emoji: '🧊',
    description: 'Fully heal.',
    apply(runState) {
      runState.hp = runState.maxHp;
    },
  },
  duffCase: {
    id: 'duffCase',
    name: 'Duff Case (12-Pack)',
    emoji: '📦',
    description: '+8 Donut currency.',
    apply(runState) {
      runState.donutsCurrency += 8;
    },
  },
  frinkinator: {
    id: 'frinkinator',
    name: 'The Frinkinator 3000',
    emoji: '🔬',
    description: 'Learn a random common or uncommon ability.',
    apply(runState) {
      const pool = getDraftPool(runState.cast).filter(
        (a) => (a.rarity === RARITY.COMMON || a.rarity === RARITY.UNCOMMON) && !runState.abilityDeck.includes(a.id)
      );
      if (pool.length) runState.abilityDeck.push(pool[Math.floor(Math.random() * pool.length)].id);
    },
  },
};

export function rollProductChoices(count) {
  const pool = [...Object.values(PRODUCTS)];
  const choices = [];
  for (let i = 0; i < count && pool.length > 0; i += 1) {
    const idx = Math.floor(Math.random() * pool.length);
    choices.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return choices;
}
