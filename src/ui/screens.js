const SCREEN_IDS = [
  'screen-hub',
  'screen-episode-intro',
  'screen-interstitial',
  'screen-route-choice',
  'screen-breaking-news',
  'screen-arena',
  'screen-end',
];

const $ = (id) => document.getElementById(id);

export function showScreen(id) {
  for (const screenId of SCREEN_IDS) {
    $(screenId).classList.toggle('hidden', screenId !== id);
  }
}

export function updateMetaReadout(meta) {
  $('meta-readout').textContent = `Season ${meta.season} · Episode ${meta.episodeInSeason + 1}`;
}

export function populateHub(meta, characters, selectedId, onSelect) {
  $('hub-trophies').textContent = meta.trophies.length ? meta.trophies.join(' ') : 'No trophies yet. Go cause some chaos.';
  const container = $('hub-character-select');
  container.innerHTML = '';
  for (const character of characters) {
    const card = document.createElement('div');
    card.className = 'character-card' + (character.id === selectedId ? ' selected' : '') + (character.unlocked ? '' : ' locked');
    card.innerHTML = `<div class="emoji">${character.unlocked ? character.emoji : '\u{1F512}'}</div><div>${character.name}</div><small>${character.tagline}</small>`;
    if (character.unlocked) {
      card.addEventListener('click', () => onSelect(character.id));
    }
    container.appendChild(card);
  }
  updateMetaReadout(meta);
}

export function populateEpisodeIntro(episode) {
  $('intro-tag').textContent = `SEASON EPISODE · ${episode.modifierName.toUpperCase()}`;
  $('intro-title').textContent = `"${episode.title}"`;
  $('intro-character').textContent = `Character: ${episode.characterName}`;
  $('intro-objective').textContent = `Initial Objective: ${episode.objective}`;
  $('intro-modifier').textContent = `Episode Modifier: Normal Springfield (for now...)`;
}

export function populateInterstitial(location) {
  $('interstitial-title').textContent = `${location.emoji} ${location.name}`;
  const lines = location.flavorNormal || [];
  $('interstitial-flavor').textContent = lines[Math.floor(Math.random() * lines.length)] || '';
}

export function populateRouteChoice(options, onChoose) {
  const container = $('route-options');
  container.innerHTML = '';
  for (const location of options) {
    const card = document.createElement('div');
    card.className = 'route-card';
    card.innerHTML = `<div style="font-size:2rem;">${location.emoji}</div><h3>${location.name}</h3>`;
    card.addEventListener('click', () => onChoose(location.id));
    container.appendChild(card);
  }
}

export function populateBreakingNews(newsText) {
  $('news-text').textContent = newsText;
}

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
  const eatBtn = $('btn-donut-eat');
  const saveBtn = $('btn-donut-save');
  const cleanup = () => {
    modal.classList.add('hidden');
    eatBtn.replaceWith(eatBtn.cloneNode(true));
    saveBtn.replaceWith(saveBtn.cloneNode(true));
  };
  $('btn-donut-eat').addEventListener('click', () => {
    cleanup();
    onEat();
  });
  $('btn-donut-save').addEventListener('click', () => {
    cleanup();
    onSave();
  });
}

export function showClearModal(text, onContinue) {
  const modal = $('clear-modal');
  $('clear-text').textContent = text;
  modal.classList.remove('hidden');
  const btn = $('btn-continue');
  const fresh = btn.cloneNode(true);
  btn.replaceWith(fresh);
  fresh.addEventListener('click', () => {
    modal.classList.add('hidden');
    onContinue();
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
  const leaveBtn = $('btn-shop-leave');
  const fresh = leaveBtn.cloneNode(true);
  leaveBtn.replaceWith(fresh);
  fresh.addEventListener('click', () => {
    modal.classList.add('hidden');
    onLeave();
  });
}

export function hideShopModal() {
  $('shop-modal').classList.add('hidden');
}

export function populateEndScreen(meta, result) {
  $('end-header').textContent = `SEASON ${result.season} · EPISODE ${result.episodeNum}`;
  $('end-title').textContent = `"${result.title}"`;
  $('end-sub').textContent = `Character: ${result.character} · ${result.modifierName}`;
  $('end-result').textContent = result.victory ? 'VICTORY' : 'DEFEAT';
  $('end-result').style.color = result.victory ? '#f6d217' : '#d0021b';
  const stats = result.stats;
  $('end-stats').innerHTML = `
    <li><span>Town Destruction</span><span>${stats.townDestruction}%</span></li>
    <li><span>Enemies Defeated</span><span>${stats.enemiesDefeated}</span></li>
    <li><span>People Pissed Off</span><span>${stats.peoplePissedOff}</span></li>
    <li><span>Arrests</span><span>${stats.arrests}</span></li>
    <li><span>Donuts Eaten</span><span>${stats.donutsEaten}</span></li>
  `;
  $('end-rating').textContent = '★'.repeat(result.rating) + '☆'.repeat(5 - result.rating);
  updateMetaReadout(meta);
}
