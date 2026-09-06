import { getCurrentSegment } from '../systems/board.js';

const MARGIN_X = 70;
const MARGIN_Y = 50;
const NODE_RADIUS = 30;
const OUTLINE = '#1b1b1f';

const TYPE_BADGE = {
  combat: '⚔️',
  event: '❓',
  shop: '🛒',
  rest: '💤',
  boss: '💀',
};

const TYPE_LABEL = {
  combat: 'Combat',
  event: 'Event',
  shop: 'Shop',
  rest: 'Rest',
  boss: 'Boss',
};

const ELITE_BADGE = '☠️';

function nodePixelPos(canvas, node) {
  return {
    x: MARGIN_X + node.x * (canvas.width - MARGIN_X * 2),
    y: MARGIN_Y + node.y * (canvas.height - MARGIN_Y * 2),
  };
}

function nodeState(node, runState, availableIds) {
  if (runState.completedNodeIds.has(node.id)) return 'completed';
  if (availableIds.includes(node.id)) return 'available';
  return 'locked';
}

function drawRoad(ctx, a, b, dimmed) {
  ctx.save();
  ctx.globalAlpha = dimmed ? 0.35 : 1;
  ctx.strokeStyle = '#6b6b73';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.strokeStyle = '#f6d217';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 10]);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawNode(ctx, canvas, node, state) {
  const pos = nodePixelPos(canvas, node);
  ctx.save();
  ctx.globalAlpha = state === 'locked' ? 0.4 : 1;

  if (state === 'available') {
    const pulse = 6 + Math.sin(performance.now() / 220) * 3;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, NODE_RADIUS + pulse, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(246, 210, 23, 0.35)';
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(pos.x, pos.y, NODE_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = state === 'completed' ? '#3a4a3a' : '#26262e';
  ctx.fill();
  ctx.lineWidth = node.elite ? 4 : state === 'available' ? 4 : 2.5;
  ctx.strokeStyle = node.elite ? '#d0021b' : state === 'available' ? '#f6d217' : OUTLINE;
  ctx.stroke();

  ctx.font = `${NODE_RADIUS}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(node.emoji, pos.x, pos.y + 1);

  if (state === 'completed') {
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = '#3ec24c';
    ctx.fillText('✔', pos.x + NODE_RADIUS - 6, pos.y - NODE_RADIUS + 8);
  } else {
    ctx.font = '14px sans-serif';
    ctx.fillText(node.elite ? ELITE_BADGE : TYPE_BADGE[node.type] || '', pos.x + NODE_RADIUS - 4, pos.y - NODE_RADIUS + 6);
  }

  ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#fff8ea';
  ctx.textAlign = 'center';
  ctx.fillText(node.name, pos.x, pos.y + NODE_RADIUS + 16);
  ctx.font = '11px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#c9c9d3';
  ctx.fillText(node.elite ? 'Elite Combat' : TYPE_LABEL[node.type] || '', pos.x, pos.y + NODE_RADIUS + 30);

  ctx.restore();
}

export function renderBoard(canvas, runState, markerOverride) {
  const ctx = canvas.getContext('2d');
  const segment = getCurrentSegment(runState);
  const availableIds = runState.boardPosition === null
    ? [segment.startNodeId]
    : segment.nodes[runState.boardPosition].next;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#3a5a3a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const nodes = Object.values(segment.nodes);
  for (const node of nodes) {
    const from = nodePixelPos(canvas, node);
    for (const nextId of node.next) {
      const next = segment.nodes[nextId];
      const dimmed = !(runState.completedNodeIds.has(node.id) || (runState.boardPosition === null && node.id === segment.startNodeId));
      drawRoad(ctx, from, nodePixelPos(canvas, next), dimmed);
    }
  }

  for (const node of nodes) {
    drawNode(ctx, canvas, node, nodeState(node, runState, availableIds));
  }

  const markerNodeId = markerOverride || runState.boardPosition;
  if (markerNodeId) {
    const pos = nodePixelPos(canvas, segment.nodes[markerNodeId]);
    ctx.save();
    ctx.beginPath();
    ctx.arc(pos.x, pos.y - NODE_RADIUS - 14, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#f6d217';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

// Slides the player marker from one node to another over `durationMs`,
// re-rendering the static board each frame, then calls onDone.
export function animateMarkerMove(canvas, runState, fromNodeId, toNodeId, durationMs, onDone) {
  const segment = getCurrentSegment(runState);
  const from = fromNodeId ? nodePixelPos(canvas, segment.nodes[fromNodeId]) : nodePixelPos(canvas, segment.nodes[toNodeId]);
  const to = nodePixelPos(canvas, segment.nodes[toNodeId]);
  const ctx = canvas.getContext('2d');
  const start = performance.now();

  function step(now) {
    const t = Math.min(1, (now - start) / durationMs);
    renderBoard(canvas, runState, null);
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y - NODE_RADIUS - 14, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#f6d217';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    if (t < 1) requestAnimationFrame(step);
    else onDone();
  }
  requestAnimationFrame(step);
}

export function findNodeAtPoint(canvas, runState, px, py) {
  const segment = getCurrentSegment(runState);
  for (const node of Object.values(segment.nodes)) {
    const pos = nodePixelPos(canvas, node);
    if (Math.hypot(px - pos.x, py - pos.y) <= NODE_RADIUS + 6) return node;
  }
  return null;
}
