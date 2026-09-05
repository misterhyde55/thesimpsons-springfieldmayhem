import { Entity } from '../engine/entity.js';
import { angleTo } from '../engine/collision.js';

function getPhase(boss) {
  const hpPct = boss.hp / boss.maxHp;
  for (const phase of boss.template.phases) {
    if (hpPct > phase.minHpPct) return phase;
  }
  return boss.template.phases[boss.template.phases.length - 1];
}

export class Boss extends Entity {
  constructor(template, x, y) {
    super({ x, y, radius: template.radius, hp: template.hp, color: template.color, emoji: template.emoji });
    this.template = template;
    this.name = template.name;
    this.speed = template.speed;
    this.contactDamage = template.contactDamage;
    this.attackTimer = 1200;
    this.contactCooldown = 0;
  }

  /** Moves toward the player, ticks its attack timer, and returns an attack name
   * ('charge' | 'spreadBlast' | 'summon') when it's time to fire one, else null. */
  update(dt, player) {
    if (this.dead) return null;
    this.updateStatusEffects(dt * 1000);
    const ang = angleTo(this, player);
    this.facing = ang;
    this.x += Math.cos(ang) * this.speed * dt * 0.5;
    this.y += Math.sin(ang) * this.speed * dt * 0.5;
    if (this.contactCooldown > 0) this.contactCooldown -= dt * 1000;

    const phase = getPhase(this);
    this.attackTimer -= dt * 1000;
    if (this.attackTimer <= 0) {
      this.attackTimer = phase.attackInterval;
      return phase.attacks[Math.floor(Math.random() * phase.attacks.length)];
    }
    return null;
  }
}
