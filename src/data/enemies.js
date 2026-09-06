import { STATUS } from './statusEffects.js';
import { addStatus } from '../systems/statusEngine.js';

// Turn-based enemies for the Zombie Springfield vertical slice. Each has a
// weighted `intents` list (systems/enemyAI.js rolls one at the start of
// every enemy turn and shows it to the player before they act, then
// resolves it after). `elite` marks the two tougher mid-run encounters.
// `spriteId` looks up data/assets.js's `characters` map for battle art;
// none of these have uploaded portraits yet, so battleView falls back to
// `emoji` -- adding real zombie art later is a data-only change.
//
// `tags` mark an enemy for data/horrorRules.js's onEnemySpawn mutation --
// every zombie-family entry below carries 'zombie' so it automatically
// picks up the Infected/Mutated/Alien-combo tiers that system already
// applies based on runState.infection/mayhem and which other Horror Rules
// are active, without any per-enemy code (see horrorRules.js).
//
// Three enemy-template hooks beyond `intents` (all optional, all mirroring
// the existing Horror Rule hook shape -- `(battle, runState, ...)`):
// `onBattleStart(battle, runState, self)` fires once when the battle is
// built (reacting to who ELSE showed up, e.g. Lenny/Carl's mutual bonus);
// `onAllyDefeated(battle, runState, defeatedEnemy, self)` fires on every
// other living enemy when one dies (Carl's rage, Chalmers' "SKINNER!!");
// `onDefeated(battle, runState, self)` fires on the enemy itself when it
// dies (Snake dropping his stolen donuts). See systems/battleEngine.js.
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

  // ---- Segment II: Alien Invasion. 'phase' grants the alien Dodge --
  // beaming partway out of reality mid-fight.
  alienProbe: {
    id: 'alienProbe',
    name: 'Alien Probe Drone',
    emoji: '🛸',
    hp: 20,
    intents: [
      { type: 'attack', value: 8, weight: 55, label: 'Zap', icon: '⚡' },
      { type: 'phase', value: 1, weight: 45, label: 'Phase Out', icon: '👽' },
    ],
  },
  abductedCitizen: {
    id: 'abductedCitizen',
    name: 'Abducted Citizen',
    emoji: '👤',
    hp: 24,
    intents: [
      { type: 'attack', value: 9, weight: 60, label: 'Attack', icon: '🩸' },
      { type: 'defend', value: 8, weight: 40, label: 'Defend', icon: '🛡️' },
    ],
  },
  alienEnforcer: {
    id: 'alienEnforcer',
    name: 'Alien Enforcer',
    emoji: '👽',
    hp: 58,
    elite: true,
    intents: [
      { type: 'attack', value: 15, weight: 40, label: 'Ray Blast', icon: '⚡' },
      { type: 'phase', value: 2, weight: 30, label: 'Phase Out', icon: '👽' },
      { type: 'buff', value: 5, weight: 30, label: 'Overcharge', icon: '💪' },
    ],
  },

  // ---- Recognizable zombie characters (Priority 3). Reuses each
  // character's real portrait via data/assets.js's `enemies` map where one
  // exists; the ones with no uploaded art yet fall back to emoji, same as
  // every other enemy above.
  zombieLenny: {
    id: 'zombieLenny',
    name: 'Zombie Lenny',
    emoji: '🧟',
    hp: 24,
    tags: ['zombie', 'moeRegular'],
    intents: [
      { type: 'attack', value: 9, weight: 60, label: 'Attack', icon: '🩸' },
      { type: 'attackTwice', value: 10, weight: 40, label: 'Wild Swings', icon: '🩸' },
    ],
    // Simple and aggressive, per spec -- his only real depth is the bonus
    // he and Carl give each other for showing up in the same fight.
    onBattleStart(battle, runState, self) {
      if (battle.enemies.some((e) => e.templateId === 'zombieCarl' && e !== self)) {
        addStatus(self, STATUS.STRENGTH, 3);
      }
    },
  },
  zombieCarl: {
    id: 'zombieCarl',
    name: 'Zombie Carl',
    emoji: '🧟',
    hp: 26,
    tags: ['zombie', 'moeRegular'],
    intents: [
      { type: 'defend', value: 8, weight: 55, label: 'Defend', icon: '🛡️' },
      { type: 'attack', value: 6, weight: 45, label: 'Attack', icon: '🩸' },
    ],
    onBattleStart(battle, runState, self) {
      if (battle.enemies.some((e) => e.templateId === 'zombieLenny' && e !== self)) {
        addStatus(self, STATUS.ARMOR, 10);
      }
    },
    // Defensive until Lenny falls, then he stops holding back.
    onAllyDefeated(battle, runState, defeatedEnemy, self) {
      if (defeatedEnemy.templateId !== 'zombieLenny') return;
      addStatus(self, STATUS.STRENGTH, 6);
      battle.log.push({ turn: battle.turnNumber, actor: 'system', text: `${self.name} flies into a rage as Lenny falls!` });
    },
  },
  zombieBarney: {
    id: 'zombieBarney',
    name: 'Zombie Barney',
    emoji: '🧟',
    hp: 42,
    tags: ['zombie', 'moeRegular'],
    intents: [
      { type: 'buff', value: 6, weight: 40, label: 'Drunken Rage', icon: '🍺' },
      { type: 'attackTwice', value: 10, weight: 60, label: 'Stumble Swing', icon: '🩸' },
    ],
  },
  zombieWiggum: {
    id: 'zombieWiggum',
    name: 'Zombie Wiggum',
    emoji: '🧟',
    hp: 26,
    tags: ['zombie'],
    intents: [
      { type: 'attack', value: 7, weight: 45, label: 'Attack', icon: '🩸' },
      { type: 'friendlyFire', value: 9, weight: 35, label: 'Discharges Weapon Badly', icon: '💥' },
      { type: 'defend', value: 5, weight: 20, label: 'Defend', icon: '🛡️' },
    ],
  },
  zombieRalph: {
    id: 'zombieRalph',
    name: 'Zombie Ralph',
    emoji: '🧟',
    hp: 20,
    tags: ['zombie'],
    intents: [
      { type: 'attack', value: 3, weight: 40, label: 'Poke', icon: '🩸' },
      { type: 'defend', value: 3, weight: 30, label: 'Stares Blankly', icon: '🛡️' },
      { type: 'attack', value: 18, weight: 10, label: 'Surprisingly Hard Bite', icon: '🩸' },
      { type: 'confuse', value: 2, weight: 20, label: 'Says Something Unsettling', icon: '❓' },
    ],
  },
  zombieMilhouse: {
    id: 'zombieMilhouse',
    name: 'Zombie Milhouse',
    emoji: '🧟',
    hp: 14,
    tags: ['zombie'],
    intents: [
      { type: 'attack', value: 5, weight: 60, label: 'Attack', icon: '🩸' },
      { type: 'summon', value: 0, weight: 40, label: 'Calls for Bart', icon: '📣', summonId: 'zombieBart' },
    ],
  },
  zombieBart: {
    id: 'zombieBart',
    name: 'Zombie Bart',
    emoji: '🧟',
    hp: 16,
    tags: ['zombie'],
    intents: [
      { type: 'attack', value: 6, weight: 70, label: 'Attack', icon: '🩸' },
      { type: 'attackTwice', value: 8, weight: 30, label: 'Skateboard Combo', icon: '🩸' },
    ],
  },
  zombieChalmers: {
    id: 'zombieChalmers',
    name: 'Zombie Chalmers',
    emoji: '🧟',
    hp: 28,
    tags: ['zombie'],
    intents: [
      { type: 'buffAlly', value: 6, weight: 50, label: 'Barks Orders', icon: '💪' },
      { type: 'attack', value: 6, weight: 50, label: 'Attack', icon: '🩸' },
    ],
    onAllyDefeated(battle, runState, defeatedEnemy, self) {
      if (!defeatedEnemy.tags.has('commander')) return;
      addStatus(self, STATUS.STRENGTH, 8);
      battle.log.push({ turn: battle.turnNumber, actor: 'system', text: `${self.name}: "SKINNER!!"` });
    },
  },
  // A regular (non-boss) zombified Skinner for encounter combos elsewhere
  // in Springfield -- data/bosses.js's zombieSkinner is the scripted
  // Segment I boss fight at Springfield Elementary, a separate thing.
  zombieSkinnerZombie: {
    id: 'zombieSkinnerZombie',
    name: 'Zombie Skinner',
    emoji: '🧟',
    hp: 30,
    tags: ['zombie', 'commander'],
    intents: [
      { type: 'attack', value: 8, weight: 55, label: 'Attack', icon: '🩸' },
      { type: 'buff', value: 5, weight: 45, label: 'Detention Rage', icon: '💪' },
    ],
  },
  zombieStudent: {
    id: 'zombieStudent',
    name: 'Zombie Student',
    emoji: '🧟',
    hp: 14,
    tags: ['zombie'],
    intents: [
      { type: 'attack', value: 4, weight: 70, label: 'Attack', icon: '🩸' },
      { type: 'defend', value: 3, weight: 30, label: 'Defend', icon: '🛡️' },
    ],
  },
  zombieComicBookGuy: {
    id: 'zombieComicBookGuy',
    name: 'Zombie Comic Book Guy',
    emoji: '🧟',
    hp: 34,
    tags: ['zombie'],
    intents: [
      { type: 'defend', value: 12, weight: 55, label: 'Defend', icon: '🛡️' },
      { type: 'weaken', value: 3, weight: 45, label: '"Worst Attack Ever."', icon: '💢' },
    ],
  },
  zombieKrusty: {
    id: 'zombieKrusty',
    name: 'Zombie Krusty',
    emoji: '🧟',
    hp: 26,
    tags: ['zombie'],
    intents: [
      { type: 'attack', value: 9, weight: 50, label: 'Attack', icon: '🩸' },
      { type: 'infect', value: 4, weight: 30, label: 'Dangerous Product', icon: '☣️' },
      { type: 'attackTwice', value: 10, weight: 20, label: 'Pie in the Face', icon: '🩸' },
    ],
  },
  zombieKrustyDeluxe: {
    id: 'zombieKrustyDeluxe',
    name: 'Zombie Krusty (Deluxe Edition)',
    emoji: '🧟',
    hp: 55,
    elite: true,
    tags: ['zombie'],
    intents: [
      { type: 'attack', value: 14, weight: 35, label: 'Attack', icon: '🩸' },
      { type: 'infect', value: 6, weight: 30, label: 'Recalled Product', icon: '☣️' },
      { type: 'attackTwice', value: 16, weight: 20, label: 'Pie in the Face', icon: '🩸' },
      { type: 'buff', value: 6, weight: 15, label: 'Contractually Obligated Rage', icon: '💪' },
    ],
  },
  zombieHibbert: {
    id: 'zombieHibbert',
    name: 'Zombie Dr. Hibbert',
    emoji: '🧟',
    hp: 24,
    tags: ['zombie'],
    intents: [
      { type: 'heal', value: 10, weight: 55, label: 'Heals an Ally', icon: '➕' },
      { type: 'attack', value: 5, weight: 45, label: 'Attack', icon: '🩸' },
    ],
  },
  zombieNurse: {
    id: 'zombieNurse',
    name: 'Zombie Nurse',
    emoji: '🧟',
    hp: 16,
    tags: ['zombie'],
    intents: [
      { type: 'attack', value: 5, weight: 50, label: 'Attack', icon: '🩸' },
      { type: 'heal', value: 6, weight: 30, label: 'Heals an Ally', icon: '➕' },
      { type: 'defend', value: 4, weight: 20, label: 'Defend', icon: '🛡️' },
    ],
  },
  zombieSnake: {
    id: 'zombieSnake',
    name: 'Zombie Snake',
    emoji: '🧟',
    hp: 22,
    tags: ['zombie'],
    intents: [
      { type: 'steal', value: 4, weight: 55, label: 'Grabs Your Donuts', icon: '💰' },
      { type: 'attackTwice', value: 8, weight: 45, label: 'Attack', icon: '🩸' },
    ],
    // Kill him to get it back.
    onDefeated(battle, runState, self) {
      if (!self.stolenTotal) return;
      runState.donutsCurrency += self.stolenTotal;
      battle.log.push({ turn: battle.turnNumber, actor: 'system', text: `Snake drops ${self.stolenTotal} stolen donuts as he goes down.` });
    },
  },
  zombieGrandpa: {
    id: 'zombieGrandpa',
    name: 'Zombie Grandpa',
    emoji: '🧟',
    hp: 28,
    tags: ['zombie'],
    intents: [
      { type: 'confuse', value: 3, weight: 50, label: 'Tells a Long Story', icon: '❓' },
      { type: 'attack', value: 5, weight: 50, label: 'Attack', icon: '🩸' },
    ],
  },
};
