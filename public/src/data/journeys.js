import { wheresBarneyCemeteryContent, missingOfficersReportContent } from './quests.js';

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
          policeStation: { type: 'event', eventPool: ['policeEvidenceRoom'] },
          krustyBurger: { type: 'event', eventPool: ['krustyBurgerCombo', 'cursedDonut'] },
          androidsDungeon: { type: 'event', eventPool: ['androidsDungeonGamble'] },
          bowlarama: { type: 'event', eventPool: ['bowlaramaFrame'] },
          springfieldHospital: { type: 'event', eventPool: ['hospitalTriage'] },
          burnsManor: { type: 'combat', enemyIds: ['zombieComicBookGuy', 'zombieRalph'], questResolution: 'officersFound' },
          retirementCastle: { type: 'event', eventPool: ['grampasStory'] },
          springfieldChurch: { type: 'event', eventPool: ['churchConfession'] },
          springfieldSewer: { type: 'combat', elite: true, enemyIds: ['zombieSnake', 'zombieGrandpa'] },
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
          policeStation: { type: 'event', eventPool: ['policeEvidenceRoom'] },
          krustyBurger: { type: 'event', eventPool: ['krustyBurgerCombo', 'cursedDonut'] },
          androidsDungeon: { type: 'event', eventPool: ['androidsDungeonGamble'] },
          bowlarama: { type: 'combat', enemyIds: ['zombieMilhouse'] },
          springfieldHospital: { type: 'event', eventPool: ['hospitalTriage'] },
          burnsManor: { type: 'combat', enemyIds: ['zombieWiggum', 'abductedCitizen'], questResolution: 'officersFound' },
          retirementCastle: { type: 'event', eventPool: ['grampasStory'] },
          springfieldChurch: { type: 'event', eventPool: ['churchConfession'] },
          springfieldSewer: { type: 'combat', elite: true, enemyIds: ['zombieSnake', 'alienEnforcer'] },
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
          // The "School" encounter combo: Chalmers buffs the group and
          // enrages if the Skinner-tagged unit falls first (see
          // data/enemies.js zombieChalmers.onAllyDefeated).
          springfieldElementary: { type: 'combat', enemyIds: ['zombieChalmers', 'zombieStudent', 'zombieSkinnerZombie'] },
          nuclearPlant: { type: 'combat', enemyIds: ['abductedCitizen', 'shamblingIntern'] },
          springfieldCemetery: { type: 'boss', bossId: 'kangKodos' },
          // By the finale even Wiggum and Krusty have turned.
          policeStation: { type: 'combat', enemyIds: ['zombieWiggum'] },
          krustyBurger: { type: 'combat', enemyIds: ['zombieKrusty'] },
          // glowingDonut/kwikEMartRobbery moved here from springfieldElementary
          // now that it's the School combo fight above.
          androidsDungeon: { type: 'event', eventPool: ['androidsDungeonGamble', 'glowingDonut', 'kwikEMartRobbery'] },
          bowlarama: { type: 'event', eventPool: ['bowlaramaFrame', 'cursedDonut'] },
          // The "Hospital" encounter combo: Hibbert keeps healing the
          // Nurses, changing who's worth focusing down first.
          springfieldHospital: { type: 'combat', enemyIds: ['zombieHibbert', 'zombieNurse', 'zombieNurse'] },
          burnsManor: { type: 'combat', elite: true, enemyIds: ['zombieKrustyDeluxe'], questResolution: 'officersFound' },
          retirementCastle: { type: 'event', eventPool: ['grampasStory'] },
          springfieldChurch: { type: 'event', eventPool: ['churchConfession'] },
          springfieldSewer: { type: 'combat', elite: true, enemyIds: ['zombieSnake', 'zombieKrustyDeluxe'] },
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
  // Priority 4: once the Devil Ned CALLBACK! has fired (data/callbacks.js
  // devilNedAppears), First Church of Springfield is permanently corrupted
  // into his optional boss fight instead of its normal churchConfession
  // event -- "the map changes," not just a one-time cutscene detour.
  if (locationId === 'springfieldChurch' && runState.world.locationFlags.hasDevilPortal) {
    if (runState.world.locationFlags.devilNedDefeated) return null;
    return { type: 'boss', bossId: 'devilNed' };
  }

  const segment = getSegment(runState.character.id, runState.segmentIndex);

  // Quest 1 (WHERE'S BARNEY?, started at Moe's Tavern): overrides Springfield
  // Cemetery's normal content with the FIGHT/CURE/RUN encounter, as long as
  // the Cemetery isn't this segment's own scripted boss fight (Segment III).
  if (locationId === 'springfieldCemetery' && runState.quests.wheresBarney === 'active' && segment.bossLocationId !== 'springfieldCemetery') {
    return wheresBarneyCemeteryContent();
  }

  // Quest 3 (THE MISSING OFFICERS, started at Police Station, resolved at
  // Burns Manor): once resolved, the next visit to Police Station offers
  // the report-back-and-collect-reward beat instead of its normal content.
  if (locationId === 'policeStation' && runState.quests.missingOfficers === 'resolved') {
    return missingOfficersReportContent();
  }

  return segment.content[locationId] || null;
}
