import { Input } from './engine/input.js';
import { ARENA_WIDTH, ARENA_HEIGHT, PLAYER_START } from './engine/config.js';
import { drawCircleEntity, drawMeleeArc, drawText, drawCoverImage } from './engine/canvasUtils.js';
import { distance, clamp, pickRandom } from './engine/collision.js';
import { getAssetUrl } from './data/assets.js';
import { getImage, loadImage } from './engine/assetLoader.js';
import { playMenuMove, playMenuSelect, playEpisodeStart } from './engine/audio.js';

import { CHARACTERS } from './data/characters.js';
import { ITEMS } from './data/items.js';
import { ENEMIES } from './data/enemies.js';
import { BOSSES } from './data/bosses.js';
import { LOCATIONS } from './data/locations.js';
import { getEvent } from './data/events.js';
import { UPGRADES } from './data/upgrades.js';

import { generateEpisode } from './systems/episodeManager.js';
import { getNode, getAvailableNodeIds, markNodeCompleted, isJourneyComplete, resolveBossForNode } from './systems/board.js';
import { buildEnemyWave, buildPickups } from './systems/spawner.js';
import { resolveMeleeAttack, computeAimAngle, maybeApplyRadiation } from './systems/combat.js';
import { checkSynergies } from './systems/synergy.js';
import { eatDonut, saveDonut, restHeal, getShopCatalog, purchaseItem } from './systems/economy.js';
import { shiftRelationship, moeSupportsInBossFight, moeGreeting } from './systems/relationships.js';
import { rollUpgradeChoices, applyUpgrade } from './systems/upgradeSystem.js';
import { pruneTimedBuffs } from './systems/timedBuffs.js';

import { Player } from './entities/player.js';
import { Enemy, makeMoeJukeboxProp } from './entities/enemy.js';
import { Boss } from './entities/boss.js';
import { Projectile } from './entities/projectile.js';
import { Pickup } from './entities/pickup.js';

import {
  loadMeta,
  saveMeta,
  recordEpisodeResult,
  createRunState,
  saveActiveRun,
  loadActiveRun,
  hasActiveRun,
  clearActiveRun,
  recordDiscoveries,
} from './state/gameState.js';
import * as screens from './ui/screens.js';
import { renderBoard, animateMarkerMove, findNodeAtPoint } from './ui/boardView.js';

const ARENA_BOUNDS = { width: ARENA_WIDTH, height: ARENA_HEIGHT };

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = new Input(canvas);
    this.meta = loadMeta();

    this.runState = null;
    this.currentNode = null;
    this.pendingNode = null;

    this.arenaRunning = false;
    this.boardRunning = false;
    this.paused = false;
    this.lastTime = 0;
    this.episodeEnding = false;

    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.effects = [];
    this.boss = null;
    this.player = null;
    this.currentLocation = null;
    this.arenaCleared = false;
    this.moeJukebox = null;
    this.fireAuraTimer = 0;
    this.blinkyTimer = 0;
    this.nodeStartHp = 0;
    this.nodeEnemiesDefeated = 0;
    this.nodeDonutsCollected = 0;

    document.getElementById('boardCanvas').addEventListener('click', (e) => this.handleBoardClick(e));
    document.getElementById('btn-news-continue').addEventListener('click', () => this.continueAfterNews());
    document.addEventListener('keydown', (e) => this.handleGlobalKeydown(e));
    this.mainMenuNav = null;
  }

  init() {
    this.showMainMenu();
  }

  // ---------- MAIN MENU ----------
  // Keyboard nav (arrow keys / Enter) is handled globally here rather than
  // per-screen, since only the console menu and episode-reveal card need it
  // right now; MenuNav itself stays input-agnostic so a future gamepad poll
  // loop can drive the same moveSelection/activateSelected calls.
  handleGlobalKeydown(e) {
    const menuVisible = !document.getElementById('screen-main-menu').classList.contains('hidden');
    const revealVisible = !document.getElementById('screen-episode-reveal').classList.contains('hidden');
    if (menuVisible && this.mainMenuNav) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.mainMenuNav.moveSelection(1);
        playMenuMove();
        screens.renderConsoleMenu(this.mainMenuNav);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.mainMenuNav.moveSelection(-1);
        playMenuMove();
        screens.renderConsoleMenu(this.mainMenuNav);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        playMenuSelect();
        this.mainMenuNav.activateSelected();
      }
    } else if (revealVisible && e.key === 'Enter') {
      e.preventDefault();
      this.confirmNewEpisode();
    }
  }

  showMainMenu() {
    this.stopBoardLoop();
    this.stopArenaLoop();
    screens.showScreen('screen-main-menu');
    this.mainMenuNav = screens.populateMainMenu(this.meta, hasActiveRun(), {
      'new-episode': () => this.beginNewEpisode(),
      continue: () => this.resumeActiveRun(),
      'simpson-house': () => this.showSimpsonHouse(),
      'episode-guide': () => this.showSeasonsInfo(),
      collection: () => this.showCollectionInfo(),
      options: () => this.showSettings(),
    });
  }

  beginNewEpisode() {
    const unlocked = Object.values(CHARACTERS).filter((c) => c.unlocked);
    if (unlocked.length === 1) {
      this.showEpisodeReveal(unlocked[0].id);
    } else {
      this.showCharacterSelect();
    }
  }

  showCharacterSelect() {
    screens.showScreen('screen-character-select');
    screens.populateCharacterSelect(Object.values(CHARACTERS), (id) => this.showEpisodeReveal(id), () => this.showMainMenu());
  }

  showSimpsonHouse() {
    this.stopBoardLoop();
    this.stopArenaLoop();
    screens.showScreen('screen-simpson-house');
    screens.populateSimpsonHouse(() => this.showCharactersInfo(), () => this.showMainMenu());
  }

  showCharactersInfo() {
    screens.showScreen('screen-characters-info');
    screens.populateCharactersInfo(Object.values(CHARACTERS), () => this.showMainMenu());
  }

  showSeasonsInfo() {
    screens.showScreen('screen-seasons-info');
    screens.populateSeasonsInfo(this.meta, () => this.showMainMenu());
  }

  showCollectionInfo() {
    screens.showScreen('screen-collection-info');
    screens.populateCollectionInfo(this.meta, () => this.showMainMenu());
  }

  showSettings() {
    screens.showScreen('screen-settings');
    screens.bindSettings(
      () => {
        if (window.confirm('Reset all save data? This cannot be undone.')) {
          localStorage.clear();
          this.meta = loadMeta();
          this.showMainMenu();
        }
      },
      () => this.showMainMenu()
    );
  }

  // ---------- RUN SETUP ----------
  // The episode is rolled once here (not again on confirm) so the reveal
  // card's title/objective always match the run it's about to start.
  showEpisodeReveal(characterId) {
    const character = CHARACTERS[characterId];
    this.pendingCharacterId = characterId;
    this.pendingEpisode = generateEpisode(character);
    screens.showScreen('screen-episode-reveal');
    screens.populateEpisodeReveal(character, this.pendingEpisode, () => this.confirmNewEpisode());
  }

  confirmNewEpisode() {
    playEpisodeStart();
    const character = CHARACTERS[this.pendingCharacterId];
    this.runState = createRunState(character);
    this.runState.episode = this.pendingEpisode;
    saveActiveRun(this.runState);
    this.showBoard();
  }

  resumeActiveRun() {
    const runState = loadActiveRun();
    if (!runState) {
      this.showMainMenu();
      return;
    }
    this.runState = runState;
    this.showBoard();
  }

  // ---------- BOARD ----------
  showBoard() {
    this.currentNode = null;
    screens.showScreen('screen-board');
    const characterId = this.runState.character.id;
    const availableIds = getAvailableNodeIds(this.runState);
    const nextNode = availableIds.length === 1 ? getNode(characterId, availableIds[0]) : null;
    screens.populateBoardInfo(this.runState.episode, nextNode);
    this.startBoardLoop();
  }

  startBoardLoop() {
    this.boardRunning = true;
    const canvas = document.getElementById('boardCanvas');
    const step = () => {
      if (!this.boardRunning) return;
      renderBoard(canvas, this.runState.character.id, this.runState);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  stopBoardLoop() {
    this.boardRunning = false;
  }

  handleBoardClick(e) {
    if (!this.boardRunning || !this.runState) return;
    const canvas = e.target;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;
    const characterId = this.runState.character.id;
    const node = findNodeAtPoint(canvas, characterId, px, py);
    if (!node) return;
    if (!getAvailableNodeIds(this.runState).includes(node.id)) return;

    this.stopBoardLoop();
    const fromId = this.runState.boardPosition;
    animateMarkerMove(canvas, characterId, this.runState, fromId, node.id, 500, () => this.enterNode(node));
  }

  // ---------- NODE ENTRY ----------
  enterNode(node) {
    this.currentNode = node;
    if (node.type === 'shop') {
      this.openShopAtNode(node);
      return;
    }
    if (node.type === 'event') {
      this.showEventScreen(node);
      return;
    }
    if (node.type === 'rest') {
      this.showRestScreen(node);
      return;
    }

    const location = LOCATIONS[node.locationId];
    if (location.isTwistLocation && this.runState.episode.modifierId === 'alienInvasion' && !this.runState.episode.twistTriggered) {
      this.pendingNode = node;
      screens.populateBreakingNews(this.runState.episode.newsText);
      screens.showScreen('screen-breaking-news');
      return;
    }
    this.enterArenaForNode(node);
  }

  continueAfterNews() {
    if (!this.pendingNode) return;
    this.runState.episode.twistTriggered = true;
    const node = this.pendingNode;
    this.pendingNode = null;
    this.enterArenaForNode(node);
  }

  // ---------- SHOP ----------
  openShopAtNode(node) {
    const catalog = getShopCatalog(this.runState);
    screens.showShopModal(
      catalog,
      "Apu's got what you need. For a price.",
      (entry) => {
        if (purchaseItem(this.runState, entry.itemId, entry.cost)) {
          this.applyPurchasedItem(entry.itemId);
          this.openShopAtNode(node);
        }
      },
      () => {
        screens.hideShopModal();
        markNodeCompleted(this.runState, node.id);
        saveActiveRun(this.runState);
        this.showBoard();
      }
    );
  }

  applyPurchasedItem(itemId) {
    const item = ITEMS[itemId];
    this.runState.ownedItemIds.add(itemId);
    for (const tag of item.tags || []) this.runState.ownedTags.add(tag);
    recordDiscoveries(this.meta, [itemId]);
    saveMeta(this.meta);

    if (item.category === 'weapon') {
      this.runState.weaponId = item.weaponId;
      screens.showBanner(`Picked up ${item.name}!`, 1600);
    } else {
      item.apply(this.runState);
      screens.showBanner(`${item.name}: ${item.description}`, 1800);
    }

    const synergies = checkSynergies(this.runState);
    for (const synergy of synergies) {
      setTimeout(() => screens.showBanner(`SYNERGY: ${synergy.name}! ${synergy.description}`, 2600), 400);
    }
  }

  // ---------- EVENT ----------
  showEventScreen(node) {
    const eventId = node.eventId || pickRandom(node.eventPool);
    const event = getEvent(eventId);
    screens.showScreen('screen-event');
    screens.populateEvent(event, (option) => {
      option.apply(this.runState);
    });
    screens.showEventContinue(() => {
      markNodeCompleted(this.runState, node.id);
      saveActiveRun(this.runState);
      this.showBoard();
    });
  }

  // ---------- REST ----------
  showRestScreen(node) {
    screens.showScreen('screen-rest');
    screens.setRestFlavor('Catch your breath.');
    screens.populateRest(
      node,
      () => {
        restHeal(this.runState);
        screens.setRestFlavor('You feel fully refreshed.');
        this.finishRestNode(node);
      },
      () => this.showRestUpgrade(node),
      () => {
        this.runState.donutsCurrency += 1;
        screens.setRestFlavor('A local shares gossip (and a donut). +1 donut currency.');
        this.finishRestNode(node);
      }
    );
  }

  finishRestNode(node) {
    setTimeout(() => {
      markNodeCompleted(this.runState, node.id);
      saveActiveRun(this.runState);
      this.showBoard();
    }, 1200);
  }

  showRestUpgrade(node) {
    const choices = rollUpgradeChoices(this.runState, 3);
    screens.showScreen('screen-level-complete');
    screens.populateLevelComplete(
      { locationName: node.name, enemiesDefeated: 0, damageTaken: 0, donutsCollected: 0 },
      choices,
      (upgrade) => {
        if (upgrade) {
          applyUpgrade(this.runState, upgrade);
          recordDiscoveries(this.meta, [upgrade.id]);
          saveMeta(this.meta);
        }
        markNodeCompleted(this.runState, node.id);
        saveActiveRun(this.runState);
        this.showBoard();
      }
    );
  }

  // ---------- ARENA SETUP (combat / miniBoss / boss nodes) ----------
  enterArenaForNode(node) {
    this.currentLocation = LOCATIONS[node.locationId];
    this.arenaCleared = false;
    this.episodeEnding = false;
    this.enemies = [];
    this.projectiles = [];
    this.effects = [];
    this.pickups = [];
    this.moeJukebox = null;
    this.boss = null;
    this.nodeEnemiesDefeated = 0;
    this.nodeDonutsCollected = 0;

    const scenarioId = this.runState.episode.modifierId;
    const twistActive = this.runState.episode.twistTriggered;

    if (node.type === 'miniBoss' || node.type === 'boss') {
      const { bossId, locationId } = resolveBossForNode(node, this.runState.episode);
      this.currentLocation = LOCATIONS[locationId];
      const bossTemplate = BOSSES[bossId];
      this.boss = new Boss(bossTemplate, ARENA_WIDTH / 2, 120);

      this.player = new Player(this.runState.character, this.runState);
      this.player.x = PLAYER_START.x;
      this.player.y = PLAYER_START.y;
      this.nodeStartHp = this.player.hp;

      if (moeSupportsInBossFight(this.runState)) {
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + 30);
        this.runState.hp = this.player.hp;
        screens.showNpcBanner('moe', 'Moe: "Take this one for the road!" (+30 HP)', 2200);
      }

      screens.showScreen('screen-arena');
      screens.showNpcBanner(bossId, bossTemplate.intro, 2400);
      this.startArenaLoop();
      return;
    }

    const progressCount = this.runState.completedNodeIds.size;
    const wave = buildEnemyWave(this.currentLocation, progressCount, scenarioId, twistActive, !!node.elite);
    for (const spawn of wave) {
      this.enemies.push(new Enemy(spawn.template, spawn.x, spawn.y));
    }

    if (this.currentLocation.hasMoeRelationship) {
      this.moeJukebox = makeMoeJukeboxProp(ARENA_WIDTH - 90, 90);
      this.enemies.push(this.moeJukebox);
      screens.showNpcBanner('moe', moeGreeting(this.runState), 2200);
    }

    this.pickups = buildPickups().map((p) => new Pickup({ x: p.x, y: p.y, kind: p.kind, itemId: p.itemId }));

    this.player = new Player(this.runState.character, this.runState);
    this.player.x = PLAYER_START.x;
    this.player.y = PLAYER_START.y;
    this.nodeStartHp = this.player.hp;

    const flavor = twistActive ? this.currentLocation.flavorAlien : this.currentLocation.flavorNormal;
    if (flavor && flavor.length) {
      const line = pickRandom(flavor);
      if (this.currentLocation.npcId) screens.showNpcBanner(this.currentLocation.npcId, line, 2200);
      else screens.showBanner(line, 2200);
    }

    screens.showScreen('screen-arena');
    this.startArenaLoop();
  }

  // ---------- MAIN ARENA LOOP ----------
  startArenaLoop() {
    this.arenaRunning = true;
    this.paused = false;
    this.lastTime = performance.now();
    const step = (now) => {
      if (!this.arenaRunning) return;
      const dt = Math.min(0.05, (now - this.lastTime) / 1000);
      this.lastTime = now;
      if (!this.paused) this.updateArena(dt);
      this.renderArena();
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  stopArenaLoop() {
    this.arenaRunning = false;
  }

  updateArena(dt) {
    const player = this.player;
    if (!player) return;

    pruneTimedBuffs(this.runState, performance.now());
    player.update(dt, this.input, ARENA_BOUNDS);

    if (this.input.consumeAttackPress() && player.canAttack()) {
      this.performPlayerAttack();
    }

    this.updateFireAura(dt);
    this.updateBlinky(dt);

    const targets = this.boss ? [...this.enemies, this.boss] : this.enemies;
    for (const enemy of this.enemies) {
      enemy.update(dt, player, (shooter, angle) => this.spawnEnemyProjectile(shooter, angle));
      this.handleContactDamage(enemy, player);
    }

    if (this.boss) {
      const attack = this.boss.update(dt, player);
      this.handleContactDamage(this.boss, player);
      if (attack) this.executeBossAttack(attack);
    }

    for (const proj of this.projectiles) {
      proj.update(dt, ARENA_BOUNDS);
      this.resolveProjectileHits(proj, targets, player);
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);

    this.reapDeadEnemies();

    for (const pickup of this.pickups) {
      if (!pickup.dead && distance(player, pickup) < player.radius + pickup.radius) {
        this.collectPickup(pickup);
      }
    }
    this.pickups = this.pickups.filter((p) => !p.dead);

    if (player.hp <= 0 && !this.episodeEnding) {
      this.episodeEnding = true;
      this.finalizeRun(false);
      return;
    }

    if (this.boss && this.boss.dead && !this.episodeEnding) {
      this.episodeEnding = true;
      this.runState.stats.enemiesDefeated += 1;
      this.nodeEnemiesDefeated += 1;
      screens.showBanner(`${this.boss.name.toUpperCase()} DEFEATED!`, 2000);
      setTimeout(() => this.proceedAfterNodeCleared(), 1200);
      return;
    }

    if (!this.arenaCleared && !this.currentLocation.isBoss) {
      const remaining = this.enemies.filter((e) => !e.isProp);
      if (remaining.length === 0) {
        this.arenaCleared = true;
        this.onArenaCleared();
      }
    }
  }

  performPlayerAttack() {
    const player = this.player;
    const weapon = player.weapon;
    const targets = this.boss ? [...this.enemies, this.boss] : this.enemies;
    const radiationChance = this.runState.buffs.radiationChance || 0;

    if (weapon.type === 'melee') {
      resolveMeleeAttack(player, weapon, player.damageMult, targets, radiationChance);
      this.effects.push({ x: player.x, y: player.y, facing: player.facing, range: weapon.range, arc: (weapon.arcDegrees * Math.PI) / 180, life: 140 });
    } else {
      const angle = computeAimAngle(player, player.accuracy);
      const nuclear = this.runState.buffs.nuclearBowlingBall;
      const bounces = nuclear || this.runState.buffs.bowlingNightUpgrade;
      const proj = new Projectile({
        x: player.x + Math.cos(angle) * player.radius,
        y: player.y + Math.sin(angle) * player.radius,
        vx: Math.cos(angle) * weapon.projectileSpeed,
        vy: Math.sin(angle) * weapon.projectileSpeed,
        radius: weapon.projectileRadius,
        damage: weapon.damage * player.damageMult,
        color: nuclear ? '#7cff3a' : '#3b2a1a',
        owner: 'player',
        pierce: !!bounces,
        appliesStatus: nuclear ? { kind: 'poison', duration: 3000, tickInterval: 500, dps: 5 } : null,
        knockback: weapon.knockback,
      });
      this.projectiles.push(proj);
    }
    player.triggerAttackCooldown();
  }

  spawnEnemyProjectile(shooter, angle) {
    this.projectiles.push(
      new Projectile({
        x: shooter.x + Math.cos(angle) * shooter.radius,
        y: shooter.y + Math.sin(angle) * shooter.radius,
        vx: Math.cos(angle) * shooter.template.projectileSpeed,
        vy: Math.sin(angle) * shooter.template.projectileSpeed,
        radius: 8,
        damage: shooter.template.projectileDamage,
        color: '#38d63f',
        owner: 'enemy',
      })
    );
  }

  resolveProjectileHits(proj, targets, player) {
    if (proj.dead) return;
    const radiationChance = this.runState.buffs.radiationChance || 0;
    if (proj.owner === 'player') {
      for (const target of targets) {
        if (target.dead || proj.hitEntityIds.has(target.id)) continue;
        if (distance(proj, target) < proj.radius + target.radius) {
          target.takeDamage(proj.damage);
          if (proj.appliesStatus) target.applyStatus(proj.appliesStatus);
          maybeApplyRadiation(target, radiationChance);
          const angle = Math.atan2(target.y - proj.y, target.x - proj.x);
          target.x += Math.cos(angle) * proj.knockback * 0.15;
          target.y += Math.sin(angle) * proj.knockback * 0.15;
          proj.hitEntityIds.add(target.id);
          if (!proj.pierce) {
            proj.dead = true;
            return;
          }
        }
      }
    } else if (distance(proj, player) < proj.radius + player.radius) {
      player.takeDamage(proj.damage);
      proj.dead = true;
    }
  }

  handleContactDamage(enemy, player) {
    if (enemy.dead || enemy.isProp) return;
    if (enemy.contactCooldown > 0) return;
    if (distance(enemy, player) < enemy.radius + player.radius) {
      player.takeDamage(enemy.contactDamage);
      enemy.contactCooldown = 700;
    }
  }

  updateFireAura(dt) {
    if (!this.runState.buffs.fireAura) return;
    this.fireAuraTimer -= dt * 1000;
    if (this.fireAuraTimer > 0) return;
    this.fireAuraTimer = 500;
    const radius = 50 + this.runState.buffs.fireAura * 7;
    const dps = (4 + this.runState.buffs.fireAura) * (this.runState.buffs.drunkenInferno ? 1.8 : 1);
    const targets = this.boss ? [...this.enemies, this.boss] : this.enemies;
    for (const enemy of targets) {
      if (enemy.dead || enemy.isProp) continue;
      if (distance(enemy, this.player) < radius + enemy.radius) {
        enemy.takeDamage(dps);
        enemy.applyStatus({ kind: 'burn', duration: 600, tickInterval: 9999 });
      }
    }
  }

  updateBlinky(dt) {
    if (!this.runState.buffs.blinky) return;
    this.blinkyTimer -= dt * 1000;
    if (this.blinkyTimer > 0) return;
    this.blinkyTimer = 900;
    const targets = (this.boss ? [...this.enemies, this.boss] : this.enemies).filter((e) => !e.dead && !e.isProp);
    let nearest = null;
    let nearestDist = 240;
    for (const enemy of targets) {
      const d = distance(enemy, this.player);
      if (d < nearestDist) {
        nearest = enemy;
        nearestDist = d;
      }
    }
    if (nearest) nearest.takeDamage(10);
  }

  executeBossAttack(name) {
    const boss = this.boss;
    const player = this.player;
    if (name === 'charge') {
      const angle = Math.atan2(player.y - boss.y, player.x - boss.x);
      boss.x = clamp(boss.x + Math.cos(angle) * 220, boss.radius, ARENA_WIDTH - boss.radius);
      boss.y = clamp(boss.y + Math.sin(angle) * 220, boss.radius, ARENA_HEIGHT - boss.radius);
      screens.showBanner(`${boss.name.toUpperCase()}: CHARGE!`, 900);
    } else if (name === 'spreadBlast') {
      const count = 8;
      const color = boss.template.projectileColor || boss.color;
      for (let i = 0; i < count; i += 1) {
        const angle = (Math.PI * 2 * i) / count;
        this.projectiles.push(
          new Projectile({
            x: boss.x,
            y: boss.y,
            vx: Math.cos(angle) * 210,
            vy: Math.sin(angle) * 210,
            radius: 10,
            damage: 12,
            color,
            owner: 'enemy',
          })
        );
      }
      screens.showBanner(`${boss.name.toUpperCase()}: BARRAGE!`, 900);
    } else if (name === 'summon') {
      const template = boss.template.summonEnemyId ? ENEMIES[boss.template.summonEnemyId] : null;
      if (template) {
        for (let i = 0; i < 2; i += 1) {
          const angle = Math.random() * Math.PI * 2;
          this.enemies.push(new Enemy(template, boss.x + Math.cos(angle) * 60, boss.y + Math.sin(angle) * 60));
        }
        screens.showBanner('REINFORCEMENTS!', 900);
      }
    }
  }

  reapDeadEnemies() {
    const survivors = [];
    for (const enemy of this.enemies) {
      if (enemy.dead) {
        if (enemy.isProp) {
          shiftRelationship(this.runState, 'moe', -2);
          screens.showNpcBanner('moe', 'Moe: "MY JUKEBOX! GET OUT!"', 2000);
        } else {
          this.runState.stats.enemiesDefeated += 1;
          this.nodeEnemiesDefeated += 1;
        }
      } else {
        survivors.push(enemy);
      }
    }
    this.enemies = survivors;
  }

  collectPickup(pickup) {
    pickup.dead = true;
    if (pickup.kind === 'donut') {
      this.paused = true;
      screens.showDonutModal(
        () => {
          eatDonut(this.runState);
          this.nodeDonutsCollected += 1;
          this.paused = false;
        },
        () => {
          saveDonut(this.runState);
          this.nodeDonutsCollected += 1;
          this.paused = false;
        }
      );
    }
  }

  // ---------- NODE COMPLETION ----------
  onArenaCleared() {
    if (this.currentLocation.hasMoeRelationship && this.moeJukebox && !this.moeJukebox.dead && this.moeJukebox.hp === this.moeJukebox.maxHp) {
      shiftRelationship(this.runState, 'moe', 1);
    }
    this.stopArenaLoop();
    this.proceedAfterNodeCleared();
  }

  proceedAfterNodeCleared() {
    const node = this.currentNode;
    const damageTaken = Math.max(0, Math.round(this.nodeStartHp - this.player.hp));
    const summary = {
      locationName: this.currentLocation.name,
      enemiesDefeated: this.nodeEnemiesDefeated,
      damageTaken,
      donutsCollected: this.nodeDonutsCollected,
    };

    markNodeCompleted(this.runState, node.id);
    saveActiveRun(this.runState);

    if (isJourneyComplete(this.runState)) {
      this.finalizeRun(true);
      return;
    }

    const milestoneId = node.milestoneUpgradeId;
    const milestoneUpgrade = milestoneId && !this.runState.upgradesChosen.has(milestoneId) ? UPGRADES[milestoneId] : null;
    const choices = milestoneUpgrade ? [milestoneUpgrade] : rollUpgradeChoices(this.runState, 3);

    screens.showScreen('screen-level-complete');
    screens.populateLevelComplete(
      summary,
      choices,
      (upgrade) => {
        if (upgrade) {
          applyUpgrade(this.runState, upgrade);
          recordDiscoveries(this.meta, [upgrade.id]);
          saveMeta(this.meta);
          if (milestoneUpgrade) screens.showBanner(`${this.runState.character.name.toUpperCase()} LEARNED ${upgrade.name}!`, 2400);
        }
        saveActiveRun(this.runState);
        this.showBoard();
      },
      { milestone: !!milestoneUpgrade }
    );
  }

  // ---------- END OF RUN ----------
  finalizeRun(victory) {
    this.stopArenaLoop();
    this.episodeEnding = false;

    const stats = this.runState.stats;
    const nodesCleared = this.runState.completedNodeIds.size;
    const townDestruction = clamp(Math.round(stats.enemiesDefeated * 2 + nodesCleared * 6 + (victory ? 20 : 0)), 0, 100);
    const peoplePissedOff = Math.floor(stats.enemiesDefeated / 6) + (this.runState.relationships.moe === 'angry' ? 2 : 0);
    const arrests = Math.floor(stats.enemiesDefeated / 18) + (this.runState.relationships.moe === 'angry' ? 1 : 0);

    let rating = victory ? 3 : 1;
    if (townDestruction >= 35 && townDestruction <= 95) rating += 1;
    if (stats.donutsEaten >= 3) rating += 1;
    rating = clamp(rating, 1, 5);

    const result = {
      season: this.meta.season,
      episodeNum: this.meta.episodeInSeason + 1,
      title: this.runState.episode.title,
      character: this.runState.character.name,
      modifier: this.runState.episode.modifierId,
      modifierName: this.runState.episode.modifierName,
      victory,
      rating,
      nodesCleared,
      lastLocationName: this.currentLocation ? this.currentLocation.name : '???',
      stats: { ...stats, townDestruction, peoplePissedOff, arrests },
    };

    const legacyBefore = this.meta.legacyPoints;
    recordEpisodeResult(this.meta, result);
    result.legacyPointsEarned = this.meta.legacyPoints - legacyBefore;

    clearActiveRun();

    if (victory) {
      screens.showScreen('screen-run-complete');
      screens.populateRunComplete(this.meta, result, () => this.showMainMenu());
    } else {
      screens.showScreen('screen-run-failure');
      screens.populateRunFailure(this.meta, result, () => this.showMainMenu());
    }
  }

  // ---------- RENDER ----------
  renderArena() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
    const backgroundUrl = this.currentLocation ? getAssetUrl('buildings', this.currentLocation.id) : null;
    const backgroundImage = backgroundUrl ? getImage(backgroundUrl) : null;
    if (backgroundUrl) loadImage(backgroundUrl);
    if (backgroundImage) {
      drawCoverImage(ctx, backgroundImage, ARENA_WIDTH, ARENA_HEIGHT);
    } else {
      ctx.fillStyle = this.currentLocation ? this.currentLocation.groundColor : '#7fbf6a';
      ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
    }

    for (const pickup of this.pickups) {
      const bob = Math.sin(performance.now() / 300 + pickup.bobPhase) * 3;
      ctx.save();
      ctx.translate(0, bob);
      drawCircleEntity(ctx, pickup);
      ctx.restore();
    }

    for (const enemy of this.enemies) drawCircleEntity(ctx, enemy);
    if (this.boss) drawCircleEntity(ctx, this.boss);
    for (const proj of this.projectiles) drawCircleEntity(ctx, proj);

    if (this.player && this.runState.buffs.fireAura) {
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.beginPath();
      ctx.arc(this.player.x, this.player.y, 50 + this.runState.buffs.fireAura * 7, 0, Math.PI * 2);
      ctx.fillStyle = '#ff5a1f';
      ctx.fill();
      ctx.restore();
    }

    if (this.player) drawCircleEntity(ctx, this.player);

    this.effects = this.effects.filter((fx) => (fx.life -= 16) > 0);
    for (const fx of this.effects) {
      drawMeleeArc(ctx, fx, fx.facing, fx.range, fx.arc, (fx.life / 140) * 0.5);
    }

    if (this.boss) {
      drawText(ctx, this.boss.name, ARENA_WIDTH / 2, 24, { size: 18, color: '#fff' });
    }

    if (this.player && this.currentLocation) {
      screens.updateHud(this.runState, this.player.weapon, this.currentLocation.name);
    }
  }
}
