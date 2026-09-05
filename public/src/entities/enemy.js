import { Entity } from '../engine/entity.js';
import { angleTo, distance, randRange } from '../engine/collision.js';
import { getAssetUrl } from '../data/assets.js';
import { loadImage } from '../engine/assetLoader.js';

export class Enemy extends Entity {
  constructor(template, x, y) {
    super({ x, y, radius: template.radius, hp: template.hp, color: template.color, emoji: template.emoji });
    this.template = template;
    this.name = template.name;
    this.contactDamage = template.contactDamage;
    this.speed = template.speed;
    this.behavior = template.behavior || 'chase';
    this.contactCooldown = 0;
    this.shootCooldown = template.shootCooldown ? randRange(400, template.shootCooldown) : 0;
    this.isProp = !!template.isProp;
    this.renderKind = this.isProp ? 'prop' : 'enemy';
    this.expression = template.scenario === 'alienInvasion' ? 'alien' : 'angry';
    this.spriteUrl = getAssetUrl(this.isProp ? 'buildings' : 'enemies', template.id);
    loadImage(this.spriteUrl);
  }

  update(dt, player, onShoot) {
    if (this.dead) return;
    this.updateStatusEffects(dt * 1000);
    if (this.behavior === 'static') return;

    const ang = angleTo(this, player);
    this.facing = ang;

    if (this.behavior === 'chaseShoot') {
      const d = distance(this, player);
      if (d > this.template.shootRange * 0.55) {
        this.x += Math.cos(ang) * this.speed * dt;
        this.y += Math.sin(ang) * this.speed * dt;
      }
      this.shootCooldown -= dt * 1000;
      if (d <= this.template.shootRange && this.shootCooldown <= 0) {
        this.shootCooldown = this.template.shootCooldown;
        onShoot(this, ang);
      }
    } else {
      this.x += Math.cos(ang) * this.speed * dt;
      this.y += Math.sin(ang) * this.speed * dt;
    }

    if (this.contactCooldown > 0) this.contactCooldown -= dt * 1000;
  }
}

export function makeMoeJukeboxProp(x, y) {
  return new Enemy(
    {
      name: "Moe's Jukebox",
      emoji: '🎵',
      hp: 40,
      speed: 0,
      contactDamage: 0,
      radius: 18,
      color: '#c9a86a',
      behavior: 'static',
      isProp: true,
    },
    x,
    y
  );
}
