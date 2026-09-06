import { pickWeighted } from '../engine/collision.js';
import { STATUS } from '../data/statusEffects.js';
import { addStatus, computeOutgoingDamage, applyIncomingDamage } from './statusEngine.js';

// Enemies (and boss phases) declare a weighted `intents` list; this module
// just picks one and later resolves it. Intent types: 'attack' (hits the
// player once), 'attackTwice' (hits twice at half value, rounded), 'defend'
// (Armor on self), 'buff' (Strength on self), 'infect' (Poison on player,
// and -- via battleEngine.js -- raises the run's Infection meter), 'phase'
// (Dodge on self; alien enemies "beaming" partway out of reality).
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

// Maps an intent's `type` to an icons.js `intent` category id -- one small
// vocabulary shared by every enemy/boss, so data/enemies.js and
// data/bosses.js never need their own icon path per intent (see
// ui/screens.js, which renders this through ui/icons.js).
const INTENT_ICON_IDS = {
  attack: 'attack',
  attackTwice: 'attackTwice',
  defend: 'defend',
  buff: 'buff',
  infect: 'infect',
  phase: 'phase',
};

export function intentIconId(type) {
  return INTENT_ICON_IDS[type] || 'unknown';
}

// The tooltip line shown on hover/click over an enemy's intent -- "what is
// this actually going to do to me", spelled out in full since the icon +
// number alone is meant to be scannable, not exhaustive.
export function describeIntent(enemyName, intent) {
  if (!intent) return '';
  switch (intent.type) {
    case 'attack':
      return `${enemyName} will attack for ${intent.value} damage.`;
    case 'attackTwice':
      return `${enemyName} will hit twice for ${Math.round(intent.value / 2)} damage each.`;
    case 'defend':
      return `${enemyName} will gain ${intent.value} Armor.`;
    case 'buff':
      return `${enemyName} will gain ${intent.value} Strength.`;
    case 'infect':
      return `${enemyName} will apply ${intent.value} Infection to you.`;
    case 'phase':
      return `${enemyName} will phase partway out of reality, gaining Dodge.`;
    default:
      return `${enemyName}'s next move is unknown.`;
  }
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
  if (intent.type === 'phase') {
    addStatus(enemy, STATUS.DODGE, intent.value);
    return { type: 'phase', value: intent.value };
  }
  return { type: 'none' };
}
