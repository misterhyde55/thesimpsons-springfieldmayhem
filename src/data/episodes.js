// Episode modifiers describe how a run's twist transforms Springfield. Only
// `implemented: true` modifiers are eligible for random selection right now;
// the rest are here so wiring up a new one is a data entry + a spawn table,
// not a rewrite of the run loop.
export const EPISODE_MODIFIERS = {
  alienInvasion: {
    id: 'alienInvasion',
    name: 'Alien Invasion',
    implemented: true,
    newsText: 'KANG & KODOS ARE INVADING SPRINGFIELD!',
    bossId: 'kangKodos',
    twistFlavor: 'Buildings glow green. The sky splits open.',
  },
  treehouseOfHorror: {
    id: 'treehouseOfHorror',
    name: 'Treehouse of Horror',
    implemented: false,
    newsText: 'SPRINGFIELD HAS BECOME A HORROR SHOW!',
  },
  zombieOutbreak: {
    id: 'zombieOutbreak',
    name: 'Zombie Outbreak',
    implemented: false,
    newsText: 'RESIDENTS ARE TURNING INTO ZOMBIES!',
  },
  sideshowBob: {
    id: 'sideshowBob',
    name: 'Sideshow Bob',
    implemented: false,
    newsText: 'SIDESHOW BOB HAS ESCAPED AND IS HUNTING BART!',
  },
  radioactiveSpringfield: {
    id: 'radioactiveSpringfield',
    name: 'Radioactive Springfield',
    implemented: false,
    newsText: 'THE POWER PLANT HAS HAD "ANOTHER" ACCIDENT!',
  },
  itchyScratchyRevolt: {
    id: 'itchyScratchyRevolt',
    name: 'Itchy & Scratchy Robot Revolt',
    implemented: false,
    newsText: 'ANIMATRONIC CARTOON ROBOTS ARE ON A RAMPAGE!',
  },
  springfieldRiot: {
    id: 'springfieldRiot',
    name: 'Springfield Riot',
    implemented: false,
    newsText: 'THE ENTIRE TOWN HAS TURNED AGAINST ITSELF!',
  },
  burnsTakesOver: {
    id: 'burnsTakesOver',
    name: 'Mr. Burns Takes Over',
    implemented: false,
    newsText: 'MR. BURNS HAS SEIZED CONTROL OF SPRINGFIELD!',
  },
};

export function getImplementedModifiers() {
  return Object.values(EPISODE_MODIFIERS).filter((m) => m.implemented);
}

const TITLE_ADJECTIVES = ['Excellent', 'Radioactive', 'Sticky', 'Regrettable', 'Squeaky-Clean', 'Deep-Fried', 'Unlicensed'];
const TITLE_NOUNS = ['Disaster', 'Adventure', 'Meltdown', 'Detour', 'Catastrophe', 'Road Trip', 'Fiasco'];

export function generateEpisodeTitle(characterName) {
  const adjective = TITLE_ADJECTIVES[Math.floor(Math.random() * TITLE_ADJECTIVES.length)];
  const noun = TITLE_NOUNS[Math.floor(Math.random() * TITLE_NOUNS.length)];
  const firstName = characterName.split(' ')[0];
  return `${firstName}'s ${adjective} ${noun}`;
}
