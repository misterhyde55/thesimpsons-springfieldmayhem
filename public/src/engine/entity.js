let nextId = 1;

export class Entity {
  constructor({ x, y, radius, hp, color = '#fff', emoji = '', facing = 0 }) {
    this.id = nextId++;
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.maxHp = hp;
    this.hp = hp;
    this.color = color;
    this.emoji = emoji;
    this.facing = facing;
    this.dead = false;
    this.statusEffects = [];
  }

  takeDamage(amount) {
    if (this.dead) return;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
    }
  }

  applyStatus(effect) {
    this.statusEffects.push({ ...effect, elapsed: 0 });
  }

  updateStatusEffects(dt) {
    for (const effect of this.statusEffects) {
      effect.elapsed += dt;
      if (effect.tickInterval) {
        effect.sinceTick = (effect.sinceTick || 0) + dt;
        if (effect.sinceTick >= effect.tickInterval) {
          effect.sinceTick -= effect.tickInterval;
          if (effect.dps) this.takeDamage(effect.dps);
        }
      }
    }
    this.statusEffects = this.statusEffects.filter((e) => e.elapsed < e.duration);
  }

  hasStatus(kind) {
    return this.statusEffects.some((e) => e.kind === kind);
  }
}
