// Springfield Mayhem (state/gameState.js `runState.mayhem`, 0-100) describes
// how far a run's collective Horror Rules have spiraled. These are just the
// flavor bands shown on the HUD; game.js picks a location's
// `flavorCorrupted` text once Mayhem crosses CORRUPTION_MAYHEM_THRESHOLD,
// and the battle screen layers a visual corruption filter at the same tiers.
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

// Every run is billed as one Treehouse of Horror special (data/journeys.js
// supplies the three segment titles that make up "Tonight's Terrifying
// Tales"). `episodeNumber` becomes "Treehouse of Horror <N>" the way the
// show numbers its own specials.
export function generateEpisodeTitle(episodeNumber) {
  return `Treehouse of Horror ${toRoman(episodeNumber)}`;
}

function toRoman(num) {
  const table = [
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let n = num;
  let out = '';
  for (const [value, symbol] of table) {
    while (n >= value) {
      out += symbol;
      n -= value;
    }
  }
  return out || String(num);
}
