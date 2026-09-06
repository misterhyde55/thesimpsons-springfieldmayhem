import { ABILITIES } from '../data/abilities.js';
import { ENEMIES } from '../data/enemies.js';
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
import { fireHooks } from './passiveHooks.js';

const PLAYER_MAX_ENERGY = 3;
const INFECTION_MAX = 100;
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

function notePlayerDamage(battle, runState, amount) {
  if (amount <= 0) return;
  battle.flags.playerDamageTakenThisBattle = (battle.flags.playerDamageTakenThisBattle || 0) + amount;
  fireHooks(runState, 'onDamageTaken', battle, amount);
}

// Fired the instant any enemy's HP hits 0, before the victory check -- a
// Horror Rule (e.g. Zombie Outbreak) can revive it here by setting enemy.hp
// back above 0 and enemy.hasResurrected = true, which keeps it out of this
// check for the rest of the battle.
function resolveDefeatOrResurrect(battle, runState, enemy) {
  if (enemy.hp > 0 || enemy.hasResurrected) return;
  fireHooks(runState, 'onEnemyDefeated', battle, enemy);
  if (enemy.hp > 0 || enemy.hasResurrected) return; // a Horror Rule revived it -- no death reactions fire
  if (enemy.template.onDefeated) enemy.template.onDefeated(battle, runState, enemy);
  for (const ally of getAliveEnemies(battle)) {
    if (ally.template.onAllyDefeated) ally.template.onAllyDefeated(battle, runState, enemy, ally);
  }
}

function checkVictory(battle) {
  if (battle.outcome) return;
  if (getAliveEnemies(battle).length === 0) battle.outcome = 'victory';
}

function instantiateEnemy(template) {
  return {
    instanceId: `e${nextEnemyInstanceId++}`,
    templateId: template.id,
    template,
    name: template.name,
    emoji: template.emoji,
    hp: template.hp,
    maxHp: template.hp,
    statuses: freshCombatantStatuses(),
    tags: new Set(template.tags || []),
    hasResurrected: false,
    comboApplied: false,
    intent: null,
  };
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
    enemies: enemyTemplates.map(instantiateEnemy),
    turnNumber: 1,
    flags: {},
    log: [],
    locationId,
    isBoss: !!isBoss,
    outcome: null,
  };
  for (const enemy of battle.enemies) {
    fireHooks(runState, 'onEnemySpawn', enemy);
    rollIntent(enemy);
  }
  // A per-template hook (not a run-wide Horror Rule/relic hook) for an
  // enemy that reacts to who ELSE is in the fight at the start -- e.g.
  // Zombie Lenny and Zombie Carl each getting a small bonus for showing up
  // together (see data/enemies.js).
  for (const enemy of battle.enemies) {
    if (enemy.template.onBattleStart) enemy.template.onBattleStart(battle, runState, enemy);
  }
  fireHooks(runState, 'onBattleStart', battle);
  fireHooks(runState, 'onPlayerTurnStart', battle);
  return battle;
}

export function getAliveEnemies(battle) {
  return battle.enemies.filter((e) => e.hp > 0);
}

export function getPlayableAbilities(runState) {
  return runState.abilityDeck.map((id) => ABILITIES[id]).filter(Boolean);
}

export function abilityCost(battle, runState, ability) {
  let cost = ability.cost;
  for (const override of fireHooks(runState, 'onAbilityCost', battle, ability)) {
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
          fireHooks(runState, 'onStatusApplied', battle, enemy, id, getStatus(enemy, id));
        }
        events.push({ kind: 'status', who: 'allEnemies', statusId: id, amount });
        return;
      }
      const target = resolveWho(who);
      addStatus(target, id, amount);
      fireHooks(runState, 'onStatusApplied', battle, target, id, getStatus(target, id));
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
      resolveDefeatOrResurrect(battle, runState, targetEnemy);
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
        resolveDefeatOrResurrect(battle, runState, enemy);
      }
      checkVictory(battle);
    },
    heal(amount, who) {
      let amt = amount;
      for (const override of fireHooks(runState, 'onHealAmount', battle, amt)) {
        if (typeof override === 'number') amt = override;
      }
      const target = resolveWho(who);
      const healed = healCombatant(target, amt);
      events.push({ kind: 'heal', who, amount: healed });
      return healed;
    },
    ateFood() {
      battle.flags.foodEatenCount = (battle.flags.foodEatenCount || 0) + 1;
      fireHooks(runState, 'onAteFood', battle, battle.flags.foodEatenCount);
      return battle.flags.foodEatenCount;
    },
    setNextAttackBonus(pct) {
      battle.flags.nextAttackBonusPct = pct;
    },
    damageTakenThisBattle: () => battle.flags.playerDamageTakenThisBattle || 0,
  };

  ability.effect(api);
  fireHooks(runState, 'onAbilityPlayed', battle, ability, targetEnemy);
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
      if (result.type === 'infect') {
        runState.infection = Math.min(INFECTION_MAX, (runState.infection || 0) + (result.value || 0));
      }
      if (result.type === 'steal') {
        const stolen = Math.min(runState.donutsCurrency, result.value || 0);
        runState.donutsCurrency -= stolen;
        enemy.stolenTotal = (enemy.stolenTotal || 0) + stolen;
        result.stolenAmount = stolen;
      }
      if (result.type === 'summon' && !battle.flags[`summoned_${enemy.instanceId}`]) {
        battle.flags[`summoned_${enemy.instanceId}`] = true;
        const summonTemplate = ENEMIES[result.summonId];
        if (summonTemplate) {
          const summoned = instantiateEnemy(summonTemplate);
          fireHooks(runState, 'onEnemySpawn', summoned);
          if (summoned.template.onBattleStart) summoned.template.onBattleStart(battle, runState, summoned);
          rollIntent(summoned);
          battle.enemies.push(summoned);
          result.summonedInstanceId = summoned.instanceId;
          result.summonedName = summoned.name;
        }
      }
      // Some of the reactive hooks above (heal/friendlyFire/buffAlly targets,
      // or a friendly-fire kill) can resolve/kill an ally mid-intent -- run
      // the same defeat check the player's own damage goes through.
      if (result.targetId) {
        const targetEnemy = battle.enemies.find((e) => e.instanceId === result.targetId);
        if (targetEnemy) resolveDefeatOrResurrect(battle, runState, targetEnemy);
      }
      checkVictory(battle);
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
  fireHooks(runState, 'onPlayerTurnStart', battle);

  return { enemyActions, playerStunned: stunned };
}

export function syncRunStateFromBattle(runState, battle) {
  runState.hp = battle.player.hp;
}
