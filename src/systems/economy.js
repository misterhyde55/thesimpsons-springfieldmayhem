import { ITEMS } from '../data/items.js';

export function eatDonut(runState) {
  const healAmount = 25;
  runState.hp = Math.min(runState.maxHp, runState.hp + healAmount);
  runState.stats.donutsEaten += 1;
  if (runState.buffs.donutArmorUpgrade) {
    runState.armorShield = Math.max(runState.armorShield, 20);
  }
}

export function saveDonut(runState) {
  runState.donutsCurrency += 1;
  runState.stats.donutsSaved += 1;
}

export function restHeal(runState) {
  runState.hp = runState.maxHp;
}

const SHOP_CATALOG = [
  { itemId: 'krustyBurger', cost: 2 },
  { itemId: 'duffBeer', cost: 3 },
  { itemId: 'buzzCola', cost: 3 },
  { itemId: 'flamingMoe', cost: 3 },
  { itemId: 'blinky', cost: 4 },
  { itemId: 'bowlingBall', cost: 4 },
  { itemId: 'radioactiveRod', cost: 4 },
  { itemId: 'malibuStacy', cost: 5 },
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
