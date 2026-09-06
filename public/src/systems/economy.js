import { ITEMS } from '../data/items.js';
import { RELICS, getRelicShopPool } from '../data/relics.js';

export function restHeal(runState) {
  runState.hp = runState.maxHp;
}

// The Kwik-E-Mart's real store (data/interiors.js's 'BUY SOMETHING'
// interaction). Staples are always in stock (in limited quantity -- Apu
// isn't running a warehouse); the relic and rare-item slots are rolled once
// per episode from a larger pool so no two visits to the same run look
// identical. Everything here is denominated in the same donutsCurrency the
// rest of the game already uses -- "Springfield Cash" is what the fiction
// calls it, not a second currency.
const STAPLE_ITEMS = [
  { itemId: 'squishee', cost: 2, stock: 3 },
  { itemId: 'duffBeer', cost: 2, stock: 2 },
  { itemId: 'krustyBurger', cost: 3, stock: 2 },
];

const RARE_ITEM_COSTS = {
  radioactiveDonut: 4,
  cursedMonkeyPaw: 6,
  mysteriousKey: 5,
  krustyEmergencyKit: 5,
};
const RARE_ITEM_POOL = Object.keys(RARE_ITEM_COSTS);
const RARE_ITEM_SLOTS = 2;
const RELIC_SLOTS = 2;

function shuffled(list) {
  return [...list].sort(() => Math.random() - 0.5);
}

function rollKwikEMartInventory(runState) {
  const staples = STAPLE_ITEMS.map((e) => ({ kind: 'item', itemId: e.itemId, cost: e.cost, stock: e.stock }));
  const relics = shuffled(getRelicShopPool())
    .filter((r) => !runState.relics.includes(r.id))
    .slice(0, RELIC_SLOTS)
    .map((r) => ({ kind: 'relic', relicId: r.id, cost: relicCost(r.id), stock: 1 }));
  const rares = shuffled(RARE_ITEM_POOL)
    .slice(0, RARE_ITEM_SLOTS)
    .map((itemId) => ({ kind: 'item', itemId, cost: RARE_ITEM_COSTS[itemId], stock: 1 }));
  return [...staples, ...relics, ...rares];
}

const RELIC_COSTS = {
  bartsSkateboard: 4,
  mrPlowJacket: 4,
  homersWorkBadge: 5,
  krustySeal: 5,
  blinky: 6,
  malibuStacy: 6,
};
function relicCost(relicId) {
  return RELIC_COSTS[relicId] || 5;
}

// Rolled lazily the first time Homer opens the shop this episode, then
// persisted on runState.world so re-opening (or reloading a save) shows the
// same stock, minus whatever he's already bought.
export function getKwikEMartInventory(runState) {
  if (!runState.world.kwikEMartInventory) {
    runState.world.kwikEMartInventory = rollKwikEMartInventory(runState);
  }
  return runState.world.kwikEMartInventory;
}

// Apu's relationship with Homer moves prices -- a friend gets a discount, an
// enemy gets gouged (or banned outright, see canUseKwikEMartShop).
export function apuPriceModifier(runState) {
  const level = runState.relationships.apu;
  if (level === 'bestFriend') return 0.5;
  if (level === 'friendly') return 0.75;
  if (level === 'annoyed') return 1.25;
  if (level === 'angry') return 1.5;
  return 1;
}

// If Apu considers Homer an outright enemy he bans him from the store --
// EXCEPT once Mayhem gets bad enough that Apu needs Homer's help again more
// than he needs to hold a grudge.
export function canUseKwikEMartShop(runState) {
  if (runState.relationships.apu !== 'enemy') return true;
  return runState.mayhem >= 70;
}

export function apuBanMessage(runState) {
  if (runState.mayhem >= 70) {
    return 'Apu: "...Homer. I know what happened. But with everything going on tonight, I need your help more than I need to stay angry. Take what you need."';
  }
  return 'Apu: "Get out of my store, Simpson! After what you did, you\'re banned!"';
}

export function getShopCatalog(runState) {
  const inventory = getKwikEMartInventory(runState);
  const modifier = apuPriceModifier(runState);
  return inventory
    .filter((entry) => entry.stock > 0)
    .map((entry) => {
      const cost = Math.max(1, Math.round(entry.cost * modifier));
      const item = entry.kind === 'item' ? ITEMS[entry.itemId] : RELICS[entry.relicId];
      return { ...entry, cost, item, affordable: runState.donutsCurrency >= cost };
    });
}

function findInventoryEntry(runState, entry) {
  const inventory = runState.world.kwikEMartInventory || [];
  return inventory.find((e) => e.kind === entry.kind && (e.itemId ? e.itemId === entry.itemId : e.relicId === entry.relicId));
}

// Rare items go into runState.consumables (a small held bag) instead of
// applying immediately -- they're worth saving for the right moment (or
// selling back). Staples still apply on the spot, same as always.
export function purchaseEntry(runState, entry) {
  if (runState.donutsCurrency < entry.cost) return false;
  runState.donutsCurrency -= entry.cost;
  if (entry.kind === 'item') {
    const item = ITEMS[entry.itemId];
    if (item.rare) {
      runState.consumables[entry.itemId] = (runState.consumables[entry.itemId] || 0) + 1;
    } else {
      item.apply(runState);
    }
  } else {
    runState.relics.push(entry.relicId);
  }
  const invEntry = findInventoryEntry(runState, entry);
  if (invEntry) invEntry.stock -= 1;
  return true;
}

// Selling: only the held rare items (runState.consumables) are sellable --
// relics are permanent upgrades and staples are consumed on purchase, so
// neither ever sits in the bag to begin with.
export function sellPriceFor(itemId) {
  return Math.max(1, Math.round((RARE_ITEM_COSTS[itemId] || 4) / 2));
}

export function sellHeldItem(runState, itemId) {
  if (!runState.consumables[itemId]) return 0;
  runState.consumables[itemId] -= 1;
  if (runState.consumables[itemId] <= 0) delete runState.consumables[itemId];
  const price = sellPriceFor(itemId);
  runState.donutsCurrency += price;
  return price;
}

export function useHeldItem(runState, itemId) {
  if (!runState.consumables[itemId]) return false;
  runState.consumables[itemId] -= 1;
  if (runState.consumables[itemId] <= 0) delete runState.consumables[itemId];
  ITEMS[itemId].apply(runState);
  return true;
}
