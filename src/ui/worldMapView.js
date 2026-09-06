import { WORLD_LOCATIONS, getAllRoads, isRoadBlocked, getReachableLocationIds, START_LOCATION_ID } from '../data/worldMap.js';
import { getCurrentSegment, isBossLocationUnlocked } from '../systems/board.js';
import { LOCATIONS } from '../data/locations.js';

const MARGIN_X = 80;
const MARGIN_Y = 55;
const NODE_RADIUS = 34;
const OUTLINE = '#1b1b1f';

function pixelPos(canvas, id) {
  const loc = WORLD_LOCATIONS[id];
  return {
    x: MARGIN_X + loc.x * (canvas.width - MARGIN_X * 2),
    y: MARGIN_Y + loc.y * (canvas.height - MARGIN_Y * 2),
  };
}

// 'current' -- standing here right now. 'locked' -- reachable by road, but
// it's this segment's boss location and the map hasn't been explored
// enough yet (systems/board.js isBossLocationUnlocked). 'available' /
// 'visited-available' -- reachable and travelable. 'visited' -- been here
// this run, not reachable from here right now. 'unreachable' -- no direct
// road from the current location.
function nodeState(id, runState, reachableIds, segment, bossUnlocked) {
  const here = runState.world.currentLocationId || START_LOCATION_ID;
  if (id === here) return 'current';
  const visited = runState.world.visitedLocationIds.includes(id);
  const roadReachable = reachableIds.includes(id);
  const isBoss = id === segment.bossLocationId;
  if (roadReachable && isBoss && !bossUnlocked) return visited ? 'visited' : 'locked';
  if (roadReachable) return visited ? 'visited-available' : 'available';
  return visited ? 'visited' : 'unreachable';
}

function drawRoad(ctx, a, b, blocked) {
  ctx.save();
  ctx.strokeStyle = blocked ? '#4a2020' : '#6b6b73';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.strokeStyle = blocked ? '#d0021b' : '#f6d217';
  ctx.lineWidth = 3;
  ctx.setLineDash(blocked ? [4, 8] : [10, 10]);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  if (blocked) {
    ctx.save();
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🚫', (a.x + b.x) / 2, (a.y + b.y) / 2 + 7);
    ctx.restore();
  }
}

function drawNode(ctx, canvas, id, state, isBossLocation, flagText) {
  const pos = pixelPos(canvas, id);
  const loc = LOCATIONS[id];
  ctx.save();
  ctx.globalAlpha = state === 'unreachable' ? 0.45 : 1;

  const pulsing = state === 'available' || state === 'visited-available';
  if (pulsing) {
    const pulse = 6 + Math.sin(performance.now() / 220) * 3;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, NODE_RADIUS + pulse, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(246, 210, 23, 0.35)';
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(pos.x, pos.y, NODE_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = state === 'visited' || state === 'visited-available' ? '#3a4a3a' : '#26262e';
  ctx.fill();
  ctx.lineWidth = isBossLocation ? 4 : pulsing ? 4 : 2.5;
  ctx.strokeStyle = isBossLocation ? '#d0021b' : pulsing ? '#f6d217' : state === 'current' ? '#3ec2ff' : OUTLINE;
  ctx.stroke();

  ctx.font = `${NODE_RADIUS}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(loc.emoji, pos.x, pos.y + 1);

  ctx.font = '16px sans-serif';
  if (state === 'locked') {
    ctx.fillText('🔒', pos.x + NODE_RADIUS - 8, pos.y - NODE_RADIUS + 10);
  } else if (state === 'visited' || state === 'visited-available') {
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = '#3ec24c';
    ctx.fillText('✔', pos.x + NODE_RADIUS - 6, pos.y - NODE_RADIUS + 8);
  } else if (isBossLocation) {
    ctx.fillText('☠️', pos.x + NODE_RADIUS - 8, pos.y - NODE_RADIUS + 10);
  }

  ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#fff8ea';
  ctx.fillText(loc.name, pos.x, pos.y + NODE_RADIUS + 16);

  ctx.font = '11px "Segoe UI", Arial, sans-serif';
  if (flagText) {
    ctx.fillStyle = '#ff6b6b';
    ctx.fillText(flagText, pos.x, pos.y + NODE_RADIUS + 31);
  } else if (state === 'unreachable') {
    ctx.fillStyle = '#8a8a92';
    ctx.fillText('???', pos.x, pos.y + NODE_RADIUS + 31);
  } else if (state === 'locked') {
    ctx.fillStyle = '#8a8a92';
    ctx.fillText('explore more first', pos.x, pos.y + NODE_RADIUS + 31);
  }
  ctx.restore();
}

function drawMarker(ctx, pos) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(pos.x, pos.y - NODE_RADIUS - 14, 9, 0, Math.PI * 2);
  ctx.fillStyle = '#3ec2ff';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function renderWorldMap(canvas, runState, markerOverride) {
  const ctx = canvas.getContext('2d');
  const segment = getCurrentSegment(runState);
  const reachableIds = getReachableLocationIds(runState);
  const bossUnlocked = isBossLocationUnlocked(runState);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#2f4a2f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const [a, b] of getAllRoads()) {
    drawRoad(ctx, pixelPos(canvas, a), pixelPos(canvas, b), isRoadBlocked(runState, a, b));
  }

  for (const id of Object.keys(WORLD_LOCATIONS)) {
    const state = nodeState(id, runState, reachableIds, segment, bossUnlocked);
    drawNode(ctx, canvas, id, state, id === segment.bossLocationId, runState.world.locationFlags[id]);
  }

  const markerId = markerOverride || runState.world.currentLocationId || START_LOCATION_ID;
  drawMarker(ctx, pixelPos(canvas, markerId));
}

// Slides the marker from one location to another over `durationMs`,
// re-rendering the static map each frame, then calls onDone.
export function animateTravelMarker(canvas, runState, fromId, toId, durationMs, onDone) {
  const from = fromId ? pixelPos(canvas, fromId) : pixelPos(canvas, toId);
  const to = pixelPos(canvas, toId);
  const ctx = canvas.getContext('2d');
  const start = performance.now();

  function step(now) {
    const t = Math.min(1, (now - start) / durationMs);
    renderWorldMap(canvas, runState, null);
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;
    drawMarker(ctx, { x, y });
    if (t < 1) requestAnimationFrame(step);
    else onDone();
  }
  requestAnimationFrame(step);
}

export function findLocationAtPoint(canvas, px, py) {
  for (const id of Object.keys(WORLD_LOCATIONS)) {
    const pos = pixelPos(canvas, id);
    if (Math.hypot(px - pos.x, py - pos.y) <= NODE_RADIUS + 6) return id;
  }
  return null;
}
