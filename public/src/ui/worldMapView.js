// The Springfield map is the real SpringfieldMap_Clean.png artwork -- pure
// environment art (buildings/roads/trees/water, no baked UI at all), not a
// canvas drawing, not a CSS approximation. `.map-world` (index.html) holds
// the `<img>` at its natural 1594x987 size plus an SVG road layer and a DOM
// hotspot layer, all positioned with plain percentages against that same
// box; pan/zoom then just transforms `.map-world` as a whole (translate +
// scale), so every hotspot/road stays glued to the art at any pan/zoom
// without ever recomputing its own position. Homer's marker is a real
// element too, animated between locations via a CSS transition on left/top
// rather than a per-frame redraw loop -- nothing here runs on a
// requestAnimationFrame loop the way the old canvas board did.
import { WORLD_LOCATIONS, getAllRoads, isRoadBlocked, getReachableLocationIds, START_LOCATION_ID, roadKey } from '../data/worldMap.js';
import { getRouteWaypoints } from '../data/mapRoutes.js';
import { getCurrentSegment, isBossLocationUnlocked } from '../systems/board.js';
import { LOCATIONS } from '../data/locations.js';
import { getAssetUrl } from '../data/assets.js';
import { getCurrentObjective, getActiveQuestsSummary } from '../data/quests.js';
import { mayhemLabel } from '../data/episodes.js';

const SIDEBAR_COLLAPSE_KEY = 'springfieldMayhem.mapSidebarCollapsed';

const MAP_WIDTH = 1594;
const MAP_HEIGHT = 987;
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

// ---- Route reveal state -- "NO paths when nothing is selected; hovering
// or selecting a reachable location draws ONLY that one route" (map-rebuild
// spec). Selecting (a location the player clicked into the inspect panel)
// wins over merely hovering something else, so the route the player is
// actually deciding about doesn't flicker away while they move the mouse
// toward the TRAVEL button. ----
let hoveredLocationId = null;
let selectedLocationId = null;

let lastRunState = null; // so the sidebar/hover panel can re-render without game.js re-driving it
let sidebarHandlers = null; // {onShowLocation, onViewQuests} -- set once in mountMapView

// ==================== MAP EDIT MODE (dev-only, Ctrl+Shift+M) ====================
// "DO NOT GUESS BUILDING POSITIONS FOREVER. Give me tools to calibrate
// them." WORLD_LOCATIONS is a plain module-level object -- mutating it here
// live-updates every consumer (renderMap, renderRoute, ...) immediately,
// which is exactly the point; nothing here ever touches runState or
// localStorage, so a reload always comes back to the real source-file
// values. `editOriginalLocations` snapshots those values the moment edit
// mode turns on, purely so Export Config can diff and only print what
// actually changed instead of dumping all 16 locations every time.
const EDIT_MODE_KEY = 'springfieldMayhem.mapEditMode';
let editMode = false;
let editOriginalLocations = null;
let editRouteOverrides = {}; // roadKey -> [{x,y}, ...], recorded this session
let editSelectedId = null;
let editDragState = null; // {id, startX, startY, origX, origY, moved} while dragging a pin
let editRecording = null; // {from, to, waypoints: [{x,y}, ...]} while recording

function pointerToNormalized(clientX, clientY) {
  const rect = dom.viewport.getBoundingClientRect();
  const px = clientX - rect.left;
  const py = clientY - rect.top;
  const worldX = (px - camera.x) / camera.zoom;
  const worldY = (py - camera.y) / camera.zoom;
  return { x: worldX / MAP_WIDTH, y: worldY / MAP_HEIGHT };
}

function getEffectiveWaypoints(a, b) {
  return editRouteOverrides[roadKey(a, b)] || getRouteWaypoints(a, b);
}

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

// The map must never show a gap around the art (no blank gutters) --
// so the effective minimum zoom is whatever "covers" the current
// viewport in both dimensions (like CSS background-size:cover), not a
// fixed constant. A phone-sized viewport and an ultrawide monitor need
// different minimums; this recomputes it from the real viewport every
// time instead of guessing one number that only works for one screen.
function minZoomForViewport() {
  if (!dom) return MIN_ZOOM;
  const rect = dom.viewport.getBoundingClientRect();
  if (!rect.width || !rect.height) return MIN_ZOOM;
  return Math.max(MIN_ZOOM, rect.width / MAP_WIDTH, rect.height / MAP_HEIGHT);
}

function clampZoom(z) {
  return Math.min(MAX_ZOOM, Math.max(minZoomForViewport(), z));
}

// Keeps the scaled image's edges at or beyond the viewport's edges on
// every side, at the current zoom -- the general fix for the "blank
// black bar" bug: any pan/zoom that would reveal the raw viewport
// background past the art's edge gets pulled back in instead.
function clampCameraPosition(cam) {
  if (!dom) return cam;
  const rect = dom.viewport.getBoundingClientRect();
  const scaledW = MAP_WIDTH * cam.zoom;
  const scaledH = MAP_HEIGHT * cam.zoom;
  const minX = Math.min(0, rect.width - scaledW);
  const minY = Math.min(0, rect.height - scaledH);
  const x = scaledW <= rect.width ? (rect.width - scaledW) / 2 : Math.min(0, Math.max(minX, cam.x));
  const y = scaledH <= rect.height ? (rect.height - scaledH) / 2 : Math.min(0, Math.max(minY, cam.y));
  return { zoom: cam.zoom, x, y };
}

function applyCameraTransform() {
  dom.world.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`;
}

export function getCameraState() {
  return { ...camera };
}

export function setCameraState(state) {
  if (!state) return;
  const zoom = clampZoom(state.zoom ?? camera.zoom);
  camera = clampCameraPosition({ x: state.x ?? camera.x, y: state.y ?? camera.y, zoom });
  if (dom) applyCameraTransform();
}

function centerCameraOn(locationId, zoom) {
  const loc = WORLD_LOCATIONS[locationId];
  const rect = dom.viewport.getBoundingClientRect();
  const targetZoom = clampZoom(zoom ?? camera.zoom);
  const worldX = loc.x * MAP_WIDTH;
  const worldY = loc.y * MAP_HEIGHT;
  camera = clampCameraPosition({
    zoom: targetZoom,
    x: rect.width / 2 - worldX * targetZoom,
    y: rect.height / 2 - worldY * targetZoom,
  });
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

// Quest tracker's "SHOW ON MAP" and Springfield Intel's "SHOW LOCATION"
// (data/quests.js QUEST_DISPLAY locationId) -- pans/zooms straight to an
// arbitrary location, same framing resetViewToCurrentLocation uses, so
// game.js can then drive the exact same select-and-inspect flow a real
// hotspot click would (see onHotspotClick). Also briefly pulses the
// destination's pin, same animation the old "YOU ARE HERE" button used, so
// the player's eye actually lands on it once the camera settles.
export function focusCameraOnLocation(locationId) {
  centerCameraOn(locationId, START_ZOOM);
  const pin = hotspotEls[locationId]?.root;
  if (pin) {
    pin.classList.add('location-focus-pulse');
    setTimeout(() => pin.classList.remove('location-focus-pulse'), 1300);
  }
}

function zoomAtPoint(clientX, clientY, factor) {
  const rect = dom.viewport.getBoundingClientRect();
  const px = clientX - rect.left;
  const py = clientY - rect.top;
  const newZoom = clampZoom(camera.zoom * factor);
  if (newZoom === camera.zoom) return;
  const worldX = (px - camera.x) / camera.zoom;
  const worldY = (py - camera.y) / camera.zoom;
  camera = clampCameraPosition({
    zoom: newZoom,
    x: px - worldX * newZoom,
    y: py - worldY * newZoom,
  });
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
  camera = clampCameraPosition({ ...camera, x: dragState.camX + dx, y: dragState.camY + dy });
  applyCameraTransform();
}

function onPointerUp(e) {
  const wasClick = dragState && !dragState.moved;
  dragState = null;
  dom.viewport.classList.remove('is-panning');
  document.removeEventListener('pointermove', onPointerMove);
  document.removeEventListener('pointerup', onPointerUp);
  scheduleCameraSettled();
  // A plain click (no pan) on empty map while recording a Map Edit Mode
  // route appends a waypoint at that spot.
  if (wasClick && editMode && editRecording) handleMapEditClick(e.clientX, e.clientY);
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

function svgLine(points, stroke, width, opacity, dash) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  el.setAttribute('points', points.map((p) => `${p.x},${p.y}`).join(' '));
  el.setAttribute('fill', 'none');
  el.setAttribute('stroke', stroke);
  el.setAttribute('stroke-width', width);
  el.setAttribute('stroke-linecap', 'round');
  el.setAttribute('stroke-linejoin', 'round');
  el.setAttribute('opacity', opacity);
  if (dash) el.setAttribute('stroke-dasharray', dash);
  return el;
}

// "When NO location is selected: NO PATHS. When the player hovers a
// reachable location: show ONLY the route from CURRENT LOCATION to
// HOVERED LOCATION. When hover ends: route disappears. When a location is
// selected: keep that single route visible." (map-rebuild spec) -- so
// unlike the old renderRoads (which drew the whole graph, dimmed), this
// draws at most ONE line, and only ever on demand. Follows
// data/mapRoutes.js's hand-authored waypoints when a pair has one (or a
// live Map Edit Mode recording override); falls back to a straight
// point-to-point line otherwise -- most of Springfield's roads don't have
// an authored route yet, and a straight line still reads fine on
// SpringfieldMap_Clean.png's fairly regular grid.
function renderRoute(targetId, runState) {
  const svg = dom.roadsSvg;
  svg.innerHTML = '';
  if (editRecording) renderRecordingPreview();
  if (!targetId || !runState) return;
  const here = runState.world.currentLocationId || START_LOCATION_ID;
  if (targetId === here) return;
  const reachable = getReachableLocationIds(runState).includes(targetId);
  if (!reachable) return;
  const posA = WORLD_LOCATIONS[here];
  const posB = WORLD_LOCATIONS[targetId];
  if (!posA || !posB) return;
  const blocked = isRoadBlocked(runState, here, targetId);
  const waypoints = getEffectiveWaypoints(here, targetId) || [];
  const points = [posA, ...waypoints, posB].map((p) => ({ x: p.x * MAP_WIDTH, y: p.y * MAP_HEIGHT }));
  // A wide, soft, low-opacity glow UNDER a bright, mostly-solid core --
  // the glow is what keeps the path readable against the map's own
  // detailed street art without needing a harsh, oversized line.
  svg.appendChild(svgLine(points, blocked ? '#d0021b' : '#f6d217', 14, 0.3));
  svg.appendChild(svgLine(points, blocked ? '#ff4444' : '#ffe14d', 4, 0.9, blocked ? '10 8' : '2 12'));
}

// A live preview of the route currently being recorded in Map Edit Mode --
// small dots at each placed waypoint plus a dashed line connecting them,
// in a color distinct from the real travel route so the two are never
// confused while calibrating.
function renderRecordingPreview() {
  if (!editRecording) return;
  const svg = dom.roadsSvg;
  const from = WORLD_LOCATIONS[editRecording.from];
  const to = WORLD_LOCATIONS[editRecording.to];
  if (!from || !to) return;
  const points = [from, ...editRecording.waypoints, to].map((p) => ({ x: p.x * MAP_WIDTH, y: p.y * MAP_HEIGHT }));
  svg.appendChild(svgLine(points, '#38b6ff', 3, 0.9, '4 6'));
  for (const p of points) {
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', p.x);
    dot.setAttribute('cy', p.y);
    dot.setAttribute('r', 6);
    dot.setAttribute('fill', '#38b6ff');
    svg.appendChild(dot);
  }
}

// Selecting (clicked into the inspect panel) wins over merely hovering
// something else, so the route the player is actually deciding about
// doesn't disappear while they move the mouse toward the TRAVEL button.
function refreshRoute() {
  renderRoute(selectedLocationId || hoveredLocationId, lastRunState);
}

export function setHoveredLocation(id) {
  hoveredLocationId = id;
  refreshRoute();
}

export function setSelectedLocation(id) {
  if (selectedLocationId && hotspotEls[selectedLocationId]) {
    hotspotEls[selectedLocationId].root.classList.remove('selected');
  }
  selectedLocationId = id;
  if (id && hotspotEls[id]) hotspotEls[id].root.classList.add('selected');
  refreshRoute();
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
    root.addEventListener('pointerdown', (e) => {
      if (!editMode) return;
      e.stopPropagation();
      startEditDrag(id, e);
    });
    root.addEventListener('pointerup', (e) => {
      // In edit mode this must bubble to document's onEditDragUp (added by
      // startEditDrag above) so releasing the pointer over the pin itself
      // still ends the drag/selects it -- stopPropagation would swallow it
      // before that listener ever sees the event.
      if (editMode) return;
      e.stopPropagation();
      if (clickHandler) clickHandler(id);
    });
    root.addEventListener('pointerenter', () => {
      handlers.onHotspotHover(id);
      setHoveredLocation(id);
    });
    root.addEventListener('pointerleave', () => {
      handlers.onHotspotHover(null);
      setHoveredLocation(null);
    });
    dom.hotspotsLayer.appendChild(root);
    hotspotEls[id] = { root, pin: root.querySelector('.map-hotspot-pin') };
  }
}

// -------- Map Edit Mode: dragging a pin --------
function startEditDrag(id, e) {
  const loc = WORLD_LOCATIONS[id];
  editDragState = { id, startX: e.clientX, startY: e.clientY, origX: loc.x, origY: loc.y, moved: false };
  hotspotEls[id].root.classList.add('is-dragging');
  document.addEventListener('pointermove', onEditDragMove);
  document.addEventListener('pointerup', onEditDragUp);
}

function onEditDragMove(e) {
  if (!editDragState) return;
  const dx = e.clientX - editDragState.startX;
  const dy = e.clientY - editDragState.startY;
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) editDragState.moved = true;
  const loc = WORLD_LOCATIONS[editDragState.id];
  loc.x = Math.max(0, Math.min(1, editDragState.origX + dx / camera.zoom / MAP_WIDTH));
  loc.y = Math.max(0, Math.min(1, editDragState.origY + dy / camera.zoom / MAP_HEIGHT));
  const root = hotspotEls[editDragState.id].root;
  root.style.left = pct(loc.x);
  root.style.top = pct(loc.y);
  updateEditCoordsReadout(loc.x, loc.y);
  if (editSelectedId === editDragState.id) updateEditSelectedInputs();
  refreshRoute();
}

function onEditDragUp() {
  if (!editDragState) return;
  const { id, moved } = editDragState;
  hotspotEls[id].root.classList.remove('is-dragging');
  document.removeEventListener('pointermove', onEditDragMove);
  document.removeEventListener('pointerup', onEditDragUp);
  editDragState = null;
  if (!moved) selectEditHotspot(id);
}

function updateEditCoordsReadout(x, y) {
  const xEl = document.getElementById('map-edit-x');
  const yEl = document.getElementById('map-edit-y');
  if (xEl) xEl.textContent = x.toFixed(3);
  if (yEl) yEl.textContent = y.toFixed(3);
}

function updateEditSelectedInputs() {
  const loc = WORLD_LOCATIONS[editSelectedId];
  if (!loc) return;
  document.getElementById('map-edit-selected-x').value = loc.x.toFixed(3);
  document.getElementById('map-edit-selected-y').value = loc.y.toFixed(3);
}

function selectEditHotspot(id) {
  if (editSelectedId && hotspotEls[editSelectedId]) {
    hotspotEls[editSelectedId].root.classList.remove('map-edit-selected');
  }
  editSelectedId = id;
  if (hotspotEls[id]) hotspotEls[id].root.classList.add('map-edit-selected');
  document.getElementById('map-edit-selected').classList.remove('hidden');
  document.getElementById('map-edit-selected-name').textContent = LOCATIONS[id]?.name || id;
  updateEditSelectedInputs();
}

function onEditSelectedInputChange() {
  if (!editSelectedId) return;
  const loc = WORLD_LOCATIONS[editSelectedId];
  const x = Number(document.getElementById('map-edit-selected-x').value);
  const y = Number(document.getElementById('map-edit-selected-y').value);
  if (Number.isFinite(x)) loc.x = Math.max(0, Math.min(1, x));
  if (Number.isFinite(y)) loc.y = Math.max(0, Math.min(1, y));
  const root = hotspotEls[editSelectedId]?.root;
  if (root) {
    root.style.left = pct(loc.x);
    root.style.top = pct(loc.y);
  }
  refreshRoute();
}

// -------- Map Edit Mode: route waypoint recording --------
function populateEditRouteDropdowns() {
  const fromSel = document.getElementById('map-edit-route-from');
  const toSel = document.getElementById('map-edit-route-to');
  const optionsHtml = Object.keys(WORLD_LOCATIONS)
    .map((id) => `<option value="${id}">${LOCATIONS[id]?.name || id}</option>`)
    .join('');
  fromSel.innerHTML = optionsHtml;
  toSel.innerHTML = optionsHtml;
  if (toSel.options.length > 1) toSel.selectedIndex = 1;
}

function startOrStopRecording() {
  const btn = document.getElementById('btn-map-edit-route-record');
  const status = document.getElementById('map-edit-route-status');
  if (editRecording) {
    // Stop & save.
    if (editRecording.waypoints.length) {
      editRouteOverrides[roadKey(editRecording.from, editRecording.to)] = editRecording.waypoints;
    }
    status.textContent = `Saved ${editRecording.waypoints.length} waypoint(s) for ${LOCATIONS[editRecording.from]?.name} ↔ ${LOCATIONS[editRecording.to]?.name}.`;
    editRecording = null;
    btn.textContent = 'Record';
    refreshRoute();
    return;
  }
  const from = document.getElementById('map-edit-route-from').value;
  const to = document.getElementById('map-edit-route-to').value;
  if (!from || !to || from === to) {
    status.textContent = 'Pick two different locations first.';
    return;
  }
  editRecording = { from, to, waypoints: [] };
  btn.textContent = 'Stop && Save';
  status.textContent = 'Recording -- click points on the map, then Stop.';
  refreshRoute();
}

function clearEditRoute() {
  const from = document.getElementById('map-edit-route-from').value;
  const to = document.getElementById('map-edit-route-to').value;
  delete editRouteOverrides[roadKey(from, to)];
  document.getElementById('map-edit-route-status').textContent = `Cleared override for ${LOCATIONS[from]?.name} ↔ ${LOCATIONS[to]?.name} (falls back to data/mapRoutes.js or a straight line).`;
  refreshRoute();
}

// A click on empty map (not a hotspot, not a drag) while recording appends
// a waypoint; handled from bindPanZoom's pointerup so it shares the exact
// same "was this a click or a pan" logic already used there.
function handleMapEditClick(clientX, clientY) {
  if (!editRecording) return;
  const { x, y } = pointerToNormalized(clientX, clientY);
  editRecording.waypoints.push({ x, y });
  refreshRoute();
}

// -------- Map Edit Mode: export --------
function exportConfig() {
  const changedLocations = {};
  for (const [id, loc] of Object.entries(WORLD_LOCATIONS)) {
    const orig = editOriginalLocations?.[id];
    if (!orig || orig.x !== loc.x || orig.y !== loc.y) {
      changedLocations[id] = { x: Number(loc.x.toFixed(3)), y: Number(loc.y.toFixed(3)) };
    }
  }
  const lines = [];
  lines.push('// ---- Map Edit Mode export ----');
  if (Object.keys(changedLocations).length) {
    lines.push('// Paste into data/worldMap.js WORLD_LOCATIONS (replace these ids\' entries):');
    for (const [id, loc] of Object.entries(changedLocations)) {
      lines.push(`  ${id}: { x: ${loc.x}, y: ${loc.y} },`);
    }
  } else {
    lines.push('// No location positions changed.');
  }
  lines.push('');
  if (Object.keys(editRouteOverrides).length) {
    lines.push('// Paste into data/mapRoutes.js ROUTE_WAYPOINTS (roadKey already sorted):');
    for (const [key, waypoints] of Object.entries(editRouteOverrides)) {
      const wp = waypoints.map((p) => `{ x: ${p.x.toFixed(3)}, y: ${p.y.toFixed(3)} }`).join(', ');
      lines.push(`  '${key}': [${wp}],`);
    }
  } else {
    lines.push('// No route waypoints recorded.');
  }
  const output = document.getElementById('map-edit-export-output');
  output.value = lines.join('\n');
  output.classList.remove('hidden');
  output.focus();
  output.select();
}

// -------- Map Edit Mode: on/off --------
function applyEditModeClasses() {
  for (const els of Object.values(hotspotEls)) {
    els.root.classList.toggle('map-edit-draggable', editMode);
  }
}

function onMapEditKeydown(e) {
  if (!(e.ctrlKey || e.metaKey) || !e.shiftKey || e.key.toLowerCase() !== 'm') return;
  const boardScreen = document.getElementById('screen-board');
  if (!boardScreen || boardScreen.classList.contains('hidden')) return;
  e.preventDefault();
  toggleEditMode();
}

function onEditPointerMove(e) {
  if (!editMode || editDragState) return;
  const { x, y } = pointerToNormalized(e.clientX, e.clientY);
  updateEditCoordsReadout(x, y);
}

export function isEditModeActive() {
  return editMode;
}

export function enableEditMode() {
  if (editMode) return;
  editMode = true;
  editOriginalLocations = JSON.parse(JSON.stringify(WORLD_LOCATIONS));
  document.getElementById('map-edit-panel').classList.remove('hidden');
  populateEditRouteDropdowns();
  applyEditModeClasses();
  try {
    localStorage.setItem(EDIT_MODE_KEY, '1');
  } catch {
    // Private browsing / storage disabled -- edit mode just won't persist across reloads.
  }
}

export function disableEditMode() {
  if (!editMode) return;
  editMode = false;
  editRecording = null;
  if (editSelectedId && hotspotEls[editSelectedId]) hotspotEls[editSelectedId].root.classList.remove('map-edit-selected');
  editSelectedId = null;
  document.getElementById('map-edit-panel').classList.add('hidden');
  document.getElementById('map-edit-export-output').classList.add('hidden');
  applyEditModeClasses();
  refreshRoute();
  try {
    localStorage.setItem(EDIT_MODE_KEY, '0');
  } catch {
    // Private browsing / storage disabled.
  }
}

export function toggleEditMode() {
  if (editMode) disableEditMode();
  else enableEditMode();
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
  const invasion = runState.world.locationInvasions?.[locationId];
  const bits = [];
  if (runState.world.devilNedPosition === locationId) bits.push('😈 DEVIL NED IS HERE');
  if (invasion) bits.push(`⚠ UNDER ATTACK — ${invasion.turnsLeft} MOVE${invasion.turnsLeft === 1 ? '' : 'S'} LEFT`);
  bits.push(visited ? 'VISITED' : 'NOT VISITED YET');
  if (isBoss) bits.push('☠ BOSS LOCATION');
  if (typeof flag === 'string') bits.push(flag.toUpperCase());
  return { name: loc.name, status: bits.join(' • ') };
}

// Richer, structured version of hotspotInfo for the click-driven inspect
// panel (map-rebuild "click = INSPECT" flow) -- chips for quick status,
// body lines for "why would I go there." A never-visited location with no
// active invasion/status flag/Devil Ned reveal stays a "???" -- Homer only
// knows what he's actually seen (map-rebuild "Fog of Knowledge"), even
// though the hotspot icon itself is still visible.
export function locationInspectDetails(locationId, runState) {
  const loc = LOCATIONS[locationId];
  const segment = getCurrentSegment(runState);
  const visited = runState.world.visitedLocationIds.includes(locationId);
  const isBoss = locationId === segment.bossLocationId;
  const flag = runState.world.locationFlags[locationId];
  const invasion = runState.world.locationInvasions?.[locationId];
  const devilHere = runState.world.devilNedPosition === locationId;

  const chips = [];
  if (devilHere) chips.push({ text: 'DEVIL NED', urgent: true });
  if (invasion) chips.push({ text: `UNDER ATTACK — ${invasion.turnsLeft} LEFT`, urgent: true });
  chips.push({ text: visited ? 'VISITED' : 'UNEXPLORED', urgent: false });
  if (isBoss) chips.push({ text: 'BOSS LOCATION', urgent: true });

  const bodyLines = [];
  if (typeof flag === 'string') bodyLines.push(`Status: ${flag}`);
  const revealed = visited || !!invasion || devilHere;
  if (revealed) {
    const content = segment.content[locationId];
    if (content?.type === 'combat') bodyLines.push(content.elite ? 'Elite combat encounter' : 'Combat encounter');
    else if (content?.type === 'boss') bodyLines.push('Boss encounter');
    else if (content?.type === 'event') bodyLines.push('Story event');
    else if (visited) bodyLines.push('Nothing left here for now.');
  } else {
    bodyLines.push('??? Not yet investigated.');
  }
  return { name: loc.name, chips, bodyLines };
}

// ==================== SIDEBAR (Springfield Intel) ====================
// SIMPLIFY THE SPRINGFIELD INTEL SIDEBAR: answers exactly three questions
// -- what should I be doing (CURRENT OBJECTIVE), how dangerous is it
// (MAYHEM), what else is active (ACTIVE QUESTS) -- instead of the old
// toggleable filter/highlight panel. "The map should visually tell the
// player what exists" (hotspot state classes already do that, see
// nodeStateClass below); this panel is not a second copy of that.
function renderSidebarObjective(runState) {
  const quest = getCurrentObjective(runState);
  const segment = getCurrentSegment(runState);
  const locationId = quest ? quest.locationId : null;
  document.getElementById('sidebar-objective-title').textContent = quest ? quest.title : 'MAIN OBJECTIVE';
  document.getElementById('sidebar-objective-hint').textContent = quest ? quest.hint : segment.objective;
  const btn = document.getElementById('btn-sidebar-show-location');
  btn.classList.toggle('hidden', !locationId);
  btn.onclick = locationId && sidebarHandlers ? () => sidebarHandlers.onShowLocation(locationId) : null;
}

function renderSidebarMayhem(runState) {
  document.getElementById('sidebar-mayhem-pct').textContent = `${runState.mayhem}%`;
  document.getElementById('sidebar-mayhem-label').textContent = mayhemLabel(runState.mayhem).toUpperCase();
}

function renderSidebarQuests(runState) {
  const activeQuests = getActiveQuestsSummary(runState);
  document.getElementById('sidebar-quest-count').textContent = String(activeQuests.length);
  const btn = document.getElementById('btn-sidebar-view-quests');
  btn.classList.toggle('hidden', activeQuests.length === 0);
  btn.onclick = sidebarHandlers ? () => sidebarHandlers.onViewQuests() : null;
}

function renderSidebarIntel(runState) {
  renderSidebarObjective(runState);
  renderSidebarMayhem(runState);
  renderSidebarQuests(runState);
}

function setSidebarCollapsed(collapsed) {
  document.getElementById('map-sidebar-left').classList.toggle('collapsed', collapsed);
  try {
    localStorage.setItem(SIDEBAR_COLLAPSE_KEY, collapsed ? '1' : '0');
  } catch {
    // Private browsing / storage disabled -- collapse state just won't persist.
  }
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
  sidebarHandlers = { onShowLocation: handlers.onShowLocation, onViewQuests: handlers.onViewQuests };
  dom.image.src = getAssetUrl('ui', 'springfieldMap') || '';
  buildRoads();
  buildHotspots({
    onHotspotHover: (locationId) => handlers.onHotspotHover(locationId),
  });
  bindPanZoom();
  document.getElementById('btn-map-zoom-in').addEventListener('click', () => zoomIn());
  document.getElementById('btn-map-zoom-out').addEventListener('click', () => zoomOut());
  document.getElementById('btn-map-zoom-reset').addEventListener('click', () => handlers.onZoomReset());
  // "The giant permanent panel is unnecessary" -- defaults to collapsed
  // (the small icon-only toggle) unless the player has explicitly expanded
  // it before; only an explicit '0' in storage means "I want it open by
  // default."
  let collapsed = true;
  try {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSE_KEY);
    if (stored !== null) collapsed = stored === '1';
  } catch {
    // Private browsing / storage disabled -- default to collapsed.
  }
  setSidebarCollapsed(collapsed);
  document.getElementById('btn-sidebar-collapse').addEventListener('click', () => {
    setSidebarCollapsed(!document.getElementById('map-sidebar-left').classList.contains('collapsed'));
  });
  // A resize can shrink minZoomForViewport's "cover" floor out from under
  // an already-set camera (e.g. rotating a tablet, or the browser window
  // itself resizing) -- re-clamp against the new viewport rather than
  // waiting for the next manual pan/zoom to fix it.
  window.addEventListener('resize', () => setCameraState(camera));

  // ---- Map Edit Mode wiring (dev-only, Ctrl+Shift+M) ----
  document.addEventListener('keydown', onMapEditKeydown);
  dom.viewport.addEventListener('pointermove', onEditPointerMove);
  document.getElementById('btn-map-edit-close').addEventListener('click', () => disableEditMode());
  document.getElementById('map-edit-selected-x').addEventListener('change', onEditSelectedInputChange);
  document.getElementById('map-edit-selected-y').addEventListener('change', onEditSelectedInputChange);
  document.getElementById('btn-map-edit-route-record').addEventListener('click', () => startOrStopRecording());
  document.getElementById('btn-map-edit-route-clear').addEventListener('click', () => clearEditRoute());
  document.getElementById('btn-map-edit-export').addEventListener('click', () => exportConfig());
  let editModeStored = false;
  try {
    editModeStored = localStorage.getItem(EDIT_MODE_KEY) === '1';
  } catch {
    // Private browsing / storage disabled -- edit mode starts off.
  }
  if (editModeStored) enableEditMode();
}

// Refreshes every hotspot's visible state, the road layer, and Homer's
// marker/portrait against the current runState -- call this whenever the
// board screen is (re)entered and there is nothing already animating
// (travelHomerMarker below handles the one time there is: mid-travel).
export function renderMap(runState) {
  lastRunState = runState;
  const segment = getCurrentSegment(runState);
  const reachableIds = getReachableLocationIds(runState);
  const bossUnlocked = isBossLocationUnlocked(runState);

  for (const [id, els] of Object.entries(hotspotEls)) {
    const state = nodeStateClass(id, runState, reachableIds, segment, bossUnlocked);
    const invaded = !!runState.world.locationInvasions?.[id];
    const devilHere = runState.world.devilNedPosition === id;
    const selected = id === selectedLocationId;
    const editDraggable = editMode ? ' map-edit-draggable' : '';
    const editSelected = editMode && id === editSelectedId ? ' map-edit-selected' : '';
    els.root.className = `map-hotspot ${state}${id === segment.bossLocationId ? ' is-boss' : ''}${invaded ? ' is-invaded' : ''}${devilHere ? ' is-devil-hunting' : ''}${selected ? ' selected' : ''}${editDraggable}${editSelected}`;
  }
  refreshRoute();
  renderSidebarIntel(runState);

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
