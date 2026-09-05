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
  // Every named Simpsons character portrait -- playable family members
  // (data/characters.js) and non-playable residents (data/npcs.js) alike --
  // since every uploaded portrait file actually lives under
  // public/assets/characters/ regardless of role. src/data/characterRegistry.js
  // is the one place other code should go through to resolve a portrait by id.
  characters: {
    homer: `${BASE}/characters/homer.png`,
    bart: `${BASE}/characters/bart.png`,
    lisa: `${BASE}/characters/Lisa_Simpson.png`,
    marge: `${BASE}/characters/marge.png`,
    maggie: `${BASE}/characters/Maggie_Simpson.png`,
    moe: `${BASE}/characters/Moe.png`,
    // Real filename has a literal space ("Ned Flanders.png") -- encoded here
    // so the browser requests it correctly; Vercel's static host is also
    // case-sensitive, so the rest of the name must match exactly too.
    flanders: `${BASE}/characters/Ned%20Flanders.png`,
    apu: `${BASE}/characters/apu.png`,
    barney: `${BASE}/characters/barney.png`,
    chiefWiggum: `${BASE}/characters/chiefwiggum.png`,
    comicBookGuy: `${BASE}/characters/comicbookguy.png`,
    krusty: `${BASE}/characters/krusty.png`,
    milhouse: `${BASE}/characters/milhouse.png`,
    mrBurns: `${BASE}/characters/mrburns.png`,
    nelson: `${BASE}/characters/nelson.png`,
    skinner: `${BASE}/characters/principalskinner.png`,
    ralph: `${BASE}/characters/ralph.png`,
    smithers: `${BASE}/characters/smithers.png`,
  },
  // Reserved for NPC art that isn't just a characters/ portrait (none yet --
  // every uploaded resident so far lives in the characters/ map above).
  npcs: {},
  // Pickups: donuts and data/items.js entries, keyed by item id ('donut' for the donut itself).
  items: {},
  // data/enemies.js entries, keyed by enemy id. The generic (unnamed)
  // zombie mob shares one uploaded sprite; Patient Zero Flanders is a named
  // character so he keeps his own portrait instead.
  enemies: {
    zombieBarfly: `${BASE}/enemies/Disco_Zombie_Tapped_Out.webp`,
    zombieMobGuy: `${BASE}/enemies/Disco_Zombie_Tapped_Out.webp`,
    shamblingIntern: `${BASE}/enemies/Disco_Zombie_Tapped_Out.webp`,
    undeadCafeteriaLady: `${BASE}/enemies/Disco_Zombie_Tapped_Out.webp`,
    zombieGroundskeeper: `${BASE}/enemies/Disco_Zombie_Tapped_Out.webp`,
    zombieHorde: `${BASE}/enemies/Disco_Zombie_Tapped_Out.webp`,
    patientZeroFlanders: `${BASE}/characters/Ned%20Flanders.png`,
  },
  // data/bosses.js entries, keyed by boss id. Chief Wiggum and Mr. Burns reuse
  // their characters/ portrait here for the in-arena boss sprite -- one image
  // file, two lookup entries for two different rendering contexts.
  bosses: {
    chiefWiggum: `${BASE}/characters/chiefwiggum.png`,
    mrBurns: `${BASE}/characters/mrburns.png`,
    // No dedicated "zombified" art uploaded yet -- reuses Skinner's normal
    // portrait so the boss intro/battle screen isn't emoji-only; swap this
    // for zombie-specific art the moment it's uploaded, no code changes needed.
    zombieSkinner: `${BASE}/characters/principalskinner.png`,
  },
  // Battle/board location backgrounds, keyed by location id (data/locations.js).
  buildings: {
    simpsonHouse: `${BASE}/buildings/742_Evergreen_Terrace.webp`,
    homeFrontYard: `${BASE}/buildings/742_Evergreen_Terrace.webp`,
    moesTavern: `${BASE}/buildings/Moe%27s_Tavern.webp`,
    springfieldElementary: `${BASE}/buildings/Springfield_Elementary_School.webp`,
  },
  // Full-scene backgrounds not tied to a specific location (menus, etc.)
  backgrounds: {
    // Note: real filename on disk is capitalized ("Homescreen.jfif") -- Vercel's
    // static host is case-sensitive, so this must match exactly.
    mainMenu: `${BASE}/backgrounds/Homescreen.jfif`,
  },
  // HUD/menu art not tied to a specific game entity.
  ui: {},
};

export function getAssetUrl(category, id) {
  return ASSET_MANIFEST[category]?.[id];
}
