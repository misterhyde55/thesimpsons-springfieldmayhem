import { ITEMS } from '../data/items.js';

export function eatDonut(runState) {
  runState.hp = Math.min(runState.maxHp, runState.hp + 25);
  runState.stats.donutsEaten += 1;
}

export function saveDonut(runState) {
  runState.donutsCurrency += 1;
  runState.stats.donutsSaved += 1;
}

const SHOP_CATALOG = [
  { itemId: 'krustyBurger', cost: 2 },
  { itemId: 'duffBeer', cost: 3 },
  { itemId: 'buzzCola', cost: 3 },
  { itemId: 'bowlingBall', cost: 4 },
];

export function getShopCatalog(runState) {
  return SHOP_CATALOG.map((entry) => ({
    ...entry,
    item: ITEMS[entry.itemId],
    affordable: runState.donutsCurrency >= entry.cost,
  }));
}

export function purchaseItem(runState, itemId, cost) {
  if (runState.donutsCurrency < cost) return false;
  runState.donutsCurrency -= cost;
  return true;
}
