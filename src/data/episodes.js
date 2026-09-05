// Horror scenarios describe which flavor of Treehouse-of-Horror apocalypse
// a run is set in. Only `implemented: true` scenarios are eligible for
// random selection right now; the rest are here so wiring up a new one is a
// data entry + an enemy/boss roster, not a rewrite of the run loop --
// exactly like data/journeys.js `horrorScenarioId` already expects one id
// per character journey.
export const EPISODE_MODIFIERS = {
  zombieOutbreak: {
    id: 'zombieOutbreak',
    name: 'Zombie Springfield',
    implemented: true,
    newsText: 'THE DEAD HAVE RISEN AND THEY WANT BRAINS. OR AT LEAST DONUTS.',
  },
  alienInvasion: {
    id: 'alienInvasion',
    name: 'Alien Invasion',
    implemented: false,
    newsText: 'KANG & KODOS ARE INVADING SPRINGFIELD!',
  },
  sideshowBob: {
    id: 'sideshowBob',
    name: 'Sideshow Bob',
    implemented: false,
    newsText: 'SIDESHOW BOB HAS ESCAPED AND IS HUNTING BART!',
  },
  radioactiveSpringfield: {
    id: 'radioactiveSpringfield',
    name: 'Radioactive Nightmare',
    implemented: false,
    newsText: 'THE POWER PLANT HAS HAD "ANOTHER" ACCIDENT!',
  },
  itchyScratchyRevolt: {
    id: 'itchyScratchyRevolt',
    name: 'Itchy & Scratchy Massacre',
    implemented: false,
    newsText: 'ANIMATRONIC CARTOON ROBOTS ARE ON A RAMPAGE!',
  },
  evilKrusty: {
    id: 'evilKrusty',
    name: 'Evil Krusty',
    implemented: false,
    newsText: 'KRUSTY MERCHANDISE HAS TURNED MURDEROUS!',
  },
  bodySnatchers: {
    id: 'bodySnatchers',
    name: 'Body Snatchers',
    implemented: false,
    newsText: 'SOME RESIDENTS ARE SECRETLY IMPOSTORS!',
  },
};

export function getImplementedModifiers() {
  return Object.values(EPISODE_MODIFIERS).filter((m) => m.implemented);
}

// Springfield Mayhem (state/gameState.js `runState.mayhem`, 0-100) describes
// how far a run's horror scenario has spiraled. These are just the flavor
// bands shown on the HUD; game.js picks a location's `flavorCorrupted` text
// once Mayhem crosses CORRUPTION_MAYHEM_THRESHOLD.
export const MAYHEM_BANDS = [
  { max: 20, label: 'Mostly Normal' },
  { max: 40, label: 'Something Is Off' },
  { max: 60, label: 'Mutations Spreading' },
  { max: 80, label: 'Springfield Is Corrupted' },
  { max: 99, label: 'Falling Apart' },
  { max: 100, label: 'MAYHEM MODE' },
];

export function mayhemLabel(mayhem) {
  return (MAYHEM_BANDS.find((b) => mayhem <= b.max) || MAYHEM_BANDS[MAYHEM_BANDS.length - 1]).label;
}

const TITLE_ADJECTIVES = ['Excellent', 'Radioactive', 'Sticky', 'Regrettable', 'Squeaky-Clean', 'Deep-Fried', 'Unlicensed', 'Undead'];
const TITLE_NOUNS = ['Disaster', 'Adventure', 'Meltdown', 'Detour', 'Catastrophe', 'Road Trip', 'Fiasco', 'Night of the Living Dead'];

export function generateEpisodeTitle(characterName) {
  const adjective = TITLE_ADJECTIVES[Math.floor(Math.random() * TITLE_ADJECTIVES.length)];
  const noun = TITLE_NOUNS[Math.floor(Math.random() * TITLE_NOUNS.length)];
  const firstName = characterName.split(' ')[0];
  return `${firstName}'s ${adjective} ${noun}`;
}
