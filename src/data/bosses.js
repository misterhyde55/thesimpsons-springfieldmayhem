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
};
