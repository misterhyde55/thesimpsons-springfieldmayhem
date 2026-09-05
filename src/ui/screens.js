import { getAssetUrl } from '../data/assets.js';
import { RARITY_COLOR } from '../data/upgrades.js';
import { totalDiscoverableItemCount } from '../state/gameState.js';
import { ITEMS } from '../data/items.js';
import { UPGRADES } from '../data/upgrades.js';

const SCREEN_IDS = [
  'screen-main-menu',
  'screen-character-select',
  'screen-characters-info',
  'screen-seasons-info',
  'screen-collection-info',
  'screen-settings',
  'screen-board',
  'screen-breaking-news',
  'screen-arena',
  'screen-level-complete',
  'screen-event',
  'screen-rest',
  'screen-run-complete',
  'screen-run-failure',
];

const $ = (id) => document.getElementById(id);

function freshButton(id) {
  const btn = $(id);
  const fresh = btn.cloneNode(true);
  btn.replaceWith(fresh);
  return fresh;
}

export function showScreen(id) {
  for (const screenId of SCREEN_IDS) {
    $(screenId).classList.toggle('hidden', screenId !== id);
  }
}

export function updateMetaReadout(meta) {
  $('meta-readout').textContent = `Season ${meta.season} · Episode ${meta.episodeInSeason + 1}`;
}

// ---------- MAIN MENU ----------
export function populateMainMenu(meta, characters, hasRun, handlers) {
  updateMetaReadout(meta);
  $('menu-season').textContent = `Season: ${meta.season}`;
  $('menu-episodes').textContent = `Episodes Completed: ${meta.episodeInSeason}/22`;
  const unlockedCount = characters.filter((c) => c.unlocked).length;
  $('menu-characters').textContent = `Characters Unlocked: ${unlockedCount}/${characters.length}`;
  $('menu-items').textContent = `Items Discovered: ${meta.itemsDiscoveredIds.length}/${totalDiscoverableItemCount()}`;

  const continueBtn = $('btn-continue-run');
  continueBtn.disabled = !hasRun;
  freshButton('btn-play').addEventListener('click', handlers.onPlay);
  if (hasRun) freshButton('btn-continue-run').addEventListener('click', handlers.onContinueRun);
  freshButton('btn-menu-characters').addEventListener('click', handlers.onCharacters);
  freshButton('btn-menu-seasons').addEventListener('click', handlers.onSeasons);
  freshButton('btn-menu-collection').addEventListener('click', handlers.onCollection);
  freshButton('btn-menu-settings').addEventListener('click', handlers.onSettings);
}

function characterCardHtml(character) {
  const portraitUrl = character.unlocked ? getAssetUrl('characters', character.id) : null;
  const portrait = portraitUrl
    ? `<img class="character-portrait" src="${portraitUrl}" alt="${character.name}" />`
    : `<div class="emoji">${character.unlocked ? character.emoji : '\u{1F512}'}</div>`;
  if (!character.unlocked) {
    return `${portrait}<div>${character.name}</div><small>${character.tagline}</small>`;
  }
  return `
    ${portrait}
    <div class="character-card-name">${character.name}</div>
    <ul class="character-card-stats">
      <li><span>Health</span><span>${character.healthLabel}</span></li>
      <li><span>Speed</span><span>${character.speedLabel}</span></li>
      <li><span>Ability</span><span>${character.primaryAbility}</span></li>
      <li><span>Passive</span><span>${character.specialPassive}</span></li>
      <li><span>Difficulty</span><span>${character.difficulty}</span></li>
    </ul>`;
}

export function populateCharacterSelect(characters, onSelect, onBack) {
  const container = $('character-select-grid');
  container.innerHTML = '';
  for (const character of characters) {
    const card = document.createElement('div');
    card.className = 'character-card select-card' + (character.unlocked ? '' : ' locked');
    card.innerHTML = characterCardHtml(character);
    if (character.unlocked) card.addEventListener('click', () => onSelect(character.id));
    container.appendChild(card);
  }
  freshButton('btn-character-select-back').addEventListener('click', onBack);
}

export function populateCharactersInfo(characters, onBack) {
  const container = $('characters-info-grid');
  container.innerHTML = '';
  for (const character of characters) {
    const card = document.createElement('div');
    card.className = 'character-card' + (character.unlocked ? '' : ' locked');
    card.innerHTML = characterCardHtml(character);
    container.appendChild(card);
  }
  freshButton('btn-characters-info-back').addEventListener('click', onBack);
}

export function populateSeasonsInfo(meta, onBack) {
  const list = $('seasons-info-list');
  if (!meta.history.length) {
    list.innerHTML = '<p class="flavor">No episodes recorded yet. Go make some chaos.</p>';
  } else {
    list.innerHTML = meta.history
      .map(
        (r) => `
      <div class="history-row">
        <div><strong>"${r.title}"</strong> — ${r.character} · ${r.modifierName}</div>
        <div class="${r.victory ? 'history-victory' : 'history-defeat'}">${r.victory ? 'VICTORY' : 'DEFEAT'} ${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
      </div>`
      )
      .join('');
  }
  freshButton('btn-seasons-info-back').addEventListener('click', onBack);
}

export function populateCollectionInfo(meta, onBack) {
  const discovered = new Set(meta.itemsDiscoveredIds);
  const container = $('collection-info-grid');
  const entries = [
    ...Object.values(ITEMS).filter((i) => i.id !== 'donut'),
    ...Object.values(UPGRADES),
  ];
  container.innerHTML = entries
    .map((entry) => {
      const found = discovered.has(entry.id);
      return `<div class="collection-card ${found ? '' : 'undiscovered'}">
        <div class="emoji">${found ? entry.emoji : '❔'}</div>
        <div>${found ? entry.name : '???'}</div>
      </div>`;
    })
    .join('');
  freshButton('btn-collection-info-back').addEventListener('click', onBack);
}

export function bindSettings(onReset, onBack) {
  freshButton('btn-settings-reset').addEventListener('click', onReset);
  freshButton('btn-settings-back').addEventListener('click', onBack);
}

// ---------- BOARD ----------
export function populateBoardInfo(episode, node) {
  $('board-episode-title').textContent = `"${episode.title}"`;
  $('board-episode-modifier').textContent = episode.modifierName === 'Alien Invasion' && episode.twistTriggered
    ? '👽 ALIEN INVASION UNDERWAY'
    : episode.modifierName;
  $('board-node-hint').textContent = node ? `Next up: ${node.name} (${node.type})` : 'Choose your next destination.';
}

export function populateBreakingNews(newsText) {
  $('news-text').textContent = newsText;
}

// ---------- ARENA HUD (combat / miniBoss / boss nodes) ----------
export function updateHud(runState, weapon, locationName) {
  $('hud-location').textContent = locationName;
  const pct = Math.max(0, runState.hp / runState.maxHp) * 100;
  $('hud-hp-bar').style.width = `${pct}%`;
  $('hud-hp-bar').style.background = pct < 30 ? '#d0021b' : '#3ec24c';
  $('hud-hp-text').textContent = `${Math.max(0, Math.round(runState.hp))} / ${runState.maxHp}`;
  $('hud-donuts').textContent = `\u{1F369} x${runState.donutsCurrency}`;
  $('hud-weapon').textContent = `Weapon: ${weapon.name}`;
  const buffIcons = [];
  if (runState.buffs.damageMult > 0) buffIcons.push('\u{1F37A}');
  if (runState.buffs.speedMult > 0) buffIcons.push('\u{1F944}');
  if (runState.buffs.fireAura > 0) buffIcons.push('\u{1F525}');
  if (runState.buffs.blinky) buffIcons.push('\u{1F41F}');
  if (runState.armorShield > 0) buffIcons.push('\u{1F6E1}\u{FE0F}');
  $('hud-buffs').textContent = buffIcons.join(' ');
}

export function showBanner(text, ms = 1800) {
  const el = $('banner-text');
  el.textContent = text;
  el.classList.remove('hidden');
  clearTimeout(showBanner._timer);
  showBanner._timer = setTimeout(() => el.classList.add('hidden'), ms);
}

export function showDonutModal(onEat, onSave) {
  const modal = $('donut-modal');
  modal.classList.remove('hidden');
  freshButton('btn-donut-eat').addEventListener('click', () => {
    modal.classList.add('hidden');
    onEat();
  });
  freshButton('btn-donut-save').addEventListener('click', () => {
    modal.classList.add('hidden');
    onSave();
  });
}

export function showShopModal(catalog, shopFlavor, onBuy, onLeave) {
  const modal = $('shop-modal');
  $('shop-text').textContent = shopFlavor;
  const list = $('shop-items');
  list.innerHTML = '';
  for (const entry of catalog) {
    const btn = document.createElement('button');
    btn.className = 'shop-item-btn';
    btn.disabled = !entry.affordable;
    btn.textContent = `${entry.item.emoji} ${entry.item.name} — ${entry.cost} \u{1F369}`;
    btn.addEventListener('click', () => onBuy(entry));
    list.appendChild(btn);
  }
  modal.classList.remove('hidden');
  freshButton('btn-shop-leave').addEventListener('click', () => {
    modal.classList.add('hidden');
    onLeave();
  });
}

export function hideShopModal() {
  $('shop-modal').classList.add('hidden');
}

// ---------- LEVEL COMPLETE / UPGRADE CHOICE ----------
export function populateLevelComplete(summary, upgrades, onPick) {
  $('level-complete-location').textContent = summary.locationName;
  $('level-complete-stats').innerHTML = `
    <li><span>Enemies Defeated</span><span>${summary.enemiesDefeated}</span></li>
    <li><span>Damage Taken</span><span>${summary.damageTaken}</span></li>
    <li><span>Donuts Collected</span><span>${summary.donutsCollected}</span></li>
  `;
  const container = $('upgrade-choices');
  container.innerHTML = '';
  if (upgrades.length === 0) {
    container.innerHTML = '<p class="flavor">No new upgrades available. Onward!</p>';
  }
  for (const upgrade of upgrades) {
    const card = document.createElement('div');
    card.className = 'upgrade-card';
    card.style.borderColor = RARITY_COLOR[upgrade.rarity];
    card.innerHTML = `
      <div class="upgrade-rarity" style="color:${RARITY_COLOR[upgrade.rarity]}">${upgrade.rarity.toUpperCase()}</div>
      <div class="emoji">${upgrade.emoji}</div>
      <div class="upgrade-name">${upgrade.name}</div>
      <div class="upgrade-desc">${upgrade.description}</div>
    `;
    card.addEventListener('click', () => onPick(upgrade));
    container.appendChild(card);
  }
  const skipBtn = freshButton('btn-upgrade-skip');
  skipBtn.classList.toggle('hidden', upgrades.length === 0);
  skipBtn.addEventListener('click', () => onPick(null));
}

// ---------- EVENT NODE ----------
export function populateEvent(event, onChoose) {
  $('event-title').textContent = event.title;
  $('event-emoji').textContent = event.emoji;
  $('event-prompt').textContent = event.prompt;
  $('event-result').classList.add('hidden');
  $('btn-event-continue').classList.add('hidden');
  const container = $('event-options');
  container.innerHTML = '';
  container.classList.remove('hidden');
  for (const option of event.options) {
    const btn = document.createElement('button');
    btn.className = 'big-button event-option-btn';
    btn.textContent = option.label;
    btn.addEventListener('click', () => {
      container.classList.add('hidden');
      $('event-result').textContent = option.resultText;
      $('event-result').classList.remove('hidden');
      $('btn-event-continue').classList.remove('hidden');
      onChoose(option);
    });
    container.appendChild(btn);
  }
}

export function showEventContinue(onContinue) {
  freshButton('btn-event-continue').addEventListener('click', onContinue);
}

// ---------- REST NODE ----------
export function populateRest(node, onHeal, onUpgrade, onTalk) {
  $('rest-location').textContent = node.name;
  freshButton('btn-rest-heal').addEventListener('click', onHeal);
  freshButton('btn-rest-upgrade').addEventListener('click', onUpgrade);
  freshButton('btn-rest-talk').addEventListener('click', onTalk);
}

export function setRestFlavor(text) {
  $('rest-flavor').textContent = text;
}

// ---------- RUN END ----------
function statsListHtml(stats) {
  return `
    <li><span>Town Destruction</span><span>${stats.townDestruction}%</span></li>
    <li><span>Enemies Defeated</span><span>${stats.enemiesDefeated}</span></li>
    <li><span>People Pissed Off</span><span>${stats.peoplePissedOff}</span></li>
    <li><span>Arrests</span><span>${stats.arrests}</span></li>
    <li><span>Donuts Eaten</span><span>${stats.donutsEaten}</span></li>
  `;
}

export function populateRunComplete(meta, result, onReturnHome) {
  $('run-complete-header').textContent = `SEASON ${result.season} · EPISODE ${result.episodeNum}`;
  $('run-complete-title').textContent = `"${result.title}"`;
  $('run-complete-sub').textContent = `${result.character} · ${result.modifierName}`;
  $('run-complete-stats').innerHTML = statsListHtml(result.stats);
  $('run-complete-rating').textContent = '★'.repeat(result.rating) + '☆'.repeat(5 - result.rating);
  $('run-complete-legacy').textContent = `+${result.legacyPointsEarned} Legacy Points`;
  updateMetaReadout(meta);
  freshButton('btn-run-complete-home').addEventListener('click', onReturnHome);
}

export function populateRunFailure(meta, result, onReturnHome) {
  $('run-failure-character').textContent = result.character;
  $('run-failure-node').textContent = result.lastLocationName;
  $('run-failure-stats').innerHTML = statsListHtml(result.stats);
  $('run-failure-legacy').textContent = `+${result.legacyPointsEarned} Legacy Points`;
  updateMetaReadout(meta);
  freshButton('btn-run-failure-home').addEventListener('click', onReturnHome);
}
