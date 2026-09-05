import { CHARACTERS } from '../data/characters.js';
import { ITEMS } from '../data/items.js';
import { UPGRADES } from '../data/upgrades.js';

const META_KEY = 'springfieldMayhem.meta.v2';
const ACTIVE_RUN_KEY = 'springfieldMayhem.activeRun.v1';

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
    settings: { musicOn: true, sfxOn: true },
    ...meta,
  };
}

export function saveMeta(meta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch (e) {
    console.warn('Could not save data', e);
  }
}

export function totalDiscoverableItemCount() {
  return Object.keys(ITEMS).length - 1 + Object.keys(UPGRADES).length; // -1 excludes the plain donut
}

export function recordDiscoveries(meta, ids) {
  const set = new Set(meta.itemsDiscoveredIds);
  for (const id of ids) set.add(id);
  meta.itemsDiscoveredIds = Array.from(set);
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
  if (result.victory && result.modifier === 'alienInvasion') return '👽';
  if (result.stats.donutsEaten >= 8) return '🍩';
  if (result.stats.enemiesDefeated >= 40) return '💥';
  if (!result.victory) return '🦴';
  return null;
}

// --- Run state (one playthrough of a character's journey) ------------------
export function createRunState(character) {
  return {
    character,
    hp: character.maxHp,
    maxHp: character.maxHp,
    weaponId: character.startingWeapon,
    buffs: {
      damageMult: 0,
      accuracy: 0,
      speedMult: 0,
      fireAura: 0,
      blinky: false,
      sugarRushOverdrive: false,
      nuclearBowlingBall: false,
      drunkenInferno: false,
      radiationChance: 0,
      donutArmorUpgrade: false,
      duffRageUpgrade: false,
      bowlingNightUpgrade: false,
    },
    timedBuffs: [],
    armorShield: 0,
    ownedItemIds: new Set(),
    ownedTags: new Set(),
    synergiesUnlocked: new Set(),
    upgradesChosen: new Set(),
    donutsCurrency: 0,
    stats: {
      enemiesDefeated: 0,
      donutsEaten: 0,
      donutsSaved: 0,
      townDestruction: 0,
      peoplePissedOff: 0,
      arrests: 0,
    },
    relationships: {
      moe: 'neutral',
      flanders: 'neutral',
    },
    episode: null,
    boardPosition: null,
    completedNodeIds: new Set(),
  };
}

export function serializeRunState(runState) {
  return {
    ...runState,
    character: undefined,
    characterId: runState.character.id,
    timedBuffs: [],
    ownedItemIds: Array.from(runState.ownedItemIds),
    ownedTags: Array.from(runState.ownedTags),
    synergiesUnlocked: Array.from(runState.synergiesUnlocked),
    upgradesChosen: Array.from(runState.upgradesChosen),
    completedNodeIds: Array.from(runState.completedNodeIds),
  };
}

export function deserializeRunState(obj) {
  return {
    ...obj,
    character: CHARACTERS[obj.characterId],
    timedBuffs: [],
    ownedItemIds: new Set(obj.ownedItemIds),
    ownedTags: new Set(obj.ownedTags),
    synergiesUnlocked: new Set(obj.synergiesUnlocked),
    upgradesChosen: new Set(obj.upgradesChosen),
    completedNodeIds: new Set(obj.completedNodeIds),
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
