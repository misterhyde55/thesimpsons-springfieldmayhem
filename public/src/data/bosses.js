// Turn-based bosses. `phases` swap the enemy's intent pool at HP thresholds
// (see systems/enemyAI.js) so a fight visibly escalates. `intro` is shown on
// the dramatic boss-intro screen before the fight starts.
export const BOSSES = {
  zombieSkinner: {
    id: 'zombieSkinner',
    name: 'Zombie Principal Skinner',
    emoji: '🧟‍♂️',
    hp: 140,
    subtitle: 'THE DETENTION FROM HELL',
    intro: '"DEEETENTIOOOON," moans the thing that used to be Principal Skinner.',
    phases: [
      {
        minHpPct: 0.5,
        intents: [
          { type: 'attack', value: 16, weight: 45, label: 'Attack', icon: '🩸' },
          { type: 'defend', value: 20, weight: 30, label: 'Defend', icon: '🛡️' },
          { type: 'infect', value: 3, weight: 25, label: 'Detention Slap', icon: '☣️' },
        ],
      },
      {
        minHpPct: 0,
        intents: [
          { type: 'attack', value: 22, weight: 40, label: 'Attack', icon: '🩸' },
          { type: 'infect', value: 6, weight: 35, label: 'Infect', icon: '☣️' },
          { type: 'buff', value: 6, weight: 25, label: 'Enrage', icon: '💪' },
        ],
      },
    ],
  },
  kodos: {
    id: 'kodos',
    name: 'Kodos',
    emoji: '👽',
    hp: 150,
    subtitle: 'THE PROBE FROM RIGEL 7',
    intro: '"Do not be alarmed, Earthlings. It is only mostly hopeless."',
    phases: [
      {
        minHpPct: 0.5,
        intents: [
          { type: 'attack', value: 17, weight: 40, label: 'Ray Blast', icon: '⚡' },
          { type: 'phase', value: 2, weight: 35, label: 'Phase Out', icon: '👽' },
          { type: 'defend', value: 18, weight: 25, label: 'Shield', icon: '🛡️' },
        ],
      },
      {
        minHpPct: 0,
        intents: [
          { type: 'attack', value: 24, weight: 45, label: 'Ray Blast', icon: '⚡' },
          { type: 'phase', value: 3, weight: 30, label: 'Phase Out', icon: '👽' },
          { type: 'buff', value: 6, weight: 25, label: 'Overcharge', icon: '💪' },
        ],
      },
    ],
  },
  // Segment III finale -- Kang & Kodos, empowered by whatever else is still
  // active by the time the player reaches them (see game.js's boss intro
  // line, which lists the currently-stacked Horror Rules).
  kangKodos: {
    id: 'kangKodos',
    name: 'Kang & Kodos',
    emoji: '👽',
    hp: 220,
    subtitle: 'THE END OF THE EPISODE',
    intro: '"Your Earth music has poisoned your simple minds. Now feel our wrath!"',
    phases: [
      {
        minHpPct: 0.65,
        intents: [
          { type: 'attack', value: 20, weight: 35, label: 'Twin Blast', icon: '⚡' },
          { type: 'infect', value: 5, weight: 25, label: 'Infect', icon: '☣️' },
          { type: 'phase', value: 2, weight: 20, label: 'Phase Out', icon: '👽' },
          { type: 'defend', value: 20, weight: 20, label: 'Shield', icon: '🛡️' },
        ],
      },
      {
        minHpPct: 0.3,
        intents: [
          { type: 'attack', value: 26, weight: 35, label: 'Twin Blast', icon: '⚡' },
          { type: 'infect', value: 7, weight: 30, label: 'Infect', icon: '☣️' },
          { type: 'buff', value: 8, weight: 20, label: 'Overcharge', icon: '💪' },
          { type: 'phase', value: 3, weight: 15, label: 'Phase Out', icon: '👽' },
        ],
      },
      {
        minHpPct: 0,
        intents: [
          { type: 'attackTwice', value: 24, weight: 45, label: 'Barrage', icon: '⚡' },
          { type: 'infect', value: 10, weight: 30, label: 'Infect', icon: '☣️' },
          { type: 'buff', value: 10, weight: 25, label: 'Overcharge', icon: '💪' },
        ],
      },
    ],
  },
};
