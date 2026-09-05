const META_KEY = 'springfieldMayhem.meta.v1';

export function loadMeta() {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Could not load save data', e);
  }
  return {
    season: 1,
    episodeInSeason: 0,
    totalEpisodes: 0,
    history: [],
    trophies: [],
  };
}

export function saveMeta(meta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch (e) {
    console.warn('Could not save data', e);
  }
}

export function recordEpisodeResult(meta, result) {
  meta.episodeInSeason += 1;
  meta.totalEpisodes += 1;
  meta.history.unshift(result);
  meta.history = meta.history.slice(0, 50);

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

function trophyForResult(result) {
  if (result.victory && result.modifier === 'alienInvasion') return '👽';
  if (result.stats.donutsEaten >= 8) return '🍩';
  if (result.stats.enemiesDefeated >= 40) return '💥';
  if (!result.victory) return '🦴';
  return null;
}

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
    },
    ownedItemIds: new Set(),
    ownedTags: new Set(),
    synergiesUnlocked: new Set(),
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
    },
    episode: null,
    route: [],
    currentStageIndex: 0,
  };
}
