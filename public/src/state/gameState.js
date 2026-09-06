import { CHARACTERS } from '../data/characters.js';
import { ITEMS } from '../data/items.js';
import { ABILITIES, STARTER_ABILITY_IDS } from '../data/abilities.js';
import { RELICS } from '../data/relics.js';

const META_KEY = 'springfieldMayhem.meta.v4';
const ACTIVE_RUN_KEY = 'springfieldMayhem.activeRun.v3';

// --- Meta (persists across runs forever) -----------------------------------
export function loadMeta() {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (raw) return withMetaDefaults(JSON.parse(raw));
  } catch (e) {
    console.warn('Could not load save data', e);
  }
  return withMetaDefaults({});
}

function withMetaDefaults(meta) {
  return {
    season: 1,
    episodeInSeason: 0,
    totalEpisodes: 0,
    history: [],
    trophies: [],
    unlockedCharacterIds: ['homer'],
    legacyPoints: 0,
    itemsDiscoveredIds: [],
    couchGagsSeenIds: [],
    endingsSeenIds: [],
    ...meta,
    // Merged one level deep on purpose -- a save from before `musicVolume`
    // existed has `settings: {musicOn, sfxOn}` with no volume key; a plain
    // top-level spread of `meta` would let that older object win wholesale
    // and silently drop the new default forever.
    settings: { musicOn: true, sfxOn: true, musicVolume: 1, ...meta.settings },
  };
}

export function saveMeta(meta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch (e) {
    console.warn('Could not save data', e);
  }
}

// Abilities beyond the starter 3 count as "discoverable", same as relics
// and shop consumables -- used for the Collection screen's X/Y readout.
export function totalDiscoverableItemCount() {
  return Object.keys(ITEMS).length + Object.keys(RELICS).length + (Object.keys(ABILITIES).length - STARTER_ABILITY_IDS.length);
}

export function recordDiscoveries(meta, ids) {
  const set = new Set(meta.itemsDiscoveredIds);
  for (const id of ids) set.add(id);
  meta.itemsDiscoveredIds = Array.from(set);
}

export function recordCouchGag(meta, couchGagId) {
  if (!meta.couchGagsSeenIds.includes(couchGagId)) meta.couchGagsSeenIds.push(couchGagId);
}

export function recordEnding(meta, endingId) {
  if (!meta.endingsSeenIds.includes(endingId)) meta.endingsSeenIds.push(endingId);
}

export function recordEpisodeResult(meta, result) {
  meta.episodeInSeason += 1;
  meta.totalEpisodes += 1;
  meta.history.unshift(result);
  meta.history = meta.history.slice(0, 50);
  meta.legacyPoints += legacyPointsForResult(result);

  const trophy = trophyForResult(result);
  if (trophy && !meta.trophies.includes(trophy)) meta.trophies.push(trophy);

  let seasonFinale = false;
  if (meta.episodeInSeason >= 22) {
    meta.episodeInSeason = 0;
    meta.season += 1;
    seasonFinale = true;
  }
  saveMeta(meta);
  return { seasonFinale };
}

function legacyPointsForResult(result) {
  const base = Math.round(result.stats.enemiesDefeated / 2) + result.nodesCleared * 3;
  return result.victory ? base + 25 : base;
}

function trophyForResult(result) {
  if (result.endingId === 'treehouseTranscendence') return '💫';
  if (result.endingId === 'kangKodosWin') return '👽';
  if (result.endingId === 'zombieEnding') return '🧟';
  if (result.stats.peakMayhem >= 100) return '☠️';
  if (result.stats.enemiesDefeated >= 15) return '💥';
  if (!result.victory) return '🦴';
  return null;
}

// --- Run state (one playthrough of a character's episode) -------------------
export function createRunState(character) {
  return {
    character,
    hp: character.maxHp,
    maxHp: character.maxHp,
    abilityDeck: [...STARTER_ABILITY_IDS],
    relics: [],
    mayhem: 0,
    infection: 0,
    donutsCurrency: 0,
    // Held rare/bizarre items bought at the Kwik-E-Mart (or found), keyed by
    // itemId -> count. Ordinary staples still apply the instant they're
    // bought; only the rare finds (data/items.js's `rare: true` entries) are
    // worth saving for later, so this bag only ever holds those.
    consumables: {},
    // Quest progress, keyed by quest id -> 'active' | 'resolved' | a more
    // specific outcome string ('killed'/'saved', see data/quests.js). Absent
    // key means "not started yet" -- quests start silently, from an
    // ordinary dialogue choice or event, not a quest log the player opens.
    quests: {},
    stats: {
      enemiesDefeated: 0,
      elitesDefeated: 0,
      peakMayhem: 0,
    },
    relationships: {
      moe: 'neutral',
      flanders: 'neutral',
      apu: 'neutral',
    },
    // The episode cast always starts with just the main character; other
    // Springfield residents join via event outcomes (data/events.js) or the
    // Moe's Tavern "talk" option (game.js). Cast membership unlocks that
    // character's abilities (data/abilities.js getDraftPool) and any
    // Character Synergy that requires them (data/synergies.js).
    cast: [character.id],
    // Horror Rules accumulate across segments and never leave -- see
    // systems/board.js advanceSegment and data/horrorRules.js.
    activeHorrorRuleIds: [],
    segmentIndex: 0,
    callbackFlags: {},
    firedCallbackIds: [],
    pendingCallbackEffects: {},
    episode: null,
    // Springfield: a single persistent map shared across all three segments
    // (data/worldMap.js). `currentLocationId` is where the player is
    // standing right now (null = still at home, the segment's start point).
    // `segmentVisitedLocationIds` resets every segment (systems/board.js
    // isBossLocationUnlocked reads it); everything else about the town is
    // permanent run memory, per the "locations remember what happened"
    // design -- a blocked road or a discovered secret stays that way even
    // after Springfield changes Horror Rules.
    world: {
      currentLocationId: null,
      segmentVisitedLocationIds: [],
      visitedLocationIds: [],
      blockedRoads: [],
      locationFlags: {},
      locationStates: {},
      secretsFoundIds: [],
      // The player's last pan/zoom on the Springfield map (ui/worldMapView.js
      // {x, y, zoom}) -- null until they've actually moved the camera once,
      // at which point game.js starts framed on it instead of resetting to
      // the Simpsons House. "Do not reset the map" on returning to a screen.
      mapCamera: null,
    },
  };
}

export function serializeRunState(runState) {
  return {
    ...runState,
    character: undefined,
    characterId: runState.character.id,
  };
}

export function deserializeRunState(obj) {
  return {
    ...obj,
    character: CHARACTERS[obj.characterId],
    // Saves from before the Kwik-E-Mart held-item bag existed won't have
    // this key -- default it so economy.js doesn't have to guard everywhere.
    consumables: obj.consumables || {},
    quests: obj.quests || {},
  };
}

export function saveActiveRun(runState) {
  try {
    localStorage.setItem(ACTIVE_RUN_KEY, JSON.stringify(serializeRunState(runState)));
  } catch (e) {
    console.warn('Could not save active run', e);
  }
}

export function loadActiveRun() {
  try {
    const raw = localStorage.getItem(ACTIVE_RUN_KEY);
    if (!raw) return null;
    return deserializeRunState(JSON.parse(raw));
  } catch (e) {
    console.warn('Could not load active run', e);
    return null;
  }
}

export function hasActiveRun() {
  try {
    return !!localStorage.getItem(ACTIVE_RUN_KEY);
  } catch (e) {
    return false;
  }
}

export function clearActiveRun() {
  try {
    localStorage.removeItem(ACTIVE_RUN_KEY);
  } catch (e) {
    console.warn('Could not clear active run', e);
  }
}
