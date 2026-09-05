export function drawCircleEntity(ctx, entity) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(entity.x, entity.y, entity.radius, 0, Math.PI * 2);
  ctx.fillStyle = entity.color;
  ctx.fill();
  if (entity.hasStatus && entity.hasStatus('poison')) {
    ctx.strokeStyle = '#7cff3a';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  if (entity.hasStatus && entity.hasStatus('burn')) {
    ctx.strokeStyle = '#ff8a2b';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.restore();

  if (entity.emoji) {
    ctx.font = `${Math.floor(entity.radius * 1.5)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(entity.emoji, entity.x, entity.y + 1);
  }

  if (entity.maxHp && entity.hp < entity.maxHp) {
    const w = entity.radius * 2;
    const h = 5;
    const x = entity.x - entity.radius;
    const y = entity.y - entity.radius - 12;
    ctx.fillStyle = '#400';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#3ec24c';
    ctx.fillRect(x, y, w * Math.max(0, entity.hp / entity.maxHp), h);
  }
}

export function drawMeleeArc(ctx, origin, facing, range, arcRadians, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(origin.x, origin.y);
  ctx.arc(origin.x, origin.y, range, facing - arcRadians / 2, facing + arcRadians / 2);
  ctx.closePath();
  ctx.fillStyle = '#fff8ea';
  ctx.fill();
  ctx.restore();
}

export function drawText(ctx, text, x, y, { size = 16, color = '#fff', align = 'center' } = {}) {
  ctx.font = `bold ${size}px 'Segoe UI', Arial, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}
