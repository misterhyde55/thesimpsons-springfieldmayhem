export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function circlesOverlap(a, b) {
  return distance(a, b) < a.radius + b.radius;
}

export function angleTo(from, to) {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

export function angleDiff(a, b) {
  let diff = a - b;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.abs(diff);
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function randRange(min, max) {
  return min + Math.random() * (max - min);
}

export function pickWeighted(entries) {
  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * total;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) return entry;
  }
  return entries[entries.length - 1];
}

export function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}
