import { ITEMS } from '../data/items.js';
import { RELICS } from '../data/relics.js';

export function restHeal(runState) {
  runState.hp = runState.maxHp;
}

const CONSUMABLE_CATALOG = [
  { itemId: 'squishee', cost: 2 },
  { itemId: 'duffBeer', cost: 2 },
  { itemId: 'krustyBurger', cost: 3 },
];

const RELIC_CATALOG = [
  { relicId: 'bartsSkateboard', cost: 4 },
  { relicId: 'mrPlowJacket', cost: 4 },
  { relicId: 'homersWorkBadge', cost: 5 },
  { relicId: 'krustySeal', cost: 5 },
  { relicId: 'blinky', cost: 6 },
  { relicId: 'malibuStacy', cost: 6 },
];

// A shop offers every consumable, plus every relic the player doesn't
// already own (owning one twice would be redundant since relics are
// all-or-nothing passives, not stackable).
export function getShopCatalog(runState) {
  const consumables = CONSUMABLE_CATALOG.map((entry) => ({
    kind: 'item',
    itemId: entry.itemId,
    cost: entry.cost,
    item: ITEMS[entry.itemId],
    affordable: runState.donutsCurrency >= entry.cost,
  }));
  const relics = RELIC_CATALOG.filter((entry) => !runState.relics.includes(entry.relicId)).map((entry) => ({
    kind: 'relic',
    relicId: entry.relicId,
    cost: entry.cost,
    item: RELICS[entry.relicId],
    affordable: runState.donutsCurrency >= entry.cost,
  }));
  return [...consumables, ...relics];
}

export function purchaseEntry(runState, entry) {
  if (runState.donutsCurrency < entry.cost) return false;
  runState.donutsCurrency -= entry.cost;
  if (entry.kind === 'item') {
    ITEMS[entry.itemId].apply(runState);
  } else {
    runState.relics.push(entry.relicId);
  }
  return true;
}
