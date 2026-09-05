// Turn-based enemies for the Zombie Springfield vertical slice. Each has a
// weighted `intents` list (systems/enemyAI.js rolls one at the start of
// every enemy turn and shows it to the player before they act, then
// resolves it after). `elite` marks the two tougher mid-run encounters.
// `spriteId` looks up data/assets.js's `characters` map for battle art;
// none of these have uploaded portraits yet, so battleView falls back to
// `emoji` -- adding real zombie art later is a data-only change.
export const ENEMIES = {
  zombieBarfly: {
    id: 'zombieBarfly',
    name: 'Zombie Barfly',
    emoji: '🧟',
    hp: 26,
    intents: [
      { type: 'attack', value: 8, weight: 65, label: 'Attack', icon: '🩸' },
      { type: 'defend', value: 6, weight: 35, label: 'Defend', icon: '🛡️' },
    ],
  },
  zombieMobGuy: {
    id: 'zombieMobGuy',
    name: 'Zombie Mob Guy',
    emoji: '🧟‍♂️',
    hp: 22,
    intents: [
      { type: 'attack', value: 7, weight: 60, label: 'Attack', icon: '🩸' },
      { type: 'infect', value: 2, weight: 40, label: 'Infect', icon: '☣️' },
    ],
  },
  shamblingIntern: {
    id: 'shamblingIntern',
    name: 'Shambling Intern',
    emoji: '🧟',
    hp: 18,
    intents: [
      { type: 'attack', value: 6, weight: 55, label: 'Attack', icon: '🩸' },
      { type: 'defend', value: 5, weight: 45, label: 'Defend', icon: '🛡️' },
    ],
  },
  rabidStrayDog: {
    id: 'rabidStrayDog',
    name: 'Rabid Stray Dog',
    emoji: '🐕‍🦺',
    hp: 20,
    intents: [
      { type: 'attackTwice', value: 8, weight: 65, label: 'Double Bite', icon: '🩸' },
      { type: 'defend', value: 4, weight: 35, label: 'Defend', icon: '🛡️' },
    ],
  },
  undeadCafeteriaLady: {
    id: 'undeadCafeteriaLady',
    name: 'Undead Cafeteria Lady',
    emoji: '🧟‍♀️',
    hp: 24,
    intents: [
      { type: 'attack', value: 9, weight: 55, label: 'Attack', icon: '🩸' },
      { type: 'infect', value: 3, weight: 45, label: 'Infect', icon: '☣️' },
    ],
  },
  zombieGroundskeeper: {
    id: 'zombieGroundskeeper',
    name: 'Zombie Groundskeeper',
    emoji: '🧟‍♂️',
    hp: 28,
    intents: [
      { type: 'attack', value: 10, weight: 60, label: 'Attack', icon: '🩸' },
      { type: 'buff', value: 4, weight: 40, label: 'Enrage', icon: '💪' },
    ],
  },
  zombieHorde: {
    id: 'zombieHorde',
    name: 'Zombie Horde',
    emoji: '🧟‍♂️🧟',
    hp: 55,
    elite: true,
    intents: [
      { type: 'attack', value: 14, weight: 45, label: 'Attack', icon: '🩸' },
      { type: 'infect', value: 5, weight: 30, label: 'Infect', icon: '☣️' },
      { type: 'defend', value: 15, weight: 25, label: 'Defend', icon: '🛡️' },
    ],
  },
  patientZeroFlanders: {
    id: 'patientZeroFlanders',
    name: 'Patient Zero Flanders',
    emoji: '🧟',
    hp: 60,
    elite: true,
    intents: [
      { type: 'attack', value: 12, weight: 40, label: 'Attack', icon: '🩸' },
      { type: 'infect', value: 4, weight: 35, label: 'Diddly Infect', icon: '☣️' },
      { type: 'buff', value: 5, weight: 25, label: 'Neighborly Rage', icon: '💪' },
    ],
  },
};
