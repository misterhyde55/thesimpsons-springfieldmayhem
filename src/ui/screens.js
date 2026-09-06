import { getAssetUrl } from '../data/assets.js';
import { getPortraitUrl, getCharacterInfo } from '../data/characterRegistry.js';
import { RARITY_COLOR, ABILITIES } from '../data/abilities.js';
import { RELICS } from '../data/relics.js';
import { HORROR_RULES } from '../data/horrorRules.js';
import { STATUS_INFO } from '../data/statusEffects.js';
import { ITEMS } from '../data/items.js';
import { getPlayableAbilities, canPlayAbility, abilityCost } from '../systems/battleEngine.js';
import { MenuNav } from './menuNav.js';

const SCREEN_IDS = [
  'screen-main-menu',
  'screen-episode-reveal',
  'screen-segment-title',
  'screen-character-select',
  'screen-characters-info',
  'screen-seasons-info',
  'screen-collection-info',
  'screen-settings',
  'screen-simpson-house',
  'screen-board',
  'screen-travel',
  'screen-location-interior',
  'screen-breaking-news',
  'screen-story-scene',
  'screen-boss-intro',
  'screen-battle',
  'screen-ability-draft',
  'screen-commercial-break',
  'screen-event',
  'screen-run-complete',
  'screen-run-failure',
];

// Screens that get the full-bleed treatment: no top bar, background art
// fills the real viewport instead of #app's max-width.
const FULL_BLEED_SCREEN_IDS = new Set([
  'screen-main-menu',
  'screen-episode-reveal',
  'screen-segment-title',
  'screen-story-scene',
  'screen-battle',
  'screen-boss-intro',
  'screen-commercial-break',
  'screen-travel',
  'screen-location-interior',
]);

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
  document.body.classList.toggle('full-bleed-active', FULL_BLEED_SCREEN_IDS.has(id));
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
const SEGMENT_ORDINALS = ['SEGMENT I', 'SEGMENT II', 'SEGMENT III', 'SEGMENT IV', 'SEGMENT V'];

export function populateEpisodeReveal(character, episode, onStart) {
  const card = freshButton('episode-reveal-card');
  $('episode-reveal-title').textContent = episode.title.toUpperCase();
  $('episode-reveal-segments').innerHTML = episode.segmentTitles
    .map((title, i) => `<li><span>${SEGMENT_ORDINALS[i] || `SEGMENT ${i + 1}`}</span>"${title}"</li>`)
    .join('');
  $('episode-reveal-character').textContent = `Starring: ${character.name.toUpperCase()}`;
  card.addEventListener('click', onStart);
}

// ---------- SEGMENT TITLE CARD ----------
export function populateSegmentTitleCard(segmentIndex, segment, activeRuleIds, onStart) {
  const card = freshButton('segment-title-card');
  $('segment-title-eyebrow').textContent = SEGMENT_ORDINALS[segmentIndex] || `SEGMENT ${segmentIndex + 1}`;
  $('segment-title-name').textContent = `"${segment.segmentTitle}"`;
  $('segment-title-objective').textContent = segment.objective;
  $('segment-title-rules').innerHTML = activeRuleIds
    .map((id) => HORROR_RULES[id])
    .filter(Boolean)
    .map((rule) => `<span class="segment-title-rule-pip">${rule.icon} ${rule.name}</span>`)
    .join('');
  card.addEventListener('click', onStart);
}

// ---------- THE SIMPSON HOUSE (stub hub) ----------
export function populateSimpsonHouse(onCharacters, onBack) {
  freshButton('btn-simpson-house-characters').addEventListener('click', onCharacters);
  freshButton('btn-simpson-house-back').addEventListener('click', onBack);
}

function characterCardHtml(character) {
  // Real art shows even for locked characters (dimmed via .locked) -- no
  // emoji/lock-icon standins once an actual portrait exists for them.
  const portraitUrl = getAssetUrl('characters', character.id);
  const portrait = portraitUrl
    ? `<img class="character-portrait" src="${portraitUrl}" alt="${character.name}" />`
    : `<div class="emoji">${character.unlocked ? character.emoji : '\u{1F512}'}</div>`;
  return `
    ${portrait}
    <div class="character-card-name">${character.name}</div>
    <ul class="character-card-stats">
      <li><span>Health</span><span>${character.healthLabel}</span></li>
      <li><span>Speed</span><span>${character.speedLabel}</span></li>
      <li><span>Ability</span><span>${character.primaryAbility}</span></li>
      <li><span>Passive</span><span>${character.specialPassive}</span></li>
      <li><span>Difficulty</span><span>${character.difficulty}</span></li>
    </ul>
    ${character.unlocked ? '' : `<div class="character-card-locked-tag">${character.secret ? 'SECRET' : 'COMING SOON'}</div>`}`;
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
      .map((r) => {
        const rules = (r.horrorRuleNames || []).join(' + ') || 'Normal Springfield';
        const cast = (r.cast || [r.character]).join(', ');
        return `
      <div class="history-row">
        <div>
          <strong>"${r.title}"</strong> — ${cast}<br />
          <small>${rules} · Peak Mayhem ${r.stats.peakMayhem}%</small>
        </div>
        <div class="${r.victory ? 'history-victory' : 'history-defeat'}">
          ${r.ending ? r.ending.name : r.victory ? 'VICTORY' : 'DEFEAT'}<br />
          ${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}
        </div>
      </div>`;
      })
      .join('');
  }
  freshButton('btn-seasons-info-back').addEventListener('click', onBack);
}

export function populateCollectionInfo(meta, onBack) {
  const discovered = new Set(meta.itemsDiscoveredIds);
  const container = $('collection-info-grid');
  const entries = [...Object.values(ITEMS), ...Object.values(RELICS), ...Object.values(ABILITIES)];
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
export function populateBoardInfo(runState, segment, reachableCount) {
  $('board-episode-title').textContent = `"${runState.episode.title}"`;
  const activeRules = runState.activeHorrorRuleIds.map((id) => HORROR_RULES[id]).filter(Boolean);
  $('board-episode-modifier').textContent = activeRules.length
    ? activeRules.map((r) => `${r.icon} ${r.name}`).join(' + ')
    : segment.segmentTitle;
  $('board-mayhem-readout').textContent = `☠️ MAYHEM: ${runState.mayhem}%`;
  $('board-node-hint').textContent = reachableCount
    ? 'Tap a lit-up location to travel there.'
    : 'No roads open from here. Something has gone very wrong.';

  const strip = $('board-cast-strip');
  strip.innerHTML = runState.cast
    .map((id) => {
      const info = getCharacterInfo(id);
      if (!info) return '';
      return info.portraitUrl
        ? `<img src="${info.portraitUrl}" alt="${info.name}" title="${info.name}" />`
        : `<span title="${info.name}">🧑</span>`;
    })
    .join('');
}

export function populateBreakingNews(newsText) {
  $('news-text').textContent = newsText;
}

// ---------- STORY SCENE (cinematic Treehouse of Horror artwork moments) ----------
// Narration reveals one line at a time on each Continue click; once it runs
// out, either the scene's choices appear (onChoice) or Continue itself
// resolves the scene (onContinue). A scene with no narration at all just
// shows its choices/Continue immediately.
export function populateStoryScene(scene, onChoice, onContinue) {
  $('story-scene-art').style.backgroundImage = scene.image ? `url('${scene.image}')` : 'none';
  $('story-scene-title').textContent = scene.title;
  $('story-scene-narration').textContent = '';
  const choicesEl = $('story-scene-choices');
  choicesEl.innerHTML = '';
  choicesEl.classList.add('hidden');

  const queue = [...(scene.narration || [])];
  const continueBtn = freshButton('btn-story-scene-continue');
  continueBtn.textContent = 'CONTINUE';
  continueBtn.classList.remove('hidden');

  const advance = () => {
    if (queue.length > 0) {
      $('story-scene-narration').textContent = queue.shift();
      return;
    }
    if (scene.choices && scene.choices.length) {
      continueBtn.classList.add('hidden');
      choicesEl.classList.remove('hidden');
      for (const choice of scene.choices) {
        const btn = document.createElement('button');
        btn.className = 'big-button secondary-button story-scene-choice-btn';
        btn.textContent = choice.label;
        btn.addEventListener('click', () => onChoice(choice));
        choicesEl.appendChild(btn);
      }
      return;
    }
    onContinue();
  };
  continueBtn.addEventListener('click', advance);
  advance();
}

// Shows the one-line outcome of a picked choice, then hands off to
// `onContinue` (game.js resolves the choice's `leadsTo` from there).
export function showStorySceneOutcome(text, onContinue) {
  $('story-scene-choices').classList.add('hidden');
  $('story-scene-narration').textContent = text;
  const continueBtn = freshButton('btn-story-scene-continue');
  continueBtn.textContent = 'CONTINUE';
  continueBtn.classList.remove('hidden');
  continueBtn.addEventListener('click', onContinue);
}

// ---------- BOSS INTRO ----------
export function populateBossIntro(boss, onStart) {
  const portraitUrl = getAssetUrl('bosses', boss.id);
  const portraitEl = $('boss-intro-portrait');
  if (portraitUrl) {
    portraitEl.src = portraitUrl;
    portraitEl.classList.remove('hidden');
  } else {
    portraitEl.classList.add('hidden');
  }
  $('boss-intro-name').textContent = boss.name.toUpperCase();
  $('boss-intro-subtitle').textContent = `"${boss.subtitle}"`;
  $('boss-intro-line').textContent = boss.intro;
  const content = freshButton('boss-intro-content');
  content.addEventListener('click', onStart);
}

// ---------- BATTLE ----------
function resolveEnemyPortrait(templateId) {
  return getAssetUrl('bosses', templateId) || getAssetUrl('enemies', templateId) || getAssetUrl('characters', templateId) || null;
}

function statusPipsHtml(statuses) {
  return Object.entries(statuses)
    .filter(([, v]) => v > 0)
    .map(([id, v]) => {
      const info = STATUS_INFO[id];
      return `<span class="status-pip" style="color:${info.color}" title="${info.name}: ${info.description}">${info.icon}${v}</span>`;
    })
    .join('');
}

export function populateBattle(battle, runState, handlers) {
  const bg = getAssetUrl('buildings', battle.locationId);
  $('screen-battle').style.backgroundImage = bg ? `url('${bg}')` : 'none';

  const playerPortrait = getAssetUrl('characters', runState.character.id);
  const pImg = $('battle-player-portrait');
  if (playerPortrait) {
    pImg.src = playerPortrait;
    pImg.classList.remove('hidden');
  } else {
    pImg.classList.add('hidden');
  }
  $('battle-player-name').textContent = runState.character.name.toUpperCase();

  const enemiesContainer = $('battle-enemies');
  enemiesContainer.innerHTML = '';
  for (const enemy of battle.enemies) {
    const slot = document.createElement('div');
    slot.className = 'enemy-slot';
    slot.dataset.enemyId = enemy.instanceId;
    const portraitUrl = resolveEnemyPortrait(enemy.templateId);
    slot.innerHTML = `
      <div class="enemy-intent"></div>
      <div class="status-row"></div>
      ${portraitUrl ? `<img class="battle-portrait enemy-portrait" src="${portraitUrl}" alt="" />` : `<div class="battle-portrait-fallback">${enemy.emoji}</div>`}
      <div class="combatant-footer">
        <div class="combatant-name">${enemy.name}</div>
        <div class="hp-bar-outer"><div class="hp-bar-inner"></div><span class="hp-bar-label"></span></div>
      </div>
    `;
    slot.addEventListener('click', () => handlers.onTargetEnemy(enemy.instanceId));
    enemiesContainer.appendChild(slot);
  }

  const abilitiesContainer = $('battle-abilities');
  abilitiesContainer.innerHTML = '';
  for (const ability of getPlayableAbilities(runState)) {
    const btn = document.createElement('button');
    btn.className = 'ability-btn';
    btn.dataset.abilityId = ability.id;
    btn.innerHTML = `
      <span class="ability-cost"></span>
      <span class="ability-emoji">${ability.emoji}</span>
      <span class="ability-name">${ability.name}</span>
      <span class="ability-desc">${ability.description}</span>
    `;
    btn.addEventListener('click', () => handlers.onAbilityClick(ability.id));
    abilitiesContainer.appendChild(btn);
  }
  freshButton('btn-battle-end-turn').addEventListener('click', () => handlers.onEndTurn());

  renderBattle(battle, runState);
}

// Re-renders the live parts of the battle screen (HP/energy/statuses/
// intents/ability affordability). Called after every action.
export function renderBattle(battle, runState) {
  const p = battle.player;
  $('battle-player-hp-bar').style.width = `${Math.max(0, (p.hp / p.maxHp) * 100)}%`;
  $('battle-player-hp-bar').style.background = p.hp / p.maxHp < 0.3 ? '#d0021b' : '#3ec24c';
  $('battle-player-hp-text').textContent = `${Math.max(0, Math.round(p.hp))} / ${p.maxHp}`;
  $('battle-player-statuses').innerHTML = statusPipsHtml(p.statuses);
  $('battle-energy-value').textContent = p.energy;
  document.querySelector('#battle-energy-readout small').textContent = `/${p.maxEnergy}`;
  $('battle-mayhem-readout').textContent = `☠️ MAYHEM: ${runState.mayhem}%`;
  applyMayhemVisuals(runState.mayhem);

  for (const enemy of battle.enemies) {
    const slot = document.querySelector(`.enemy-slot[data-enemy-id="${enemy.instanceId}"]`);
    if (!slot) continue;
    const dead = enemy.hp <= 0;
    slot.classList.toggle('dead', dead);
    slot.querySelector('.hp-bar-inner').style.width = `${Math.max(0, (enemy.hp / enemy.maxHp) * 100)}%`;
    slot.querySelector('.hp-bar-label').textContent = `${Math.max(0, Math.round(enemy.hp))} / ${enemy.maxHp}`;
    slot.querySelector('.status-row').innerHTML = statusPipsHtml(enemy.statuses);
    const intentEl = slot.querySelector('.enemy-intent');
    intentEl.textContent = !dead && enemy.intent ? `${enemy.intent.icon} ${enemy.intent.label}` : '';
  }

  const abilitiesContainer = $('battle-abilities');
  const targetingAbilityId = abilitiesContainer.dataset.targetingAbilityId || '';
  [...abilitiesContainer.children].forEach((btn) => {
    const ability = ABILITIES[btn.dataset.abilityId];
    btn.querySelector('.ability-cost').textContent = `⚡${abilityCost(battle, runState, ability)}`;
    btn.disabled = battle.outcome !== null || !canPlayAbility(battle, runState, ability.id);
    btn.classList.toggle('targeting', ability.id === targetingAbilityId);
  });
  $('battle-enemies').classList.toggle('targeting-mode', !!targetingAbilityId);
}

export function setBattleTargetingAbility(abilityId) {
  $('battle-abilities').dataset.targetingAbilityId = abilityId || '';
}

// Springfield visibly corrupts as Mayhem climbs -- filter-only, no new DOM,
// so it never gets in the way of reading the battle (or the map). Thresholds
// loosely track data/episodes.js MAYHEM_BANDS (see style.css .mayhem-*).
const MAYHEM_VISUAL_CLASSES = ['mayhem-mid', 'mayhem-high', 'mayhem-max'];
function applyMayhemVisualsToElement(el, mayhem) {
  el.classList.remove(...MAYHEM_VISUAL_CLASSES);
  if (mayhem >= 100) el.classList.add('mayhem-max');
  else if (mayhem >= 70) el.classList.add('mayhem-high');
  else if (mayhem >= 40) el.classList.add('mayhem-mid');
}

export function applyMayhemVisuals(mayhem) {
  applyMayhemVisualsToElement($('screen-battle'), mayhem);
}

// The Springfield map itself visibly corrupts too -- fog/hue-shift on the
// canvas as Mayhem climbs, same tiers as the battle screen.
export function applyMapMayhemVisuals(mayhem) {
  applyMayhemVisualsToElement($('boardCanvas'), mayhem);
}

export function showFloatingNumber(enemyInstanceId, text, kind) {
  const container = enemyInstanceId ? document.querySelector(`.enemy-slot[data-enemy-id="${enemyInstanceId}"]`) : $('battle-side-player');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `floating-number floating-${kind}`;
  el.textContent = text;
  container.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

export function shakeBattleStage() {
  const stage = document.querySelector('.battle-stage');
  if (!stage) return;
  stage.classList.remove('shake');
  // Force reflow so re-adding the class restarts the animation.
  void stage.offsetWidth;
  stage.classList.add('shake');
}

export function appendBattleLog(text) {
  const log = $('battle-log');
  const line = document.createElement('div');
  line.textContent = text;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
  while (log.children.length > 6) log.removeChild(log.firstChild);
}

export function clearBattleLog() {
  $('battle-log').innerHTML = '';
}

let bannerTimer = null;

export function showBanner(text, ms = 1800) {
  const el = $('banner-text');
  el.textContent = text;
  el.classList.remove('hidden');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => el.classList.add('hidden'), ms);
}

// Same banner, but fronted by a character's portrait when the registry has
// one -- for NPC dialogue lines and boss intros. Falls back to a plain text
// banner when no portrait is registered for that id (unknown speaker, or a
// boss like Kang & Kodos with no uploaded art yet).
export function showNpcBanner(characterId, text, ms = 2200) {
  const portraitUrl = getPortraitUrl(characterId);
  if (!portraitUrl) {
    showBanner(text, ms);
    return;
  }
  const el = $('banner-text');
  el.innerHTML = `<img class="banner-npc-portrait" src="${portraitUrl}" alt="" />${text}`;
  el.classList.remove('hidden');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => el.classList.add('hidden'), ms);
}

// ---------- SHOP ----------
export function showShopModal(catalog, shopFlavor, onBuy, onLeave) {
  const modal = $('shop-modal');
  $('shop-text').textContent = shopFlavor;
  const list = $('shop-items');
  list.innerHTML = '';
  for (const entry of catalog) {
    const btn = document.createElement('button');
    btn.className = 'shop-item-btn';
    btn.disabled = !entry.affordable;
    const tag = entry.kind === 'relic' ? ' (Relic)' : '';
    btn.innerHTML = `<strong>${entry.item.emoji} ${entry.item.name}${tag} — ${entry.cost} \u{1F369}</strong><br><small>${entry.item.description}</small>`;
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

// ---------- ABILITY DRAFT (post-battle reward) ----------
export function populateAbilityDraft(summary, abilities, onPick, options = {}) {
  const milestone = !!options.milestone;
  $('ability-draft-heading').textContent = milestone ? '\u{1F31F} NEW ABILITY UNLOCKED \u{1F31F}' : 'VICTORY';
  $('ability-draft-location').textContent = summary.locationName;
  $('ability-draft-stats').innerHTML = `
    <li><span>HP Remaining</span><span>${Math.round(summary.hpRemaining)} / ${summary.maxHp}</span></li>
    <li><span>Mayhem</span><span>${summary.mayhem}%</span></li>
  `;
  $('ability-draft-prompt').textContent = milestone
    ? 'This is a defining moment in the story. The ability is yours.'
    : 'Choose one new ability:';
  const container = $('ability-draft-choices');
  container.innerHTML = '';
  container.classList.toggle('milestone-reveal', milestone);
  if (abilities.length === 0) {
    container.innerHTML = '<p class="flavor">No new abilities available. Onward!</p>';
  }
  for (const ability of abilities) {
    const card = document.createElement('div');
    card.className = 'upgrade-card' + (milestone ? ' upgrade-card-milestone' : '');
    card.style.borderColor = RARITY_COLOR[ability.rarity];
    card.innerHTML = `
      <div class="upgrade-rarity" style="color:${RARITY_COLOR[ability.rarity]}">${ability.rarity.toUpperCase()} · ⚡${ability.cost}</div>
      <div class="emoji">${ability.emoji}</div>
      <div class="upgrade-name">${ability.name}</div>
      <div class="upgrade-desc">${ability.description}</div>
    `;
    if (!milestone) card.addEventListener('click', () => onPick(ability));
    container.appendChild(card);
  }
  const skipBtn = freshButton('btn-ability-draft-skip');
  if (milestone) {
    skipBtn.textContent = 'CONTINUE';
    skipBtn.classList.remove('hidden');
    skipBtn.addEventListener('click', () => onPick(abilities[0]));
  } else {
    skipBtn.textContent = 'SKIP';
    skipBtn.classList.toggle('hidden', abilities.length === 0);
    skipBtn.addEventListener('click', () => onPick(null));
  }
}

// ---------- COMMERCIAL BREAK (segment-boundary reward) ----------
// Replaces a generic reward screen at every segment boundary. Self-manages
// the TV-static "WE'LL BE RIGHT BACK" beat before revealing the sponsor
// products, same way showBanner self-manages its own timeout -- game.js
// just shows the screen and calls this once.
export function populateCommercialBreak(products, onPick, onSkip) {
  $('commercial-break-intro').classList.remove('hidden');
  $('commercial-break-content').classList.add('hidden');

  const choices = $('commercial-break-choices');
  choices.innerHTML = '';
  for (const product of products) {
    const card = document.createElement('div');
    card.className = 'upgrade-card';
    card.innerHTML = `
      <div class="emoji">${product.emoji}</div>
      <div class="upgrade-name">${product.name}</div>
      <div class="upgrade-desc">${product.description}</div>
    `;
    card.addEventListener('click', () => onPick(product));
    choices.appendChild(card);
  }
  freshButton('btn-commercial-break-skip').addEventListener('click', onSkip);

  setTimeout(() => {
    $('commercial-break-intro').classList.add('hidden');
    $('commercial-break-content').classList.remove('hidden');
  }, 1800);
}

// ---------- EVENT NODE ----------
export function populateEvent(event, onChoose) {
  $('event-title').textContent = event.title;
  const portraitUrl = event.npcId ? getPortraitUrl(event.npcId) : null;
  const emojiEl = $('event-emoji');
  if (portraitUrl) {
    emojiEl.innerHTML = `<img class="event-npc-portrait" src="${portraitUrl}" alt="" />`;
  } else {
    emojiEl.textContent = event.emoji;
  }
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
      const resultText = onChoose(option);
      $('event-result').textContent = resultText || option.resultText || '';
      $('event-result').classList.remove('hidden');
      $('btn-event-continue').classList.remove('hidden');
    });
    container.appendChild(btn);
  }
}

export function showEventContinue(onContinue) {
  freshButton('btn-event-continue').addEventListener('click', onContinue);
}

// ---------- TRAVEL (atmospheric scene between locations) ----------
export function populateTravelScreen(scene, sceneLine, destinationName, travelOutcome, onContinue) {
  $('travel-scene-emoji').textContent = scene.emoji;
  $('travel-scene-heading').textContent = `SPRINGFIELD -- EN ROUTE TO ${destinationName.toUpperCase()}`;
  $('travel-scene-line').textContent = `"${sceneLine}"`;
  const outcomeEl = $('travel-event-text');
  if (travelOutcome && travelOutcome.text) {
    outcomeEl.textContent = travelOutcome.text;
    outcomeEl.classList.remove('hidden');
  } else {
    outcomeEl.classList.add('hidden');
  }
  freshButton('btn-travel-continue').addEventListener('click', onContinue);
}

// ---------- LOCATION INTERIOR (enterable Springfield buildings) ----------
export function populateLocationInterior(locationName, state, actionsRemaining, onInteract, onLeave) {
  $('interior-location-name').textContent = locationName.toUpperCase();
  $('interior-actions-readout').textContent = `ACTIONS REMAINING: ${actionsRemaining}`;
  $('interior-background-emoji').textContent = state.background;
  $('interior-intro-text').textContent = state.intro;
  $('interior-result-panel').classList.add('hidden');

  const container = $('interior-interactions');
  container.innerHTML = '';
  container.classList.remove('hidden');
  for (const interaction of state.interactions) {
    const btn = document.createElement('button');
    btn.className = 'big-button interior-interaction-btn';
    btn.disabled = actionsRemaining <= 0;
    btn.innerHTML = `${interaction.label} <small>-${interaction.cost} action${interaction.cost === 1 ? '' : 's'}</small>`;
    btn.addEventListener('click', () => onInteract(interaction));
    container.appendChild(btn);
  }
  freshButton('btn-interior-leave').addEventListener('click', onLeave);
}

// Shows the outcome of one interaction (and, if it opened a conversation,
// its free follow-up replies) in the result panel, hiding the interaction
// list underneath until the player hits Continue.
export function showInteriorResult(text, followUps, onPickFollowUp, onContinue) {
  $('interior-interactions').classList.add('hidden');
  const panel = $('interior-result-panel');
  panel.classList.remove('hidden');
  $('interior-result-text').textContent = text;

  const followUpContainer = $('interior-followups');
  followUpContainer.innerHTML = '';
  if (followUps && followUps.length) {
    for (const followUp of followUps) {
      const btn = document.createElement('button');
      btn.className = 'big-button secondary-button interior-followup-btn';
      btn.textContent = followUp.label;
      btn.addEventListener('click', () => onPickFollowUp(followUp));
      followUpContainer.appendChild(btn);
    }
  }

  const continueBtn = freshButton('btn-interior-result-continue');
  continueBtn.classList.toggle('hidden', !!(followUps && followUps.length));
  continueBtn.addEventListener('click', onContinue);
}

// ---------- RUN END ----------
function statsListHtml(result) {
  return `
    <li><span>Enemies Defeated</span><span>${result.stats.enemiesDefeated}</span></li>
    <li><span>Elites Defeated</span><span>${result.stats.elitesDefeated}</span></li>
    <li><span>Peak Mayhem</span><span>${result.stats.peakMayhem}%</span></li>
    <li><span>Abilities Learned</span><span>${result.abilitiesLearned}</span></li>
    <li><span>Relics Collected</span><span>${result.relicsCollected}</span></li>
  `;
}

export function populateRunComplete(meta, result, onReturnHome) {
  $('run-complete-header').textContent = `SEASON ${result.season} · EPISODE ${result.episodeNum}`;
  $('run-complete-title').textContent = `"${result.title}"`;
  $('run-complete-sub').textContent = `${result.character} · Starring: ${result.cast.join(', ')}`;
  $('run-complete-ending').textContent = result.ending.name;
  $('run-complete-ending-desc').textContent = result.ending.description;
  $('run-complete-stats').innerHTML = statsListHtml(result);
  $('run-complete-rating').textContent = '★'.repeat(result.rating) + '☆'.repeat(5 - result.rating);
  $('run-complete-legacy').textContent = `+${result.legacyPointsEarned} Legacy Points · VIEWERS: ${result.viewers} MILLION`;
  $('run-complete-couch-gag').textContent = result.couchGag.description;
  updateMetaReadout(meta);
  freshButton('btn-run-complete-home').addEventListener('click', onReturnHome);
}

export function populateRunFailure(meta, result, onReturnHome) {
  $('run-failure-ending').textContent = result.ending.name;
  $('run-failure-ending-desc').textContent = result.ending.description;
  $('run-failure-character').textContent = `${result.character} · Starring: ${result.cast.join(', ')}`;
  $('run-failure-node').textContent = result.lastLocationName;
  $('run-failure-stats').innerHTML = statsListHtml(result);
  $('run-failure-legacy').textContent = `+${result.legacyPointsEarned} Legacy Points`;
  $('run-failure-couch-gag').textContent = result.couchGag.description;
  updateMetaReadout(meta);
  freshButton('btn-run-failure-home').addEventListener('click', onReturnHome);
}
