// A "journey" is a character's level board: a directed graph of nodes the
// player routes through over one run. Coordinates are normalized (0-1); the
// board renders y=0 at the top (final boss) down to y=1 at the bottom
// (run start), climbing upward like a Slay the Spire-style map.
//
// Node `type` drives which screen/flow handles it (see systems/board.js and
// game.js): 'combat' | 'event' | 'shop' | 'rest' | 'miniBoss' | 'boss'.
// `locationId` points at data/locations.js for arena flavor/visuals.
// `elite` marks a harder combat node with better upgrade odds.
// `alienFinalBossLocationId` / `alienFinalBossId` let a node swap to the
// Alien Invasion version of a boss when that episode modifier is active.
export const JOURNEYS = {
  homer: {
    characterId: 'homer',
    objective: 'Get to Moe\'s... eventually.',
    startNodeId: 'homeFrontYard',
    nodes: {
      homeFrontYard: {
        id: 'homeFrontYard',
        type: 'combat',
        locationId: 'homeFrontYard',
        name: '742 Evergreen Terrace',
        emoji: '🏠',
        x: 0.5,
        y: 0.92,
        next: ['evergreenTerraceBlock', 'flandersHouse'],
      },
      evergreenTerraceBlock: {
        id: 'evergreenTerraceBlock',
        type: 'combat',
        locationId: 'evergreenTerraceBlock',
        name: 'Evergreen Terrace',
        emoji: '🏘️',
        x: 0.3,
        y: 0.82,
        next: ['kwikEMart'],
      },
      flandersHouse: {
        id: 'flandersHouse',
        type: 'event',
        locationId: 'flandersHouse',
        eventId: 'flandersNeedsHelp',
        name: "Flanders' House",
        emoji: '🏡',
        x: 0.7,
        y: 0.82,
        next: ['kwikEMart'],
      },
      kwikEMart: {
        id: 'kwikEMart',
        type: 'shop',
        locationId: 'kwikEMart',
        name: 'Kwik-E-Mart',
        emoji: '🏪',
        x: 0.5,
        y: 0.72,
        next: ['springfieldStreets'],
      },
      springfieldStreets: {
        id: 'springfieldStreets',
        type: 'combat',
        locationId: 'springfieldStreets',
        name: 'Springfield Streets',
        emoji: '🛣️',
        x: 0.5,
        y: 0.62,
        next: ['nuclearPlant'],
      },
      nuclearPlant: {
        id: 'nuclearPlant',
        type: 'combat',
        locationId: 'nuclearPlant',
        name: 'Nuclear Power Plant',
        emoji: '☢️',
        x: 0.5,
        y: 0.52,
        next: ['chiefWiggum'],
      },
      chiefWiggum: {
        id: 'chiefWiggum',
        type: 'miniBoss',
        locationId: 'policeStation',
        bossId: 'chiefWiggum',
        name: 'Chief Wiggum',
        emoji: '🚓',
        x: 0.5,
        y: 0.42,
        next: ['krustyBurger'],
      },
      krustyBurger: {
        id: 'krustyBurger',
        type: 'rest',
        locationId: 'krustyBurger',
        name: 'Krusty Burger',
        emoji: '🍔',
        x: 0.5,
        y: 0.32,
        next: ['downtown', 'downtownElite'],
      },
      downtown: {
        id: 'downtown',
        type: 'combat',
        locationId: 'downtownSpringfield',
        name: 'Downtown Springfield',
        emoji: '🏙️',
        x: 0.3,
        y: 0.22,
        next: ['moesTavern'],
      },
      downtownElite: {
        id: 'downtownElite',
        type: 'combat',
        elite: true,
        locationId: 'downtownSpringfield',
        name: 'Downtown Springfield (Elite)',
        emoji: '🏙️',
        x: 0.7,
        y: 0.22,
        next: ['moesTavern'],
      },
      moesTavern: {
        id: 'moesTavern',
        type: 'combat',
        locationId: 'moesTavern',
        name: "Moe's Tavern",
        emoji: '🍺',
        x: 0.5,
        y: 0.12,
        next: ['mrBurnsBoss'],
      },
      mrBurnsBoss: {
        id: 'mrBurnsBoss',
        type: 'boss',
        locationId: 'burnsManor',
        bossId: 'mrBurns',
        alienFinalBossLocationId: 'bossArena',
        alienFinalBossId: 'kangKodos',
        name: 'Burns Manor',
        emoji: '🏰',
        x: 0.5,
        y: 0.02,
        next: [],
      },
    },
  },
};

export function getJourney(characterId) {
  return JOURNEYS[characterId];
}
