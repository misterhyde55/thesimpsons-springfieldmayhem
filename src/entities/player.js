import { Entity } from '../engine/entity.js';
import { WEAPONS } from '../data/weapons.js';
import { clamp } from '../engine/collision.js';
import { PLAYER_START } from '../engine/config.js';
import { getAssetUrl } from '../data/assets.js';
import { loadImage } from '../engine/assetLoader.js';
import { getTimedBuffTotal } from '../systems/timedBuffs.js';

export class Player extends Entity {
  constructor(character, runState) {
    super({
      x: PLAYER_START.x,
      y: PLAYER_START.y,
      radius: character.radius,
      hp: runState.hp,
      color: character.color,
      emoji: character.emoji,
    });
    this.character = character;
    this.runState = runState;
    this.renderKind = 'player';
    this.expression = 'player';
    this.spriteUrl = getAssetUrl('characters', character.id);
    loadImage(this.spriteUrl);
    this.maxHp = runState.maxHp;
    this.hp = Math.min(runState.hp, runState.maxHp);
    this.attackCooldownRemaining = 0;
    this.fireAuraTick = 0;
    this.blinkyTick = 0;
  }

  get weapon() {
    return WEAPONS[this.runState.weaponId];
  }

  get moveSpeed() {
    const speedMult = this.runState.buffs.speedMult + getTimedBuffTotal(this.runState, 'speedMult');
    return this.character.moveSpeed * Math.max(0.25, 1 + speedMult);
  }

  get damageMult() {
    const damageMult = this.runState.buffs.damageMult + getTimedBuffTotal(this.runState, 'damageMult');
    return Math.max(0.2, 1 + damageMult);
  }

  get accuracy() {
    return this.runState.buffs.accuracy;
  }

  canAttack() {
    return this.attackCooldownRemaining <= 0;
  }

  triggerAttackCooldown() {
    const cooldownMult = Math.max(0.3, 1 + getTimedBuffTotal(this.runState, 'cooldownMult'));
    this.attackCooldownRemaining = this.weapon.cooldown * cooldownMult;
  }

  takeDamage(amount) {
    if (this.dead) return;
    let remaining = amount;
    if (this.runState.armorShield > 0) {
      const absorbed = Math.min(this.runState.armorShield, remaining);
      this.runState.armorShield -= absorbed;
      remaining -= absorbed;
    }
    super.takeDamage(remaining);
  }

  update(dt, input, bounds) {
    const axis = input.axis();
    this.x = clamp(this.x + axis.x * this.moveSpeed * dt, this.radius, bounds.width - this.radius);
    this.y = clamp(this.y + axis.y * this.moveSpeed * dt, this.radius, bounds.height - this.radius);
    if (input.mouse.x || input.mouse.y) {
      this.facing = Math.atan2(input.mouse.y - this.y, input.mouse.x - this.x);
    }
    if (this.attackCooldownRemaining > 0) this.attackCooldownRemaining -= dt * 1000;
    this.updateStatusEffects(dt * 1000);
    this.maxHp = this.runState.maxHp;
    this.runState.hp = this.hp;
  }
}
