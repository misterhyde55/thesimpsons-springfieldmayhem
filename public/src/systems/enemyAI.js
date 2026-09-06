import { pickWeighted } from '../engine/collision.js';
import { STATUS } from '../data/statusEffects.js';
import { addStatus, computeOutgoingDamage, applyIncomingDamage, heal as healCombatant } from './statusEngine.js';

// Enemies (and boss phases) declare a weighted `intents` list; this module
// just picks one and later resolves it. Intent types: 'attack' (hits the
// player once), 'attackTwice' (hits twice at half value, rounded), 'defend'
// (Armor on self), 'buff' (Strength on self), 'infect' (Poison on player,
// and -- via battleEngine.js -- raises the run's Infection meter), 'phase'
// (Dodge on self; alien enemies "beaming" partway out of reality).
//
// Zombie-character mechanics (Priority 3, "at least 8 recognizable zombie
// enemies... give each unique mechanics") added a few more: 'heal' (targets
// the lowest-HP living ally, e.g. Zombie Dr. Hibbert), 'friendlyFire'
// (damages a random OTHER living enemy, e.g. Zombie Wiggum's badly-handled
// gear), 'buffAlly' (Strength on a random other living ally, e.g. Zombie
// Chalmers rallying Skinner), 'weaken'/'confuse' (Weak/Vulnerable on the
// player -- two flavors of debuff-talk, e.g. Comic Book Guy's condescension
// vs. Grandpa's rambling stories), and 'steal'/'summon', which only tag
// themselves here -- the actual currency/roster mutation needs runState or
// the enemy-instance factory, so battleEngine.js's endPlayerTurn special-
// cases those two the same way it already does 'infect'.
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
  heal: 'heal',
  friendlyFire: 'attack',
  buffAlly: 'buff',
  weaken: 'debuff',
  confuse: 'debuff',
  steal: 'debuff',
  summon: 'summon',
  deal: 'bossSpecial',
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
    case 'heal':
      return `${enemyName} will heal a wounded ally for ${intent.value}.`;
    case 'friendlyFire':
      return `${enemyName} will accidentally hit an ally for ${intent.value}.`;
    case 'buffAlly':
      return `${enemyName} will give an ally ${intent.value} Strength.`;
    case 'weaken':
      return `${enemyName} will apply ${intent.value} Weak to you.`;
    case 'confuse':
      return `${enemyName} will apply ${intent.value} Vulnerable to you.`;
    case 'steal':
      return `${enemyName} will try to steal up to ${intent.value} donuts.`;
    case 'summon':
      return `${enemyName} will call for backup.`;
    case 'deal':
      return `${enemyName} is about to make you an offer.`;
    default:
      return `${enemyName}'s next move is unknown.`;
  }
}

// Living enemies other than `self` -- shared by the new ally-targeting
// intents ('heal', 'friendlyFire', 'buffAlly') below.
function aliveAllies(battle, self) {
  return battle.enemies.filter((e) => e.hp > 0 && e.instanceId !== self.instanceId);
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
  if (intent.type === 'heal') {
    const allies = aliveAllies(battle, enemy).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
    const target = allies[0];
    if (!target) return { type: 'none' };
    const healed = healCombatant(target, intent.value);
    return { type: 'heal', targetId: target.instanceId, value: healed };
  }
  if (intent.type === 'friendlyFire') {
    const allies = aliveAllies(battle, enemy);
    const target = allies[Math.floor(Math.random() * allies.length)];
    if (!target) return { type: 'none' };
    const { dealt } = applyIncomingDamage(target, intent.value);
    return { type: 'friendlyFire', targetId: target.instanceId, value: dealt };
  }
  if (intent.type === 'buffAlly') {
    const allies = aliveAllies(battle, enemy);
    const target = allies[Math.floor(Math.random() * allies.length)] || enemy;
    addStatus(target, STATUS.STRENGTH, intent.value);
    return { type: 'buffAlly', targetId: target.instanceId, value: intent.value };
  }
  if (intent.type === 'weaken') {
    addStatus(battle.player, STATUS.WEAK, intent.value);
    return { type: 'weaken', value: intent.value };
  }
  if (intent.type === 'confuse') {
    addStatus(battle.player, STATUS.VULNERABLE, intent.value);
    return { type: 'confuse', value: intent.value };
  }
  // 'steal' and 'summon' just tag themselves -- battleEngine.js's
  // endPlayerTurn does the actual currency/roster mutation, since that
  // needs runState (for the former) or the enemy-instance factory and
  // Horror Rule spawn hooks (for the latter), neither of which this module
  // has without importing back into battleEngine.js and creating a cycle.
  if (intent.type === 'steal' || intent.type === 'summon') {
    return { type: intent.type, value: intent.value, summonId: intent.summonId };
  }
  // 'deal' (Devil Ned's TEMPTATION/THE CONTRACT) replaces the boss's whole
  // turn with a real player choice instead of an automatic effect --
  // game.js's endTurn shows the choice modal for it, same as it would show
  // an animation for anything else in this list.
  if (intent.type === 'deal') {
    return { type: 'deal', deal: intent.deal };
  }
  return { type: 'none' };
}
