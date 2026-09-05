import { ABILITIES } from '../data/abilities.js';
import { RELICS } from '../data/relics.js';
import { STATUS } from '../data/statusEffects.js';
import {
  getStatus,
  addStatus,
  clearStatus,
  computeOutgoingDamage,
  applyIncomingDamage,
  heal as healCombatant,
  tickTurnStart,
  tickTurnEnd,
} from './statusEngine.js';
import { rollIntent, resolveEnemyIntent } from './enemyAI.js';

const PLAYER_MAX_ENERGY = 3;
let nextEnemyInstanceId = 1;

function freshCombatantStatuses() {
  return {
    [STATUS.STRENGTH]: 0,
    [STATUS.ARMOR]: 0,
    [STATUS.WEAK]: 0,
    [STATUS.VULNERABLE]: 0,
    [STATUS.DODGE]: 0,
    [STATUS.STUN]: 0,
    [STATUS.RADIATION]: 0,
    [STATUS.POISON]: 0,
    [STATUS.TIPSY]: 0,
  };
}

function fireRelicHooks(runState, hookName, ...args) {
  const results = [];
  for (const relicId of runState.relics) {
    const relic = RELICS[relicId];
    const hook = relic && relic.hooks[hookName];
    if (hook) results.push(hook(...args));
  }
  return results;
}

function notePlayerDamage(battle, runState, amount) {
  if (amount <= 0) return;
  battle.flags.playerDamageTakenThisBattle = (battle.flags.playerDamageTakenThisBattle || 0) + amount;
  fireRelicHooks(runState, 'onDamageTaken', battle, amount);
}

export function createBattle(runState, enemyTemplates, locationId, isBoss) {
  const battle = {
    player: {
      hp: runState.hp,
      maxHp: runState.maxHp,
      energy: PLAYER_MAX_ENERGY,
      maxEnergy: PLAYER_MAX_ENERGY,
      statuses: freshCombatantStatuses(),
    },
    enemies: enemyTemplates.map((template) => ({
      instanceId: `e${nextEnemyInstanceId++}`,
      templateId: template.id,
      template,
      name: template.name,
      emoji: template.emoji,
      hp: template.hp,
      maxHp: template.hp,
      statuses: freshCombatantStatuses(),
      intent: null,
    })),
    turnNumber: 1,
    flags: {},
    log: [],
    locationId,
    isBoss: !!isBoss,
    outcome: null,
  };
  for (const enemy of battle.enemies) rollIntent(enemy);
  fireRelicHooks(runState, 'onBattleStart', battle);
  fireRelicHooks(runState, 'onPlayerTurnStart', battle);
  return battle;
}

export function getAliveEnemies(battle) {
  return battle.enemies.filter((e) => e.hp > 0);
}

function checkVictory(battle) {
  if (battle.outcome) return;
  if (getAliveEnemies(battle).length === 0) battle.outcome = 'victory';
}

export function getPlayableAbilities(runState) {
  return runState.abilityDeck.map((id) => ABILITIES[id]).filter(Boolean);
}

export function abilityCost(battle, runState, ability) {
  let cost = ability.cost;
  for (const override of fireRelicHooks(runState, 'onAbilityCost', battle, ability)) {
    if (typeof override === 'number') cost = Math.min(cost, override);
  }
  return Math.max(0, cost);
}

export function canPlayAbility(battle, runState, abilityId) {
  if (battle.outcome) return false;
  const ability = ABILITIES[abilityId];
  if (!ability) return false;
  return battle.player.energy >= abilityCost(battle, runState, ability);
}

// Resolves one ability play. `targetInstanceId` is required for
// target:'enemy' abilities and ignored otherwise. Returns a small event log
// the UI can turn into damage numbers / heal numbers / status pips.
export function playAbility(battle, runState, abilityId, targetInstanceId) {
  const ability = ABILITIES[abilityId];
  if (!ability || !canPlayAbility(battle, runState, abilityId)) return { ok: false };

  const cost = abilityCost(battle, runState, ability);
  battle.player.energy -= cost;

  const targetEnemy = ability.target === 'enemy' ? battle.enemies.find((e) => e.instanceId === targetInstanceId && e.hp > 0) : null;
  if (ability.target === 'enemy' && !targetEnemy) return { ok: false };

  const events = [];

  function resolveWho(who) {
    if (who === 'self') return battle.player;
    if (who === 'target') return targetEnemy;
    return null;
  }

  const api = {
    self: () => battle.player,
    getStatus: (id, who) => getStatus(resolveWho(who), id),
    clearStatus: (id, who) => clearStatus(resolveWho(who), id),
    status(id, amount, who) {
      if (who === 'allEnemies') {
        for (const enemy of getAliveEnemies(battle)) {
          addStatus(enemy, id, amount);
          fireRelicHooks(runState, 'onStatusApplied', battle, enemy, id, getStatus(enemy, id));
        }
        events.push({ kind: 'status', who: 'allEnemies', statusId: id, amount });
        return;
      }
      const target = resolveWho(who);
      addStatus(target, id, amount);
      fireRelicHooks(runState, 'onStatusApplied', battle, target, id, getStatus(target, id));
      events.push({ kind: 'status', who, statusId: id, amount });
    },
    consumeStatus(id, who) {
      const target = resolveWho(who);
      const value = getStatus(target, id);
      clearStatus(target, id);
      return value;
    },
    damage(amount) {
      let dmg = amount;
      if (battle.flags.nextAttackBonusPct) {
        dmg = Math.round(dmg * (1 + battle.flags.nextAttackBonusPct));
        battle.flags.nextAttackBonusPct = 0;
      }
      const outgoing = computeOutgoingDamage(battle.player, dmg);
      const { dealt, dodged } = applyIncomingDamage(targetEnemy, outgoing);
      events.push({ kind: 'damage', targetId: targetEnemy.instanceId, amount: dealt, dodged });
      checkVictory(battle);
      return dealt;
    },
    damageAll(amount) {
      let dmg = amount;
      if (battle.flags.nextAttackBonusPct) {
        dmg = Math.round(dmg * (1 + battle.flags.nextAttackBonusPct));
        battle.flags.nextAttackBonusPct = 0;
      }
      for (const enemy of getAliveEnemies(battle)) {
        const outgoing = computeOutgoingDamage(battle.player, dmg);
        const { dealt, dodged } = applyIncomingDamage(enemy, outgoing);
        events.push({ kind: 'damage', targetId: enemy.instanceId, amount: dealt, dodged });
      }
      checkVictory(battle);
    },
    heal(amount, who) {
      let amt = amount;
      for (const override of fireRelicHooks(runState, 'onHealAmount', battle, amt)) {
        if (typeof override === 'number') amt = override;
      }
      const target = resolveWho(who);
      const healed = healCombatant(target, amt);
      events.push({ kind: 'heal', who, amount: healed });
      return healed;
    },
    ateFood() {
      battle.flags.foodEatenCount = (battle.flags.foodEatenCount || 0) + 1;
      fireRelicHooks(runState, 'onAteFood', battle, battle.flags.foodEatenCount);
      return battle.flags.foodEatenCount;
    },
    setNextAttackBonus(pct) {
      battle.flags.nextAttackBonusPct = pct;
    },
    damageTakenThisBattle: () => battle.flags.playerDamageTakenThisBattle || 0,
  };

  ability.effect(api);
  fireRelicHooks(runState, 'onAbilityPlayed', battle, ability, targetEnemy);
  battle.log.push({ turn: battle.turnNumber, actor: 'player', abilityId, events });

  return { ok: true, events };
}

// Resolves every enemy's already-rolled intent, ticks end-of-turn statuses,
// rolls each enemy's next intent, and refills the player's energy for the
// next turn. Called once the player ends their turn (or has no playable
// abilities left). Returns a per-enemy action log for the UI to animate.
export function endPlayerTurn(battle, runState) {
  if (battle.outcome) return { enemyActions: [] };

  const poisonDamage = tickTurnEnd(battle.player);
  if (poisonDamage > 0) notePlayerDamage(battle, runState, poisonDamage);
  if (battle.player.hp <= 0) {
    battle.outcome = 'defeat';
    return { enemyActions: [], playerPoisonTick: poisonDamage };
  }

  const enemyActions = [];
  for (const enemy of getAliveEnemies(battle)) {
    const { stunned } = tickTurnStart(enemy);
    if (stunned) {
      enemyActions.push({ enemyId: enemy.instanceId, stunned: true, intent: enemy.intent });
    } else {
      const result = resolveEnemyIntent(battle, enemy);
      if (result.dealt) notePlayerDamage(battle, runState, result.dealt);
      enemyActions.push({ enemyId: enemy.instanceId, stunned: false, intent: enemy.intent, result });
    }
    tickTurnEnd(enemy);
    if (battle.player.hp <= 0) {
      battle.outcome = 'defeat';
      break;
    }
  }

  if (battle.outcome) return { enemyActions };

  for (const enemy of getAliveEnemies(battle)) rollIntent(enemy);

  battle.turnNumber += 1;
  const { stunned } = tickTurnStart(battle.player);
  battle.player.energy = battle.player.maxEnergy;
  fireRelicHooks(runState, 'onPlayerTurnStart', battle);

  return { enemyActions, playerStunned: stunned };
}

export function syncRunStateFromBattle(runState, battle) {
  runState.hp = battle.player.hp;
}
