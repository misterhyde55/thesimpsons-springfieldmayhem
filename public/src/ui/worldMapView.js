// The Springfield map is the real Springfieldmap2.png artwork -- not a
// canvas drawing, not a CSS approximation. `.map-world` (index.html) holds
// the `<img>` at its natural 1594x986 size plus an SVG road layer and a DOM
// hotspot layer, all positioned with plain percentages against that same
// 1594x986 box; pan/zoom then just transforms `.map-world` as a whole
// (translate + scale), so every hotspot/road stays glued to the art at any
// pan/zoom without ever recomputing its own position. Homer's marker is a
// real element too, animated between locations via a CSS transition on
// left/top rather than a per-frame redraw loop -- nothing here runs on a
// requestAnimationFrame loop the way the old canvas board did.
import { WORLD_LOCATIONS, getAllRoads, isRoadBlocked, getReachableLocationIds, START_LOCATION_ID } from '../data/worldMap.js';
import { getCurrentSegment, isBossLocationUnlocked } from '../systems/board.js';
import { LOCATIONS } from '../data/locations.js';
import { getAssetUrl } from '../data/assets.js';

const MAP_WIDTH = 1594;
const MAP_HEIGHT = 986;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
const START_ZOOM = 1.5;

let dom = null;
let camera = { x: 0, y: 0, zoom: START_ZOOM };
let dragState = null;
let hotspotEls = {}; // locationId -> {root, pin, label}
let clickHandler = null;
let cameraSettledHandler = null;
let cameraSaveTimer = null;

// Debounced so a wheel-zoom flurry or an active drag doesn't spam
// saveActiveRun -- fires ~400ms after the camera stops moving.
function scheduleCameraSettled() {
  if (!cameraSettledHandler) return;
  clearTimeout(cameraSaveTimer);
  cameraSaveTimer = setTimeout(() => cameraSettledHandler(getCameraState()), 400);
}

function pct(n) {
  return `${(n * 100).toFixed(3)}%`;
}

function clampZoom(z) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

function applyCameraTransform() {
  dom.world.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`;
}

export function getCameraState() {
  return { ...camera };
}

export function setCameraState(state) {
  if (!state) return;
  camera = { x: state.x ?? camera.x, y: state.y ?? camera.y, zoom: clampZoom(state.zoom ?? camera.zoom) };
  if (dom) applyCameraTransform();
}

function centerCameraOn(locationId, zoom) {
  const loc = WORLD_LOCATIONS[locationId];
  const rect = dom.viewport.getBoundingClientRect();
  const targetZoom = clampZoom(zoom ?? camera.zoom);
  const worldX = loc.x * MAP_WIDTH;
  const worldY = loc.y * MAP_HEIGHT;
  camera = {
    zoom: targetZoom,
    x: rect.width / 2 - worldX * targetZoom,
    y: rect.height / 2 - worldY * targetZoom,
  };
  applyCameraTransform();
}

// Called once when a fresh episode starts -- "camera should start focused
// around the Simpsons House... do not immediately show the entire map."
export function focusCameraOnStart() {
  centerCameraOn(START_LOCATION_ID, START_ZOOM);
}

// The zoom-reset (home) button and any other "recenter on where I am now" call.
export function resetViewToCurrentLocation(runState) {
  centerCameraOn(runState.world.currentLocationId || START_LOCATION_ID, START_ZOOM);
}

function zoomAtPoint(clientX, clientY, factor) {
  const rect = dom.viewport.getBoundingClientRect();
  const px = clientX - rect.left;
  const py = clientY - rect.top;
  const newZoom = clampZoom(camera.zoom * factor);
  if (newZoom === camera.zoom) return;
  const worldX = (px - camera.x) / camera.zoom;
  const worldY = (py - camera.y) / camera.zoom;
  camera = {
    zoom: newZoom,
    x: px - worldX * newZoom,
    y: py - worldY * newZoom,
  };
  applyCameraTransform();
}

export function zoomIn() {
  const rect = dom.viewport.getBoundingClientRect();
  zoomAtPoint(rect.left + rect.width / 2, rect.top + rect.height / 2, 1.25);
  scheduleCameraSettled();
}

export function zoomOut() {
  const rect = dom.viewport.getBoundingClientRect();
  zoomAtPoint(rect.left + rect.width / 2, rect.top + rect.height / 2, 0.8);
  scheduleCameraSettled();
}

function onPointerMove(e) {
  if (!dragState) return;
  const dx = e.clientX - dragState.startX;
  const dy = e.clientY - dragState.startY;
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragState.moved = true;
  camera = { ...camera, x: dragState.camX + dx, y: dragState.camY + dy };
  applyCameraTransform();
}

function onPointerUp() {
  dragState = null;
  dom.viewport.classList.remove('is-panning');
  document.removeEventListener('pointermove', onPointerMove);
  document.removeEventListener('pointerup', onPointerUp);
  scheduleCameraSettled();
}

function bindPanZoom() {
  dom.viewport.addEventListener('pointerdown', (e) => {
    // A hotspot handles its own click -- don't start a background drag on it.
    if (e.target.closest && e.target.closest('.map-hotspot')) return;
    if (e.button !== undefined && e.button !== 0) return;
    dragState = { startX: e.clientX, startY: e.clientY, camX: camera.x, camY: camera.y, moved: false };
    dom.viewport.classList.add('is-panning');
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  });
  dom.viewport.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      zoomAtPoint(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 0.89);
      scheduleCameraSettled();
    },
    { passive: false }
  );
}

function buildRoads() {
  dom.roadsSvg.setAttribute('viewBox', `0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`);
}

function renderRoads(runState) {
  const svg = dom.roadsSvg;
  svg.innerHTML = '';
  for (const [a, b] of getAllRoads()) {
    const posA = WORLD_LOCATIONS[a];
    const posB = WORLD_LOCATIONS[b];
    const blocked = isRoadBlocked(runState, a, b);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', posA.x * MAP_WIDTH);
    line.setAttribute('y1', posA.y * MAP_HEIGHT);
    line.setAttribute('x2', posB.x * MAP_WIDTH);
    line.setAttribute('y2', posB.y * MAP_HEIGHT);
    line.setAttribute('stroke', blocked ? '#d0021b' : '#f6d217');
    line.setAttribute('stroke-width', '5');
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('stroke-dasharray', blocked ? '10 14' : '2 18');
    line.setAttribute('opacity', blocked ? '0.6' : '0.55');
    svg.appendChild(line);
  }
}

function buildHotspots(handlers) {
  dom.hotspotsLayer.innerHTML = '';
  hotspotEls = {};
  for (const id of Object.keys(WORLD_LOCATIONS)) {
    const loc = WORLD_LOCATIONS[id];
    const info = LOCATIONS[id];
    const root = document.createElement('div');
    root.className = 'map-hotspot';
    root.style.left = pct(loc.x);
    root.style.top = pct(loc.y);
    root.innerHTML = `<div class="map-hotspot-pin">${info.emoji}</div><div class="map-hotspot-label">${info.name}</div>`;
    root.addEventListener('pointerup', (e) => {
      e.stopPropagation();
      if (clickHandler) clickHandler(id);
    });
    root.addEventListener('pointerenter', () => handlers.onHotspotHover(id));
    root.addEventListener('pointerleave', () => handlers.onHotspotHover(null));
    dom.hotspotsLayer.appendChild(root);
    hotspotEls[id] = { root, pin: root.querySelector('.map-hotspot-pin') };
  }
}

function nodeStateClass(id, runState, reachableIds, segment, bossUnlocked) {
  const here = runState.world.currentLocationId || START_LOCATION_ID;
  if (id === here) return 'state-current';
  const visited = runState.world.visitedLocationIds.includes(id);
  const roadReachable = reachableIds.includes(id);
  const isBoss = id === segment.bossLocationId;
  if (roadReachable && isBoss && !bossUnlocked) return visited ? 'state-visited' : 'state-locked';
  if (roadReachable) return visited ? 'state-visited-available' : 'state-available';
  return visited ? 'state-visited' : 'state-unreachable';
}

function moveHomerMarker(locationId) {
  const loc = WORLD_LOCATIONS[locationId];
  dom.homerMarker.style.left = pct(loc.x);
  dom.homerMarker.style.top = pct(loc.y);
}

export function hotspotInfo(locationId, runState) {
  const loc = LOCATIONS[locationId];
  const segment = getCurrentSegment(runState);
  const visited = runState.world.visitedLocationIds.includes(locationId);
  const isBoss = locationId === segment.bossLocationId;
  const flag = runState.world.locationFlags[locationId];
  const bits = [];
  bits.push(visited ? 'VISITED' : 'NOT VISITED YET');
  if (isBoss) bits.push('☠ BOSS LOCATION');
  if (typeof flag === 'string') bits.push(flag.toUpperCase());
  return { name: loc.name, status: bits.join(' • ') };
}

// Mounted once (from game.js's constructor) -- rebuilding the hotspot/road
// DOM every board visit would be wasteful since neither the art nor the
// location registry changes mid-session, only their *state* does (see
// renderMap, called on every board entry and after anything that changes
// the map).
export function mountMapView(handlers) {
  if (dom) return;
  dom = {
    viewport: document.getElementById('map-viewport'),
    world: document.getElementById('map-world'),
    image: document.getElementById('map-image'),
    roadsSvg: document.getElementById('map-roads'),
    hotspotsLayer: document.getElementById('map-hotspots'),
    homerMarker: document.getElementById('map-homer-marker'),
    homerPortrait: document.getElementById('map-homer-portrait'),
    hoverPanel: document.getElementById('map-hover-panel'),
  };
  clickHandler = handlers.onHotspotClick;
  cameraSettledHandler = handlers.onCameraSettled || null;
  dom.image.src = getAssetUrl('ui', 'springfieldMap') || '';
  buildRoads();
  buildHotspots({
    onHotspotHover: (locationId) => handlers.onHotspotHover(locationId),
  });
  bindPanZoom();
  document.getElementById('btn-map-zoom-in').addEventListener('click', () => zoomIn());
  document.getElementById('btn-map-zoom-out').addEventListener('click', () => zoomOut());
  document.getElementById('btn-map-zoom-reset').addEventListener('click', () => handlers.onZoomReset());
}

// Refreshes every hotspot's visible state, the road layer, and Homer's
// marker/portrait against the current runState -- call this whenever the
// board screen is (re)entered and there is nothing already animating
// (travelHomerMarker below handles the one time there is: mid-travel).
export function renderMap(runState) {
  const segment = getCurrentSegment(runState);
  const reachableIds = getReachableLocationIds(runState);
  const bossUnlocked = isBossLocationUnlocked(runState);

  for (const [id, els] of Object.entries(hotspotEls)) {
    const state = nodeStateClass(id, runState, reachableIds, segment, bossUnlocked);
    els.root.className = `map-hotspot ${state}${id === segment.bossLocationId ? ' is-boss' : ''}`;
  }
  renderRoads(runState);

  const homerPortraitUrl = getAssetUrl('characters', runState.character.id);
  if (homerPortraitUrl) dom.homerPortrait.src = homerPortraitUrl;
  moveHomerMarker(runState.world.currentLocationId || START_LOCATION_ID);
}

export function showHoverPanel(locationId, runState) {
  if (!locationId) {
    dom.hoverPanel.classList.add('hidden');
    return;
  }
  const info = hotspotInfo(locationId, runState);
  dom.hoverPanel.innerHTML = `<div class="map-hover-panel-name">${info.name}</div><div class="map-hover-panel-status">${info.status}</div>`;
  dom.hoverPanel.classList.remove('hidden');
}

// Slides Homer's marker to the destination via the CSS transition already
// on .map-homer-marker (index.html/style.css), then calls onDone -- the
// direct replacement for the old canvas animateTravelMarker.
export function travelHomerMarker(toId, durationMs, onDone) {
  moveHomerMarker(toId);
  setTimeout(onDone, durationMs);
}
