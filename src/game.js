import { playMenuMove, playMenuSelect, playEpisodeStart } from './engine/audio.js';
import { pickRandom, clamp } from './engine/collision.js';

import { CHARACTERS } from './data/characters.js';
import { ENEMIES } from './data/enemies.js';
import { BOSSES } from './data/bosses.js';
import { LOCATIONS } from './data/locations.js';
import { getEvent } from './data/events.js';
import { ABILITIES, STARTER_ABILITY_IDS } from './data/abilities.js';

import { generateEpisode } from './systems/episodeManager.js';
import { getNode, getAvailableNodeIds, markNodeCompleted, isJourneyComplete } from './systems/board.js';
import {
  createBattle,
  playAbility,
  endPlayerTurn,
  canPlayAbility,
  getAliveEnemies,
  getPlayableAbilities,
  syncRunStateFromBattle,
} from './systems/battleEngine.js';
import { rollAbilityChoices, learnAbility } from './systems/abilityDraft.js';
import { restHeal, getShopCatalog, purchaseEntry } from './systems/economy.js';
import { shiftRelationship, moeSupportsInBossFight, moeGreeting } from './systems/relationships.js';

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

// Once a run's Mayhem meter crosses this, locations show their
// `flavorCorrupted` line instead of `flavorNormal` -- Springfield visibly
// getting worse as the episode goes on rather than flipping all at once.
const CORRUPTION_MAYHEM_THRESHOLD = 50;

export class Game {
  constructor() {
    this.meta = loadMeta();

    this.runState = null;
    this.currentNode = null;
    this.currentLocation = null;
    this.battle = null;
    this.pendingAbilityId = null;
    this.pendingCharacterId = null;
    this.pendingEpisode = null;
    this.firstBoardEntry = false;
    this.boardRunning = false;
    this.mainMenuNav = null;

    document.getElementById('boardCanvas').addEventListener('click', (e) => this.handleBoardClick(e));
    document.getElementById('btn-news-continue').addEventListener('click', () => this.continueAfterNews());
    document.addEventListener('keydown', (e) => this.handleGlobalKeydown(e));
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
    this.firstBoardEntry = true;
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
    if (this.firstBoardEntry) {
      this.firstBoardEntry = false;
      screens.populateBreakingNews(this.runState.episode.newsText);
      screens.showScreen('screen-breaking-news');
      return;
    }
    this.enterBoardScreen();
  }

  continueAfterNews() {
    this.enterBoardScreen();
  }

  enterBoardScreen() {
    screens.showScreen('screen-board');
    const characterId = this.runState.character.id;
    const availableIds = getAvailableNodeIds(this.runState);
    const nextNode = availableIds.length === 1 ? getNode(characterId, availableIds[0]) : null;
    screens.populateBoardInfo(this.runState.episode, nextNode, this.runState.mayhem);
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

  increaseMayhem(amount) {
    this.runState.mayhem = clamp(this.runState.mayhem + amount, 0, 100);
    this.runState.stats.peakMayhem = Math.max(this.runState.stats.peakMayhem, this.runState.mayhem);
  }

  // ---------- NODE ENTRY ----------
  enterNode(node) {
    this.currentNode = node;
    this.currentLocation = LOCATIONS[node.locationId];
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
    this.enterBattleForNode(node);
  }

  // ---------- SHOP ----------
  openShopAtNode(node) {
    const catalog = getShopCatalog(this.runState);
    screens.showShopModal(
      catalog,
      "Apu's got what you need. For a price.",
      (entry) => {
        if (purchaseEntry(this.runState, entry)) {
          this.onShopPurchase(entry);
          this.openShopAtNode(node);
        }
      },
      () => {
        screens.hideShopModal();
        this.increaseMayhem(5);
        markNodeCompleted(this.runState, node.id);
        saveActiveRun(this.runState);
        this.showBoard();
      }
    );
  }

  onShopPurchase(entry) {
    const id = entry.kind === 'item' ? entry.itemId : entry.relicId;
    recordDiscoveries(this.meta, [id]);
    saveMeta(this.meta);
    screens.showBanner(`${entry.item.emoji} ${entry.item.name}: ${entry.item.description}`, 1800);
  }

  // ---------- EVENT ----------
  showEventScreen(node) {
    const eventId = node.eventId || pickRandom(node.eventPool);
    const event = getEvent(eventId);
    screens.showScreen('screen-event');
    screens.populateEvent(event, (option) => option.apply(this.runState));
    screens.showEventContinue(() => {
      this.increaseMayhem(5);
      markNodeCompleted(this.runState, node.id);
      saveActiveRun(this.runState);
      this.showBoard();
    });
  }

  // ---------- REST ----------
  showRestScreen(node) {
    screens.showScreen('screen-rest');
    screens.setRestFlavor('Catch your breath.');
    if (this.currentLocation.hasMoeRelationship) {
      screens.showNpcBanner('moe', moeGreeting(this.runState), 2200);
    }
    screens.populateRest(
      node,
      () => {
        restHeal(this.runState);
        screens.setRestFlavor('You feel fully refreshed.');
        this.finishRestNode(node);
      },
      () => this.showRestAbilityLearn(node),
      () => {
        if (this.currentLocation.hasMoeRelationship) {
          shiftRelationship(this.runState, 'moe', 1);
          screens.setRestFlavor('Moe: "Eh, you\'re alright, Homer." (+Relationship)');
        } else {
          this.runState.donutsCurrency += 1;
          screens.setRestFlavor('A local shares gossip (and a donut). +1 donut currency.');
        }
        this.finishRestNode(node);
      }
    );
  }

  finishRestNode(node) {
    setTimeout(() => {
      this.increaseMayhem(5);
      markNodeCompleted(this.runState, node.id);
      saveActiveRun(this.runState);
      this.showBoard();
    }, 1200);
  }

  showRestAbilityLearn(node) {
    const choices = rollAbilityChoices(this.runState, 3);
    this.showAbilityDraftScreen(node, choices, false);
  }

  // ---------- BATTLE SETUP ----------
  enterBattleForNode(node) {
    if (node.type === 'boss') {
      const bossTemplate = BOSSES[node.bossId];
      screens.showScreen('screen-boss-intro');
      screens.populateBossIntro(bossTemplate, () => this.startBattleForNode(node, [bossTemplate], true));
      return;
    }
    const enemyTemplates = node.enemyIds.map((id) => ENEMIES[id]);
    this.startBattleForNode(node, enemyTemplates, false);
  }

  startBattleForNode(node, enemyTemplates, isBoss) {
    if (isBoss && moeSupportsInBossFight(this.runState)) {
      this.runState.hp = Math.min(this.runState.maxHp, this.runState.hp + 30);
    }

    this.battle = createBattle(this.runState, enemyTemplates, node.locationId, isBoss);
    screens.showScreen('screen-battle');
    screens.clearBattleLog();
    screens.populateBattle(this.battle, this.runState, {
      onAbilityClick: (abilityId) => this.onAbilityClick(abilityId),
      onTargetEnemy: (enemyInstanceId) => this.onTargetEnemy(enemyInstanceId),
      onEndTurn: () => this.endTurn(),
    });

    if (isBoss) {
      screens.showNpcBanner(node.bossId, BOSSES[node.bossId].intro, 2400);
    } else {
      const corrupted = this.runState.mayhem >= CORRUPTION_MAYHEM_THRESHOLD;
      const flavor = corrupted ? this.currentLocation.flavorCorrupted : this.currentLocation.flavorNormal;
      if (flavor && flavor.length) {
        const line = pickRandom(flavor);
        if (this.currentLocation.npcId) screens.showNpcBanner(this.currentLocation.npcId, line, 2200);
        else screens.showBanner(line, 2200);
      }
    }
  }

  // ---------- BATTLE: PLAYER TURN ----------
  onAbilityClick(abilityId) {
    if (!this.battle || this.battle.outcome) return;
    const ability = ABILITIES[abilityId];
    if (!canPlayAbility(this.battle, this.runState, abilityId)) return;

    if (ability.target === 'enemy') {
      const alive = getAliveEnemies(this.battle);
      if (alive.length === 1) {
        this.resolveAbilityPlay(abilityId, alive[0].instanceId);
      } else {
        this.pendingAbilityId = abilityId;
        screens.setBattleTargetingAbility(abilityId);
        screens.renderBattle(this.battle, this.runState);
      }
      return;
    }
    this.resolveAbilityPlay(abilityId, null);
  }

  onTargetEnemy(enemyInstanceId) {
    if (!this.pendingAbilityId) return;
    const abilityId = this.pendingAbilityId;
    this.pendingAbilityId = null;
    screens.setBattleTargetingAbility(null);
    this.resolveAbilityPlay(abilityId, enemyInstanceId);
  }

  resolveAbilityPlay(abilityId, targetInstanceId) {
    playMenuSelect();
    const result = playAbility(this.battle, this.runState, abilityId, targetInstanceId);
    if (!result.ok) return;

    this.animateAbilityEvents(result.events);
    screens.appendBattleLog(`You used ${ABILITIES[abilityId].name}.`);
    screens.renderBattle(this.battle, this.runState);
    syncRunStateFromBattle(this.runState, this.battle);

    if (this.battle.outcome === 'victory') {
      setTimeout(() => this.onBattleVictory(), 700);
      return;
    }

    const anyPlayable = getPlayableAbilities(this.runState).some((a) => canPlayAbility(this.battle, this.runState, a.id));
    if (!anyPlayable) setTimeout(() => this.endTurn(), 500);
  }

  animateAbilityEvents(events) {
    for (const ev of events) {
      if (ev.kind === 'damage') {
        if (ev.dodged) screens.showFloatingNumber(ev.targetId, 'DODGE', 'heal');
        else if (ev.amount > 0) {
          screens.showFloatingNumber(ev.targetId, `-${ev.amount}`, 'damage');
          screens.shakeBattleStage();
        }
      } else if (ev.kind === 'heal' && ev.amount > 0) {
        screens.showFloatingNumber(null, `+${ev.amount}`, 'heal');
      }
    }
  }

  // ---------- BATTLE: ENEMY TURN ----------
  endTurn() {
    if (!this.battle || this.battle.outcome) return;
    screens.setBattleTargetingAbility(null);
    this.pendingAbilityId = null;

    const result = endPlayerTurn(this.battle, this.runState);
    this.animateEnemyActions(result.enemyActions);
    screens.renderBattle(this.battle, this.runState);
    syncRunStateFromBattle(this.runState, this.battle);
    saveActiveRun(this.runState);

    if (this.battle.outcome === 'defeat') {
      setTimeout(() => this.onBattleDefeat(), 900);
    }
  }

  animateEnemyActions(enemyActions) {
    for (const action of enemyActions) {
      const name = this.enemyName(action.enemyId);
      if (action.stunned) {
        screens.appendBattleLog(`${name} is Stunned and skips their turn.`);
        continue;
      }
      const r = action.result;
      if (r && (r.type === 'attack' || r.type === 'attackTwice')) {
        if (r.dealt > 0) {
          screens.showFloatingNumber(null, `-${r.dealt}`, 'damage');
          screens.shakeBattleStage();
        } else if (r.dodged) {
          screens.showFloatingNumber(null, 'DODGE', 'heal');
        }
      }
      screens.appendBattleLog(`${name}: ${action.intent.label}`);
    }
  }

  enemyName(instanceId) {
    const enemy = this.battle.enemies.find((e) => e.instanceId === instanceId);
    return enemy ? enemy.name : 'Enemy';
  }

  // ---------- BATTLE END ----------
  onBattleVictory() {
    const node = this.currentNode;
    this.runState.stats.enemiesDefeated += this.battle.enemies.length;
    if (node.elite) this.runState.stats.elitesDefeated += 1;
    this.increaseMayhem(node.type === 'boss' ? 0 : node.elite ? 15 : 8);
    this.battle = null;

    markNodeCompleted(this.runState, node.id);
    saveActiveRun(this.runState);

    if (isJourneyComplete(this.runState)) {
      this.finalizeRun(true);
      return;
    }

    const milestoneId = node.milestoneAbilityId;
    const milestoneAbility = milestoneId && !this.runState.abilityDeck.includes(milestoneId) ? ABILITIES[milestoneId] : null;
    const choices = milestoneAbility ? [milestoneAbility] : rollAbilityChoices(this.runState, 3);
    this.showAbilityDraftScreen(node, choices, !!milestoneAbility);
  }

  onBattleDefeat() {
    this.battle = null;
    this.finalizeRun(false);
  }

  showAbilityDraftScreen(node, choices, milestone) {
    screens.showScreen('screen-ability-draft');
    screens.populateAbilityDraft(
      {
        locationName: this.currentLocation ? this.currentLocation.name : node.name,
        hpRemaining: this.runState.hp,
        maxHp: this.runState.maxHp,
        mayhem: this.runState.mayhem,
      },
      choices,
      (ability) => {
        if (ability) {
          learnAbility(this.runState, ability);
          recordDiscoveries(this.meta, [ability.id]);
          saveMeta(this.meta);
          if (milestone) screens.showBanner(`${this.runState.character.name.toUpperCase()} LEARNED ${ability.name}!`, 2400);
        }
        saveActiveRun(this.runState);
        this.showBoard();
      },
      { milestone }
    );
  }

  // ---------- END OF RUN ----------
  finalizeRun(victory) {
    const stats = this.runState.stats;
    const nodesCleared = this.runState.completedNodeIds.size;

    let rating = victory ? 3 : 1;
    if (this.runState.stats.peakMayhem >= 50) rating += 1;
    if (this.runState.relics.length >= 2) rating += 1;
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
      stats: { ...stats },
      abilitiesLearned: this.runState.abilityDeck.length - STARTER_ABILITY_IDS.length,
      relicsCollected: this.runState.relics.length,
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
}
