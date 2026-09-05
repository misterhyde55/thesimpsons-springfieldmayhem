import { Entity } from '../engine/entity.js';

export class Projectile extends Entity {
  constructor({ x, y, vx, vy, radius, damage, color, owner, pierce = false, appliesStatus = null, knockback = 0 }) {
    super({ x, y, radius, hp: 1, color });
    this.vx = vx;
    this.vy = vy;
    this.damage = damage;
    this.owner = owner;
    this.pierce = pierce;
    this.appliesStatus = appliesStatus;
    this.knockback = knockback;
    this.hitEntityIds = new Set();
    this.renderKind = 'projectile';
  }

  update(dt, bounds) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.x < -40 || this.x > bounds.width + 40 || this.y < -40 || this.y > bounds.height + 40) {
      this.dead = true;
    }
  }
}
