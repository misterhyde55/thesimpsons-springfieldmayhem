import { angleTo, angleDiff, distance, randRange } from '../engine/collision.js';

const RADIATION_STATUS = { kind: 'poison', duration: 3000, tickInterval: 500, dps: 4 };

export function maybeApplyRadiation(entity, chance) {
  if (chance > 0 && Math.random() < chance) entity.applyStatus(RADIATION_STATUS);
}

export function resolveMeleeAttack(attacker, weapon, damageMult, enemies, radiationChance = 0) {
  const arcRad = (weapon.arcDegrees * Math.PI) / 180;
  const hits = [];
  for (const enemy of enemies) {
    if (enemy.dead) continue;
    const d = distance(attacker, enemy);
    if (d > weapon.range + enemy.radius) continue;
    const ang = angleTo(attacker, enemy);
    if (angleDiff(ang, attacker.facing) > arcRad / 2) continue;
    enemy.takeDamage(weapon.damage * damageMult);
    if (weapon.appliesStatus) enemy.applyStatus(weapon.appliesStatus);
    maybeApplyRadiation(enemy, radiationChance);
    const kb = weapon.knockback || 0;
    enemy.x += Math.cos(ang) * kb * 0.15;
    enemy.y += Math.sin(ang) * kb * 0.15;
    hits.push(enemy);
  }
  return hits;
}

export function computeAimAngle(attacker, accuracyPenalty) {
  const spread = Math.max(0, -accuracyPenalty) * 0.6;
  return attacker.facing + randRange(-spread, spread);
}
