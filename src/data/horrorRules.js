// Horror Rules are the defining mechanic of Springfield Mayhem: each
// segment of an episode activates one, and -- critically -- rules from
// earlier segments stay active. They use the exact same {hooks:{...}}
// shape as relics (see systems/passiveHooks.js, which fires relics,
// horror rules, and character synergies through one path), so a rule can
// hook into any battle event a relic can, plus two horror-rule-only hooks:
// `onEnemySpawn(runState, enemy)` (fired once per enemy when a battle
// starts, tags/mutates the enemy) and `onEnemyDefeated(runState, battle,
// enemy)` (fired the instant an enemy's HP hits 0, before the victory
// check -- a hook that revives the enemy by setting enemy.hp > 0 and
// enemy.hasResurrected = true keeps it in the fight).
//
// Stacking combinations aren't a generic string-mangler: each rule's
// onEnemySpawn checks `enemy.tags` for another rule's tag and, if found,
// applies its own hand-authored mutation (rename/reflavor/buff). That's
// intentional -- see Alien Invasion's hook below for the "Alien Zombie"
// combo with Zombie Outbreak. Adding a third rule later means teaching it
// (and optionally the existing two) to recognize each other's tags; nothing
// about the engine needs to change.
import { STATUS } from './statusEffects.js';

export const HORROR_RULES = {
  zombieOutbreak: {
    id: 'zombieOutbreak',
    name: 'Zombie Outbreak',
    icon: '🧟',
    newsText: 'THE DEAD HAVE RISEN AND THEY WANT BRAINS. OR AT LEAST DONUTS.',
    description: 'Defeated zombies sometimes claw back to life. Infection makes healing harder.',
    hooks: {
      onEnemySpawn(runState, enemy) {
        enemy.tags.add('zombie');
      },
      onEnemyDefeated(runState, battle, enemy) {
        if (!enemy.tags.has('zombie') || enemy.hasResurrected) return;
        if (Math.random() < 0.3) {
          enemy.hp = Math.max(1, Math.round(enemy.maxHp * 0.2));
          enemy.hasResurrected = true;
          battle.log.push({ turn: battle.turnNumber, actor: 'system', text: `${enemy.name} claws back from the dead!` });
        }
      },
      onHealAmount(runState, battle, baseAmount) {
        return (runState.infection || 0) > 50 ? Math.round(baseAmount * 0.5) : undefined;
      },
    },
  },
  alienInvasion: {
    id: 'alienInvasion',
    name: 'Alien Invasion',
    icon: '👽',
    newsText: 'KANG & KODOS ARE ABDUCTING SPRINGFIELD, ONE RESIDENT AT A TIME.',
    description: 'Kang & Kodos are abducting Springfield. Anything they touch gets stranger.',
    hooks: {
      onEnemySpawn(runState, enemy) {
        enemy.tags.add('alien');
        if (enemy.tags.has('zombie') && !enemy.comboApplied) {
          enemy.comboApplied = true;
          enemy.name = `Alien ${enemy.name}`;
          enemy.emoji = '👽';
          enemy.maxHp = Math.round(enemy.maxHp * 1.3);
          enemy.hp = enemy.maxHp;
        }
      },
    },
  },
};

export function getHorrorRule(id) {
  return HORROR_RULES[id];
}
