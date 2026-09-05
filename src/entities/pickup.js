import { Entity } from '../engine/entity.js';
import { ITEMS } from '../data/items.js';

export class Pickup extends Entity {
  constructor({ x, y, kind, itemId }) {
    const emoji = kind === 'donut' ? '🍩' : ITEMS[itemId].emoji;
    super({ x, y, radius: 15, hp: 1, color: kind === 'donut' ? '#ffb6c1' : '#ffffff', emoji });
    this.kind = kind;
    this.itemId = itemId;
    this.bobPhase = Math.random() * Math.PI * 2;
  }
}
