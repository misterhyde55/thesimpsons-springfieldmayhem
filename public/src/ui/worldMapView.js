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
import { WORLD_LOCATIONS, getAllRoads, isRoadBlocked, getReachableLocationIds, START_LOCATION_ID } from '../data/worldMap.js';
import { getCurrentSegment, isBossLocationUnlocked } from '../systems/board.js';
import { LOCATIONS } from '../data/locations.js';
import { getAssetUrl } from '../data/assets.js';
import { FILTER_DEFS, youAreHereInfo } from '../systems/mapIntel.js';

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

// ---- Sidebar filter state (systems/mapIntel.js) ----
// Most categories start OFF ("the giant permanent legend is unnecessary");
// QUEST and EVENT start on since those are the two things a player should
// never have to dig for -- per the map-rebuild spec's explicit default.
let activeFilterIds = new Set(['quest', 'event']);
let lastRunState = null; // so toggling a filter can re-render without game.js re-driving it

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

// "When NO location is selected: NO PATHS. When the player hovers a
// reachable location: show ONLY the route from CURRENT LOCATION to
// HOVERED LOCATION. When hover ends: route disappears. When a location is
// selected: keep that single route visible." (map-rebuild spec) -- so
// unlike the old renderRoads (which drew the whole graph, dimmed), this
// draws at most ONE line, and only ever on demand. Straight point-to-point
// for now (SpringfieldMap_Clean.png's grid is regular enough that this
// already reads as "the road there"); true hand-authored waypoints that
// bend around buildings are future work, not required for this to be a
// real improvement over the old permanent dotted network.
function renderRoute(targetId, runState) {
  const svg = dom.roadsSvg;
  svg.innerHTML = '';
  if (!targetId || !runState) return;
  const here = runState.world.currentLocationId || START_LOCATION_ID;
  if (targetId === here) return;
  const reachable = getReachableLocationIds(runState).includes(targetId);
  if (!reachable) return;
  const posA = WORLD_LOCATIONS[here];
  const posB = WORLD_LOCATIONS[targetId];
  if (!posA || !posB) return;
  const blocked = isRoadBlocked(runState, here, targetId);
  const x1 = posA.x * MAP_WIDTH;
  const y1 = posA.y * MAP_HEIGHT;
  const x2 = posB.x * MAP_WIDTH;
  const y2 = posB.y * MAP_HEIGHT;
  // A wide, soft, low-opacity glow UNDER a bright, mostly-solid core --
  // the glow is what keeps the path readable against the map's own
  // detailed street art without needing a harsh, oversized line.
  const glow = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  glow.setAttribute('x1', x1);
  glow.setAttribute('y1', y1);
  glow.setAttribute('x2', x2);
  glow.setAttribute('y2', y2);
  glow.setAttribute('stroke', blocked ? '#d0021b' : '#f6d217');
  glow.setAttribute('stroke-width', '14');
  glow.setAttribute('stroke-linecap', 'round');
  glow.setAttribute('opacity', '0.3');
  svg.appendChild(glow);
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', x1);
  line.setAttribute('y1', y1);
  line.setAttribute('x2', x2);
  line.setAttribute('y2', y2);
  line.setAttribute('stroke', blocked ? '#ff4444' : '#ffe14d');
  line.setAttribute('stroke-width', '4');
  line.setAttribute('stroke-linecap', 'round');
  line.setAttribute('stroke-dasharray', blocked ? '10 8' : '2 12');
  line.setAttribute('opacity', '0.9');
  svg.appendChild(line);
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
    root.addEventListener('pointerup', (e) => {
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
// active invasion/rumor/Devil Ned reveal stays a "???" -- Homer only knows
// what he's actually seen (map-rebuild "Fog of Knowledge"), even though
// the hotspot icon itself is still visible (that part of the design is
// unchanged -- see systems/mapIntel.js's own header comment).
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
  if (typeof flag === 'string') bodyLines.push(`Rumor: "${flag}"`);
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

// ==================== SIDEBAR (systems/mapIntel.js) ====================
// Combines every active filter's matches into one map so a location that
// matches two filters at once (e.g. SHOP + QUEST) still only renders one
// highlighted pin and one info card, per "do not let the map become
// unreadable" -- lines from every matching filter are concatenated.
function combinedFilterMatches(runState) {
  const combined = new Map();
  for (const filterId of activeFilterIds) {
    const def = FILTER_DEFS.find((f) => f.id === filterId);
    if (!def) continue;
    for (const [locationId, entry] of def.getEntries(runState)) {
      const existing = combined.get(locationId);
      if (existing) {
        existing.lines.push(...entry.lines);
        existing.urgent = existing.urgent || !!entry.urgent;
      } else {
        combined.set(locationId, { lines: [...entry.lines], urgent: !!entry.urgent });
      }
    }
  }
  return combined;
}

// Dims every hotspot that doesn't match at least one active filter, and
// gives the matches a gold (or red, if urgent) ring -- called on every
// renderMap and every filter toggle so it never goes stale.
function applyFilterHighlights(runState) {
  const matches = activeFilterIds.size ? combinedFilterMatches(runState) : null;
  for (const [id, els] of Object.entries(hotspotEls)) {
    els.root.classList.remove('filter-match', 'filter-dim', 'filter-urgent');
    if (!matches) continue;
    const entry = matches.get(id);
    if (entry) {
      els.root.classList.add('filter-match');
      if (entry.urgent) els.root.classList.add('filter-urgent');
    } else {
      els.root.classList.add('filter-dim');
    }
  }
}

function renderSidebarInfoPanel(runState) {
  const panel = document.getElementById('sidebar-info-panel');
  if (!activeFilterIds.size) {
    panel.classList.add('hidden');
    panel.innerHTML = '';
    return;
  }
  const matches = combinedFilterMatches(runState);
  panel.classList.remove('hidden');
  if (!matches.size) {
    panel.innerHTML = '<div class="sidebar-info-card-line">Nothing currently matches.</div>';
    return;
  }
  panel.innerHTML = '';
  for (const [locationId, entry] of matches) {
    const card = document.createElement('div');
    card.className = 'sidebar-info-card' + (entry.urgent ? ' urgent' : '');
    card.innerHTML = `<div class="sidebar-info-card-name">${LOCATIONS[locationId]?.name || locationId}</div>${entry.lines
      .map((l) => `<div class="sidebar-info-card-line">${l}</div>`)
      .join('')}`;
    card.addEventListener('click', () => centerCameraOn(locationId, camera.zoom));
    panel.appendChild(card);
  }
}

function renderSidebarFilterList(runState) {
  const list = document.getElementById('sidebar-filter-list');
  list.innerHTML = '';
  for (const def of FILTER_DEFS) {
    const count = def.getEntries(runState).size;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sidebar-filter-btn' + (activeFilterIds.has(def.id) ? ' active' : '');
    btn.title = def.description;
    btn.innerHTML = `<span class="sidebar-filter-label"><span>${def.icon}</span><span>${def.label}</span></span><span class="sidebar-filter-count">${count}</span>`;
    btn.addEventListener('click', () => toggleFilter(def.id));
    list.appendChild(btn);
  }
  document.getElementById('btn-sidebar-clear').classList.toggle('hidden', activeFilterIds.size === 0);
}

function toggleFilter(filterId) {
  if (activeFilterIds.has(filterId)) activeFilterIds.delete(filterId);
  else activeFilterIds.add(filterId);
  refreshSidebar();
}

function clearFilters() {
  activeFilterIds.clear();
  refreshSidebar();
}

function refreshSidebar() {
  if (!lastRunState) return;
  renderSidebarFilterList(lastRunState);
  applyFilterHighlights(lastRunState);
  renderSidebarInfoPanel(lastRunState);
}

function setSidebarCollapsed(collapsed) {
  document.getElementById('map-sidebar-left').classList.toggle('collapsed', collapsed);
  try {
    localStorage.setItem(SIDEBAR_COLLAPSE_KEY, collapsed ? '1' : '0');
  } catch {
    // Private browsing / storage disabled -- collapse state just won't persist.
  }
}

// "YOU ARE HERE" -- a one-off action, not a toggle: recenters the camera,
// pulses the current-location pin, and shows the same info-card panel the
// filters use (reachable count, HP) rather than a highlight set.
function showYouAreHere(runState) {
  const info = youAreHereInfo(runState);
  activeFilterIds.clear();
  renderSidebarFilterList(runState);
  for (const [id, els] of Object.entries(hotspotEls)) els.root.classList.remove('filter-match', 'filter-dim', 'filter-urgent');
  centerCameraOn(info.locationId, camera.zoom);
  const pin = hotspotEls[info.locationId]?.root;
  if (pin) {
    pin.classList.add('you-are-here-pulse');
    setTimeout(() => pin.classList.remove('you-are-here-pulse'), 1300);
  }
  const panel = document.getElementById('sidebar-info-panel');
  panel.classList.remove('hidden');
  panel.innerHTML = `
    <div class="sidebar-info-card">
      <div class="sidebar-info-card-name">${info.name}</div>
      <div class="sidebar-info-card-line">Reachable: ${info.reachableCount} location${info.reachableCount === 1 ? '' : 's'}</div>
      <div class="sidebar-info-card-line">HP: ${Math.round(info.hp)} / ${info.maxHp}</div>
    </div>
  `;
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
  document.getElementById('btn-filter-you-are-here').addEventListener('click', () => showYouAreHere(lastRunState));
  document.getElementById('btn-sidebar-clear').addEventListener('click', () => clearFilters());
  // "The giant permanent legend is unnecessary... create MAP FILTERS as a
  // collapsible button" -- defaults to collapsed (the 52px icon rail)
  // unless the player has explicitly expanded it before; only an explicit
  // '0' in storage means "I want it open by default."
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
    els.root.className = `map-hotspot ${state}${id === segment.bossLocationId ? ' is-boss' : ''}${invaded ? ' is-invaded' : ''}${devilHere ? ' is-devil-hunting' : ''}${selected ? ' selected' : ''}`;
  }
  refreshRoute();
  renderSidebarFilterList(runState);
  applyFilterHighlights(runState);
  renderSidebarInfoPanel(runState);

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
