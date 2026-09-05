import { Input } from './engine/input.js';
import { ARENA_WIDTH, ARENA_HEIGHT, PLAYER_START } from './engine/config.js';
import { drawCircleEntity, drawMeleeArc, drawText } from './engine/canvasUtils.js';
import { distance, clamp, pickRandom } from './engine/collision.js';

import { CHARACTERS } from './data/characters.js';
import { ITEMS } from './data/items.js';
import { ENEMIES } from './data/enemies.js';
import { BOSSES } from './data/bosses.js';
import { LOCATIONS } from './data/locations.js';

import { generateEpisode, getStageTemplate, resolveStageLocation, isFinalStage } from './systems/episodeManager.js';
import { buildEnemyWave, buildPickups } from './systems/spawner.js';
import { resolveMeleeAttack, computeAimAngle } from './systems/combat.js';
import { checkSynergies } from './systems/synergy.js';
import { eatDonut, saveDonut, getShopCatalog, purchaseItem } from './systems/economy.js';
import { shiftRelationship, moeSupportsInBossFight, moeGreeting } from './systems/relationships.js';

import { Player } from './entities/player.js';
import { Enemy, makeMoeJukeboxProp } from './entities/enemy.js';
import { Boss } from './entities/boss.js';
import { Projectile } from './entities/projectile.js';
import { Pickup } from './entities/pickup.js';

import { loadMeta, saveMeta, recordEpisodeResult, createRunState } from './state/gameState.js';
import * as screens from './ui/screens.js';

const ARENA_BOUNDS = { width: ARENA_WIDTH, height: ARENA_HEIGHT };

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = new Input(canvas);
    this.meta = loadMeta();
    this.selectedCharacterId = 'homer';

    this.runState = null;
    this.stageIndex = 0;
    this.arenaRunning = false;
    this.paused = false;
    this.lastTime = 0;

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

    this._bindStaticButtons();
  }

  init() {
    this.showHub();
  }

  // ---------- HUB ----------
  showHub() {
    this.stopArenaLoop();
    screens.showScreen('screen-hub');
    screens.populateHub(this.meta, Object.values(CHARACTERS), this.selectedCharacterId, (id) => {
      this.selectedCharacterId = id;
      screens.populateHub(this.meta, Object.values(CHARACTERS), this.selectedCharacterId, () => {});
    });
  }

  _bindStaticButtons() {
    document.getElementById('btn-start-episode').addEventListener('click', () => this.startEpisode());
    document.getElementById('btn-begin-episode').addEventListener('click', () => this.beginEpisode());
    document.getElementById('btn-interstitial-continue').addEventListener('click', () => this.leaveSafeLocation());
    document.getElementById('btn-news-continue').addEventListener('click', () => this.continueAfterNews());
    document.getElementById('btn-next-episode').addEventListener('click', () => this.showHub());
  }

  // ---------- EPISODE SETUP ----------
  startEpisode() {
    const character = CHARACTERS[this.selectedCharacterId];
    this.runState = createRunState(character);
    this.runState.episode = generateEpisode(character);
    this.stageIndex = 0;
    screens.populateEpisodeIntro({ ...this.runState.episode, characterName: character.name });
    screens.showScreen('screen-episode-intro');
  }

  beginEpisode() {
    this.enterStageByIndex(0);
  }

  // ---------- STAGE FLOW ----------
  enterStageByIndex(stageIndex) {
    this.stageIndex = stageIndex;
    const template = getStageTemplate(stageIndex);

    if (template.kind === 'branch') {
      const options = template.options.map((id) => LOCATIONS[id]);
      screens.populateRouteChoice(options, (chosenId) => {
        this.runState.route[stageIndex] = chosenId;
        this.enterResolvedStage(template, chosenId);
      });
      screens.showScreen('screen-route-choice');
      return;
    }

    this.runState.route[stageIndex] = template.locationId;
    this.enterResolvedStage(template, template.locationId);
  }

  enterResolvedStage(template, locationId) {
    const location = resolveStageLocation(template, locationId);

    if (location.safe) {
      this.currentLocation = location;
      screens.populateInterstitial(location);
      screens.showScreen('screen-interstitial');
      return;
    }

    if (location.isTwistLocation && !this.runState.episode.twistTriggered) {
      this.pendingLocation = location;
      screens.populateBreakingNews(this.runState.episode.newsText);
      screens.showScreen('screen-breaking-news');
      return;
    }

    if (location.isBoss) {
      this.enterBossStage(location);
      return;
    }

    this.enterArena(location);
  }

  leaveSafeLocation() {
    this.enterStageByIndex(this.stageIndex + 1);
  }

  continueAfterNews() {
    this.runState.episode.twistTriggered = true;
    const location = this.pendingLocation;
    this.pendingLocation = null;
    if (location.isBoss) {
      this.enterBossStage(location);
    } else {
      this.enterArena(location);
    }
  }

  advanceAfterClear() {
    if (isFinalStage(this.stageIndex)) return;
    this.enterStageByIndex(this.stageIndex + 1);
  }

  // ---------- ARENA SETUP ----------
  enterArena(location) {
    this.currentLocation = location;
    this.arenaCleared = false;
    this.enemies = [];
    this.projectiles = [];
    this.effects = [];
    this.moeJukebox = null;

    const scenarioId = this.runState.episode.modifierId;
    const twistActive = this.runState.episode.twistTriggered;
    const wave = buildEnemyWave(location, this.stageIndex, scenarioId, twistActive);
    for (const spawn of wave) {
      this.enemies.push(new Enemy(spawn.template, spawn.x, spawn.y));
    }

    if (location.hasMoeRelationship) {
      this.moeJukebox = makeMoeJukeboxProp(ARENA_WIDTH - 90, 90);
      this.enemies.push(this.moeJukebox);
      screens.showBanner(moeGreeting(this.runState), 2200);
    }

    this.pickups = buildPickups(location).map(
      (p) => new Pickup({ x: p.x, y: p.y, kind: p.kind, itemId: p.itemId })
    );

    this.player = new Player(this.runState.character, this.runState);
    this.player.x = PLAYER_START.x;
    this.player.y = PLAYER_START.y;

    if (twistActive) {
      const flavor = location.flavorAlien;
      if (flavor && flavor.length) screens.showBanner(pickRandom(flavor), 2200);
    }

    screens.showScreen('screen-arena');
    this.startArenaLoop();
  }

  enterBossStage(location) {
    this.currentLocation = location;
    this.arenaCleared = false;
    this.enemies = [];
    this.projectiles = [];
    this.effects = [];
    this.pickups = [];

    const bossTemplate = BOSSES[this.runState.episode.bossId];
    this.boss = new Boss(bossTemplate, ARENA_WIDTH / 2, 120);

    this.player = new Player(this.runState.character, this.runState);
    this.player.x = PLAYER_START.x;
    this.player.y = PLAYER_START.y;

    if (moeSupportsInBossFight(this.runState)) {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 30);
      this.runState.hp = this.player.hp;
      screens.showBanner('Moe: "Take this one for the road!" (+30 HP)', 2200);
    }

    screens.showScreen('screen-arena');
    screens.showBanner(bossTemplate.intro, 2400);
    this.startArenaLoop();
  }

  // ---------- MAIN LOOP ----------
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
      this.finalizeEpisode(false);
      return;
    }

    if (this.boss && this.boss.dead && !this.episodeEnding) {
      this.episodeEnding = true;
      this.runState.stats.enemiesDefeated += 1;
      screens.showBanner('KANG & KODOS DEFEATED!', 2000);
      setTimeout(() => this.finalizeEpisode(true), 1200);
      return;
    }

    if (!this.arenaCleared && !this.currentLocation.isBoss) {
      const remaining = this.enemies.filter((e) => !e.isProp);
      if (remaining.length === 0) {
        this.arenaCleared = true;
        this.onLocationCleared();
      }
    }
  }

  performPlayerAttack() {
    const player = this.player;
    const weapon = player.weapon;
    const targets = this.boss ? [...this.enemies, this.boss] : this.enemies;

    if (weapon.type === 'melee') {
      const hits = resolveMeleeAttack(player, weapon, player.damageMult, targets);
      this.effects.push({ x: player.x, y: player.y, facing: player.facing, range: weapon.range, arc: (weapon.arcDegrees * Math.PI) / 180, life: 140 });
    } else {
      const angle = computeAimAngle(player, player.accuracy);
      const nuclear = this.runState.buffs.nuclearBowlingBall;
      const proj = new Projectile({
        x: player.x + Math.cos(angle) * player.radius,
        y: player.y + Math.sin(angle) * player.radius,
        vx: Math.cos(angle) * weapon.projectileSpeed,
        vy: Math.sin(angle) * weapon.projectileSpeed,
        radius: weapon.projectileRadius,
        damage: weapon.damage * player.damageMult,
        color: nuclear ? '#7cff3a' : '#3b2a1a',
        owner: 'player',
        pierce: !!nuclear,
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
    if (proj.owner === 'player') {
      for (const target of targets) {
        if (target.dead || proj.hitEntityIds.has(target.id)) continue;
        if (distance(proj, target) < proj.radius + target.radius) {
          target.takeDamage(proj.damage);
          if (proj.appliesStatus) target.applyStatus(proj.appliesStatus);
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
      screens.showBanner('KANG & KODOS CHARGE!', 900);
    } else if (name === 'spreadBlast') {
      const count = 8;
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
            color: '#38d63f',
            owner: 'enemy',
          })
        );
      }
      screens.showBanner('PROBE BLAST!', 900);
    } else if (name === 'summon') {
      for (let i = 0; i < 2; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        this.enemies.push(
          new Enemy(ENEMIES.kodosSpawnling, boss.x + Math.cos(angle) * 60, boss.y + Math.sin(angle) * 60)
        );
      }
      screens.showBanner('REINFORCEMENTS!', 900);
    }
  }

  reapDeadEnemies() {
    const survivors = [];
    for (const enemy of this.enemies) {
      if (enemy.dead) {
        if (enemy.isProp) {
          shiftRelationship(this.runState, 'moe', -2);
          screens.showBanner('Moe: "MY JUKEBOX! GET OUT!"', 2000);
        } else {
          this.runState.stats.enemiesDefeated += 1;
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
          this.paused = false;
        },
        () => {
          saveDonut(this.runState);
          this.paused = false;
        }
      );
      return;
    }
    this.applyItem(pickup.itemId);
  }

  applyItem(itemId) {
    const item = ITEMS[itemId];
    this.runState.ownedItemIds.add(itemId);
    for (const tag of item.tags || []) this.runState.ownedTags.add(tag);

    if (item.category === 'weapon') {
      this.runState.weaponId = item.weaponId;
      screens.showBanner(`Picked up ${item.name}!`, 1600);
    } else {
      item.apply(this.runState, {
        addTimedBuff: () => {},
        scheduleAfter: (ms, fn) => setTimeout(fn, ms),
      });
      screens.showBanner(`${item.name}: ${item.description}`, 1800);
    }

    const synergies = checkSynergies(this.runState);
    for (const synergy of synergies) {
      setTimeout(() => screens.showBanner(`SYNERGY: ${synergy.name}! ${synergy.description}`, 2600), 400);
    }
  }

  // ---------- CLEAR / SHOP ----------
  onLocationCleared() {
    if (this.currentLocation.hasMoeRelationship && this.moeJukebox && !this.moeJukebox.dead && this.moeJukebox.hp === this.moeJukebox.maxHp) {
      shiftRelationship(this.runState, 'moe', 1);
    }

    if (this.currentLocation.shop) {
      this.paused = true;
      this.openShop();
      return;
    }

    this.paused = true;
    screens.showClearModal('AREA CLEAR', () => {
      this.paused = false;
      this.advanceAfterClear();
    });
  }

  openShop() {
    const catalog = getShopCatalog(this.runState);
    screens.showShopModal(
      catalog,
      "Apu's got what you need. For a price.",
      (entry) => {
        if (purchaseItem(this.runState, entry.itemId, entry.cost)) {
          this.applyItem(entry.itemId);
          this.openShop();
        }
      },
      () => {
        this.paused = false;
        this.advanceAfterClear();
      }
    );
  }

  // ---------- END OF RUN ----------
  finalizeEpisode(victory) {
    this.stopArenaLoop();
    this.episodeEnding = false;

    const stats = this.runState.stats;
    const townDestruction = Math.round(
      clamp(stats.enemiesDefeated * 2 + this.stageIndex * 8 + (victory ? 20 : 0), 0, 100)
    );
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
      stats: { ...stats, townDestruction, peoplePissedOff, arrests },
    };

    recordEpisodeResult(this.meta, result);
    screens.populateEndScreen(this.meta, result);
    screens.showScreen('screen-end');
  }

  // ---------- RENDER ----------
  renderArena() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
    ctx.fillStyle = this.currentLocation ? this.currentLocation.groundColor : '#7fbf6a';
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

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
      drawMeleeArc(ctx, fx, fx.facing, fx.range, fx.arc, fx.life / 140 * 0.5);
    }

    if (this.boss) {
      drawText(ctx, this.boss.name, ARENA_WIDTH / 2, 24, { size: 18, color: '#fff' });
    }

    if (this.player && this.currentLocation) {
      screens.updateHud(this.runState, this.player.weapon, this.currentLocation.name);
    }
  }
}

