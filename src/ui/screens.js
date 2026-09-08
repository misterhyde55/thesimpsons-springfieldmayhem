import { getAssetUrl } from '../data/assets.js';
import { LOCATIONS } from '../data/locations.js';
import { getPortraitUrl, getCharacterInfo } from '../data/characterRegistry.js';
import { RARITY_COLOR, ABILITIES } from '../data/abilities.js';
import { RELICS } from '../data/relics.js';
import { HORROR_RULES } from '../data/horrorRules.js';
import { STATUS_INFO } from '../data/statusEffects.js';
import { ITEMS } from '../data/items.js';
import { getHandAbilities, canPlayAbility, abilityCost } from '../systems/battleEngine.js';
import { intentIconId, describeIntent } from '../systems/enemyAI.js';
import { MenuNav } from './menuNav.js';
import { iconHtml } from './icons.js';
import { MAYHEM_BANDS, mayhemLabel } from '../data/episodes.js';

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
  'screen-boss-reward',
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
  'screen-board',
]);

// Screens that hide the Treehouse Broadcast HUD (#top-bar) entirely --
// cinematic/story beats only. Map/Combat/Location/Shop screens are also
// full-bleed (above) but now keep the header on screen (see the
// body.header-hidden vs. .map-screen/.battle-screen/.location-interior-
// screen "top: var(--header-h)" rules in style.css).
const HEADER_HIDDEN_SCREEN_IDS = new Set([
  'screen-main-menu',
  'screen-episode-reveal',
  'screen-segment-title',
  'screen-story-scene',
  'screen-boss-intro',
  'screen-commercial-break',
  'screen-travel',
]);

const $ = (id) => document.getElementById(id);

export function freshButton(id) {
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
  document.body.classList.toggle('header-hidden', HEADER_HIDDEN_SCREEN_IDS.has(id));
}

export function updateMetaReadout(meta) {
  $('header-season-episode').textContent = `Season ${meta.season} · Episode ${meta.episodeInSeason + 1}`;
}

// ---------- HEADER (Treehouse Broadcast HUD run info) ----------
// Center episode title + right-side segment/Mayhem readouts. Called
// wherever the board/battle/interior screens already refresh their own
// run info, so the header never falls out of sync with the screen under it.
function mayhemTooltip(mayhem) {
  const label = mayhemLabel(mayhem);
  const bandIndex = MAYHEM_BANDS.findIndex((b) => mayhem <= b.max);
  const next = MAYHEM_BANDS[bandIndex + 1];
  return next
    ? `${label}. At ${MAYHEM_BANDS[bandIndex].max + 1}%+: ${next.label}.`
    : `${label}. Mayhem is maxed out.`;
}

export function updateHeaderRunInfo(runState) {
  const titleEl = $('header-episode-title');
  const segmentEl = $('header-segment-readout');
  const mayhemBtn = $('header-mayhem-readout');
  if (!runState) {
    titleEl.textContent = 'CURRENT EPISODE';
    segmentEl.textContent = '';
    mayhemBtn.textContent = 'MAYHEM 0%';
    mayhemBtn.title = mayhemTooltip(0);
    return;
  }
  titleEl.textContent = runState.episode?.title ? `"${runState.episode.title}"` : 'ZOMBIE OUTBREAK';
  segmentEl.textContent = SEGMENT_ORDINALS[runState.segmentIndex] || `SEGMENT ${runState.segmentIndex + 1}`;
  mayhemBtn.textContent = `MAYHEM ${runState.mayhem}%`;
  mayhemBtn.title = mayhemTooltip(runState.mayhem);
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

// A small ON/OFF toggle button bound the same way in three places below
// (Music/SFX/Mute All) -- one helper instead of three near-identical
// click handlers.
function bindOnOffToggle(id, initialOn, onLabel, offLabel, onChange) {
  const btn = freshButton(id);
  btn.textContent = initialOn ? onLabel : offLabel;
  btn.addEventListener('click', () => {
    const next = btn.textContent !== onLabel;
    btn.textContent = next ? onLabel : offLabel;
    onChange(next);
  });
  return btn;
}

function bindVolumeSlider(sliderId, labelId, initialVolume01, onChange) {
  const slider = freshButton(sliderId);
  const label = $(labelId);
  slider.value = Math.round((initialVolume01 ?? 1) * 100);
  label.textContent = `${slider.value}%`;
  slider.addEventListener('input', () => {
    label.textContent = `${slider.value}%`;
    onChange(Number(slider.value) / 100);
  });
}

export function populateSettings(meta, handlers) {
  bindVolumeSlider('settings-master-volume', 'settings-master-volume-label', meta.settings.masterVolume ?? 1, handlers.onMasterVolumeChange);
  bindOnOffToggle('btn-settings-music-toggle', meta.settings.musicOn, 'ON', 'OFF', handlers.onMusicToggle);
  bindVolumeSlider('settings-music-volume', 'settings-music-volume-label', meta.settings.musicVolume, handlers.onVolumeChange);
  bindOnOffToggle('btn-settings-sfx-toggle', meta.settings.sfxOn, 'ON', 'OFF', handlers.onSfxToggle);
  bindVolumeSlider('settings-sfx-volume', 'settings-sfx-volume-label', meta.settings.sfxVolume, handlers.onSfxVolumeChange);
  bindOnOffToggle('btn-settings-mute-toggle', handlers.muted, 'ON', 'OFF', handlers.onMuteToggle);

  freshButton('btn-settings-reset').addEventListener('click', handlers.onReset);
  freshButton('btn-settings-back').addEventListener('click', handlers.onBack);
}

// ---------- BOARD ----------
export function populateBoardInfo(runState, segment, reachableCount) {
  updateHeaderRunInfo(runState);
  $('board-episode-title').textContent = `"${runState.episode.title}"`;
  const activeRules = runState.activeHorrorRuleIds.map((id) => HORROR_RULES[id]).filter(Boolean);
  $('board-episode-modifier').textContent = activeRules.length
    ? activeRules.map((r) => `${r.icon} ${r.name}`).join(' + ')
    : segment.segmentTitle;
  $('board-mayhem-readout').textContent = `☠️ MAYHEM: ${runState.mayhem}%`;
  $('board-cash-readout').textContent = `🍩 ${runState.donutsCurrency}`;
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

// ---------- PAUSE MENU ----------
export function showPauseMenu(onResume, onSaveExit) {
  $('pause-menu-modal').classList.remove('hidden');
  freshButton('btn-pause-resume').addEventListener('click', onResume);
  freshButton('btn-pause-save-exit').addEventListener('click', onSaveExit);
}

export function hidePauseMenu() {
  $('pause-menu-modal').classList.add('hidden');
}

// ---------- QUEST TRACKER ----------
export function populateQuestTrackerToggle(activeQuests, onOpen) {
  const btn = freshButton('btn-open-quest-tracker');
  btn.classList.toggle('hidden', activeQuests.length === 0);
  $('quest-tracker-count').textContent = activeQuests.length ? `(${activeQuests.length})` : '';
  btn.addEventListener('click', onOpen);
}

function activeQuestCardHtml(quest) {
  return `
    <div class="quest-tracker-title">${quest.title}</div>
    <div class="quest-tracker-hint">${quest.hint}</div>
    <div class="quest-tracker-reward">REWARD: ${quest.reward}</div>
    ${quest.locationId ? '<button type="button" class="quest-tracker-show-map-btn">SHOW ON MAP</button>' : ''}
  `;
}

// `data`: {objectiveText, sideQuests, familyQuests, resolvedQuests} -- see
// game.js openQuestJournal. Sections only render when they have something
// in them, so a fresh run just shows MAIN OBJECTIVE and nothing else.
export function showQuestTrackerModal(data, onClose, onShowOnMap) {
  $('quest-tracker-objective').innerHTML = `
    <div class="quest-tracker-section-label">MAIN OBJECTIVE</div>
    <div class="quest-tracker-hint">${data.objectiveText}</div>
  `;

  const list = $('quest-tracker-list');
  list.innerHTML = '';
  const sections = [
    ['SIDE QUESTS', data.sideQuests],
    ['FAMILY QUESTS', data.familyQuests],
  ];
  let anyActive = false;
  for (const [label, quests] of sections) {
    if (!quests.length) continue;
    anyActive = true;
    const heading = document.createElement('div');
    heading.className = 'quest-tracker-section-label';
    heading.textContent = label;
    list.appendChild(heading);
    for (const quest of quests) {
      const card = document.createElement('div');
      card.className = 'quest-tracker-card';
      card.innerHTML = activeQuestCardHtml(quest);
      if (quest.locationId && onShowOnMap) {
        card.querySelector('.quest-tracker-show-map-btn').addEventListener('click', () => onShowOnMap(quest.locationId));
      }
      list.appendChild(card);
    }
  }
  if (!anyActive) {
    const empty = document.createElement('p');
    empty.className = 'quest-tracker-empty';
    empty.textContent = 'Nothing active right now. Keep exploring Springfield.';
    list.appendChild(empty);
  }
  if (data.resolvedQuests.length) {
    const heading = document.createElement('div');
    heading.className = 'quest-tracker-section-label';
    heading.textContent = 'COMPLETED';
    list.appendChild(heading);
    for (const quest of data.resolvedQuests) {
      const card = document.createElement('div');
      card.className = 'quest-tracker-card quest-tracker-card-resolved';
      card.innerHTML = `<div class="quest-tracker-title">${quest.title}</div><div class="quest-tracker-hint">${quest.outcome.toUpperCase()}</div>`;
      list.appendChild(card);
    }
  }

  $('quest-tracker-modal').classList.remove('hidden');
  freshButton('btn-quest-tracker-close').addEventListener('click', () => {
    $('quest-tracker-modal').classList.add('hidden');
    if (onClose) onClose();
  });
}

// SHOW ON MAP (game.js onQuestShowOnMap) closes the tracker itself before
// panning/inspecting, rather than routing back through the CLOSE button's
// own onClose callback -- that callback is for "the player dismissed this,"
// not "we're navigating them somewhere else."
export function hideQuestTrackerModal() {
  $('quest-tracker-modal').classList.add('hidden');
}

export function populateBreakingNews(newsText) {
  $('news-text').textContent = newsText;
}

// ---------- STORY SCENE (cinematic Treehouse of Horror artwork moments) ----------
// Narration reveals one line at a time on each Continue click; once it runs
// out, either the scene's choices appear (onChoice) or Continue itself
// resolves the scene (onContinue). A scene with no narration at all just
// shows its choices/Continue immediately.
// A choice's danger rating (0-4) as a small row of pips -- filled pips use
// the card's own tone color (set via CSS on .decision-danger), empty ones
// stay dim, so "how risky is this" reads at a glance without needing to
// parse a number.
function dangerPipsHtml(danger) {
  const n = Math.max(0, Math.min(4, danger || 0));
  let out = '';
  for (let i = 0; i < 4; i += 1) out += `<span class="decision-danger-pip${i < n ? ' filled' : ''}"></span>`;
  return out;
}

// One data-driven decision card -- see data/treehouseScenes.js's header
// comment for the full field list. Never a generic <button>: category
// drives the icon + small type badge, tone drives the accent color, and
// known effects/warnings/cost are always visible before the player commits
// (REDESIGN ALL DECISION / STORY SCREENS -- "choices must explain what
// they do"). `unknown` choices collapse effects/warnings into a single
// "???" line instead, preserving mystery on purpose.
function decisionCardHtml(choice, disabledReason) {
  const tone = choice.tone || 'safe';
  const effectsHtml = choice.unknown
    ? '<li class="decision-effect-unknown">??? UNKNOWN CONSEQUENCE</li>'
    : (choice.effects || []).map((e) => `<li class="decision-effect-good">${e}</li>`).join('');
  const warningsHtml = choice.unknown ? '' : (choice.warnings || []).map((w) => `<li class="decision-effect-warn">${w}</li>`).join('');
  return `
    <button class="decision-card tone-${tone}" data-choice-id="${choice.id}" ${disabledReason ? 'disabled' : ''}>
      <div class="decision-card-top">
        <span class="decision-card-icon">${iconHtml('decision', choice.category || 'risk', choice.category || 'CHOICE')}</span>
        <span class="decision-card-type">${(choice.category || '').toUpperCase()}</span>
        <span class="decision-danger">${dangerPipsHtml(choice.danger)}</span>
      </div>
      <div class="decision-card-label">${choice.label}</div>
      <div class="decision-card-desc">${choice.description || ''}</div>
      ${choice.combatPreview ? `<div class="decision-card-combat">⚔ ${choice.combatPreview}</div>` : ''}
      ${choice.cost ? `<div class="decision-card-cost">COST: ${choice.cost}</div>` : ''}
      <ul class="decision-card-effects">${effectsHtml}${warningsHtml}</ul>
      ${disabledReason ? `<div class="decision-card-disabled-reason">${disabledReason}</div>` : ''}
    </button>
  `;
}

export function populateStoryScene(scene, onChoice, onContinue, runState) {
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
      choicesEl.innerHTML = scene.choices.map((c) => decisionCardHtml(c, c.disabledReason && runState ? c.disabledReason(runState) : null)).join('');
      for (const choice of scene.choices) {
        const btn = choicesEl.querySelector(`[data-choice-id="${choice.id}"]`);
        if (btn && !btn.disabled) btn.addEventListener('click', () => onChoice(choice));
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
// `effects`, when given, also fires the reward-toast chip stack so the
// player sees the actual mechanical consequence (HP -8, +8% MAYHEM, ...),
// not just narration text (REDESIGN ALL DECISION / STORY SCREENS --
// "consequence feedback").
export function showStorySceneOutcome(text, onContinue, effects) {
  $('story-scene-choices').classList.add('hidden');
  $('story-scene-narration').textContent = text;
  if (effects && effects.length) showRewardToasts(effects);
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
// A registered asset path doesn't guarantee the file actually exists (see
// ui/icons.js's identical concern) -- both portrait <img>s render
// optimistically and fall back to the adjacent letter badge on load
// failure, never an emoji.
if (typeof window !== 'undefined') {
  window.__battlePortraitError = function (img) {
    img.classList.add('hidden');
    const fallback = img.nextElementSibling;
    if (fallback) fallback.classList.remove('hidden');
  };
}

function resolveEnemyPortrait(templateId) {
  return getAssetUrl('bosses', templateId) || getAssetUrl('enemies', templateId) || getAssetUrl('characters', templateId) || null;
}

function statusPipsHtml(statuses) {
  return Object.entries(statuses)
    .filter(([, v]) => v > 0)
    .map(([id, v]) => {
      const info = STATUS_INFO[id];
      return `<span class="status-pip" title="${info.name}: ${info.description}">${iconHtml('status', info.iconId, info.name)}${v}</span>`;
    })
    .join('');
}

// The current boss phase, for the "BOSS -- PHASE N" (or "-- N -- NAME" when
// a phase sets one, e.g. Devil Ned's TEMPTATION/HELLFIRE/THE CONTRACT) --
// see data/bosses.js `phases`, already used by systems/enemyAI.js to pick
// the active intent pool. 1-indexed to match how the design is talked about.
function bossPhaseInfo(enemy) {
  const phases = enemy.template.phases;
  if (!phases) return null;
  const hpPct = enemy.hp / enemy.maxHp;
  const idx = phases.findIndex((p) => hpPct > p.minHpPct);
  const i = idx === -1 ? phases.length - 1 : idx;
  return { number: i + 1, name: phases[i].name || null };
}

function bossPhaseLabelText(enemy) {
  const info = bossPhaseInfo(enemy);
  if (!info) return '';
  return `BOSS &mdash; PHASE ${info.number}${info.name ? ` &mdash; ${info.name}` : ''}`;
}

// Rebuilds the hand from battle.hand every call (see systems/battleEngine.js
// drawCards) -- cheap at hand-size <=5, and the only way the DOM stays in
// sync with what's actually playable after a card is played or a new turn
// draws a fresh hand. Click handling is delegated (see populateBattle), so
// rebuilding here never needs to re-bind listeners.
function renderHandCards(battle, runState) {
  const container = $('battle-abilities');
  const targetingAbilityId = container.dataset.targetingAbilityId || '';
  container.innerHTML = getHandAbilities(battle)
    .map(
      (ability) => `
      <button class="action-card archetype-${ability.archetype}${ability.upgraded ? ' upgraded' : ''}" data-ability-id="${ability.id}">
        <span class="action-cost">${abilityCost(battle, runState, ability)}</span>
        <span class="action-rarity" style="background:${RARITY_COLOR[ability.rarity] || RARITY_COLOR.common}"></span>
        <span class="action-icon-wrap">${iconHtml(ability.icon.category, ability.icon.id, ability.name)}</span>
        <span class="action-name">${ability.name.toUpperCase()}</span>
        <span class="action-desc">${ability.description}</span>
        <span class="action-type-badge">${ability.archetype.toUpperCase()}</span>
      </button>
    `
    )
    .join('');
  for (const btn of container.children) {
    const ability = ABILITIES[btn.dataset.abilityId];
    btn.disabled = battle.outcome !== null || !canPlayAbility(battle, runState, ability.id);
    btn.classList.toggle('targeting', ability.id === targetingAbilityId);
  }
  $('battle-draw-count').textContent = battle.drawPile.length;
  $('battle-discard-count').textContent = battle.discardPile.length;
}

export function populateBattle(battle, runState, handlers) {
  const bg = getAssetUrl('buildings', battle.locationId);
  $('screen-battle').style.backgroundImage = bg ? `url('${bg}')` : 'none';
  $('battle-location-name').textContent = (LOCATIONS[battle.locationId]?.name || 'Springfield').toUpperCase();

  // A persistent reminder of whichever Horror Rule(s) are active this
  // segment (REDESIGN COMBAT GAMEPLAY: "Horror Rules appear during combat")
  // -- shown as a small always-visible badge rather than a one-off banner,
  // since the rule keeps mattering for the whole fight, not just its start.
  const activeRules = (runState.activeHorrorRuleIds || []).map((id) => HORROR_RULES[id]).filter(Boolean);
  const ruleBadge = $('battle-horror-rule');
  ruleBadge.classList.toggle('hidden', activeRules.length === 0);
  ruleBadge.innerHTML = activeRules.map((r) => `<span title="${r.description || ''}">${r.icon} ${r.name}</span>`).join('');

  const playerPortrait = getAssetUrl('characters', runState.character.id);
  const pImg = $('battle-player-portrait');
  const pFallback = $('battle-player-portrait-fallback');
  pFallback.textContent = runState.character.name[0];
  if (playerPortrait) {
    pImg.src = playerPortrait;
    pImg.onerror = () => window.__battlePortraitError(pImg);
    pImg.classList.remove('hidden');
    pFallback.classList.add('hidden');
  } else {
    pImg.classList.add('hidden');
    pFallback.classList.remove('hidden');
  }
  $('battle-player-name').textContent = runState.character.name.toUpperCase();

  document.querySelector('.battle-stage').classList.toggle('is-boss', !!battle.isBoss);

  const enemiesContainer = $('battle-enemies');
  enemiesContainer.className = `battle-enemies-row count-${battle.enemies.length}`;
  enemiesContainer.innerHTML = '';
  for (const enemy of battle.enemies) {
    const slot = document.createElement('div');
    slot.className = 'enemy-slot';
    slot.dataset.enemyId = enemy.instanceId;
    const portraitUrl = resolveEnemyPortrait(enemy.templateId);
    slot.innerHTML = `
      <div class="enemy-intent"></div>
      <div class="status-row"></div>
      ${
        portraitUrl
          ? `<img class="battle-portrait enemy-portrait" src="${portraitUrl}" alt="" onerror="window.__battlePortraitError(this)" />`
          : ''
      }
      <div class="battle-portrait-fallback enemy-portrait-fallback${portraitUrl ? ' hidden' : ''}">${enemy.name[0]}</div>
      <div class="combatant-footer">
        <div class="combatant-name">${enemy.name}</div>
        ${battle.isBoss ? `<div class="boss-phase-label">${bossPhaseLabelText(enemy)}</div>` : ''}
        <div class="hp-bar-outer"><div class="hp-bar-ghost"></div><div class="hp-bar-inner"></div><span class="hp-bar-label"></span></div>
        ${
          enemy.breakMax
            ? '<div class="break-bar-outer"><div class="break-bar-inner"></div><span class="break-bar-label"></span></div>'
            : ''
        }
      </div>
    `;
    slot.addEventListener('click', () => handlers.onTargetEnemy(enemy.instanceId));
    enemiesContainer.appendChild(slot);
  }

  // The hand is redrawn every render (it changes every play and every new
  // turn -- see systems/battleEngine.js drawCards), so clicks are handled
  // via one delegated listener on the container instead of per-card
  // listeners that would need re-binding on every rebuild.
  $('battle-abilities').onclick = (e) => {
    const card = e.target.closest('.action-card');
    if (card && !card.disabled) handlers.onAbilityClick(card.dataset.abilityId);
  };
  renderHandCards(battle, runState);
  freshButton('btn-battle-end-turn').addEventListener('click', () => handlers.onEndTurn());
  freshButton('btn-battle-draw-pile').addEventListener('click', () => handlers.onInspectPile('draw'));
  freshButton('btn-battle-discard-pile').addEventListener('click', () => handlers.onInspectPile('discard'));

  // Battlefield objects (data/battleEnvironments.js) -- free, limited-use
  // actions separate from Homer's own ability deck. Only some encounters
  // have any (battle.environment is [] otherwise), so the row hides itself.
  const envContainer = $('battle-environment');
  envContainer.innerHTML = '';
  envContainer.classList.toggle('hidden', battle.environment.length === 0);
  for (const action of battle.environment) {
    const btn = document.createElement('button');
    btn.className = 'environment-action-btn';
    btn.dataset.actionId = action.id;
    btn.title = action.description;
    btn.innerHTML = `
      <span class="env-action-icon">${action.icon}</span>
      <span class="env-action-name">${action.label}</span>
      <span class="env-action-uses"></span>
    `;
    btn.addEventListener('click', () => handlers.onEnvironmentClick(action.id));
    envContainer.appendChild(btn);
  }

  // Held consumables (data/items.js runState.consumables) usable mid-fight
  // (REDESIGN COMBAT GAMEPLAY: "show a few inventory slots... player can
  // use consumables during battle"). Rebuilt here (buttons per owned item
  // id) since the bag's contents only change between battles, not turn to
  // turn -- renderBattle just updates quantity text/disabled state below.
  const consumableContainer = $('battle-consumables');
  consumableContainer.innerHTML = '';
  const ownedItemIds = Object.keys(runState.consumables || {}).filter((id) => runState.consumables[id] > 0);
  consumableContainer.classList.toggle('hidden', ownedItemIds.length === 0);
  for (const itemId of ownedItemIds) {
    const item = ITEMS[itemId];
    if (!item) continue;
    const btn = document.createElement('button');
    btn.className = 'consumable-action-btn';
    btn.dataset.itemId = itemId;
    btn.title = item.description;
    btn.innerHTML = `
      <span class="consumable-action-icon">${item.emoji}</span>
      <span class="consumable-action-name">${item.name.toUpperCase()}</span>
      <span class="consumable-action-qty"></span>
    `;
    btn.addEventListener('click', () => handlers.onConsumableClick(itemId));
    consumableContainer.appendChild(btn);
  }

  renderBattle(battle, runState);
}

// Re-renders the live parts of the battle screen (HP/energy/statuses/
// intents/ability affordability). Called after every action.
export function renderBattle(battle, runState) {
  const p = battle.player;
  const playerHpPct = `${Math.max(0, (p.hp / p.maxHp) * 100)}%`;
  $('battle-player-hp-bar').style.width = playerHpPct;
  $('battle-player-hp-bar').style.background = p.hp / p.maxHp < 0.3 ? '#d0021b' : '#3ec24c';
  $('battle-player-hp-bar-ghost').style.width = playerHpPct;
  $('battle-player-hp-text').textContent = `${Math.max(0, Math.round(p.hp))} / ${p.maxHp}`;
  $('battle-player-statuses').innerHTML = statusPipsHtml(p.statuses);
  $('battle-energy-value').textContent = p.energy;
  document.querySelector('#battle-energy-readout small').textContent = `/${p.maxEnergy}`;
  $('battle-mayhem-readout').textContent = `MAYHEM: ${runState.mayhem}%`;
  applyMayhemVisuals(runState.mayhem);
  updateHeaderRunInfo(runState);

  for (const enemy of battle.enemies) {
    const slot = document.querySelector(`.enemy-slot[data-enemy-id="${enemy.instanceId}"]`);
    if (!slot) continue;
    const dead = enemy.hp <= 0;
    slot.classList.toggle('dead', dead);
    const enemyHpPct = `${Math.max(0, (enemy.hp / enemy.maxHp) * 100)}%`;
    slot.querySelector('.hp-bar-inner').style.width = enemyHpPct;
    slot.querySelector('.hp-bar-ghost').style.width = enemyHpPct;
    slot.querySelector('.hp-bar-label').textContent = `${Math.max(0, Math.round(enemy.hp))} / ${enemy.maxHp}`;
    slot.querySelector('.status-row').innerHTML = statusPipsHtml(enemy.statuses);
    const breakOuter = slot.querySelector('.break-bar-outer');
    if (breakOuter) {
      breakOuter.querySelector('.break-bar-inner').style.width = `${Math.max(0, (enemy.break / enemy.breakMax) * 100)}%`;
      breakOuter.querySelector('.break-bar-label').textContent = `BREAK ${Math.max(0, enemy.break)}/${enemy.breakMax}`;
    }
    const phaseLabelEl = slot.querySelector('.boss-phase-label');
    if (phaseLabelEl) phaseLabelEl.innerHTML = bossPhaseLabelText(enemy);
    const intentEl = slot.querySelector('.enemy-intent');
    if (!dead && enemy.intent) {
      intentEl.innerHTML = `${iconHtml('intent', intentIconId(enemy.intent.type), enemy.intent.label)}<span class="enemy-intent-value">${enemy.intent.value ?? ''}</span>`;
      intentEl.title = describeIntent(enemy.name, enemy.intent);
    } else {
      intentEl.innerHTML = '';
      intentEl.title = '';
    }
  }

  const targetingAbilityId = $('battle-abilities').dataset.targetingAbilityId || '';
  renderHandCards(battle, runState);
  $('battle-enemies').classList.toggle('targeting-mode', !!targetingAbilityId);

  const envContainer = $('battle-environment');
  for (const action of battle.environment) {
    const btn = envContainer.querySelector(`[data-action-id="${action.id}"]`);
    if (!btn) continue;
    btn.disabled = battle.outcome !== null || action.usesLeft <= 0;
    btn.classList.toggle('targeting', action.id === targetingAbilityId);
    btn.querySelector('.env-action-uses').textContent = `x${action.usesLeft}`;
  }

  const consumableContainer = $('battle-consumables');
  for (const btn of consumableContainer.children) {
    const qty = (runState.consumables || {})[btn.dataset.itemId] || 0;
    btn.disabled = battle.outcome !== null || qty <= 0;
    btn.querySelector('.consumable-action-qty').textContent = `x${qty}`;
  }
}

export function setBattleTargetingAbility(abilityId) {
  $('battle-abilities').dataset.targetingAbilityId = abilityId || '';
}

// Draw/discard pile inspect (REDESIGN COMBAT GAMEPLAY: "small clickable
// indicators for DRAW/DISCARD... clicking one allows the player to inspect
// those cards"). `abilityIds` is battle.drawPile or battle.discardPile
// as-is -- unordered for the draw pile is intentional, it's a real
// shuffled pile, not a preview of what's coming next.
export function showPileInspect(title, abilityIds) {
  $('pile-inspect-title').textContent = `${title} (${abilityIds.length})`;
  const list = $('pile-inspect-list');
  if (!abilityIds.length) {
    list.innerHTML = '<p class="pile-inspect-empty">Empty.</p>';
  } else {
    list.innerHTML = abilityIds
      .map((id) => ABILITIES[id])
      .filter(Boolean)
      .map(
        (ability) => `
        <div class="pile-inspect-row">
          <span class="action-icon-wrap">${iconHtml(ability.icon.category, ability.icon.id, ability.name)}</span>
          <span class="pile-inspect-name">${ability.name.toUpperCase()}</span>
          <span class="pile-inspect-cost">${ability.cost}</span>
        </div>
      `
      )
      .join('');
  }
  $('pile-inspect-modal').classList.remove('hidden');
}

export function hidePileInspect() {
  $('pile-inspect-modal').classList.add('hidden');
}

// Rare/Epic abilities get a brief large-card moment before resolving (see
// game.js resolveAbilityPlay) -- Common/Uncommon abilities never call this,
// so pacing stays fast for ordinary attacks/skills.
export function showLargeCardPreview(ability, onDone) {
  const cardEl = $('large-card-preview-card');
  cardEl.className = `large-card-preview-card archetype-${ability.archetype}`;
  cardEl.innerHTML = `
    <span class="action-cost large">${ability.cost}</span>
    <span class="action-rarity" style="background:${RARITY_COLOR[ability.rarity] || RARITY_COLOR.common}"></span>
    <span class="action-icon-wrap large">${iconHtml(ability.icon.category, ability.icon.id, ability.name)}</span>
    <span class="action-name large">${ability.name.toUpperCase()}</span>
    <span class="action-desc large">${ability.description}</span>
    <span class="action-type-badge">${ability.archetype.toUpperCase()}</span>
  `;
  const overlay = $('large-card-preview');
  overlay.classList.remove('hidden');
  requestAnimationFrame(() => overlay.classList.add('showing'));
  setTimeout(() => {
    overlay.classList.remove('showing');
    setTimeout(() => {
      overlay.classList.add('hidden');
      onDone();
    }, 200);
  }, 850);
}

// Quick (<0.5s) reactions on a combatant until real hit/cast animation
// assets exist -- see style.css .combatant-hit/-heal/-cast. `enemyInstanceId`
// null means the player's own side.
export function playCombatantAnimation(enemyInstanceId, kind) {
  const el = enemyInstanceId ? document.querySelector(`.enemy-slot[data-enemy-id="${enemyInstanceId}"]`) : $('battle-side-player');
  if (!el) return;
  const className = `combatant-${kind}`;
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
  setTimeout(() => el.classList.remove(className), 500);
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
// map viewport as Mayhem climbs, same tiers as the battle screen.
export function applyMapMayhemVisuals(mayhem) {
  applyMayhemVisualsToElement($('map-viewport'), mayhem);
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

// A brief dramatic pause for a boss phase transition (data/bosses.js
// `transitionLine`, e.g. Zombie Ned's "Okie dokie...") -- darkens the
// battlefield for the duration game.js holds it, distinct from the ordinary
// per-hit shake/flash.
export function setBattleDarkened(on) {
  document.querySelector('.battle-stage')?.classList.toggle('battle-darkened', on);
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

// Distinct from showBanner (narrative NPC/story lines): a stack of short-
// lived gold chips for mechanical gains/losses ("+$14 CASH", "MOE
// RELATIONSHIP +10") so the player never has to infer a consequence from
// dialogue text alone. Pass an array of either strings or {text, negative}
// objects; each chip removes itself after its animation.
export function showRewardToasts(entries) {
  const stack = $('reward-toast-stack');
  const list = Array.isArray(entries) ? entries : [entries];
  list.forEach((entry, i) => {
    const { text, negative } = typeof entry === 'string' ? { text: entry, negative: false } : entry;
    if (!text) return;
    setTimeout(() => {
      const chip = document.createElement('div');
      chip.className = 'reward-toast-chip' + (negative ? ' negative' : '');
      chip.textContent = text;
      stack.appendChild(chip);
      setTimeout(() => chip.remove(), 2700);
    }, i * 220);
  });
}

// ---------- GLOBAL SOUND CONTROL ----------
// Reflects the master-mute flag on the one persistent HUD button (see
// index.html) -- toggles which of its two real SVG icons shows, its
// pressed state, and its tooltip. game.js is the only caller; it's the
// single source of truth for whether audio is actually muted.
export function updateSoundButtons(muted) {
  const btn = $('btn-sound-toggle');
  if (!btn) return;
  btn.classList.toggle('is-muted', muted);
  btn.setAttribute('aria-pressed', String(muted));
  btn.title = muted ? 'Sound muted -- click to unmute' : 'Sound on -- click to mute';
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
    const tag = entry.kind === 'relic' ? ' (Relic)' : entry.item.rare ? ' (Rare Find)' : '';
    const stockNote = entry.stock <= 1 ? ' <em>(last one!)</em>' : ` <em>(${entry.stock} left)</em>`;
    btn.innerHTML = `<strong>${entry.item.emoji} ${entry.item.name}${tag} — ${entry.cost} \u{1F369}</strong>${stockNote}<br><small>${entry.item.description}</small>`;
    btn.addEventListener('click', () => onBuy(entry));
    list.appendChild(btn);
  }
  if (!catalog.length) {
    const empty = document.createElement('p');
    empty.className = 'shop-empty-note';
    empty.textContent = "Shelves are picked clean. Come back another visit.";
    list.appendChild(empty);
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

// ---------- CHOICE MODAL / StoryEventModal (Devil Ned's deals + reward,
// data/devilDeals.js; Zombie Ned's Rod & Todd mid-fight event + reward,
// data/bosses.js; ENCOUNTER COMPLETE summary) ----------
// Generic N-option event popup: {title, subtitle?, icon?, speaker?,
// prompt|bodyHtml, choiceA, choiceB, choiceC?, choiceD?}. Each choice is a
// decisionCardHtml-shaped object -- {label, apply(...), id?, category?,
// tone?, description?, cost?, danger?, effects?, warnings?} -- rendered
// through the exact same torn-panel decision-card system the Treehouse
// Scenes use (REDESIGN ALL STORY / MID-COMBAT DECISION POPUPS), so a caller
// that only supplies {label, apply} still gets the themed card, just
// without the extra bullets/danger pips. Always at least two buttons, no
// "leave" -- a deal or a reward always needs a real pick, never a shrug.
// `bodyHtml` (trusted, internally-authored content only) lets the
// ENCOUNTER COMPLETE summary render a stat list instead of a single line
// of prose. The background stays visible behind the modal (see .modal's
// own translucent scrim in style.css) -- this never fully hides combat.
const CHOICE_LETTERS = ['A', 'B', 'C', 'D'];

export function showChoiceModal(deal, onChoose) {
  $('choice-modal-eyebrow').innerHTML = deal.icon
    ? `${iconHtml('decision', deal.icon, 'Event', 'choice-modal-eyebrow-icon')}<span>EVENT</span>`
    : '<span>EVENT</span>';
  $('choice-modal-title').textContent = deal.title || '';
  const promptEl = $('choice-modal-prompt');
  if (deal.bodyHtml) {
    promptEl.innerHTML = deal.bodyHtml;
  } else if (deal.speaker) {
    promptEl.innerHTML = `<span class="choice-modal-speaker">${deal.speaker}:</span> ${deal.prompt || ''}`;
  } else {
    promptEl.textContent = deal.prompt || '';
  }
  const container = $('choice-modal-options');
  container.innerHTML = '';
  const choices = [deal.choiceA, deal.choiceB, deal.choiceC, deal.choiceD].filter(Boolean);
  container.innerHTML = choices
    .map((choice, i) => decisionCardHtml({ ...choice, id: choice.id || CHOICE_LETTERS[i] }, null))
    .join('');
  for (const choice of choices) {
    const id = choice.id || CHOICE_LETTERS[choices.indexOf(choice)];
    const btn = container.querySelector(`[data-choice-id="${id}"]`);
    if (btn) btn.addEventListener('click', () => onChoose(choice));
  }
  $('choice-modal-result').classList.add('hidden');
  container.classList.remove('hidden');
  $('choice-modal').classList.remove('hidden');
}

export function hideChoiceModal() {
  $('choice-modal').classList.add('hidden');
}

// Swaps the still-open choice modal to a brief structured result view
// (a short line of prose + bullet effects, e.g. "ROD & TODD RESCUED /
// HOMER -12 HP") instead of hiding it immediately -- lets the player see
// the mechanical consequence of what they just picked before combat
// resumes, without leaving the scene. Callers whose choice.apply() still
// returns a plain string (every choiceModal user except the Rod & Todd
// event, for now) keep using showBanner instead; this is opt-in.
export function showChoiceResult(resultText, effects, onContinue) {
  $('choice-modal-options').classList.add('hidden');
  const resultEl = $('choice-modal-result');
  resultEl.innerHTML = `
    <p class="choice-modal-result-text">${resultText}</p>
    ${effects && effects.length ? `<ul class="choice-modal-result-effects">${effects.map((e) => `<li>${e}</li>`).join('')}</ul>` : ''}
    <button type="button" class="big-button choice-modal-result-continue">CONTINUE</button>
  `;
  resultEl.classList.remove('hidden');
  resultEl.querySelector('.choice-modal-result-continue').addEventListener('click', onContinue);
}

// ---------- MAP: LOCATION INSPECT (click = inspect, not instant travel) ----------
// `details` is ui/worldMapView.js's locationInspectDetails() shape
// ({name, chips, bodyLines}); `canTravel`/`disabledReason` come from
// game.js's own reachability check, since only it knows the segment/road
// rules. Always exactly one primary action (TRAVEL HERE) plus CLOSE --
// never an instant travel on the click that opened this.
export function showLocationInspect(details, { canTravel, disabledReason } = {}, onTravel, onClose) {
  $('location-inspect-name').textContent = details.name;
  $('location-inspect-status').innerHTML = details.chips
    .map((c) => `<span class="status-chip${c.urgent ? ' urgent' : ''}">${c.text}</span>`)
    .join('');
  $('location-inspect-body').innerHTML = details.bodyLines.map((l) => `<div>${l}</div>`).join('');

  const travelBtn = freshButton('btn-location-inspect-travel');
  travelBtn.classList.toggle('hidden', !canTravel);
  if (canTravel) travelBtn.addEventListener('click', onTravel);

  const reasonEl = $('location-inspect-disabled-reason');
  reasonEl.classList.toggle('hidden', canTravel || !disabledReason);
  reasonEl.textContent = disabledReason || '';

  freshButton('btn-location-inspect-close').addEventListener('click', onClose);
  $('location-inspect-modal').classList.remove('hidden');
}

export function hideLocationInspect() {
  $('location-inspect-modal').classList.add('hidden');
}

// ---------- ABILITY DRAFT (post-battle reward) ----------
// REWARD SCREEN CLARITY: every ordinary victory (by far the most common
// reward moment in the game) now gets the exact same full explanation as a
// boss reward -- effect text, keyword tooltips, and archetype synergy --
// via the same buildRewardCardContent/rewardCardHtml/scanKeywordsIn used by
// populateBossReward, instead of a bare name+description card. Non-milestone
// picks also get the same select-then-confirm double-click protection
// (a stray click no longer permanently locks in a deck choice).
export function populateAbilityDraft(summary, abilities, runState, onPick, options = {}) {
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
    freshButton('btn-ability-draft-skip').classList.add('hidden');
    return;
  }

  const contents = abilities.map((ability) => buildRewardCardContent({ kind: 'ability', id: ability.id }, runState));
  if (milestone) {
    // Single guaranteed pickup -- show the full card, no select/take-button
    // gating (there's nothing to choose between).
    container.innerHTML = rewardCardHtml(contents[0], 0);
    container.querySelector('.reward-card-take-btn')?.classList.add('hidden');
  } else {
    container.innerHTML = contents.map((c, i) => rewardCardHtml(c, i)).join('');
    const cards = Array.from(container.querySelectorAll('.reward-card'));
    for (const card of cards) {
      const idx = Number(card.dataset.index);
      const takeBtn = card.querySelector('.reward-card-take-btn');
      card.addEventListener('click', (e) => {
        if (e.target === takeBtn) return;
        for (const other of cards) {
          other.classList.toggle('selected', other === card);
          other.querySelector('.reward-card-take-btn').classList.toggle('hidden', other !== card);
        }
      });
      takeBtn.addEventListener('click', () => onPick(abilities[idx]));
    }
  }

  const skipBtn = freshButton('btn-ability-draft-skip');
  if (milestone) {
    skipBtn.textContent = 'CONTINUE';
    skipBtn.classList.remove('hidden');
    skipBtn.addEventListener('click', () => onPick(abilities[0]));
  } else {
    skipBtn.textContent = 'SKIP';
    skipBtn.classList.remove('hidden');
    skipBtn.addEventListener('click', () => onPick(null));
  }
}

// ---------- BOSS REWARD (REDESIGN REWARD CHOICE SCREEN) ----------
// Game concepts that come up in ability/relic/item text but aren't a
// combat status (so they're not in data/statusEffects.js STATUS_INFO) --
// scanKeywordsIn below checks both dictionaries against the same text.
const EXTRA_KEYWORD_INFO = {
  Break: { description: "A boss's second resource, separate from HP. Depleting it Stuns them and applies Vulnerable." },
  Energy: { description: 'What playing a card costs. Refills to your max every turn.' },
};

function scanKeywordsIn(text) {
  const found = [];
  const haystack = text.toLowerCase();
  for (const info of Object.values(STATUS_INFO)) {
    if (haystack.includes(info.name.toLowerCase())) found.push({ label: info.name, description: info.description });
  }
  for (const [label, info] of Object.entries(EXTRA_KEYWORD_INFO)) {
    if (haystack.includes(label.toLowerCase()) && !found.some((k) => k.label === label)) found.push({ label, description: info.description });
  }
  return found;
}

// Normalizes one reward option (data/bosses.js ZOMBIE_NED_REWARD `options`,
// {kind: 'ability'|'relic'|'item', id, goodFor, apply}) into everything a
// reward card needs to show -- always pulled from the REAL live ability/
// relic/item data (never a second hand-typed copy of a number), so a
// balance tweak there can never leave the reward screen's numbers stale.
function buildRewardCardContent(option, runState) {
  if (option.kind === 'ability') {
    const ability = ABILITIES[option.id];
    const alreadyOwned = runState.abilityDeck.includes(option.id);
    const sameArchetype = runState.abilityDeck.map((id) => ABILITIES[id]).filter((a) => a && a.archetype === ability.archetype && a.id !== ability.id);
    return {
      kind: 'ability',
      icon: ability.emoji,
      name: ability.name,
      typeLabel: 'ABILITY',
      typeSubLabel: ability.target === 'self' ? 'SKILL' : 'ATTACK',
      rarityLabel: ability.rarity.toUpperCase(),
      rarityColor: RARITY_COLOR[ability.rarity],
      metaLines: [`Cost: ${ability.cost} Energy`],
      effectText: ability.description,
      permanenceLabel: alreadyOwned ? 'ALREADY IN YOUR DECK' : 'ADDED TO DECK',
      permanenceDetail: alreadyOwned ? 'Picking this does nothing extra -- you already know it.' : 'Available for the rest of this episode.',
      keywords: scanKeywordsIn(ability.description),
      synergyLabel: sameArchetype.length >= 2 ? 'HIGH' : sameArchetype.length === 1 ? 'MEDIUM' : 'LOW',
      synergyDetail: sameArchetype.length
        ? `Works with: ${sameArchetype.map((a) => a.name).join(', ')}`
        : `No other ${ability.archetype} abilities in your deck yet.`,
      goodFor: option.goodFor,
      isNew: !alreadyOwned,
      takeLabel: 'TAKE ABILITY',
    };
  }
  if (option.kind === 'relic') {
    const relic = RELICS[option.id];
    const alreadyOwned = runState.relics.includes(option.id);
    return {
      kind: 'relic',
      icon: relic.emoji,
      name: relic.name,
      typeLabel: 'RELIC',
      typeSubLabel: null,
      rarityLabel: option.rarityLabel || 'RARE',
      rarityColor: RARITY_COLOR.rare,
      metaLines: ['Relics do not use Energy.'],
      effectText: relic.description,
      permanenceLabel: alreadyOwned ? 'ALREADY OWNED' : 'PASSIVE FOR REST OF EPISODE',
      permanenceDetail: alreadyOwned ? "Picking this does nothing extra -- it's already active." : 'Its effect applies automatically, every battle, no upkeep.',
      keywords: scanKeywordsIn(relic.description),
      synergyLabel: null,
      synergyDetail: runState.relics.length ? `Current relics: ${runState.relics.map((id) => RELICS[id].name).join(', ')}` : 'This would be your first relic.',
      goodFor: option.goodFor,
      isNew: !alreadyOwned,
      takeLabel: 'TAKE RELIC',
    };
  }
  // 'item'
  const item = ITEMS[option.id];
  const heldCount = runState.consumables[option.id] || 0;
  return {
    kind: 'item',
    icon: item.emoji,
    name: item.name,
    typeLabel: 'CONSUMABLE ITEM',
    typeSubLabel: null,
    rarityLabel: null,
    rarityColor: '#b7b7c0',
    metaLines: [`You currently have: ${heldCount}`, `Your HP right now: ${Math.round(runState.hp)} / ${runState.maxHp}`],
    effectText: item.description,
    permanenceLabel: 'ONE-TIME USE',
    permanenceDetail: 'Goes into your bag. Use it any time from an interior or mid-battle; gone after one use.',
    keywords: scanKeywordsIn(item.description),
    synergyLabel: null,
    synergyDetail: null,
    goodFor: option.goodFor,
    isNew: heldCount === 0,
    takeLabel: 'TAKE ITEM',
  };
}

function rewardCardHtml(content, index) {
  const keywordsHtml = content.keywords.length
    ? `<div class="reward-card-keywords">${content.keywords
        .map((k) => `<span class="reward-card-keyword" title="${k.description}">${k.label.toUpperCase()}</span>`)
        .join('')}</div>`
    : '';
  const synergyHtml = content.synergyLabel
    ? `<div class="reward-card-synergy"><span class="reward-card-synergy-label synergy-${content.synergyLabel.toLowerCase()}">SYNERGY: ${content.synergyLabel}</span><span class="reward-card-synergy-detail">${content.synergyDetail}</span></div>`
    : content.synergyDetail
      ? `<div class="reward-card-synergy"><span class="reward-card-synergy-detail">${content.synergyDetail}</span></div>`
      : '';
  return `
    <div class="reward-card" data-index="${index}" style="--reward-rarity-color:${content.rarityColor}">
      ${content.isNew ? '<div class="reward-card-new-tag">NEW</div>' : ''}
      <div class="reward-card-icon">${content.icon}</div>
      <div class="reward-card-name">${content.name}</div>
      <div class="reward-card-badges">
        <span class="reward-card-type-badge">${content.typeLabel}${content.typeSubLabel ? ` &mdash; ${content.typeSubLabel}` : ''}</span>
        ${content.rarityLabel ? `<span class="reward-card-rarity-badge">${content.rarityLabel}</span>` : ''}
      </div>
      ${content.metaLines.map((l) => `<div class="reward-card-meta">${l}</div>`).join('')}
      <div class="reward-card-effect">${content.effectText}</div>
      ${keywordsHtml}
      <div class="reward-card-permanence">
        <span class="reward-card-permanence-label">${content.permanenceLabel}</span>
        <span class="reward-card-permanence-detail">${content.permanenceDetail}</span>
      </div>
      ${synergyHtml}
      ${content.goodFor ? `<div class="reward-card-good-for"><span>GOOD FOR:</span> ${content.goodFor}</div>` : ''}
      <button type="button" class="reward-card-take-btn hidden">${content.takeLabel}</button>
    </div>
  `;
}

// `reward`: {headline, title, prompt, options: [{kind, id, goodFor,
// rarityLabel?, apply(runState) => resultText}]} -- see data/bosses.js
// ZOMBIE_NED_REWARD. Select-then-confirm (REDESIGN REWARD CHOICE SCREEN:
// "do not make the player choose immediately... do not instantly select
// from one accidental click"): the first click on a card selects/enlarges
// it and reveals ITS take button; every other card's button stays hidden.
// A second click, on the take button, actually commits via onPick.
export function populateBossReward(reward, runState, onPick) {
  $('boss-reward-headline').textContent = reward.headline;
  $('boss-reward-title').textContent = reward.title;
  $('boss-reward-prompt').textContent = reward.prompt;
  const container = $('boss-reward-cards');
  const contents = reward.options.map((option) => buildRewardCardContent(option, runState));
  container.innerHTML = contents.map((c, i) => rewardCardHtml(c, i)).join('');

  const cards = Array.from(container.querySelectorAll('.reward-card'));
  for (const card of cards) {
    const idx = Number(card.dataset.index);
    const takeBtn = card.querySelector('.reward-card-take-btn');
    card.addEventListener('click', (e) => {
      if (e.target === takeBtn) return;
      for (const other of cards) {
        other.classList.toggle('selected', other === card);
        other.querySelector('.reward-card-take-btn').classList.toggle('hidden', other !== card);
      }
    });
    takeBtn.addEventListener('click', () => onPick(reward.options[idx], contents[idx]));
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
// `imageAssetId` (data/interiors.js's per-interior `image` field, e.g.
// moesTavern's 'moeChat') swaps the small emoji glyph for a real, large,
// aspect-ratio-preserved scene photo -- the visual centerpiece the
// interaction list sits below, not a tiny generic rectangle. Falls back to
// the emoji for every interior that doesn't have art yet.
// REDESIGN MOE'S TAVERN + KWIK-E-MART: a "fast pit stop" reads two large,
// obvious buttons (the actual reason to visit -- a heal, the store) plus a
// row of small utility chips underneath for everything else the location
// still offers (talk/quests/secrets/upgrades, all now folded behind
// a single TALK TO X chip's dialogue tree -- see data/interiors.js), rather
// than one long vertical stack of a dozen equally-sized buttons. An
// interaction opts into the small row with `secondary: true`; an interaction
// with `isUsed(runState)` returning true renders disabled with its
// `usedLabel` instead of the normal cost caption (e.g. Moe's HAVE A BEER ->
// "ALREADY HAD ONE" once spent this visit).
export function populateLocationInterior(locationName, state, actionsRemaining, onInteract, onLeave, interior, runState) {
  $('interior-location-name').textContent = locationName.toUpperCase();
  $('interior-actions-readout').textContent = `ACTIONS REMAINING: ${actionsRemaining}`;
  const stage = $('interior-stage');
  const imageEl = $('interior-image');
  const portraitEl = $('interior-portrait');
  // Two art modes (LOCATION INTERACTION SYSTEM, data/interiors.js): a single
  // combined scene photo (`image`, e.g. Moe's -- Moe is already IN the
  // shot), or a real location background with a separate NPC chat portrait
  // composited on top (`background` + `portrait`, e.g. Kwik-E-Mart's real
  // store photo + Apu's own portrait) -- never both, never invented art.
  const backgroundUrl = interior?.background ? getAssetUrl(interior.background.category, interior.background.id) : interior?.image ? getAssetUrl('ui', interior.image) : null;
  const portraitUrl = interior?.portrait ? getAssetUrl(interior.portrait.category, interior.portrait.id) : null;
  stage.classList.toggle('has-image', !!backgroundUrl);
  if (backgroundUrl) {
    imageEl.src = backgroundUrl;
    imageEl.classList.remove('hidden');
    $('interior-background-emoji').classList.add('hidden');
  } else {
    imageEl.classList.add('hidden');
    $('interior-background-emoji').classList.remove('hidden');
    $('interior-background-emoji').textContent = state.background;
  }
  portraitEl.classList.toggle('hidden', !portraitUrl);
  if (portraitUrl) portraitEl.src = portraitUrl;
  $('interior-intro-text').textContent = typeof state.intro === 'function' ? state.intro(runState) : state.intro;
  $('interior-result-panel').classList.add('hidden');

  if (runState) {
    $('interior-hp-readout').textContent = `HP ${Math.max(0, Math.round(runState.hp))}/${runState.maxHp}`;
    $('interior-cash-readout').textContent = `🍩 ${runState.donutsCurrency}`;
  }

  const primaryContainer = $('interior-interactions-primary');
  const secondaryContainer = $('interior-interactions-secondary');
  primaryContainer.classList.remove('hidden');
  secondaryContainer.classList.remove('hidden');
  primaryContainer.innerHTML = '';
  secondaryContainer.innerHTML = '';
  for (const interaction of state.interactions) {
    const cost = interaction.cost ?? 1;
    const used = runState && interaction.isUsed ? interaction.isUsed(runState) : false;
    const btn = document.createElement('button');
    btn.className = interaction.secondary
      ? 'interior-interaction-btn interior-interaction-btn--secondary'
      : 'big-button interior-interaction-btn interior-interaction-btn--primary';
    btn.disabled = used || actionsRemaining < cost;
    if (used) {
      btn.textContent = interaction.usedLabel || interaction.label;
    } else {
      btn.innerHTML = cost > 0 ? `${interaction.label} <small>-${cost} action${cost === 1 ? '' : 's'}</small>` : interaction.label;
    }
    btn.addEventListener('click', () => onInteract(interaction));
    (interaction.secondary ? secondaryContainer : primaryContainer).appendChild(btn);
  }
  freshButton('btn-interior-leave').addEventListener('click', onLeave);
}

// Shows the outcome of one interaction (and, if it opened a conversation,
// its free follow-up replies) in the result panel, hiding the interaction
// list underneath until the player hits Continue.
export function showInteriorResult(text, followUps, onPickFollowUp, onContinue) {
  $('interior-interactions-primary').classList.add('hidden');
  $('interior-interactions-secondary').classList.add('hidden');
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
    <li><span>Locations Visited</span><span>${result.nodesCleared}</span></li>
    <li><span>Enemies Defeated</span><span>${result.stats.enemiesDefeated}</span></li>
    <li><span>Elites Defeated</span><span>${result.stats.elitesDefeated}</span></li>
    <li><span>Bosses Defeated</span><span>${result.stats.bossesDefeated || 0}</span></li>
    <li><span>Side Quests Completed</span><span>${result.questsCompleted}</span></li>
    <li><span>Peak Mayhem</span><span>${result.stats.peakMayhem}%</span></li>
    <li><span>Abilities Learned</span><span>${result.abilitiesLearned}</span></li>
    <li><span>Relics Collected</span><span>${result.relicsCollected}</span></li>
    <li><span>Build</span><span>${result.buildType}</span></li>
    <li><span>Run Time</span><span>${result.runTimeText}</span></li>
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
