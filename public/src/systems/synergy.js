// Item combinations. Checked every time a new item is picked up: if the run now
// owns every item id in `items`, the synergy fires (once) and its effect applies.
export const SYNERGIES = [
  {
    id: 'drunkenInferno',
    name: 'DRUNKEN INFERNO',
    description: 'The beer catches fire. This was inevitable.',
    items: ['duffBeer', 'flamingMoe'],
    apply(runState) {
      runState.buffs.fireAura = (runState.buffs.fireAura || 0) + 6;
      runState.buffs.damageMult += 0.15;
      runState.buffs.drunkenInferno = true;
    },
  },
  {
    id: 'nuclearBowlingBall',
    name: 'NUCLEAR BOWLING BALL',
    description: 'The ball glows green and punches through everything.',
    items: ['bowlingBall', 'radioactiveRod'],
    apply(runState) {
      runState.buffs.nuclearBowlingBall = true;
    },
  },
  {
    id: 'sugarRushOverdrive',
    name: 'SUGAR RUSH OVERDRIVE',
    description: 'No crash. Just rush.',
    items: ['buzzCola', 'squishee'],
    apply(runState) {
      runState.buffs.sugarRushOverdrive = true;
      runState.buffs.speedMult += 0.15;
    },
  },
];

export function checkSynergies(runState) {
  const triggered = [];
  for (const synergy of SYNERGIES) {
    if (runState.synergiesUnlocked.has(synergy.id)) continue;
    const owned = synergy.items.every((itemId) => runState.ownedItemIds.has(itemId));
    if (owned) {
      synergy.apply(runState);
      runState.synergiesUnlocked.add(synergy.id);
      triggered.push(synergy);
    }
  }
  return triggered;
}
