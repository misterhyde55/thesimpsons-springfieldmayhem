// Non-playable named Springfield residents. Each entry is the single source
// of truth for that character's identity regardless of which role they play
// in a given episode (background NPC, quest giver, boss, ally) -- a
// character never gets defined twice just because their role changes.
// `locationIds` is a light hook for the future "who shows up where" system;
// nothing reads it yet beyond documenting the connection.
export const NPCS = {
  moe: { id: 'moe', name: 'Moe Szyslak', locationIds: ['moesTavern'] },
  flanders: { id: 'flanders', name: 'Ned Flanders', locationIds: ['flandersHouse'] },
  apu: { id: 'apu', name: 'Apu Nahasapeemapetilon', locationIds: ['kwikEMart'] },
  skinner: { id: 'skinner', name: 'Principal Skinner', locationIds: ['springfieldElementary'] },
  krusty: { id: 'krusty', name: 'Krusty the Clown', locationIds: ['krustyBurger'] },
  milhouse: { id: 'milhouse', name: 'Milhouse Van Houten', locationIds: [] },
  smithers: { id: 'smithers', name: 'Waylon Smithers', locationIds: ['burnsManor'] },
  comicBookGuy: { id: 'comicBookGuy', name: 'Comic Book Guy', locationIds: ['androidsDungeon'] },
  barney: { id: 'barney', name: 'Barney Gumble', locationIds: ['moesTavern'] },
  nelson: { id: 'nelson', name: 'Nelson Muntz', locationIds: ['springfieldElementary'] },
  ralph: { id: 'ralph', name: 'Ralph Wiggum', locationIds: ['springfieldElementary'] },
  // Also defined in data/bosses.js under the same id for their boss-fight
  // stats/attacks -- that entry owns combat behavior, this one owns identity.
  chiefWiggum: { id: 'chiefWiggum', name: 'Chief Wiggum', locationIds: ['policeStation'] },
  mrBurns: { id: 'mrBurns', name: 'Mr. Burns', locationIds: ['burnsManor'] },
};
