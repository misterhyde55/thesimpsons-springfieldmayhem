import { ABILITIES } from '../data/abilities.js';
import { ENEMIES } from '../data/enemies.js';
import { ITEMS } from '../data/items.js';
import { STATUS } from '../data/statusEffects.js';
import { getBattleEnvironment } from '../data/battleEnvironments.js';
import { getLocationBattleEvent } from '../data/locationBattleEvents.js';
import {
  getStatus,
  addStatus,
  clearStatus,
  computeOutgoingDamage,
  applyIncomingDamage,
  heal as healCombatant,
  gainArmor,
  effectiveMaxEnergy,
  tickTurnStart,
  tickTurnEnd,
} from './statusEngine.js';
import { rollIntent, resolveEnemyIntent, currentPhaseIndex } from './enemyAI.js';
import { fireHooks } from './passiveHooks.js';

const PLAYER_MAX_ENERGY = 3;
const INFECTION_MAX = 100;
// A real roguelike hand: runState.abilityDeck (every ability Homer knows --
// learnAbility already refuses duplicates, so ids are unique and safe to use
// directly as draw/hand/discard entries with no separate card-instance
// model) gets shuffled into a draw pile at battle start; each player turn
// discards whatever's left in hand and draws a fresh HAND_SIZE, reshuffling
// the discard pile back in once the draw pile runs dry.
const HAND_SIZE = 5;
let nextEnemyInstanceId = 1;

function shuffledArray(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Draws up to `count` cards into battle.hand, reshuffling the discard pile
// into the draw pile once it empties. Stops early (a smaller-than-HAND_SIZE
// hand) only once both piles are genuinely empty -- i.e. every card Homer
// owns is already in his hand.
export function drawCards(battle, count) {
  for (let i = 0; i < count; i += 1) {
    if (battle.drawPile.length === 0) {
      if (battle.discardPile.length === 0) return;
      battle.drawPile = shuffledArray(battle.discardPile);
      battle.discardPile = [];
    }
    battle.hand.push(battle.drawPile.pop());
  }
}

export function getHandAbilities(battle) {
  return battle.hand.map((id) => ABILITIES[id]).filter(Boolean);
}

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
    [STATUS.BURNING]: 0,
    [STATUS.BLEEDING]: 0,
    [STATUS.CONFUSED]: 0,
    [STATUS.TERRIFIED]: 0,
    [STATUS.EXHAUSTED]: 0,
    [STATUS.ANGRY]: 0,
    [STATUS.SLIMED]: 0,
    [STATUS.CURSED]: 0,
    [STATUS.SOAKED]: 0,
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
// check for the rest of the battle. A location battlefield event (e.g.
// Cemetery's THE DEAD DON'T STAY DEAD, data/locationBattleEvents.js) gets
// the next shot at reviving it, then the normal defeat reactions run.
// `events` is optional -- only the two damage-dealing call sites below have
// a live event log to push a 'locationRevive' notice into; the enemy-turn
// friendly-fire call site has none, so its revival simply isn't announced.
function resolveDefeatOrResurrect(battle, runState, enemy, events) {
  if (enemy.hp > 0 || enemy.hasResurrected) return;
  fireHooks(runState, 'onEnemyDefeated', battle, enemy);
  if (enemy.hp > 0 || enemy.hasResurrected) return; // a Horror Rule revived it -- no death reactions fire
  const locEvent = getLocationBattleEvent(battle.locationId);
  if (locEvent && locEvent.onEnemyDefeated) {
    const revived = locEvent.onEnemyDefeated(battle, runState, enemy);
    if (revived) {
      if (events) events.push({ kind: 'locationRevive', targetId: enemy.instanceId, label: locEvent.label });
      return;
    }
  }
  if (enemy.template.onDefeated) enemy.template.onDefeated(battle, runState, enemy);
  for (const ally of getAliveEnemies(battle)) {
    if (ally.template.onAllyDefeated) ally.template.onAllyDefeated(battle, runState, enemy, ally);
  }
}

function checkVictory(battle) {
  if (battle.outcome) return;
  if (getAliveEnemies(battle).length === 0) battle.outcome = 'victory';
}

// A stronger enemy's second resource (data/bosses.js `breakMax`), separate
// from HP -- certain abilities/environment actions chip it via
// api.reduceBreak instead of (or alongside) HP damage. Depleting it stuns
// the enemy's next turn and leaves them Vulnerable, reusing the existing
// Stun/Vulnerable statuses rather than inventing a bespoke "broken" state,
// then resets so it can be broken again in a longer fight.
function applyBreakDamage(battle, runState, enemy, amount, events) {
  if (!enemy.breakMax || amount <= 0 || enemy.hp <= 0) return;
  enemy.break = Math.max(0, enemy.break - amount);
  events.push({ kind: 'breakDamage', targetId: enemy.instanceId, amount, break: enemy.break, breakMax: enemy.breakMax });
  if (enemy.break <= 0 && !enemy.brokenThisCycle) {
    enemy.brokenThisCycle = true;
    addStatus(enemy, STATUS.STUN, 1);
    addStatus(enemy, STATUS.VULNERABLE, 2);
    enemy.break = enemy.breakMax;
    events.push({ kind: 'break', targetId: enemy.instanceId });
    if (enemy.template.onBreak) enemy.template.onBreak(battle, runState, enemy);
  }
}

// Detects an HP-threshold phase change (data/bosses.js `phases`) right
// after damage lands, pushes a UI event for it, and fires the enemy's own
// onPhaseChange hook -- e.g. Zombie Ned losing composure and gaining
// Vulnerable the moment he "snaps." Purely derived from current HP each
// call (see enemyAI.js currentPhaseIndex), matching how intent selection
// itself already works -- this just also announces the moment it happens.
function checkPhaseTransition(battle, runState, enemy, events) {
  if (!enemy.template.phases || enemy.hp <= 0) return;
  const idx = currentPhaseIndex(enemy);
  if (idx === enemy.lastPhaseIndex) return;
  enemy.lastPhaseIndex = idx;
  // A fixed-pattern phase (see enemyAI.js rollIntent) always opens on step 0
  // of its own pattern -- never picks up wherever the PREVIOUS phase's
  // pattern/weighted-roll count happened to leave off.
  enemy.turnsInPhase = 0;
  const phase = enemy.template.phases[idx];
  events.push({ kind: 'phaseChange', targetId: enemy.instanceId, phaseIndex: idx, phaseName: phase.name || null, transitionLine: phase.transitionLine || null });
  if (enemy.template.onPhaseChange) enemy.template.onPhaseChange(battle, runState, enemy, idx);
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
    // Combat-redesign additions (see applyBreakDamage/checkPhaseTransition
    // above and enemyAI.js's interruptible-intent handling below).
    damageTakenThisTurn: 0,
    breakMax: template.breakMax || 0,
    break: template.breakMax || 0,
    brokenThisCycle: false,
    lastPhaseIndex: 0,
    // How many of ITS OWN turns this enemy has taken since entering its
    // current phase -- only meaningful for a phase with a fixed `pattern`
    // (enemyAI.js rollIntent); reset to 0 by checkPhaseTransition above.
    turnsInPhase: 0,
  };
}

export function createBattle(runState, enemyTemplates, locationId, isBoss, environmentId, isElite) {
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
    // Springfield Survivor (data/relics.js) reads this at onBattleStart.
    isElite: !!isElite,
    outcome: null,
    // Battlefield objects the player can interact with outside their
    // normal ability deck (see playEnvironmentAction below and
    // data/battleEnvironments.js) -- free, no Energy cost, limited uses.
    environment: getBattleEnvironment(environmentId).map((def) => ({ ...def, usesLeft: def.uses })),
    // A single ability id disabled for the current player turn (Zombie
    // Ned's Ski Nightmare/'distract' intent) -- cleared every new round.
    distractedAbilityId: null,
    // The real deck: drawPile starts as every ability Homer owns, shuffled;
    // hand is what's playable RIGHT NOW (see drawCards/getHandAbilities
    // above); discardPile is everything played or discarded at turn end,
    // reshuffled back into drawPile once drawPile runs dry.
    drawPile: shuffledArray(runState.abilityDeck),
    hand: [],
    discardPile: [],
    // COMBAT OVERHAUL: D'OH! Meter -- fills from PERFECT Attack/Defense
    // Challenge outcomes and interrupts (game.js addDohMeter); useDohMove
    // below spends it on a free "WHY YOU LITTLE!" burst once full.
    dohMeter: 0,
    dohMeterMax: 100,
  };
  drawCards(battle, HAND_SIZE);
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
  // Snake's event-reward relic (data/relics.js quickHands): "draw 1
  // additional card on the first turn of combat." Every source's own
  // return value is summed rather than short-circuited, same as every
  // other fireHooks call site, so this still adds up correctly if more
  // than one source ever grants extra first-turn draws.
  const extraDraws = fireHooks(runState, 'onFirstTurnExtraDraw', battle).reduce((sum, n) => sum + (typeof n === 'number' ? n : 0), 0);
  if (extraDraws > 0) drawCards(battle, extraDraws);
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
  // Confused makes everything harder to think through, flatly -- applied
  // before the hook overrides below so a discount relic still reduces off
  // of the confused price, not the base one.
  if (getStatus(battle.player, STATUS.CONFUSED) > 0) cost += 1;
  for (const override of fireHooks(runState, 'onAbilityCost', battle, ability)) {
    if (typeof override === 'number') cost = Math.min(cost, override);
  }
  return Math.max(0, cost);
}

export function canPlayAbility(battle, runState, abilityId) {
  if (battle.outcome) return false;
  if (!battle.hand.includes(abilityId)) return false;
  if (battle.distractedAbilityId === abilityId) return false;
  const ability = ABILITIES[abilityId];
  if (!ability) return false;
  return battle.player.energy >= abilityCost(battle, runState, ability);
}

// Shared by playAbility and playEnvironmentAction so an environment object
// (a thrown garden gnome, a kicked-over grill) can do everything a card
// can -- damage, status, break, heal -- through the exact same rules
// (Strength/Weak on the way out, Vulnerable/Soaked/Armor on the way in),
// rather than a second, drifting copy of this math. `effectSource` (only
// set by playAbility/playEnvironmentAction below) tells an 'onDamageDealt'
// hook (data/relics.js bowlingLeagueChamp) what's actually dealing this
// damage -- {kind:'ability', archetype} or {kind:'environment'} -- so an
// archetype-specific bonus doesn't need its own bespoke plumbing.
export function buildBattleApi(battle, runState, targetEnemy, events, effectSource = null) {
  function resolveWho(who) {
    if (who === 'self') return battle.player;
    if (who === 'target') return targetEnemy;
    return null;
  }
  return {
    self: () => battle.player,
    target: () => targetEnemy,
    getStatus: (id, who) => getStatus(resolveWho(who), id),
    clearStatus: (id, who) => clearStatus(resolveWho(who), id),
    status(id, amount, who) {
      if (who === 'allEnemies') {
        for (const enemy of getAliveEnemies(battle)) {
          if (id === STATUS.ARMOR && amount > 0) gainArmor(enemy, amount);
          else addStatus(enemy, id, amount);
          fireHooks(runState, 'onStatusApplied', battle, enemy, id, getStatus(enemy, id));
        }
        events.push({ kind: 'status', who: 'allEnemies', statusId: id, amount });
        return;
      }
      const target = resolveWho(who);
      if (id === STATUS.ARMOR && amount > 0) gainArmor(target, amount);
      else addStatus(target, id, amount);
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
      // Angry is a consumed "next Attack hits harder" buff, not a stacking
      // multiplier like Strength -- it's spent the moment it's used.
      if (getStatus(battle.player, STATUS.ANGRY) > 0) {
        dmg = Math.round(dmg * 1.5);
        clearStatus(battle.player, STATUS.ANGRY);
      }
      for (const bonus of fireHooks(runState, 'onDamageDealt', battle, effectSource)) {
        if (typeof bonus === 'number') dmg += bonus;
      }
      const outgoing = computeOutgoingDamage(battle.player, dmg);
      const { dealt, dodged } = applyIncomingDamage(targetEnemy, outgoing);
      targetEnemy.damageTakenThisTurn += dealt;
      events.push({ kind: 'damage', targetId: targetEnemy.instanceId, amount: dealt, dodged });
      resolveDefeatOrResurrect(battle, runState, targetEnemy, events);
      checkPhaseTransition(battle, runState, targetEnemy, events);
      checkVictory(battle);
      return dealt;
    },
    damageAll(amount) {
      let dmg = amount;
      if (battle.flags.nextAttackBonusPct) {
        dmg = Math.round(dmg * (1 + battle.flags.nextAttackBonusPct));
        battle.flags.nextAttackBonusPct = 0;
      }
      if (getStatus(battle.player, STATUS.ANGRY) > 0) {
        dmg = Math.round(dmg * 1.5);
        clearStatus(battle.player, STATUS.ANGRY);
      }
      for (const bonus of fireHooks(runState, 'onDamageDealt', battle, effectSource)) {
        if (typeof bonus === 'number') dmg += bonus;
      }
      for (const enemy of getAliveEnemies(battle)) {
        const outgoing = computeOutgoingDamage(battle.player, dmg);
        const { dealt, dodged } = applyIncomingDamage(enemy, outgoing);
        enemy.damageTakenThisTurn += dealt;
        events.push({ kind: 'damage', targetId: enemy.instanceId, amount: dealt, dodged });
        resolveDefeatOrResurrect(battle, runState, enemy, events);
        checkPhaseTransition(battle, runState, enemy, events);
      }
      checkVictory(battle);
    },
    // A second resource some enemies have (data/bosses.js breakMax) --
    // independent of HP/Armor, see applyBreakDamage above.
    reduceBreak(amount, who = 'target') {
      const target = resolveWho(who);
      if (target) applyBreakDamage(battle, runState, target, amount, events);
    },
    heal(amount, who) {
      let amt = amount;
      for (const override of fireHooks(runState, 'onHealAmount', battle, amt)) {
        if (typeof override === 'number') amt = override;
      }
      const target = resolveWho(who);
      const healed = healCombatant(target, amt);
      if (target === battle.player && healed > 0) battle.flags.healedThisTurn = true;
      events.push({ kind: 'heal', who, amount: healed });
      return healed;
    },
    // Snake's event-reward ability (data/abilities.js hotDogPunch): "if
    // Homer healed this turn, deal +6 damage instead." Reset every player
    // turn alongside the other per-round trackers in endPlayerTurn below.
    healedThisTurn: () => !!battle.flags.healedThisTurn,
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

  // Playing a card moves it from hand to the discard pile -- see
  // drawCards/getHandAbilities above.
  const handIdx = battle.hand.indexOf(abilityId);
  if (handIdx !== -1) {
    battle.hand.splice(handIdx, 1);
    battle.discardPile.push(abilityId);
  }

  const events = [];
  const api = buildBattleApi(battle, runState, targetEnemy, events, { kind: 'ability', archetype: ability.archetype });

  ability.effect(api);
  fireHooks(runState, 'onAbilityPlayed', battle, ability, targetEnemy);
  // A location battlefield event reacting to HOW Homer just fought (e.g.
  // Moe's BROKEN BOTTLES applying Bleeding to whatever a card hit) --
  // separate from the run-wide hook above, keyed by battle.locationId
  // instead of an equipped relic/rule (see data/locationBattleEvents.js).
  const locEvent = getLocationBattleEvent(battle.locationId);
  if (locEvent && locEvent.onAbilityPlayed) {
    const message = locEvent.onAbilityPlayed(battle, runState, ability, targetEnemy, api);
    if (message) events.push({ kind: 'locationEvent', message });
  }
  // A per-enemy reaction to HOW Homer just fought (not a run-wide hook) --
  // e.g. Zombie Ned's Forgiveness counting attacks against him specifically.
  // Fires for every alive enemy, not just the one targeted, so an enemy can
  // react to being ignored too.
  for (const enemy of getAliveEnemies(battle)) {
    if (enemy.template.onPlayerAbility) enemy.template.onPlayerAbility(battle, runState, enemy, ability, targetEnemy);
  }
  battle.log.push({ turn: battle.turnNumber, actor: 'player', abilityId, events });

  return { ok: true, events };
}

// Environment objects (data/battleEnvironments.js) work like abilities but
// cost no Energy, don't end the turn, and are limited by uses rather than
// affordability -- a separate resource entirely from Homer's own deck.
export function playEnvironmentAction(battle, runState, actionId, targetInstanceId) {
  if (battle.outcome) return { ok: false };
  const action = battle.environment.find((a) => a.id === actionId);
  if (!action || action.usesLeft <= 0) return { ok: false };

  const targetEnemy = action.target === 'enemy' ? battle.enemies.find((e) => e.instanceId === targetInstanceId && e.hp > 0) : null;
  if (action.target === 'enemy' && !targetEnemy) return { ok: false };

  const events = [];
  const api = buildBattleApi(battle, runState, targetEnemy, events, { kind: 'environment' });

  action.usesLeft -= 1;
  action.effect(api);
  battle.flags.environmentActionsUsed = (battle.flags.environmentActionsUsed || 0) + 1;
  for (const enemy of getAliveEnemies(battle)) {
    if (enemy.template.onPlayerAbility) enemy.template.onPlayerAbility(battle, runState, enemy, action, targetEnemy);
  }
  battle.log.push({ turn: battle.turnNumber, actor: 'environment', actionId, events });

  return { ok: true, events };
}

// COMBAT OVERHAUL: D'OH! Move -- "WHY YOU LITTLE!", the first of the
// spec's big Simpsons super moves. Free (no Energy, doesn't end the
// turn), costs the whole D'OH Meter (game.js addDohMeter fills it from
// PERFECT Attack/Defense Challenge outcomes and interrupts). Hits every
// alive enemy at once so it needs no targeting step of its own.
const DOH_MOVE_DAMAGE = 25;

export function useDohMove(battle, runState) {
  if (battle.outcome || battle.dohMeter < battle.dohMeterMax) return { ok: false };
  battle.dohMeter = 0;
  const events = [];
  const api = buildBattleApi(battle, runState, null, events, { kind: 'dohMove' });
  api.damageAll(DOH_MOVE_DAMAGE);
  battle.log.push({ turn: battle.turnNumber, actor: 'dohMove', actionId: 'whyYouLittle', events });
  return { ok: true, events };
}

// COMBAT OVERHAUL PART 4 (ACTIVE ENEMY DEFENSE): the enemy-turn resolver
// used to be one synchronous function that resolved every enemy's already-
// rolled intent in a single pass -- fine when nothing ever needed player
// input mid-resolution, but a real defense challenge (a dodge prompt) has
// to actually PAUSE before a dodgeable hit lands, wait for the player's
// reaction, and then resume with the REST of the enemies still to go. That
// needs the enemy-turn to become resumable rather than atomic, so it's now
// split into three pieces:
//   beginEnemyTurn   -- the once-per-turn setup (poison tick, snapshot the
//                        alive-enemies queue). Call once, when the player
//                        ends their turn.
//   advanceEnemyTurn -- resolves ONE enemy (or, if resuming a defense
//                        challenge, finishes resolving the one that
//                        paused), then returns immediately. Call this
//                        again for status 'continue'; on 'needsDefense',
//                        game.js shows the challenge and calls this again
//                        with the outcome for the SAME enemy (battle.
//                        pendingDefenseEnemyId tracks which one); 'done'
//                        means the whole enemy turn has resolved and the
//                        tail logic (roll next intents, draw a fresh hand,
//                        etc. -- everything the old function's second half
//                        did) has already run.
// Everything BELOW is byte-for-byte the same resolution logic the old
// single function had -- only the control flow changed, not the rules.
export function beginEnemyTurn(battle, runState) {
  if (battle.outcome) return { enemyActions: [], defeated: false };
  const poisonDamage = tickTurnEnd(battle.player);
  if (poisonDamage > 0) notePlayerDamage(battle, runState, poisonDamage);
  if (battle.player.hp <= 0) {
    battle.outcome = 'defeat';
    return { enemyActions: [], playerPoisonTick: poisonDamage, defeated: true };
  }
  battle.pendingEnemyQueue = getAliveEnemies(battle).map((e) => e.instanceId);
  battle.pendingEnemyActions = [];
  battle.pendingDefenseEnemyId = null;
  return { enemyActions: [], playerPoisonTick: poisonDamage, defeated: false };
}

function resolveOneEnemy(battle, runState, enemy, defenseOutcome) {
  const result = resolveEnemyIntent(battle, enemy, defenseOutcome);
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
  if (result.type === 'distract') {
    const candidates = runState.abilityDeck.filter((id) => id !== battle.distractedAbilityId);
    if (candidates.length) {
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      battle.distractedAbilityId = pick;
      result.distractedAbilityId = pick;
    }
  }
  if (result.targetId) {
    const targetEnemy = battle.enemies.find((e) => e.instanceId === result.targetId);
    if (targetEnemy) resolveDefeatOrResurrect(battle, runState, targetEnemy);
  }
  checkVictory(battle);
  battle.pendingEnemyActions.push({ enemyId: enemy.instanceId, stunned: false, intent: enemy.intent, result });
  tickTurnEnd(enemy);
  if (battle.player.hp <= 0) battle.outcome = 'defeat';
}

// The once-per-turn tail (rolling next intents, refilling energy, drawing a
// fresh hand, firing onPlayerTurnStart, the location event's periodic
// tick) -- unchanged from the old function's second half, just renamed
// since it now only runs once the resumable loop's queue is empty.
function finishEnemyTurn(battle, runState) {
  if (!battle.outcome) {
    for (const enemy of getAliveEnemies(battle)) {
      rollIntent(enemy);
      enemy.damageTakenThisTurn = 0;
      enemy.brokenThisCycle = false;
    }
  }
  battle.distractedAbilityId = null;
  battle.flags.healedThisTurn = false;

  const enemyActions = battle.pendingEnemyActions;
  if (battle.outcome) return { status: 'done', enemyActions };

  battle.turnNumber += 1;
  const { stunned } = tickTurnStart(battle.player);
  battle.player.energy = effectiveMaxEnergy(battle.player, battle.player.maxEnergy);
  battle.discardPile.push(...battle.hand);
  battle.hand = [];
  drawCards(battle, HAND_SIZE);
  fireHooks(runState, 'onPlayerTurnStart', battle);

  let locationEvent = null;
  const locEvent = getLocationBattleEvent(battle.locationId);
  if (locEvent && locEvent.onTurnStart && !battle.outcome) {
    const events = [];
    const api = buildBattleApi(battle, runState, null, events);
    const message = locEvent.onTurnStart(battle, runState, api);
    if (message) locationEvent = { message, events, label: locEvent.label };
    if (battle.player.hp <= 0) battle.outcome = 'defeat';
  }

  return { status: 'done', enemyActions, playerStunned: stunned, locationEvent };
}

// Called once per step by game.js's enemy-turn loop. `defenseOutcome`
// ('perfect'|'good'|'fail') should be passed ONLY when resuming after a
// defense challenge for battle.pendingDefenseEnemyId -- omit it otherwise.
// Returns one of:
//   {status:'needsDefense', enemyId, intent}  -- game.js must show the
//     challenge, then call this again with the outcome for the SAME enemy.
//   {status:'continue', enemyActions}         -- one enemy resolved
//     (or was stunned); call again for the next one.
//   {status:'done', enemyActions, ...}        -- the whole enemy turn (and
//     its once-per-turn tail) has finished; same shape the old single
//     function used to return.
export function advanceEnemyTurn(battle, runState, defenseOutcome) {
  if (battle.outcome) return { status: 'done', enemyActions: battle.pendingEnemyActions || [] };

  let enemy;
  if (battle.pendingDefenseEnemyId) {
    // Resuming: this enemy's intent already paused once (see the
    // 'needsDefense' branch below) and is NOT re-fetched from the queue.
    enemy = battle.enemies.find((e) => e.instanceId === battle.pendingDefenseEnemyId);
    battle.pendingDefenseEnemyId = null;
  } else {
    const enemyId = battle.pendingEnemyQueue.shift();
    if (!enemyId) return finishEnemyTurn(battle, runState);
    enemy = battle.enemies.find((e) => e.instanceId === enemyId);
    // getAliveEnemies snapshotted the queue in beginEnemyTurn -- an earlier
    // enemy's own turn (friendlyFire, a location event's reaction) can
    // still kill a LATER enemy already in that snapshot (DEBUG ALL ENEMY
    // AI: "enemy dies but remains in turn queue").
    if (!enemy || enemy.hp <= 0) return advanceEnemyTurn(battle, runState);

    const { stunned } = tickTurnStart(enemy);
    if (stunned) {
      battle.pendingEnemyActions.push({ enemyId: enemy.instanceId, stunned: true, intent: enemy.intent });
      tickTurnEnd(enemy);
      return { status: 'continue', enemyActions: battle.pendingEnemyActions };
    }

    const intent = enemy.intent;
    if (intent?.dodgeable && (intent.type === 'attack' || intent.type === 'attackTwice')) {
      battle.pendingDefenseEnemyId = enemy.instanceId;
      return { status: 'needsDefense', enemyId: enemy.instanceId, intent };
    }
  }

  resolveOneEnemy(battle, runState, enemy, defenseOutcome);
  if (battle.outcome) return { status: 'done', enemyActions: battle.pendingEnemyActions };
  return { status: 'continue', enemyActions: battle.pendingEnemyActions };
}

export function syncRunStateFromBattle(runState, battle) {
  runState.hp = battle.player.hp;
}

// Using a held consumable (data/items.js, runState.consumables) mid-fight
// (REDESIGN COMBAT GAMEPLAY: "player can use consumables during battle...
// should NOT count as normal cards") -- doesn't cost Energy or a card play,
// doesn't end the turn. Every item's `apply(runState)` reads/writes
// runState.hp/maxHp/infection/etc directly, which is fine outside combat
// but WRONG mid-battle (runState.hp is stale -- battle.player.hp is the
// live value, only synced back via syncRunStateFromBattle at battle end).
// This proxy redirects hp/maxHp onto the live battle.player instead, so
// e.g. drinking a Duff Beer mid-fight heals off current HP, not whatever
// runState.hp happened to be when the fight started.
export function useConsumableInBattle(battle, runState, itemId) {
  if (battle.outcome) return { ok: false };
  const item = ITEMS[itemId];
  if (!item || !runState.consumables[itemId]) return { ok: false };
  const hpBefore = battle.player.hp;
  const proxy = {
    get hp() {
      return battle.player.hp;
    },
    set hp(value) {
      battle.player.hp = Math.max(0, Math.min(battle.player.maxHp, value));
    },
    get maxHp() {
      return battle.player.maxHp;
    },
    set maxHp(value) {
      battle.player.maxHp = value;
    },
    get infection() {
      return runState.infection;
    },
    set infection(value) {
      runState.infection = value;
    },
    world: runState.world,
  };
  item.apply(proxy);
  runState.consumables[itemId] -= 1;
  if (runState.consumables[itemId] <= 0) delete runState.consumables[itemId];
  const healed = battle.player.hp - hpBefore;
  return { ok: true, item, healed };
}
