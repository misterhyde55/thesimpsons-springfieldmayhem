import { pickWeighted } from '../engine/collision.js';
import { STATUS } from '../data/statusEffects.js';
import { addStatus, computeOutgoingDamage, applyIncomingDamage } from './statusEngine.js';

// Enemies (and boss phases) declare a weighted `intents` list; this module
// just picks one and later resolves it. Intent types: 'attack' (hits the
// player once), 'attackTwice' (hits twice at half value, rounded), 'defend'
// (Armor on self), 'buff' (Strength on self), 'infect' (Poison on player).
function intentsForEnemy(enemy) {
  if (enemy.template.phases) {
    const hpPct = enemy.hp / enemy.maxHp;
    const phase = enemy.template.phases.find((p) => hpPct > p.minHpPct) || enemy.template.phases[enemy.template.phases.length - 1];
    return phase.intents;
  }
  return enemy.template.intents;
}

export function rollIntent(enemy) {
  const pool = intentsForEnemy(enemy);
  const chosen = pickWeighted(pool.map((i) => ({ ...i, weight: i.weight })));
  enemy.intent = chosen;
}

// Applies an enemy's already-rolled intent against the player, returning a
// small summary the UI can turn into damage numbers / log lines.
export function resolveEnemyIntent(battle, enemy) {
  const intent = enemy.intent;
  if (!intent) return { type: 'none' };

  if (intent.type === 'attack' || intent.type === 'attackTwice') {
    const hits = intent.type === 'attackTwice' ? 2 : 1;
    const perHit = intent.type === 'attackTwice' ? Math.round(intent.value / 2) : intent.value;
    let totalDealt = 0;
    let anyDodged = false;
    for (let i = 0; i < hits; i += 1) {
      const outgoing = computeOutgoingDamage(enemy, perHit);
      const { dealt, dodged } = applyIncomingDamage(battle.player, outgoing);
      totalDealt += dealt;
      anyDodged = anyDodged || dodged;
    }
    return { type: intent.type, dealt: totalDealt, dodged: anyDodged };
  }
  if (intent.type === 'defend') {
    addStatus(enemy, STATUS.ARMOR, intent.value);
    return { type: 'defend', value: intent.value };
  }
  if (intent.type === 'buff') {
    addStatus(enemy, STATUS.STRENGTH, intent.value);
    return { type: 'buff', value: intent.value };
  }
  if (intent.type === 'infect') {
    addStatus(battle.player, STATUS.POISON, intent.value);
    return { type: 'infect', value: intent.value };
  }
  return { type: 'none' };
}
