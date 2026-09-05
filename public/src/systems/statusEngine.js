import { STATUS, DECAYING_ON_OWN_TURN } from '../data/statusEffects.js';

// A "combatant" is either battle.player or one of battle.enemies -- both
// shapes carry a plain `statuses` map of STATUS id -> stack count, so this
// module doesn't need to know which side it's operating on.
export function getStatus(combatant, statusId) {
  return combatant.statuses[statusId] || 0;
}

export function addStatus(combatant, statusId, amount) {
  if (!amount) return;
  combatant.statuses[statusId] = Math.max(0, getStatus(combatant, statusId) + amount);
}

export function clearStatus(combatant, statusId) {
  combatant.statuses[statusId] = 0;
}

// Applies Strength/Weak to a raw ability damage value on the way out.
export function computeOutgoingDamage(source, baseDamage) {
  if (baseDamage <= 0) return 0;
  let damage = baseDamage + getStatus(source, STATUS.STRENGTH);
  if (getStatus(source, STATUS.WEAK) > 0) damage *= 0.75;
  return Math.max(0, Math.round(damage));
}

// Applies Vulnerable, then Dodge, then Armor to incoming damage, mutating
// the target's HP/Armor/Dodge in place. Returns how much actually landed on
// HP (for damage-number popups) and whether it was dodged, for the caller
// to decide what to animate.
export function applyIncomingDamage(target, rawDamage) {
  if (rawDamage <= 0) return { dealt: 0, dodged: false };
  let damage = rawDamage;
  if (getStatus(target, STATUS.TIPSY) > 0) damage *= 1 + getStatus(target, STATUS.TIPSY) * 0.1;
  if (getStatus(target, STATUS.VULNERABLE) > 0) damage *= 1.5;
  damage = Math.round(damage);

  if (getStatus(target, STATUS.DODGE) > 0) {
    addStatus(target, STATUS.DODGE, -1);
    return { dealt: 0, dodged: true };
  }

  const armor = getStatus(target, STATUS.ARMOR);
  const absorbed = Math.min(armor, damage);
  if (absorbed > 0) addStatus(target, STATUS.ARMOR, -absorbed);
  const toHp = damage - absorbed;
  target.hp = Math.max(0, target.hp - toHp);
  return { dealt: toHp, dodged: false };
}

export function heal(target, amount) {
  if (amount <= 0) return 0;
  const before = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + amount);
  return target.hp - before;
}

// Called at the start of a combatant's own turn: decays Weak/Vulnerable,
// and reports (then consumes) a Stun so the caller can skip that turn.
export function tickTurnStart(combatant) {
  for (const statusId of DECAYING_ON_OWN_TURN) {
    if (getStatus(combatant, statusId) > 0) addStatus(combatant, statusId, -1);
  }
  const stunned = getStatus(combatant, STATUS.STUN) > 0;
  if (stunned) clearStatus(combatant, STATUS.STUN);
  return { stunned };
}

// Called at the end of a combatant's own turn: Poison/Infection ticks
// damage equal to its stacks, then decays by 1. Returns the damage dealt
// (0 if none) so the caller can show a popup and check for death.
export function tickTurnEnd(combatant) {
  const poison = getStatus(combatant, STATUS.POISON);
  if (poison <= 0) return 0;
  combatant.hp = Math.max(0, combatant.hp - poison);
  addStatus(combatant, STATUS.POISON, -1);
  return poison;
}
