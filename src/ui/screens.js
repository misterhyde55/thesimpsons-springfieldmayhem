import { getAssetUrl } from '../data/assets.js';
import { RARITY_COLOR } from '../data/upgrades.js';
import { ITEMS } from '../data/items.js';
import { UPGRADES } from '../data/upgrades.js';
import { MenuNav } from './menuNav.js';

const SCREEN_IDS = [
  'screen-main-menu',
  'screen-episode-reveal',
  'screen-character-select',
  'screen-characters-info',
  'screen-seasons-info',
  'screen-collection-info',
  'screen-settings',
  'screen-simpson-house',
  'screen-board',
  'screen-breaking-news',
  'screen-arena',
  'screen-level-complete',
  'screen-event',
  'screen-rest',
  'screen-run-complete',
  'screen-run-failure',
];

// Screens that get the full-bleed console title-screen treatment: no top
// bar, background art fills the real viewport instead of #app's max-width.
const MENU_ACTIVE_SCREEN_IDS = new Set(['screen-main-menu', 'screen-episode-reveal']);

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
  document.body.classList.toggle('menu-active', MENU_ACTIVE_SCREEN_IDS.has(id));
}

export function updateMetaReadout(meta) {
  $('meta-readout').textContent = `Season ${meta.season} · Episode ${meta.episodeInSeason + 1}`;
}

// ---------- MAIN MENU ----------
// Console-style vertical menu: a single MenuNav drives both the highlighted
// selector (keyboard/gamepad-ready) and mouse hover/click, so there's only
// one "what's selected" source of truth. Returns the MenuNav so game.js can
// forward arrow-key/Enter input into it.
const MENU_ITEM_DEFS = [
  { id: 'new-episode', label: 'NEW EPISODE' },
  { id: 'continue', label: 'CONTINUE' },
  { id: 'simpson-house', label: 'THE SIMPSON HOUSE' },
  { id: 'episode-guide', label: 'EPISODE GUIDE' },
  { id: 'collection', label: 'COLLECTION' },
  { id: 'options', label: 'OPTIONS' },
];

export function populateMainMenu(meta, hasRun, handlers) {
  updateMetaReadout(meta);

  const bg = getAssetUrl('backgrounds', 'mainMenu');
  if (bg) $('screen-main-menu').style.backgroundImage = `url('${bg}')`;

  const items = MENU_ITEM_DEFS.map((def) => ({
    ...def,
    disabled: def.id === 'continue' && !hasRun,
    onActivate: () => handlers[def.id]?.(),
  }));
  const nav = new MenuNav(items);

  const listEl = $('console-menu-list');
  [...listEl.children].forEach((li, index) => {
    li.classList.toggle('disabled', !!items[index].disabled);
    li.onclick = () => {
      if (items[index].disabled) return;
      nav.select(index);
      renderConsoleMenu(nav);
      nav.activateSelected();
    };
    li.onmouseenter = () => {
      if (items[index].disabled) return;
      nav.select(index);
      renderConsoleMenu(nav);
    };
  });
  renderConsoleMenu(nav);
  return nav;
}

export function renderConsoleMenu(nav) {
  const listEl = $('console-menu-list');
  [...listEl.children].forEach((li, index) => {
    li.classList.toggle('selected', index === nav.selectedIndex);
  });
}

// ---------- EPISODE REVEAL ----------
export function populateEpisodeReveal(character, episode, onStart) {
  const card = freshButton('episode-reveal-card');
  $('episode-reveal-title').textContent = `"${episode.title}"`;
  $('episode-reveal-character').textContent = `Character: ${character.name.toUpperCase()}`;
  $('episode-reveal-objective').textContent = `Objective: ${episode.objective}`;
  card.addEventListener('click', onStart);
}

// ---------- THE SIMPSON HOUSE (stub hub) ----------
export function populateSimpsonHouse(onCharacters, onBack) {
  freshButton('btn-simpson-house-characters').addEventListener('click', onCharacters);
  freshButton('btn-simpson-house-back').addEventListener('click', onBack);
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
export function populateLevelComplete(summary, upgrades, onPick, options = {}) {
  const milestone = !!options.milestone;
  $('level-complete-heading').textContent = milestone ? '\u{1F31F} NEW SKILL UNLOCKED \u{1F31F}' : 'LEVEL COMPLETE';
  $('level-complete-location').textContent = summary.locationName;
  $('level-complete-stats').innerHTML = `
    <li><span>Enemies Defeated</span><span>${summary.enemiesDefeated}</span></li>
    <li><span>Damage Taken</span><span>${summary.damageTaken}</span></li>
    <li><span>Donuts Collected</span><span>${summary.donutsCollected}</span></li>
  `;
  $('upgrade-choice-prompt').textContent = milestone
    ? "This is a defining moment in the story. The skill is yours."
    : 'Choose one upgrade:';
  const container = $('upgrade-choices');
  container.innerHTML = '';
  container.classList.toggle('milestone-reveal', milestone);
  if (upgrades.length === 0) {
    container.innerHTML = '<p class="flavor">No new upgrades available. Onward!</p>';
  }
  for (const upgrade of upgrades) {
    const card = document.createElement('div');
    card.className = 'upgrade-card' + (milestone ? ' upgrade-card-milestone' : '');
    card.style.borderColor = RARITY_COLOR[upgrade.rarity];
    card.innerHTML = `
      <div class="upgrade-rarity" style="color:${RARITY_COLOR[upgrade.rarity]}">${upgrade.rarity.toUpperCase()}</div>
      <div class="emoji">${upgrade.emoji}</div>
      <div class="upgrade-name">${upgrade.name}</div>
      <div class="upgrade-desc">${upgrade.description}</div>
    `;
    if (!milestone) card.addEventListener('click', () => onPick(upgrade));
    container.appendChild(card);
  }
  const skipBtn = freshButton('btn-upgrade-skip');
  if (milestone) {
    skipBtn.textContent = 'CONTINUE';
    skipBtn.classList.remove('hidden');
    skipBtn.addEventListener('click', () => onPick(upgrades[0]));
  } else {
    skipBtn.textContent = 'SKIP';
    skipBtn.classList.toggle('hidden', upgrades.length === 0);
    skipBtn.addEventListener('click', () => onPick(null));
  }
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
