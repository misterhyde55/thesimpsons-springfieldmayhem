const OUTLINE = '#1b1b1f';

function applyStatusRing(ctx, entity, radius) {
  if (entity.hasStatus && entity.hasStatus('poison')) {
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#7cff3a';
    ctx.beginPath();
    ctx.arc(entity.x, entity.y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (entity.hasStatus && entity.hasStatus('burn')) {
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ff8a2b';
    ctx.beginPath();
    ctx.arc(entity.x, entity.y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawFace(ctx, cx, cy, radius, facing, expression, hurtRatio) {
  const fx = Math.cos(facing);
  const fy = Math.sin(facing);
  const px = -fy;
  const py = fx;
  const forward = radius * 0.3;
  const perp = radius * 0.34;
  const baseX = cx + fx * forward;
  const baseY = cy + fy * forward;
  const eyeR = radius * 0.22;
  const pupilR = radius * 0.11;

  for (const side of [1, -1]) {
    const ex = baseX + px * perp * side;
    const ey = baseY + py * perp * side;

    ctx.beginPath();
    ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.lineWidth = Math.max(1, radius * 0.05);
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();

    const pupilX = ex + fx * eyeR * 0.35;
    const pupilY = ey + fy * eyeR * 0.35;
    ctx.beginPath();
    ctx.arc(pupilX, pupilY, pupilR, 0, Math.PI * 2);
    ctx.fillStyle = OUTLINE;
    ctx.fill();

    if (expression === 'angry') {
      ctx.beginPath();
      ctx.moveTo(ex - eyeR * side, ey - eyeR * 1.4);
      ctx.lineTo(ex + eyeR * side, ey - eyeR * 0.5);
      ctx.lineWidth = Math.max(2, radius * 0.09);
      ctx.strokeStyle = OUTLINE;
      ctx.lineCap = 'round';
      ctx.stroke();
    } else if (expression === 'alien') {
      const tipX = ex + px * side * radius * 0.3;
      const tipY = ey - radius * 0.55;
      ctx.beginPath();
      ctx.moveTo(ex, ey - eyeR);
      ctx.lineTo(tipX, tipY);
      ctx.lineWidth = Math.max(1.5, radius * 0.06);
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(tipX, tipY, radius * 0.09, 0, Math.PI * 2);
      ctx.fillStyle = OUTLINE;
      ctx.fill();
    }
  }

  const mx = cx + fx * radius * 0.1;
  const my = cy + fy * radius * 0.1 + radius * 0.36;
  ctx.lineWidth = Math.max(1.5, radius * 0.07);
  ctx.strokeStyle = OUTLINE;
  ctx.lineCap = 'round';
  if (hurtRatio !== undefined && hurtRatio < 0.3) {
    ctx.beginPath();
    ctx.arc(mx, my, radius * 0.14, 0, Math.PI * 2);
    ctx.fillStyle = OUTLINE;
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(mx - radius * 0.18, my);
    ctx.lineTo(mx + radius * 0.18, my);
    ctx.stroke();
  }
}

function drawCharacterEntity(ctx, entity) {
  ctx.beginPath();
  ctx.arc(entity.x, entity.y, entity.radius, 0, Math.PI * 2);
  ctx.fillStyle = entity.color;
  ctx.fill();
  ctx.lineWidth = Math.max(2.5, entity.radius * 0.16);
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  applyStatusRing(ctx, entity, entity.radius);
  const hurtRatio = entity.maxHp ? entity.hp / entity.maxHp : undefined;
  drawFace(ctx, entity.x, entity.y, entity.radius, entity.facing || 0, entity.expression || 'neutral', hurtRatio);
}

function drawBossEntity(ctx, boss) {
  const headRadius = boss.radius * 0.7;
  const offset = boss.radius * 0.55;
  const hurtRatio = boss.hp / boss.maxHp;
  for (const side of [-1, 1]) {
    const hx = boss.x + side * offset;
    const hy = boss.y;
    ctx.beginPath();
    ctx.arc(hx, hy, headRadius, 0, Math.PI * 2);
    ctx.fillStyle = boss.color;
    ctx.fill();
    ctx.lineWidth = Math.max(3, headRadius * 0.18);
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    drawFace(ctx, hx, hy, headRadius, boss.facing || 0, 'alien', hurtRatio);
  }
  applyStatusRing(ctx, boss, boss.radius);
}

function drawIconEntity(ctx, entity) {
  ctx.beginPath();
  ctx.arc(entity.x, entity.y, entity.radius, 0, Math.PI * 2);
  ctx.fillStyle = entity.color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  applyStatusRing(ctx, entity, entity.radius);
  if (entity.emoji) {
    ctx.font = `${Math.floor(entity.radius * 1.4)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(entity.emoji, entity.x, entity.y + 1);
  }
}

function drawProjectileEntity(ctx, entity) {
  ctx.beginPath();
  ctx.arc(entity.x, entity.y, entity.radius, 0, Math.PI * 2);
  ctx.fillStyle = entity.color;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
}

export function drawCircleEntity(ctx, entity) {
  ctx.save();
  if (entity.renderKind === 'pickup' || entity.renderKind === 'prop') {
    drawIconEntity(ctx, entity);
  } else if (entity.renderKind === 'projectile') {
    drawProjectileEntity(ctx, entity);
  } else if (entity.renderKind === 'boss') {
    drawBossEntity(ctx, entity);
  } else {
    drawCharacterEntity(ctx, entity);
  }
  ctx.restore();

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
