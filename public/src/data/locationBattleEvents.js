// Battlefield events tied to WHERE a fight is happening (REDESIGN COMBAT
// GAMEPLAY: "sometimes the ENVIRONMENT should matter") -- distinct from
// data/battleEnvironments.js (free player-triggered actions like throwing a
// garden gnome). These fire on their own, keyed by battle.locationId, and
// are wired into systems/battleEngine.js: `onTurnStart` runs once every
// fresh player turn, `onAbilityPlayed` runs after any enemy-targeted card
// resolves, `onEnemyDefeated` gets one shot at reviving a corpse before the
// normal defeat/resurrect check runs. Any hook a location doesn't define is
// simply skipped -- most locations have no entry here at all yet.
import { STATUS } from './statusEffects.js';

export const LOCATION_BATTLE_EVENTS = {
  nuclearPlant: {
    label: 'RADIATION LEAK',
    description: 'Every 3 turns, everyone in the fight gains 1 Radiation.',
    onTurnStart(battle, runState, api) {
      if (battle.turnNumber % 3 !== 0) return null;
      api.status(STATUS.RADIATION, 1, 'self');
      api.status(STATUS.RADIATION, 1, 'allEnemies');
      return 'The reactor hums. Everyone gains 1 Radiation.';
    },
  },
  moesTavern: {
    label: 'BROKEN BOTTLES',
    description: "Homer's attacks apply 1 Bleeding to their target.",
    onAbilityPlayed(battle, runState, ability, targetEnemy, api) {
      if (!targetEnemy || targetEnemy.hp <= 0 || ability.target !== 'enemy') return null;
      api.status(STATUS.BLEEDING, 1, 'target');
      return null;
    },
  },
  springfieldCemetery: {
    label: "THE DEAD DON'T STAY DEAD",
    description: 'A defeated zombie has a chance to claw back up with 25% HP.',
    onEnemyDefeated(battle, runState, enemy) {
      if (enemy.reviveRolled || !enemy.tags.has('zombie')) return false;
      enemy.reviveRolled = true;
      if (Math.random() >= 0.35) return false;
      enemy.hp = Math.max(1, Math.round(enemy.maxHp * 0.25));
      enemy.hasResurrected = true;
      return true;
    },
  },
  kwikEMart: {
    label: 'SQUISHEE MACHINE MALFUNCTION',
    description: 'Every 3 turns the Squishee machine sprays something onto the battlefield.',
    onTurnStart(battle, runState, api) {
      if (battle.turnNumber % 3 !== 0) return null;
      const roll = Math.random();
      if (roll < 0.34) {
        api.heal(4, 'self');
        return 'The Squishee machine sprays you down. +4 HP.';
      }
      if (roll < 0.67) {
        api.status(STATUS.SOAKED, 2, 'allEnemies');
        return 'Sticky Squishee syrup soaks the enemies.';
      }
      api.status(STATUS.WEAK, 1, 'allEnemies');
      return 'A blast of brain-freeze mist chills the enemies. Weak applied.';
    },
  },
};

export function getLocationBattleEvent(locationId) {
  return LOCATION_BATTLE_EVENTS[locationId] || null;
}
