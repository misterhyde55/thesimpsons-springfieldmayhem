// Boss templates. `phases` are HP-percent thresholds that swap attack pattern sets.
export const BOSSES = {
  kangKodos: {
    id: 'kangKodos',
    name: 'Kang & Kodos',
    emoji: '👽',
    hp: 620,
    speed: 55,
    contactDamage: 18,
    radius: 42,
    color: '#38d63f',
    scenario: 'alienInvasion',
    intro: '"IT\'S TIME TO ELIMINATE ONE OF EARTH\'S DUMBEST SPECIES!"',
    phases: [
      { minHpPct: 0.5, attackInterval: 2600, attacks: ['charge', 'spreadBlast'] },
      { minHpPct: 0, attackInterval: 1700, attacks: ['charge', 'spreadBlast', 'summon'] },
    ],
  },
};
