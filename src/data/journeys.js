// A "journey" is a character's whole episode: three segments, each
// activating its own Horror Rule (which then stays active -- see
// systems/episodeManager.js / game.js activateCurrentSegmentRule). Unlike
// the old per-segment branching path, all three segments now play out on
// the SAME persistent Springfield map (data/worldMap.js) -- what changes
// between segments is what's waiting at each location, tracked here as a
// `content` table keyed by location id instead of a fresh node graph.
//
// `content[locationId]`: `{type: 'combat'|'event'|'boss', enemyIds,
// eventPool, bossId, elite, milestoneAbilityId}`. Two locations
// (kwikEMart, moesTavern) never appear in this table -- they're always
// enterable interiors resolved by data/interiors.js instead, since their
// whole point is reacting to whichever Horror Rules are active rather than
// being a single fixed encounter.
//
// `bossLocationId` is gated in game.js behind having explored enough of
// the rest of the map first (see isBossLocationUnlocked), so a segment
// can't be beelined in one hop.
export const JOURNEYS = {
  homer: {
    characterId: 'homer',
    segments: [
      {
        id: 'segment1',
        horrorRuleId: 'zombieOutbreak',
        segmentTitle: 'Night of the Living Flanders',
        objective: 'Survive the outbreak. Get to the bottom of it.',
        bossLocationId: 'springfieldElementary',
        content: {
          simpsonHouse: { type: 'combat', enemyIds: ['zombieMobGuy'] },
          flandersHouse: { type: 'combat', elite: true, enemyIds: ['patientZeroFlanders'] },
          springfieldCemetery: { type: 'combat', enemyIds: ['shamblingIntern', 'rabidStrayDog'] },
          nuclearPlant: { type: 'combat', elite: true, enemyIds: ['zombieHorde'], milestoneAbilityId: 'nuclearUppercut' },
          springfieldElementary: { type: 'boss', bossId: 'zombieSkinner' },
        },
      },
      {
        id: 'segment2',
        horrorRuleId: 'alienInvasion',
        segmentTitle: 'Invasion of the Homer Snatchers',
        objective: "Something's in the sky. Figure out what before it figures out you.",
        bossLocationId: 'nuclearPlant',
        content: {
          simpsonHouse: { type: 'event', eventPool: ['strangeLights'] },
          flandersHouse: { type: 'combat', elite: true, enemyIds: ['alienEnforcer'], milestoneAbilityId: 'meltdown' },
          springfieldElementary: { type: 'event', eventPool: ['milhouseTrustTest'] },
          springfieldCemetery: { type: 'combat', enemyIds: ['abductedCitizen', 'abductedCitizen'] },
          nuclearPlant: { type: 'boss', bossId: 'kodos' },
        },
      },
      {
        id: 'segment3',
        horrorRuleId: null,
        segmentTitle: 'When Horrors Collide',
        objective: 'Springfield is unrecognizable. Finish this, however it ends.',
        bossLocationId: 'springfieldCemetery',
        content: {
          simpsonHouse: { type: 'combat', enemyIds: ['zombieMobGuy'] },
          flandersHouse: { type: 'combat', elite: true, enemyIds: ['alienEnforcer'] },
          springfieldElementary: { type: 'event', eventPool: ['glowingDonut', 'kwikEMartRobbery'] },
          nuclearPlant: { type: 'combat', enemyIds: ['abductedCitizen', 'shamblingIntern'] },
          springfieldCemetery: { type: 'boss', bossId: 'kangKodos' },
        },
      },
    ],
  },
};

export function getJourney(characterId) {
  return JOURNEYS[characterId];
}

export function getSegment(characterId, segmentIndex) {
  return getJourney(characterId).segments[segmentIndex];
}

export function getSegmentCount(characterId) {
  return getJourney(characterId).segments.length;
}

export function getLocationContent(runState, locationId) {
  return getSegment(runState.character.id, runState.segmentIndex).content[locationId] || null;
}
