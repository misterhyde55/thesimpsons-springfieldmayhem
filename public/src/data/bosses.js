// Boss templates. `phases` are HP-percent thresholds that swap attack pattern sets.
// `summonEnemyId` (optional) points at data/enemies.js for the 'summon' attack;
// bosses that never list 'summon' in their phases don't need one.
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
    summonEnemyId: 'kodosSpawnling',
    phases: [
      { minHpPct: 0.5, attackInterval: 2600, attacks: ['charge', 'spreadBlast'] },
      { minHpPct: 0, attackInterval: 1700, attacks: ['charge', 'spreadBlast', 'summon'] },
    ],
  },
  chiefWiggum: {
    id: 'chiefWiggum',
    name: 'Chief Wiggum',
    emoji: '👮',
    hp: 260,
    speed: 60,
    contactDamage: 14,
    radius: 34,
    color: '#5b7fbf',
    intro: '"Alright, this donut stand is now a crime scene. Also, I\'m eating the evidence."',
    projectileColor: '#ffd23f',
    phases: [
      { minHpPct: 0.4, attackInterval: 2200, attacks: ['charge', 'spreadBlast'] },
      { minHpPct: 0, attackInterval: 1500, attacks: ['charge', 'spreadBlast'] },
    ],
  },
  mrBurns: {
    id: 'mrBurns',
    name: 'Mr. Burns',
    emoji: '🧓',
    hp: 700,
    speed: 45,
    contactDamage: 20,
    radius: 38,
    color: '#8a6aa8',
    intro: '"Ahh, Homer Simpson. Release the hounds. Excellent."',
    projectileColor: '#c9a8ff',
    phases: [
      { minHpPct: 0.5, attackInterval: 2400, attacks: ['charge', 'spreadBlast'] },
      { minHpPct: 0, attackInterval: 1400, attacks: ['charge', 'spreadBlast'] },
    ],
  },
};
