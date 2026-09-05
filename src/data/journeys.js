// A "journey" is a character's branching Springfield map: a directed graph
// of nodes the player routes through over one run. Coordinates are
// normalized (0-1); the board renders y=0 at the top (boss) down to y=1 at
// the bottom (run start), climbing upward like a Slay the Spire-style map.
//
// Node `type` drives which flow handles it (see systems/board.js and
// game.js): 'combat' | 'event' | 'shop' | 'rest' | 'boss'. `elite` marks a
// harder combat node with better ability-draft odds. `enemyIds` (combat/
// elite/boss nodes) point at data/enemies.js or data/bosses.js. `eventPool`
// (event nodes) points at data/events.js; one is picked at random on entry.
// `milestoneAbilityId` (data/abilities.js id) makes clearing that node a
// guaranteed story-tied ability unlock instead of the usual random 3-choice
// draft -- this is how a character's signature abilities reliably show up
// over the course of their specific run rather than being left to chance.
export const JOURNEYS = {
  homer: {
    characterId: 'homer',
    objective: "Survive the night. Something ate Springfield.",
    startNodeId: 'simpsonHouse',
    horrorScenarioId: 'zombieOutbreak',
    nodes: {
      simpsonHouse: {
        id: 'simpsonHouse',
        type: 'combat',
        locationId: 'simpsonHouse',
        enemyIds: ['zombieMobGuy'],
        name: '742 Evergreen Terrace',
        emoji: '🏠',
        x: 0.5,
        y: 0.94,
        next: ['kwikEMart', 'flandersHouseElite', 'springfieldCemetery'],
      },
      kwikEMart: {
        id: 'kwikEMart',
        type: 'shop',
        locationId: 'kwikEMart',
        name: 'Kwik-E-Mart',
        emoji: '🏪',
        x: 0.2,
        y: 0.78,
        next: ['moesTavern'],
      },
      flandersHouseElite: {
        id: 'flandersHouseElite',
        type: 'combat',
        elite: true,
        locationId: 'flandersHouse',
        enemyIds: ['patientZeroFlanders'],
        name: "Flanders' House",
        emoji: '🏡',
        x: 0.5,
        y: 0.78,
        next: ['moesTavern'],
      },
      springfieldCemetery: {
        id: 'springfieldCemetery',
        type: 'combat',
        locationId: 'springfieldCemetery',
        enemyIds: ['shamblingIntern', 'rabidStrayDog'],
        name: 'Springfield Cemetery',
        emoji: '⚰️',
        x: 0.8,
        y: 0.78,
        next: ['moesTavern'],
      },
      moesTavern: {
        id: 'moesTavern',
        type: 'rest',
        locationId: 'moesTavern',
        name: "Moe's Tavern",
        emoji: '🍺',
        x: 0.5,
        y: 0.6,
        next: ['nuclearPlantElite', 'elementaryMystery'],
      },
      nuclearPlantElite: {
        id: 'nuclearPlantElite',
        type: 'combat',
        elite: true,
        locationId: 'nuclearPlant',
        enemyIds: ['zombieHorde'],
        name: 'Springfield Nuclear Power Plant',
        emoji: '☢️',
        x: 0.25,
        y: 0.4,
        next: ['schoolBoss'],
        milestoneAbilityId: 'nuclearUppercut',
      },
      elementaryMystery: {
        id: 'elementaryMystery',
        type: 'event',
        locationId: 'springfieldElementary',
        eventPool: ['glowingDonut', 'kwikEMartRobbery', 'flandersNeedsHelp', 'lardLadDare'],
        name: 'Springfield Elementary: The Halls',
        emoji: '❓',
        x: 0.75,
        y: 0.4,
        next: ['schoolBoss'],
      },
      schoolBoss: {
        id: 'schoolBoss',
        type: 'boss',
        locationId: 'springfieldElementary',
        bossId: 'zombieSkinner',
        name: 'Springfield Elementary: Detention',
        emoji: '🧟‍♂️',
        x: 0.5,
        y: 0.18,
        next: [],
      },
    },
  },
};

export function getJourney(characterId) {
  return JOURNEYS[characterId];
}
