import { STATUS, DECAYING_ON_OWN_TURN, DOT_STATUSES } from '../data/statusEffects.js';

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
  if (getStatus(target, STATUS.SOAKED) > 0) damage *= 1.25;
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
  const effective = getStatus(target, STATUS.CURSED) > 0 ? Math.floor(amount / 2) : amount;
  const before = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + effective);
  return target.hp - before;
}

// Armor specifically (not the generic addStatus) so Slimed's penalty lives
// in one place -- everything that grants Block/Armor should route through
// this rather than calling addStatus(ARMOR, ...) directly.
export function gainArmor(target, amount) {
  if (amount <= 0) return;
  const effective = getStatus(target, STATUS.SLIMED) > 0 ? Math.floor(amount / 2) : amount;
  addStatus(target, STATUS.ARMOR, effective);
}

// Max Energy after Terrified/Exhausted reduce it, floored at 1 so a
// debuffed combatant can never be locked out of acting entirely.
export function effectiveMaxEnergy(combatant, baseMaxEnergy) {
  const reduction = (getStatus(combatant, STATUS.TERRIFIED) > 0 ? 1 : 0) + getStatus(combatant, STATUS.EXHAUSTED);
  return Math.max(1, baseMaxEnergy - reduction);
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

// Called at the end of a combatant's own turn: every DoT status (Poison,
// Burning, Bleeding) ticks damage equal to its own stack count, then
// decays by 1. Returns the total damage dealt (0 if none) so the caller
// can show a popup and check for death.
export function tickTurnEnd(combatant) {
  let total = 0;
  for (const statusId of DOT_STATUSES) {
    const stacks = getStatus(combatant, statusId);
    if (stacks <= 0) continue;
    combatant.hp = Math.max(0, combatant.hp - stacks);
    addStatus(combatant, statusId, -1);
    total += stacks;
  }
  return total;
}
