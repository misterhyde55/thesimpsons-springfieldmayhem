// Central registry of uploaded art. Files live under public/assets/<category>/;
// register them here by id and the renderer picks them up automatically.
//
// To add new art: drop the file in the matching public/assets/<category>/
// folder, add one line below pointing at it, done — no rendering code needs
// to change. An id with no entry here (or whose file 404s) just keeps using
// the game's procedural canvas-drawn look, so partial art coverage is safe.
//
// Categories match the folders already set up under public/assets/:
// characters, npcs, items, enemies, bosses, buildings, backgrounds, ui.
const BASE = '/assets';

export const ASSET_MANIFEST = {
  // Playable family members, keyed by character id (data/characters.js).
  characters: {
    homer: `${BASE}/characters/homer.png`,
  },
  // Springfield residents that aren't playable (Moe, Apu, Flanders, ...).
  npcs: {},
  // Pickups: donuts and data/items.js entries, keyed by item id ('donut' for the donut itself).
  items: {},
  // data/enemies.js entries, keyed by enemy id.
  enemies: {},
  // data/bosses.js entries, keyed by boss id.
  bosses: {},
  // In-arena/board location backgrounds, keyed by location id (data/locations.js).
  buildings: {},
  // Full-scene backgrounds not tied to a specific location (menus, etc.)
  backgrounds: {
    mainMenu: `${BASE}/backgrounds/mainpage.jpeg`,
  },
  // HUD/menu art not tied to a specific game entity.
  ui: {},
};

export function getAssetUrl(category, id) {
  return ASSET_MANIFEST[category]?.[id];
}
