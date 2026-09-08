import {
  playMenuMove,
  playMenuSelect,
  playMenuBack,
  playEpisodeStart,
  playMusic,
  playMusicForScene,
  SCENE,
  setMusicEnabled,
  setMusicVolume,
  setSfxEnabled,
  setSfxVolume,
  setMasterVolume,
  setMuted,
  toggleMuted,
  isMuted,
} from './engine/audio.js';
import { pickRandom, clamp } from './engine/collision.js';

import { CHARACTERS } from './data/characters.js';
import { ENEMIES } from './data/enemies.js';
import { BOSSES, ZOMBIE_NED_REWARD } from './data/bosses.js';
import { LOCATIONS } from './data/locations.js';
import { getEvent } from './data/events.js';
import { ABILITIES, STARTER_ABILITY_IDS, RARITY } from './data/abilities.js';
import { ITEMS } from './data/items.js';
import { HORROR_RULES } from './data/horrorRules.js';
import { rollProductChoices } from './data/products.js';
import { resolveEnding } from './data/endings.js';
import { pickCouchGag } from './data/couchGags.js';
import { getCharacterInfo } from './data/characterRegistry.js';
import { getLocationContent } from './data/journeys.js';
import { getReachableLocationIds, START_LOCATION_ID } from './data/worldMap.js';
import { INTERIORS, getInteriorState, checkRandomInterrupt } from './data/interiors.js';
import { pickTravelScene, pickSceneLine } from './data/scenes.js';
import { rollTravelEvent } from './data/travelEvents.js';
import { pickTreehouseScene } from './data/treehouseScenes.js';
import { DEVIL_DEALS } from './data/devilDeals.js';
import { applyQuestResolution, getActiveQuestsSummary } from './data/quests.js';
import { getLocationBattleEvent } from './data/locationBattleEvents.js';

import { generateEpisode } from './systems/episodeManager.js';
import { getCurrentSegment, isFinalSegment, isSegmentComplete, isBossLocationUnlocked, markLocationVisited } from './systems/board.js';
import {
  createBattle,
  playAbility,
  playEnvironmentAction,
  useConsumableInBattle,
  endPlayerTurn,
  canPlayAbility,
  getAliveEnemies,
  getPlayableAbilities,
  syncRunStateFromBattle,
} from './systems/battleEngine.js';
import { rollAbilityChoices, learnAbility } from './systems/abilityDraft.js';
import { getShopCatalog, purchaseEntry, canUseKwikEMartShop, apuBanMessage } from './systems/economy.js';
import { moeSupportsInBossFight, shiftRelationship } from './systems/relationships.js';
import { checkCallback } from './systems/callbackEngine.js';
import { maybeTriggerLocationInvasion, tickLocationInvasions, overrunAnnouncement, INVASION_CONFIG } from './systems/locationInvasions.js';
import { advanceDevilNed, isDevilNedAdjacentTo } from './systems/devilNedHunt.js';

import {
  loadMeta,
  saveMeta,
  recordEpisodeResult,
  recordDiscoveries,
  recordEnding,
  recordCouchGag,
  createRunState,
  saveActiveRun,
  loadActiveRun,
  hasActiveRun,
  clearActiveRun,
} from './state/gameState.js';
import * as screens from './ui/screens.js';
import * as mapView from './ui/worldMapView.js';

// Once a run's Mayhem meter crosses this, locations show their
// `flavorCorrupted` line instead of `flavorNormal` -- Springfield visibly
// getting worse as the episode goes on rather than flipping all at once.
const CORRUPTION_MAYHEM_THRESHOLD = 50;

// How many actions (interactions) a location interior visit grants -- "the
// player can't investigate everything" is the point, see data/interiors.js.
const INTERIOR_STARTING_ACTIONS = 3;

function shopFlavorForApu(runState) {
  const level = runState.relationships.apu;
  if (runState.mayhem >= 70 && level === 'enemy') return 'Apu: "...just take what you need. No charge tonight."';
  if (level === 'bestFriend') return 'Apu: "For my best customer -- everything half off, my friend."';
  if (level === 'friendly') return 'Apu: "A little discount for you, Homer."';
  if (level === 'angry') return 'Apu: "Fine. Take it. But you\'re paying double."';
  if (level === 'annoyed') return 'Apu: "Prices are a little higher for you today, Homer."';
  return "Apu's got what you need. For a price.";
}

export class Game {
  constructor() {
    this.meta = loadMeta();
    setMusicEnabled(this.meta.settings.musicOn);
    setMusicVolume(this.meta.settings.musicVolume);
    setSfxEnabled(this.meta.settings.sfxOn);
    setSfxVolume(this.meta.settings.sfxVolume);
    setMasterVolume(this.meta.settings.masterVolume);
    setMuted(this.meta.settings.masterMuted);

    this.runState = null;
    this.battle = null;
    // Held true for the duration of a boss's dramatic phase-transition pause
    // (data/bosses.js `transitionLine`, e.g. Zombie Ned's "Okie dokie...")
    // -- afterPlayerAction defers its mid-fight-event check while this is
    // true, so a checkMidFightEvent (e.g. Rod & Todd) triggered on the exact
    // same hit doesn't pop its modal on top of the still-darkened stage.
    this.phaseTransitionPending = false;
    this.pendingAbilityId = null;
    this.pendingCharacterId = null;
    this.pendingEpisode = null;
    this.mainMenuNav = null;

    // Set while resolving a map location's combat/event content (see
    // arriveAt) -- currentLocation is also read by battle flavor lookups
    // and the ability-draft/finalizeRun "where did this happen" text.
    this.currentLocationId = null;
    this.currentLocation = null;
    this.pendingLocationContent = null;

    // Set while a location interior scene (Kwik-E-Mart, Moe's Tavern) is
    // open -- see enterInteriorScreen.
    this.interiorLocationId = null;
    this.interiorStateId = null;
    this.interiorState = null;
    this.interiorActionsRemaining = 0;

    document.getElementById('btn-news-continue').addEventListener('click', () => this.continueAfterNews());
    document.addEventListener('keydown', (e) => this.handleGlobalKeydown(e));

    // Global sound button (index.html) -- lives outside every .screen, so
    // it's wired once here rather than re-bound on each screen transition.
    document.getElementById('btn-sound-toggle').addEventListener('click', () => this.toggleGlobalMuted());
    this.updateSoundButtons();

    // Header (Treehouse Broadcast HUD) Season/Episode -> Episode Guide.
    // No-ops mid-battle: there's no safe "leave and resume" path for an
    // in-progress fight yet (the pause menu itself isn't wired on the
    // battle screen either -- see openPauseMenu's call sites).
    document.getElementById('header-season-episode').addEventListener('click', () => {
      if (this.battle) return;
      this.showSeasonsInfo();
    });
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
    playMusicForScene(SCENE.MAIN_MENU, { fadeInMs: 700 });
    screens.showScreen('screen-main-menu');
    screens.updateHeaderRunInfo(null);
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
    screens.populateSettings(this.meta, {
      onReset: () => {
        if (window.confirm('Reset all save data? This cannot be undone.')) {
          localStorage.clear();
          this.meta = loadMeta();
          setMusicEnabled(this.meta.settings.musicOn);
          setMusicVolume(this.meta.settings.musicVolume);
          setSfxEnabled(this.meta.settings.sfxOn);
          setSfxVolume(this.meta.settings.sfxVolume);
          setMasterVolume(this.meta.settings.masterVolume);
          setMuted(this.meta.settings.masterMuted);
          this.updateSoundButtons();
          if (this.meta.settings.musicOn) playMusic('homeMenuMusic');
          this.showMainMenu();
        }
      },
      onBack: () => this.showMainMenu(),
      onMasterVolumeChange: (volume01) => {
        this.meta.settings.masterVolume = volume01;
        saveMeta(this.meta);
        setMasterVolume(volume01);
      },
      onMusicToggle: (enabled) => {
        this.meta.settings.musicOn = enabled;
        saveMeta(this.meta);
        setMusicEnabled(enabled);
        if (enabled) playMusic('homeMenuMusic');
      },
      onVolumeChange: (volume01) => {
        this.meta.settings.musicVolume = volume01;
        saveMeta(this.meta);
        setMusicVolume(volume01);
      },
      onSfxToggle: (enabled) => {
        this.meta.settings.sfxOn = enabled;
        saveMeta(this.meta);
        setSfxEnabled(enabled);
      },
      onSfxVolumeChange: (volume01) => {
        this.meta.settings.sfxVolume = volume01;
        saveMeta(this.meta);
        setSfxVolume(volume01);
      },
      onMuteToggle: (muted) => this.setGlobalMuted(muted),
      muted: this.meta.settings.masterMuted,
    });
  }

  // ---------- GLOBAL SOUND (HUD mute button + Options "MUTE ALL") ----------
  // Single source of truth for the master mute flag -- both the persistent
  // HUD button (every gameplay screen) and the Options "MUTE ALL" toggle
  // call this, so either one immediately reflects in the other and in
  // localStorage (meta.settings.masterMuted, per the audio-system spec:
  // survive a refresh, survive returning tomorrow).
  setGlobalMuted(muted) {
    this.meta.settings.masterMuted = muted;
    saveMeta(this.meta);
    setMuted(muted);
    this.updateSoundButtons();
  }

  toggleGlobalMuted() {
    const muted = toggleMuted();
    this.meta.settings.masterMuted = muted;
    saveMeta(this.meta);
    this.updateSoundButtons();
  }

  // Refreshes every currently-rendered SOUND button's icon/label/pressed
  // state to match the real mute flag -- called after any mute change, not
  // just from the button's own click handler, so Options' "MUTE ALL" and
  // the HUD button never disagree.
  updateSoundButtons() {
    screens.updateSoundButtons(isMuted());
  }

  // ---------- RUN SETUP ----------
  // The episode is rolled once here (not again on confirm) so the reveal
  // card's segment list always matches the run it's about to start.
  showEpisodeReveal(characterId) {
    const character = CHARACTERS[characterId];
    this.pendingCharacterId = characterId;
    this.pendingEpisode = generateEpisode(character, this.meta.totalEpisodes + 1);
    screens.showScreen('screen-episode-reveal');
    screens.populateEpisodeReveal(character, this.pendingEpisode, () => this.confirmNewEpisode());
  }

  confirmNewEpisode() {
    playEpisodeStart();
    // The Hit & Run menu theme belongs ONLY to the main menu -- fade it
    // out the instant gameplay begins, rather than letting it ride into
    // the opening story beat/map/combat. Each scene the run passes through
    // will call playMusicForScene itself once it's actually showing (no
    // real track assigned to any of them yet, so this is silence until
    // then, not a gap waiting to be filled by a later call).
    playMusicForScene(null, { fadeOutMs: 800 });
    const character = CHARACTERS[this.pendingCharacterId];
    this.runState = createRunState(character);
    this.runState.episode = this.pendingEpisode;
    this.activateCurrentSegmentRule();
    saveActiveRun(this.runState);
    this.showSegmentTitleCard();
  }

  resumeActiveRun() {
    const runState = loadActiveRun();
    if (!runState) {
      this.showMainMenu();
      return;
    }
    playMusicForScene(null, { fadeOutMs: 800 });
    this.runState = runState;
    this.enterBoardScreen();
  }

  // ---------- SEGMENT TRANSITIONS ----------
  // Adds the current segment's Horror Rule to the run (a no-op for Segment
  // III, which relies on the previous two rules still being active -- see
  // data/journeys.js). Never removes an earlier rule: that's the whole
  // point of Horror Rule stacking.
  activateCurrentSegmentRule() {
    const segment = getCurrentSegment(this.runState);
    if (segment.horrorRuleId && !this.runState.activeHorrorRuleIds.includes(segment.horrorRuleId)) {
      this.runState.activeHorrorRuleIds.push(segment.horrorRuleId);
    }
  }

  showSegmentTitleCard() {
    const segment = getCurrentSegment(this.runState);
    screens.showScreen('screen-segment-title');
    screens.populateSegmentTitleCard(this.runState.segmentIndex, segment, this.runState.activeHorrorRuleIds, () =>
      this.showSegmentBreakingNews(segment)
    );
  }

  showSegmentBreakingNews(segment) {
    if (!segment.horrorRuleId) {
      this.enterBoardScreen();
      return;
    }
    const scene = pickTreehouseScene('horrorRuleActivated', {
      horrorRuleId: segment.horrorRuleId,
      segmentIndex: this.runState.segmentIndex,
      mayhem: this.runState.mayhem,
    });
    if (scene) {
      this.showStoryScene(scene);
      return;
    }
    screens.showScreen('screen-breaking-news');
    screens.populateBreakingNews(HORROR_RULES[segment.horrorRuleId].newsText);
  }

  continueAfterNews() {
    this.enterBoardScreen();
  }

  // ---------- STORY SCENE (cinematic Treehouse of Horror artwork moments) ----------
  showStoryScene(scene, onContinue) {
    playMusicForScene(SCENE.EVENT);
    screens.showScreen('screen-story-scene');
    screens.populateStoryScene(
      scene,
      (choice) => this.onStorySceneChoice(choice),
      onContinue || (() => this.enterBoardScreen()),
      this.runState
    );
  }

  // `choice.apply` returns either a plain string (older scenes) or
  // `{text, effects, mayhemDelta}` (the redesigned decision-card scenes --
  // see data/treehouseScenes.js's header comment) so the player sees the
  // actual mechanical consequence as reward-toast chips, not just
  // narration, and any Mayhem cost goes through increaseMayhem (respects
  // the Devil's Pitchfork multiplier) rather than being hand-rolled in data.
  onStorySceneChoice(choice) {
    const result = choice.apply(this.runState);
    const { text, effects, mayhemDelta } = typeof result === 'string' ? { text: result } : result;
    if (mayhemDelta) this.increaseMayhem(mayhemDelta);
    saveActiveRun(this.runState);
    screens.showStorySceneOutcome(text, () => this.resolveStorySceneChoice(choice), effects);
  }

  // The opening zombie scene's decision doubles as the first location
  // encounter: FIGHT THROUGH THEM resolves 742 Evergreen Terrace's own
  // combat content right here rather than making the player walk there on
  // the map immediately after; every other choice just returns to the map
  // with Evergreen Terrace still unresolved and waiting.
  resolveStorySceneChoice(choice) {
    if (choice.leadsTo !== 'combat') {
      this.enterBoardScreen();
      return;
    }
    // A choice can name its own fight (see the Devil Ned reveal scene,
    // data/treehouseScenes.js devilNedRevealed) -- defaults to the zombie
    // opening's original hardcoded Evergreen Terrace fight otherwise.
    const locationId = choice.combatLocationId || 'simpsonHouse';
    const content = choice.combatContent || getLocationContent(this.runState, locationId);
    this.currentLocationId = locationId;
    this.currentLocation = LOCATIONS[locationId];
    this.runState.world.currentLocationId = locationId;
    this.enterBattleForLocationContent(locationId, content);
  }

  // ---------- SPRINGFIELD MAP ----------
  showBoard() {
    this.currentLocationId = null;
    this.enterBoardScreen();
  }

  enterBoardScreen() {
    playMusicForScene(SCENE.MAP);
    screens.showScreen('screen-board');
    const segment = getCurrentSegment(this.runState);
    const reachableIds = getReachableLocationIds(this.runState);
    screens.populateBoardInfo(this.runState, segment, reachableIds.length);
    screens.applyMapMayhemVisuals(this.runState.mayhem);
    screens.populateQuestTrackerToggle(getActiveQuestsSummary(this.runState), () => {
      screens.showQuestTrackerModal(getActiveQuestsSummary(this.runState), null, (locationId) => this.onQuestShowOnMap(locationId));
    });
    screens.freshButton('btn-board-pause').addEventListener('click', () => this.openPauseMenu());
    mapView.mountMapView({
      onHotspotClick: (locationId) => this.onHotspotClick(locationId),
      onHotspotHover: (locationId) => mapView.showHoverPanel(locationId, this.runState),
      onZoomReset: () => {
        mapView.resetViewToCurrentLocation(this.runState);
        this.saveMapCamera();
      },
      onCameraSettled: (camera) => {
        if (!this.runState) return;
        this.runState.world.mapCamera = camera;
        saveActiveRun(this.runState);
      },
    });
    // A brand-new run has no saved camera yet -- start framed on the
    // Simpsons House rather than showing the whole map at once. Returning
    // to an in-progress run restores exactly where the player left the
    // camera (pan + zoom), per "do not reset the map."
    if (this.runState.world.mapCamera) {
      mapView.setCameraState(this.runState.world.mapCamera);
    } else {
      mapView.focusCameraOnStart();
    }
    mapView.renderMap(this.runState);
  }

  // Available mid-run from the board and interior headers. runState is
  // already saved continuously (saveActiveRun runs after nearly every
  // mutation elsewhere in this file) -- the explicit save here is mostly
  // reassurance before leaving for the main menu, not new persistence.
  openPauseMenu() {
    screens.showPauseMenu(
      () => screens.hidePauseMenu(),
      () => {
        saveActiveRun(this.runState);
        screens.hidePauseMenu();
        this.showMainMenu();
      }
    );
  }

  saveMapCamera() {
    this.runState.world.mapCamera = mapView.getCameraState();
    saveActiveRun(this.runState);
  }

  // null = travel is allowed; otherwise the reason it isn't, shown
  // directly in the inspect panel rather than a click just silently doing
  // nothing (map-rebuild "click = INSPECT" flow).
  locationTravelBlockReason(locationId) {
    if (locationId === (this.runState.world.currentLocationId || START_LOCATION_ID)) return 'You are already here.';
    if (!getReachableLocationIds(this.runState).includes(locationId)) return 'Not reachable from here yet.';
    const segment = getCurrentSegment(this.runState);
    if (locationId === segment.bossLocationId && !isBossLocationUnlocked(this.runState)) return 'Explore more of Springfield first.';
    return null;
  }

  isLocationClickable(locationId) {
    return this.locationTravelBlockReason(locationId) === null;
  }

  // First click on a map location opens an inspect panel (name, status,
  // what's known about it) with an explicit TRAVEL HERE button -- it never
  // travels on its own. Only confirmTravelTo (below), fired from that
  // button, actually moves Homer.
  onHotspotClick(locationId) {
    if (!this.runState) return;
    mapView.showHoverPanel(null);
    mapView.setSelectedLocation(locationId);
    const details = mapView.locationInspectDetails(locationId, this.runState);
    const blockReason = this.locationTravelBlockReason(locationId);
    screens.showLocationInspect(
      details,
      { canTravel: !blockReason, disabledReason: blockReason },
      () => {
        screens.hideLocationInspect();
        mapView.setSelectedLocation(null);
        this.confirmTravelTo(locationId);
      },
      () => {
        screens.hideLocationInspect();
        mapView.setSelectedLocation(null);
      }
    );
  }

  // Quest tracker's SHOW ON MAP (data/quests.js QUEST_DISPLAY locationId) --
  // pans to the quest's target location and opens the exact same inspect
  // panel a real hotspot click would, rather than a special-purpose popup.
  onQuestShowOnMap(locationId) {
    screens.hideQuestTrackerModal();
    mapView.focusCameraOnLocation(locationId);
    this.saveMapCamera();
    this.onHotspotClick(locationId);
  }

  confirmTravelTo(locationId) {
    if (!this.runState) return;
    if (this.locationTravelBlockReason(locationId)) return;
    this.saveMapCamera();
    mapView.travelHomerMarker(locationId, 500, () => this.travelTo(locationId));
  }

  increaseMayhem(amount) {
    // The Devil's Pitchfork (Devil Ned's reward, data/devilDeals.js) trades
    // combat power for a faster-rising Mayhem meter -- a single relic-id
    // check here rather than a new generic hook, since it's the only relic
    // that touches Mayhem gain itself rather than a battle event.
    const multiplier = this.runState.relics.includes('devilsPitchfork') ? 1.5 : 1;
    this.runState.mayhem = clamp(this.runState.mayhem + amount * multiplier, 0, 100);
    this.runState.stats.peakMayhem = Math.max(this.runState.stats.peakMayhem, this.runState.mayhem);
  }

  // ---------- TRAVEL (atmospheric scene between locations) ----------
  travelTo(locationId) {
    const fromId = this.runState.world.currentLocationId;
    const scene = pickTravelScene(this.runState);
    const sceneLine = pickSceneLine(scene);
    const travelEvent = rollTravelEvent(this.runState, fromId, locationId);
    const outcome = travelEvent.apply(this.runState, fromId, locationId);
    saveActiveRun(this.runState);

    screens.showScreen('screen-travel');
    screens.populateTravelScreen(scene, sceneLine, LOCATIONS[locationId].name, outcome, () => {
      if (outcome?.ambushCombat) {
        this.enterAmbushBattle(fromId, locationId, outcome.ambushCombat);
      } else {
        this.arriveAt(locationId);
      }
    });
  }

  // A travel event (data/travelEvents.js) can detour into a fight before
  // Homer actually reaches his destination -- "AMBUSH!" A battle-victory
  // callback for this content then continues on to the original
  // destination (arriveAt) instead of returning to the map, so surviving
  // the ambush doesn't cost the trip that was already in progress.
  enterAmbushBattle(fromId, destinationId, combatContent) {
    const battleLocationId = fromId || destinationId;
    this.currentLocationId = battleLocationId;
    this.currentLocation = LOCATIONS[battleLocationId];
    this.enterBattleForLocationContent(battleLocationId, {
      ...combatContent,
      type: 'combat',
      isAmbush: true,
      ambushDestinationId: destinationId,
    });
  }

  arriveAt(locationId) {
    this.runState.world.currentLocationId = locationId;

    // Location invasions ("MOE'S TAVERN UNDER ATTACK") tick down (and can
    // permanently overrun) on every arrival that isn't the invaded location
    // itself, then get a small chance to flare up somewhere new -- see
    // systems/locationInvasions.js.
    const overrunIds = tickLocationInvasions(this.runState, locationId);
    for (const id of overrunIds) screens.showBanner(overrunAnnouncement(id), 3200);
    const newInvasionId = maybeTriggerLocationInvasion(this.runState);
    if (newInvasionId && newInvasionId !== locationId) {
      screens.showBanner(`⚠ WARNING: ${LOCATIONS[newInvasionId].name.toUpperCase()} UNDER ATTACK! Get there soon.`, 3400);
    }
    saveActiveRun(this.runState);

    // Priority 4's CALLBACK! -- can interrupt arriving ANYWHERE, not just a
    // specific location, since it's about timing (locations visited since
    // the Cursed Donut) rather than a place. Fires at most once (see
    // systems/callbackEngine.js).
    const devilCallback = checkCallback(this.runState, 'locationArrival', { locationId });
    if (devilCallback) {
      const scene = pickTreehouseScene('devilNedCallback', {});
      if (scene) {
        this.showStoryScene(scene);
        return;
      }
    }

    // Priority 9's HUNTING ENEMY -- once revealed, Devil Ned has a real map
    // position and closes one road-hop toward wherever Homer just went on
    // every arrival (systems/devilNedHunt.js). Catching up drops straight
    // into his boss fight wherever that happens to be, overriding whatever
    // this location would normally show.
    if (advanceDevilNed(this.runState, locationId)) {
      this.currentLocationId = locationId;
      this.currentLocation = LOCATIONS[locationId];
      saveActiveRun(this.runState);
      screens.showBanner('😈 Devil Ned catches up to you. "Going somewhere, Homer?"', 2800);
      this.enterBattleForLocationContent(locationId, { type: 'boss', bossId: 'devilNed' });
      return;
    }
    if (isDevilNedAdjacentTo(this.runState, locationId)) {
      screens.showBanner('You smell sulfur nearby. He\'s close.', 2200);
    }

    if (INTERIORS[locationId]) {
      // CALLBACK! e.g. data/callbacks.js donutTrailFound -- an earlier
      // choice (THROW A DONUT) reaching forward into a specific interior.
      // Shown as a plain banner (not a full story scene) since, unlike the
      // 'locationArrival' Devil Ned reveal, this one has no dedicated
      // cinematic beat -- it just flags the crisis and moves on.
      const interiorCallback = checkCallback(this.runState, 'interiorArrival', { locationId });
      if (interiorCallback) {
        saveActiveRun(this.runState);
        screens.showBanner(`${interiorCallback.title} ${interiorCallback.text}`, 3000);
      }
      this.enterInteriorScreen(locationId);
      return;
    }

    this.enterLocationSegmentContent(locationId);
  }

  // Resolves and enters whichever per-segment content (data/journeys.js)
  // this location has right now -- combat, event, or a quest choice -- or
  // "Nothing left here for now." once it's used up. Extracted out of
  // arriveAt so a location that's ALSO an interior (Bowlarama, Nuclear
  // Plant -- see the 'segmentContent' special case in onInteriorInteract
  // below) can reach the exact same segment content from inside its own
  // menu instead of duplicating this gating logic.
  enterLocationSegmentContent(locationId) {
    // This can now be reached mid-interior-visit (Bowlarama/Nuclear Plant's
    // 'segmentContent' interaction) as well as directly from arriveAt --
    // clear the interior fields either way so a stale interiorLocationId
    // never lingers once we've moved on to an event/combat/board screen.
    this.interiorLocationId = null;
    this.interiorStateId = null;
    this.interiorState = null;
    // A few locations stay revisitable this segment even after their normal
    // content is used up, because a quest or callback has put something new
    // there -- First Church of Springfield once Devil Ned corrupts it
    // (data/journeys.js getLocationContent, until he's actually defeated),
    // Springfield Cemetery while WHERE'S BARNEY? is active, and Police
    // Station once THE MISSING OFFICERS is ready to be reported.
    const hasPendingLocationOverride =
      (locationId === 'springfieldChurch' && this.runState.world.locationFlags.hasDevilPortal && !this.runState.world.locationFlags.devilNedDefeated) ||
      (locationId === 'springfieldCemetery' &&
        this.runState.quests.wheresBarney === 'active' &&
        getCurrentSegment(this.runState).bossLocationId !== 'springfieldCemetery') ||
      (locationId === 'policeStation' && this.runState.quests.missingOfficers === 'resolved');
    const alreadyVisited = !hasPendingLocationOverride && this.runState.world.segmentVisitedLocationIds.includes(locationId);
    const content = alreadyVisited ? null : getLocationContent(this.runState, locationId);
    if (!content) {
      markLocationVisited(this.runState, locationId);
      saveActiveRun(this.runState);
      screens.showBanner('Nothing left here for now.', 1600);
      this.showBoard();
      return;
    }

    this.currentLocationId = locationId;
    this.currentLocation = LOCATIONS[locationId];

    if (content.type === 'event') {
      this.showEventScreenForLocation(locationId, content);
    } else if (content.type === 'questChoice') {
      this.showQuestChoiceScreen(locationId, content);
    } else {
      this.enterBattleForLocationContent(locationId, content);
    }
  }

  // ---------- QUEST CHOICE (data/quests.js) ----------
  // Reuses the ordinary event screen/UI (same {title, prompt, options}
  // shape) since a quest beat is just an event whose options can also lead
  // into a real fight instead of resolving inline -- see
  // data/quests.js wheresBarneyCemeteryContent for why FIGHT needs this and
  // an ordinary event option doesn't.
  showQuestChoiceScreen(locationId, content) {
    screens.showScreen('screen-event');
    screens.populateEvent(content, (option) => {
      this.pendingQuestChoice = option;
      return option.apply ? option.apply(this.runState) : '';
    });
    screens.showEventContinue(() => {
      const option = this.pendingQuestChoice;
      this.pendingQuestChoice = null;
      if (option && option.leadsTo === 'combat') {
        this.currentLocationId = locationId;
        this.currentLocation = LOCATIONS[locationId];
        this.runState.world.currentLocationId = locationId;
        this.enterBattleForLocationContent(locationId, option.combatContent);
        return;
      }
      this.increaseMayhem(5);
      markLocationVisited(this.runState, locationId);
      saveActiveRun(this.runState);
      this.showBoard();
    });
  }

  // ---------- EVENT (non-enterable locations) ----------
  showEventScreenForLocation(locationId, content) {
    playMusicForScene(SCENE.EVENT);
    const eventId = content.eventId || pickRandom(content.eventPool);
    const event = getEvent(eventId);
    screens.showScreen('screen-event');
    screens.populateEvent(event, (option) => option.apply(this.runState));
    screens.showEventContinue(() => {
      this.increaseMayhem(5);
      markLocationVisited(this.runState, locationId);
      saveActiveRun(this.runState);
      this.showBoard();
    });
  }

  // ---------- LOCATION INTERIOR (enterable Springfield buildings) ----------
  enterInteriorScreen(locationId) {
    playMusicForScene(locationId === 'kwikEMart' || locationId === 'moesTavern' ? SCENE.SHOP : SCENE.LOCATION);
    this.interiorLocationId = locationId;
    const { stateId, state } = getInteriorState(locationId, this.runState);
    this.interiorStateId = stateId;
    this.interiorState = state;
    this.interiorActionsRemaining = INTERIOR_STARTING_ACTIONS;
    // "Once per visit" services (Moe's BAR SNACKS/I NEED A MINUTE.) reset
    // fresh every time Homer actually walks back in, not once per episode.
    if (locationId === 'moesTavern') {
      delete this.runState.world.locationFlags.moeSnacksThisVisit;
      delete this.runState.world.locationFlags.moeRestedThisVisit;
    }
    screens.showScreen('screen-location-interior');
    screens.updateHeaderRunInfo(this.runState);
    screens.freshButton('btn-interior-pause').addEventListener('click', () => this.openPauseMenu());
    this.refreshInteriorScreen();
  }

  refreshInteriorScreen() {
    const visibleState = {
      ...this.interiorState,
      interactions: this.interiorState.interactions.filter((i) => !i.visible || i.visible(this.runState)),
    };
    screens.populateLocationInterior(
      LOCATIONS[this.interiorLocationId].name,
      visibleState,
      this.interiorActionsRemaining,
      (interaction) => this.onInteriorInteract(interaction),
      () => this.leaveInterior(),
      INTERIORS[this.interiorLocationId].image
    );
    if (this.interiorActionsRemaining === 1) {
      screens.showBanner('☠ SOMETHING IS APPROACHING. Make this one count.', 2000);
    } else if (this.interiorActionsRemaining <= 0) {
      screens.showBanner("You're out of time here.", 1600);
    }
  }

  onInteriorInteract(interaction) {
    // Cost-aware guard: a free dialogue branch (cost: 0, e.g. Moe's
    // WHAT'VE YOU GOT?/LEAVE) stays available even with zero actions left,
    // since talking itself was never the thing spending them.
    if (this.interiorActionsRemaining < (interaction.cost ?? 1)) return;

    if (interaction.special === 'shop') {
      this.interiorActionsRemaining -= 1;
      if (!canUseKwikEMartShop(this.runState)) {
        saveActiveRun(this.runState);
        screens.showInteriorResult(apuBanMessage(this.runState), null, null, () => this.afterInteriorResult());
        return;
      }
      saveActiveRun(this.runState);
      this.openInteriorShop();
      return;
    }
    if (interaction.special === 'combat') {
      // Mirrors the 'abilityDraft' case below: this ends the visit here
      // rather than through leaveInterior, since victory (or an ability
      // draft after it) goes straight back to the map.
      this.interiorActionsRemaining -= 1;
      if (interaction.flagId) this.runState.world.locationFlags[interaction.flagId] = true;
      markLocationVisited(this.runState, this.interiorLocationId);
      this.currentLocationId = this.interiorLocationId;
      this.currentLocation = LOCATIONS[this.interiorLocationId];
      saveActiveRun(this.runState);
      this.enterBattleForLocationContent(this.interiorLocationId, interaction.combatContent);
      return;
    }
    if (interaction.special === 'segmentContent') {
      // Bowlarama/Nuclear Plant aren't dialogue interiors like Moe's/Apu's --
      // they're ordinary per-segment board locations (data/journeys.js) that
      // ALSO happen to host a card-upgrade station, so this one interaction
      // hands off to the exact same combat/event resolution a normal arrival
      // would have used (enterLocationSegmentContent), instead of
      // duplicating that gating logic here.
      this.interiorActionsRemaining -= 1;
      saveActiveRun(this.runState);
      this.enterLocationSegmentContent(this.interiorLocationId);
      return;
    }
    if (interaction.special === 'abilityDraft') {
      // Taking this ends the visit on the spot (same as the old rest-node
      // "LEARN ABILITY" option) -- mark the location visited now, since
      // showAbilityDraftScreen's own callback goes straight back to the map
      // rather than through leaveInterior.
      markLocationVisited(this.runState, this.interiorLocationId);
      this.increaseMayhem(5);
      saveActiveRun(this.runState);
      const choices = rollAbilityChoices(this.runState, 3);
      this.showAbilityDraftScreen(this.interiorLocationId, choices, false);
      return;
    }

    this.interiorActionsRemaining -= interaction.cost ?? 1;
    const result = interaction.run(this.runState);
    saveActiveRun(this.runState);
    screens.showInteriorResult(
      result.text,
      result.followUps,
      (followUp) => this.onInteriorFollowUp(followUp),
      () => this.afterInteriorResult()
    );
  }

  onInteriorFollowUp(followUp) {
    // Most followUps are still a free dialogue reply (cost undefined -> 0,
    // the original behavior); Moe's WHAT'VE YOU GOT? services are the
    // first followUps to carry their own real cost.
    if (this.interiorActionsRemaining < (followUp.cost || 0)) {
      screens.showInteriorResult("You're out of time for that right now.", null, null, () => this.afterInteriorResult());
      return;
    }
    // Mirrors onInteriorInteract's top-level `special: 'combat'` case --
    // a followUp (e.g. Moe's "THE REGULARS ARE MOVING WRONG" event's
    // CONFRONT LENNY choice) can hand off to a real fight too, not just a
    // top-level interaction.
    if (followUp.special === 'combat') {
      this.interiorActionsRemaining -= followUp.cost || 0;
      if (followUp.flagId) this.runState.world.locationFlags[followUp.flagId] = true;
      markLocationVisited(this.runState, this.interiorLocationId);
      this.currentLocationId = this.interiorLocationId;
      this.currentLocation = LOCATIONS[this.interiorLocationId];
      saveActiveRun(this.runState);
      this.enterBattleForLocationContent(this.interiorLocationId, followUp.combatContent);
      return;
    }
    this.interiorActionsRemaining -= followUp.cost || 0;
    const result = followUp.run(this.runState);
    saveActiveRun(this.runState);
    screens.showInteriorResult(result.text, null, null, () => this.afterInteriorResult());
  }

  afterInteriorResult() {
    const interrupt = checkRandomInterrupt(this.interiorLocationId, this.interiorStateId, this.runState);
    if (interrupt) {
      this.showInteriorRandomEvent(interrupt);
      return;
    }
    this.refreshInteriorScreen();
  }

  // A location's own random event (e.g. Snake robbing the Kwik-E-Mart mid-
  // visit) -- reuses data/events.js's {prompt, options[{label, apply,
  // resultText}]} shape, rendered through the same result/follow-up panel
  // as an ordinary conversation.
  showInteriorRandomEvent(event) {
    const followUps = event.options.map((option) => ({
      id: option.id,
      label: option.label,
      run: (runState) => ({ text: option.apply(runState) || option.resultText || '' }),
    }));
    screens.showInteriorResult(
      event.prompt,
      followUps,
      (followUp) => {
        const result = followUp.run(this.runState);
        saveActiveRun(this.runState);
        screens.showInteriorResult(result.text, null, null, () => this.refreshInteriorScreen());
      },
      () => this.refreshInteriorScreen()
    );
  }

  openInteriorShop() {
    screens.showShopModal(
      getShopCatalog(this.runState),
      shopFlavorForApu(this.runState),
      (entry) => {
        if (purchaseEntry(this.runState, entry)) this.onShopPurchase(entry);
        this.openInteriorShop();
      },
      () => {
        screens.hideShopModal();
        saveActiveRun(this.runState);
        this.refreshInteriorScreen();
      }
    );
  }

  onShopPurchase(entry) {
    const id = entry.kind === 'item' ? entry.itemId : entry.relicId;
    recordDiscoveries(this.meta, [id]);
    saveMeta(this.meta);
    screens.showBanner(`${entry.item.emoji} ${entry.item.name}: ${entry.item.description}`, 1800);
  }

  leaveInterior() {
    const locationId = this.interiorLocationId;
    // Bowlarama/Nuclear Plant (INTERIORS entries with deferVisitToContent)
    // still have real per-segment content gated behind segmentContent (see
    // onInteriorInteract) -- marking them visited/spending Mayhem just for
    // walking in to browse the upgrade station and walking back out would
    // silently burn that segment's fight/event for nothing. Every other
    // interior (Moe's, Apu's) is a standing service with no scarce content
    // of its own, so leaving it has always meant "spent time here."
    if (!INTERIORS[locationId].deferVisitToContent) {
      markLocationVisited(this.runState, locationId);
      this.increaseMayhem(5);
    }
    this.interiorLocationId = null;
    this.interiorStateId = null;
    this.interiorState = null;
    saveActiveRun(this.runState);
    this.showBoard();
  }

  // ---------- BATTLE SETUP ----------
  enterBattleForLocationContent(locationId, content) {
    if (content.type === 'boss') {
      const scene = pickTreehouseScene('bossIntro', {
        locationId,
        segmentIndex: this.runState.segmentIndex,
        mayhem: this.runState.mayhem,
      });
      if (scene) {
        this.showStoryScene({ ...scene, choices: null }, () => this.showBossIntro(locationId, content));
        return;
      }
      this.showBossIntro(locationId, content);
      return;
    }
    const enemyTemplates = content.enemyIds.map((id) => ENEMIES[id]);
    this.startBattleForLocationContent(locationId, content, enemyTemplates, false);
  }

  showBossIntro(locationId, content) {
    const bossTemplate = BOSSES[content.bossId];
    const callback = checkCallback(this.runState, 'bossIntro', { boss: bossTemplate });
    screens.showScreen('screen-boss-intro');
    screens.populateBossIntro(bossTemplate, () => this.startBattleForLocationContent(locationId, content, [bossTemplate], true));
    if (callback) {
      setTimeout(() => screens.showBanner(`${callback.title} ${callback.text}`, 2600), 500);
    }
  }

  startBattleForLocationContent(locationId, content, enemyTemplates, isBoss) {
    playMusicForScene(isBoss ? SCENE.BOSS : SCENE.COMBAT);
    if (isBoss && moeSupportsInBossFight(this.runState)) {
      this.runState.hp = Math.min(this.runState.maxHp, this.runState.hp + 30);
    }

    this.battle = createBattle(this.runState, enemyTemplates, locationId, isBoss, content.environmentId);
    this.pendingLocationContent = content;

    // CALLBACK! An earlier choice (see data/callbacks.js buttonActivates)
    // left a breadcrumb rather than acting immediately, since the boss
    // enemy didn't exist yet at 'bossIntro' time -- apply it now that it does.
    if (isBoss && this.runState.pendingCallbackEffects.vulnerableBoss) {
      delete this.runState.pendingCallbackEffects.vulnerableBoss;
      const boss = this.battle.enemies[0];
      boss.hp = Math.max(1, Math.round(boss.hp * 0.75));
    }

    // CALLBACK! e.g. data/callbacks.js snakeGrudge -- checked right as an
    // elite fight begins, before the player has even acted.
    let eliteCallback = null;
    if (content.elite) {
      eliteCallback = checkCallback(this.runState, 'eliteBattleStart', { battle: this.battle });
    }

    screens.showScreen('screen-battle');
    screens.clearBattleLog();
    screens.populateBattle(this.battle, this.runState, {
      onAbilityClick: (abilityId) => this.onAbilityClick(abilityId),
      onTargetEnemy: (enemyInstanceId) => this.onTargetEnemy(enemyInstanceId),
      onEnvironmentClick: (actionId) => this.onEnvironmentClick(actionId),
      onConsumableClick: (itemId) => this.onConsumableClick(itemId),
      onEndTurn: () => this.endTurn(),
      onInspectPile: (which) => this.onInspectPile(which),
    });

    // A location battlefield event is active for this fight (REDESIGN
    // COMBAT GAMEPLAY: "sometimes the ENVIRONMENT should matter" -- see
    // data/locationBattleEvents.js). A toast rather than the shared
    // narrative banner below, so it never competes with the boss
    // intro/elite/flavor line for the same on-screen space.
    const locationEvent = getLocationBattleEvent(locationId);
    if (locationEvent) {
      screens.showRewardToasts(`BATTLEFIELD EVENT -- ${locationEvent.label}: ${locationEvent.description}`);
    }

    if (isBoss) {
      screens.showNpcBanner(content.bossId, BOSSES[content.bossId].intro, 2400);
    } else if (eliteCallback) {
      screens.showBanner(`${eliteCallback.title} ${eliteCallback.text}`, 2800);
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

  // Shared by ability and environment-action targeting -- both stash their
  // pending id the same way (only one is ever set at a time) and route
  // through this one click handler on the enemy slot.
  onTargetEnemy(enemyInstanceId) {
    if (this.pendingAbilityId) {
      const abilityId = this.pendingAbilityId;
      this.pendingAbilityId = null;
      screens.setBattleTargetingAbility(null);
      this.resolveAbilityPlay(abilityId, enemyInstanceId);
      return;
    }
    if (this.pendingEnvironmentActionId) {
      const actionId = this.pendingEnvironmentActionId;
      this.pendingEnvironmentActionId = null;
      screens.setBattleTargetingAbility(null);
      this.resolveEnvironmentPlay(actionId, enemyInstanceId);
    }
  }

  // Rare/Epic abilities get a brief large-card moment before they resolve
  // (REDESIGN COMBAT GAMEPLAY: "reserve dramatic presentation for rare
  // cards... not every basic attack") -- everything Common/Uncommon plays
  // immediately, so pacing stays fast.
  resolveAbilityPlay(abilityId, targetInstanceId) {
    playMenuSelect();
    const ability = ABILITIES[abilityId];
    const isSignature = ability.rarity === RARITY.RARE || ability.rarity === RARITY.EPIC;
    if (isSignature) {
      screens.showLargeCardPreview(ability, () => this.executeAbilityPlay(abilityId, targetInstanceId));
      return;
    }
    this.executeAbilityPlay(abilityId, targetInstanceId);
  }

  executeAbilityPlay(abilityId, targetInstanceId) {
    const result = playAbility(this.battle, this.runState, abilityId, targetInstanceId);
    if (!result.ok) return;

    const ability = ABILITIES[abilityId];
    // MAJOR COMBAT POLISH: "Homer leans/lunges forward... impact appears...
    // enemy recoils" -- a card that hits an enemy gets the lunge lead-in
    // (Homer moves toward the target before impact lands), a self/allies
    // card (buff/heal/armor) keeps the smaller "cast" hop, since there's no
    // target to lunge at.
    const isAttack = ability.target === 'enemy' || ability.target === 'allEnemies';
    screens.playCombatantAnimation(null, isAttack ? 'lunge' : 'cast');
    const resolve = () => {
      this.animateAbilityEvents(result.events);
      screens.appendBattleLog(`You used ${ability.name}.`);
      screens.renderBattle(this.battle, this.runState);
      syncRunStateFromBattle(this.runState, this.battle);
      this.afterPlayerAction();
    };
    if (isAttack) setTimeout(resolve, 220);
    else resolve();
  }

  onInspectPile(which) {
    if (!this.battle) return;
    playMenuSelect();
    const abilityIds = which === 'draw' ? this.battle.drawPile : this.battle.discardPile;
    screens.showPileInspect(which === 'draw' ? 'DRAW PILE' : 'DISCARD PILE', abilityIds);
    screens.freshButton('btn-pile-inspect-close').addEventListener('click', () => {
      playMenuBack();
      screens.hidePileInspect();
    });
  }

  // ---------- BATTLE: ENVIRONMENT ACTIONS (data/battleEnvironments.js) ----------
  onEnvironmentClick(actionId) {
    if (!this.battle || this.battle.outcome) return;
    const action = this.battle.environment.find((a) => a.id === actionId);
    if (!action || action.usesLeft <= 0) return;

    if (action.target === 'enemy') {
      const alive = getAliveEnemies(this.battle);
      if (alive.length === 1) {
        this.resolveEnvironmentPlay(actionId, alive[0].instanceId);
      } else {
        this.pendingEnvironmentActionId = actionId;
        screens.setBattleTargetingAbility(actionId);
        screens.renderBattle(this.battle, this.runState);
      }
      return;
    }
    this.resolveEnvironmentPlay(actionId, null);
  }

  resolveEnvironmentPlay(actionId, targetInstanceId) {
    playMenuSelect();
    const action = this.battle.environment.find((a) => a.id === actionId);
    const result = playEnvironmentAction(this.battle, this.runState, actionId, targetInstanceId);
    if (!result.ok) return;

    screens.playCombatantAnimation(null, 'cast');
    this.animateAbilityEvents(result.events);
    screens.appendBattleLog(`You used ${action.label}.`);
    screens.renderBattle(this.battle, this.runState);
    syncRunStateFromBattle(this.runState, this.battle);

    this.afterPlayerAction();
  }

  // ---------- BATTLE: CONSUMABLES (data/items.js runState.consumables) ----------
  // Free: no Energy cost, doesn't touch the hand, doesn't end the turn --
  // REDESIGN COMBAT GAMEPLAY: "Consumables should NOT count as normal
  // cards." this.battle isn't cleared by using one, so this stays available
  // right up until victory/defeat.
  onConsumableClick(itemId) {
    if (!this.battle || this.battle.outcome) return;
    const result = useConsumableInBattle(this.battle, this.runState, itemId);
    if (!result.ok) return;
    playMenuSelect();
    screens.playCombatantAnimation(null, 'heal');
    if (result.healed > 0) screens.showFloatingNumber(null, `+${result.healed}`, 'heal');
    screens.appendBattleLog(`You used ${result.item.name}. ${result.item.description}`);
    screens.renderBattle(this.battle, this.runState);
    saveActiveRun(this.runState);

    this.afterPlayerAction();
  }

  animateAbilityEvents(events) {
    for (const ev of events) {
      if (ev.kind === 'damage') {
        if (ev.dodged) screens.showFloatingNumber(ev.targetId, 'DODGE', 'heal');
        else if (ev.amount > 0) {
          screens.showFloatingNumber(ev.targetId, `-${ev.amount}`, 'damage');
          screens.playCombatantAnimation(ev.targetId, 'hit');
          screens.shakeBattleStage();
        }
      } else if (ev.kind === 'heal' && ev.amount > 0) {
        screens.showFloatingNumber(null, `+${ev.amount}`, 'heal');
        screens.playCombatantAnimation(null, 'heal');
      } else if (ev.kind === 'breakDamage' && ev.amount > 0) {
        screens.showFloatingNumber(ev.targetId, `-${ev.amount} BREAK`, 'break');
      } else if (ev.kind === 'break') {
        screens.showFloatingNumber(ev.targetId, 'BROKEN!', 'break');
        screens.playCombatantAnimation(ev.targetId, 'break');
        screens.shakeBattleStage();
        screens.appendBattleLog(`${this.enemyName(ev.targetId)} is BROKEN! Stunned and Vulnerable.`);
      } else if (ev.kind === 'phaseChange') {
        const name = this.enemyName(ev.targetId);
        const runPhaseBeat = () => {
          screens.showFloatingNumber(ev.targetId, ev.phaseName || 'PHASE SHIFT', 'phase');
          screens.playCombatantAnimation(ev.targetId, 'phase');
          screens.shakeBattleStage();
          screens.appendBattleLog(`${name} enters a new phase${ev.phaseName ? `: ${ev.phaseName}` : ''}!`);
        };
        if (ev.transitionLine) {
          // MAJOR COMBAT POLISH: "Pause battle briefly. Screen darkens...
          // Then: ZOMBIE NED MUTATES." -- a held dramatic beat before the
          // ordinary phase-change flash/shake below, only for bosses whose
          // phase declares a transitionLine (data/bosses.js).
          this.phaseTransitionPending = true;
          screens.setBattleDarkened(true);
          screens.showBanner(ev.transitionLine, 1400);
          setTimeout(() => {
            screens.showBanner(`${name.toUpperCase()} MUTATES.`, 1600);
            screens.setBattleDarkened(false);
            runPhaseBeat();
            this.phaseTransitionPending = false;
          }, 1500);
        } else {
          runPhaseBeat();
        }
      } else if (ev.kind === 'locationRevive') {
        screens.showFloatingNumber(ev.targetId, 'REVIVED!', 'phase');
        screens.playCombatantAnimation(ev.targetId, 'phase');
        screens.appendBattleLog(`${this.enemyName(ev.targetId)} claws back up! (${ev.label})`);
      } else if (ev.kind === 'locationEvent' && ev.message) {
        screens.appendBattleLog(ev.message);
      }
    }
  }

  // Runs after every player-initiated play (ability or environment action):
  // resolve the outcome, then check for a per-enemy mid-fight event (e.g.
  // Zombie Ned's Rod & Todd rescue) before letting the turn continue.
  afterPlayerAction() {
    // A boss phase-transition's dramatic pause (data/bosses.js
    // transitionLine) is still holding the stage darkened -- wait it out
    // before checking for a mid-fight event, so e.g. Zombie Ned's Rod &
    // Todd rescue (which can trigger on the very same hit that crosses his
    // 50% HP phase line) never pops its choice modal over a still-dark,
    // still-transitioning battlefield.
    if (this.phaseTransitionPending) {
      setTimeout(() => this.afterPlayerAction(), 200);
      return;
    }
    if (this.battle.outcome === 'victory') {
      setTimeout(() => this.onBattleVictory(), 700);
      return;
    }
    if (this.battle.outcome === 'defeat') {
      setTimeout(() => this.onBattleDefeat(), 700);
      return;
    }
    const midFightEvent = this.checkMidFightEvent();
    if (midFightEvent) {
      this.showMidFightEvent(midFightEvent);
      return;
    }
    const anyPlayable = getPlayableAbilities(this.runState).some((a) => canPlayAbility(this.battle, this.runState, a.id));
    const anyEnvironment = this.battle.environment.some((a) => a.usesLeft > 0);
    if (!anyPlayable && !anyEnvironment) setTimeout(() => this.endTurn(), 500);
  }

  checkMidFightEvent() {
    for (const enemy of getAliveEnemies(this.battle)) {
      if (enemy.template.checkMidFightEvent) {
        const event = enemy.template.checkMidFightEvent(this.battle, this.runState, enemy);
        if (event) return event;
      }
    }
    return null;
  }

  // A per-enemy mid-fight decision (e.g. Zombie Ned's Rod & Todd) --
  // reuses the exact same generic choice modal Devil Ned's 'deal' intents
  // use, just triggered by battle state (an HP threshold) rather than an
  // intent roll, and resumes the SAME player turn afterward instead of
  // waiting for a fresh one.
  showMidFightEvent(event) {
    screens.showChoiceModal(event, (choice) => {
      const result = choice.apply(this.runState, this.battle);
      syncRunStateFromBattle(this.runState, this.battle);
      saveActiveRun(this.runState);
      screens.renderBattle(this.battle, this.runState);
      // Rod & Todd's choices return a structured {text, effects} result --
      // show it inside the still-open modal (REDESIGN ALL STORY / MID-
      // COMBAT DECISION POPUPS: "briefly show a structured result summary
      // before resuming") instead of hiding straight to a banner. Any
      // other checkMidFightEvent that still returns a plain string keeps
      // the old banner behavior.
      if (result && typeof result === 'object') {
        screens.showChoiceResult(result.text, result.effects, () => {
          screens.hideChoiceModal();
          this.afterPlayerAction();
        });
      } else {
        screens.hideChoiceModal();
        screens.showBanner(result, 3200);
        this.afterPlayerAction();
      }
    });
  }

  // ---------- BATTLE: ENEMY TURN ----------
  endTurn() {
    if (!this.battle || this.battle.outcome) return;
    screens.setBattleTargetingAbility(null);
    this.pendingAbilityId = null;

    const result = endPlayerTurn(this.battle, this.runState);
    this.animateEnemyActions(result.enemyActions);
    // A location battlefield event's periodic tick landed this turn (Nuclear
    // Plant radiation, Kwik-E-Mart Squishee malfunction -- see
    // data/locationBattleEvents.js). Rare (most turns this is null), so a
    // banner is the right amount of ceremony -- not a full modal.
    if (result.locationEvent) {
      this.animateAbilityEvents(result.locationEvent.events);
      screens.appendBattleLog(`${result.locationEvent.label}: ${result.locationEvent.message}`);
      screens.showBanner(`${result.locationEvent.label}: ${result.locationEvent.message}`, 2600);
    }
    screens.renderBattle(this.battle, this.runState);
    syncRunStateFromBattle(this.runState, this.battle);
    saveActiveRun(this.runState);

    if (this.battle.outcome === 'defeat') {
      setTimeout(() => this.onBattleDefeat(), 900);
      return;
    }

    // Devil Ned's TEMPTATION/THE CONTRACT (data/bosses.js, systems/enemyAI.js
    // 'deal' intent) replaces his whole turn with a real choice instead of
    // an automatic effect -- show it now, before anything else this turn.
    const dealAction = result.enemyActions.find((a) => a.result && a.result.type === 'deal');
    if (dealAction) {
      this.showDevilDeal(dealAction.result.deal);
      return;
    }

    // CALLBACK! e.g. data/callbacks.js milhouseSaves -- checked here since
    // this is the first point after enemy damage where a fresh hpPct exists.
    const hpPct = this.battle.player.hp / this.battle.player.maxHp;
    const callback = checkCallback(this.runState, 'lowHp', { battle: this.battle, hpPct });
    if (callback) {
      screens.renderBattle(this.battle, this.runState);
      screens.showBanner(`${callback.title} ${callback.text}`, 2600);
    }
  }

  // ---------- DEVIL NED DEALS (data/devilDeals.js) ----------
  showDevilDeal(deal) {
    screens.showChoiceModal(deal, (choice) => {
      const resultText = choice.apply(this.runState, this.battle);
      screens.hideChoiceModal();
      syncRunStateFromBattle(this.runState, this.battle);
      saveActiveRun(this.runState);
      screens.renderBattle(this.battle, this.runState);
      screens.showBanner(resultText, 3200);
      if (this.battle.outcome === 'victory') {
        setTimeout(() => this.onBattleVictory(), 900);
      } else if (this.battle.outcome === 'defeat') {
        setTimeout(() => this.onBattleDefeat(), 900);
      }
    });
  }

  animateEnemyActions(enemyActions) {
    for (const action of enemyActions) {
      const name = this.enemyName(action.enemyId);
      if (action.stunned) {
        screens.appendBattleLog(`${name} is Stunned and skips their turn.`);
        continue;
      }
      // MAJOR COMBAT POLISH: a boss's pattern step (data/bosses.js) can
      // carry a one-line combat quip -- shown once per lap through the
      // pattern (whenever that step comes up), not every single turn.
      if (action.intent?.dialogue) {
        screens.showNpcBanner(this.battle.enemies.find((e) => e.instanceId === action.enemyId)?.templateId, action.intent.dialogue, 2600);
      }
      const r = action.result;
      if (r && (r.type === 'attack' || r.type === 'attackTwice')) {
        if (r.dealt > 0 || r.dodged) {
          // Enemy visibly lunges toward Homer FIRST, impact/recoil/damage
          // land a beat later -- "enemy turns must feel like actual
          // actions, not hidden calculations." Single-enemy fights only
          // (this session's scoped target); a multi-enemy stagger is a
          // follow-up, not needed for Zombie Ned alone.
          screens.playCombatantAnimation(action.enemyId, 'lunge');
        }
        setTimeout(() => {
          if (r.dealt > 0) {
            screens.showFloatingNumber(null, `-${r.dealt}`, 'damage');
            screens.playCombatantAnimation(null, 'hit');
            screens.shakeBattleStage();
          } else if (r.dodged) {
            screens.showFloatingNumber(null, 'DODGE', 'heal');
          }
        }, 260);
      } else if (r && r.type === 'prayer') {
        if (r.interrupted) {
          this.battle.flags.interruptsLanded = (this.battle.flags.interruptsLanded || 0) + 1;
          screens.showFloatingNumber(action.enemyId, 'INTERRUPTED!', 'break');
          screens.playCombatantAnimation(action.enemyId, 'break');
          screens.showRewardToasts('PERFECT INTERRUPT!');
          screens.appendBattleLog(`${name}'s Prayer is INTERRUPTED! Perfect Interrupt!`);
        } else if (r.value > 0) {
          screens.showFloatingNumber(action.enemyId, `+${r.value}`, 'heal');
          screens.playCombatantAnimation(action.enemyId, 'heal');
        }
      } else if (r && r.type === 'distract' && r.distractedAbilityId) {
        const locked = ABILITIES[r.distractedAbilityId];
        screens.showBanner(`${locked ? locked.name.toUpperCase() : 'AN ABILITY'} IS LOCKED THIS TURN!`, 2200);
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
    const locationId = this.currentLocationId;
    const content = this.pendingLocationContent;
    // Read before this.battle is cleared below -- distinguishes an ordinary
    // HP-depleted Devil Ned win from the Contract's "GIVE UP MOE" instant
    // win, which already grants its own reward (see data/devilDeals.js).
    const gaveUpMoeWin = this.battle.flags.dealWinReason === 'gaveUpMoe';
    // Also read before this.battle is cleared -- Zombie Ned's ENCOUNTER
    // COMPLETE performance summary (see showEncounterSummary below) needs
    // these battle.flags counters once battle state is gone.
    const zombieNedStats =
      content.bossId === 'zombieNed'
        ? {
            turns: this.battle.turnNumber,
            damageTaken: this.battle.flags.playerDamageTakenThisBattle || 0,
            interrupts: this.battle.flags.interruptsLanded || 0,
            environmentActionsUsed: this.battle.flags.environmentActionsUsed || 0,
            rodAndToddSaved: this.battle.flags.rodAndToddSaved,
          }
        : null;
    this.runState.stats.enemiesDefeated += this.battle.enemies.length;
    if (content.elite) this.runState.stats.elitesDefeated += 1;
    this.increaseMayhem(content.type === 'boss' ? 0 : content.elite ? 15 : 8);
    if (!gaveUpMoeWin) this.grantVictoryCash(content);
    if (content.bonusConsumableChance && Math.random() < content.bonusConsumableChance) this.grantBonusConsumable();
    this.battle = null;

    markLocationVisited(this.runState, locationId);
    if (content.questResolution) applyQuestResolution(this.runState, content.questResolution);
    if (content.resolvesInvasionId) this.resolveLocationInvasionVictory(content.resolvesInvasionId);
    saveActiveRun(this.runState);

    // Zombie Ned (combat-redesign prototype, Flanders House) gets a graded
    // ENCOUNTER COMPLETE performance summary before his reward choice,
    // instead of going straight into the ordinary ability draft.
    if (content.bossId === 'zombieNed') {
      this.showEncounterSummary(zombieNedStats, () => this.showZombieNedReward());
      return;
    }

    // Devil Ned (optional boss, never a segment's real bossLocationId) has
    // his own reward flow instead of the ordinary ability draft. A normal
    // HP-depleted win gets a real choice between his two rewards
    // (data/devilDeals.js victoryReward); the Contract's "GIVE UP MOE" path
    // already handed over the Pitchfork as ITS reward, so it skips this
    // second choice entirely rather than stacking both.
    if (content.bossId === 'devilNed') {
      this.runState.world.locationFlags.devilNedDefeated = true;
      saveActiveRun(this.runState);
      if (gaveUpMoeWin) {
        this.showBoard();
        return;
      }
      screens.showChoiceModal(DEVIL_DEALS.victoryReward, (choice) => {
        const resultText = choice.apply(this.runState);
        recordDiscoveries(this.meta, ['devilsPitchfork', 'forbiddenDonut']);
        saveMeta(this.meta);
        screens.hideChoiceModal();
        saveActiveRun(this.runState);
        screens.showBanner(resultText, 3200);
        this.showBoard();
      });
      return;
    }

    if (isSegmentComplete(this.runState)) {
      this.onSegmentBossVictory();
      return;
    }

    const milestoneId = content.milestoneAbilityId;
    const milestoneAbility = milestoneId && !this.runState.abilityDeck.includes(milestoneId) ? ABILITIES[milestoneId] : null;
    const choices = milestoneAbility ? [milestoneAbility] : rollAbilityChoices(this.runState, 3);
    const onDone = content.isAmbush ? () => this.arriveAt(content.ambushDestinationId) : undefined;
    this.showAbilityDraftScreen(locationId, choices, !!milestoneAbility, onDone);
  }

  // Standard/elite/boss fights all pay out donuts on top of whatever the
  // ability draft grants -- the ability draft rewards the build, this
  // rewards the fight itself, and enemies.length lets a multi-enemy horde
  // pay out more than a lone standard zombie without a separate 'horde' flag.
  grantVictoryCash(content) {
    const enemyCount = this.battle.enemies.length;
    let amount;
    if (content.type === 'boss') amount = 25 + Math.floor(Math.random() * 16);
    else if (content.elite) amount = 12 + Math.floor(Math.random() * 9);
    else amount = 3 + Math.floor(Math.random() * 5) + (enemyCount - 1) * 3;
    this.runState.donutsCurrency += amount;
    screens.showRewardToasts(`+${amount} 🍩 SPRINGFIELD CASH`);
  }

  // A small chance of a staple consumable on top of cash -- opt-in per
  // encounter via content.bonusConsumableChance, so a decision card
  // (e.g. THE DEAD HAVE RISEN's FIGHT THROUGH THEM) can honestly promise
  // "Chance of a Consumable" instead of describing a reward that never
  // actually happens.
  grantBonusConsumable() {
    const pool = ['krustyBurger', 'duffBeer', 'squishee'];
    const itemId = pool[Math.floor(Math.random() * pool.length)];
    this.runState.consumables[itemId] = (this.runState.consumables[itemId] || 0) + 1;
    recordDiscoveries(this.meta, [itemId]);
    saveMeta(this.meta);
    screens.showRewardToasts(`+1 ${ITEMS[itemId].emoji} ${ITEMS[itemId].name.toUpperCase()}`);
  }

  // ---------- ENCOUNTER COMPLETE (combat-redesign performance summary) ----------
  // Generous on purpose -- "primarily a bonus," never a punishment for a
  // casual clear. Floors at a D rather than an F, and rewards the SYSTEMS
  // this fight is built around (interrupts, environment use, the Rod &
  // Todd decision) more than raw speed.
  gradeZombieNedEncounter(stats) {
    let score = 100;
    if (stats.turns > 8) score -= (stats.turns - 8) * 4;
    score -= Math.round(stats.damageTaken * 0.4);
    score += stats.interrupts * 12;
    score += stats.environmentActionsUsed * 5;
    if (stats.rodAndToddSaved) score += 10;
    score = Math.max(35, Math.min(100, score));
    if (score >= 90) return 'S';
    if (score >= 75) return 'A';
    if (score >= 60) return 'B';
    if (score >= 45) return 'C';
    return 'D';
  }

  showEncounterSummary(stats, onContinue) {
    const grade = this.gradeZombieNedEncounter(stats);
    const rows = [
      ['Turns Taken', stats.turns],
      ['Damage Taken', stats.damageTaken],
      ['Perfect Interrupts', stats.interrupts],
      ['Environment Objects Used', stats.environmentActionsUsed],
    ];
    if (stats.rodAndToddSaved !== undefined) {
      rows.push(['Rod & Todd', stats.rodAndToddSaved ? 'SAVED' : 'IGNORED']);
    }
    const bodyHtml =
      `<div class="encounter-grade">${grade}</div>` +
      `<ul class="encounter-stats-list">${rows.map(([label, value]) => `<li><span>${label}</span><span>${value}</span></li>`).join('')}</ul>`;
    screens.showChoiceModal(
      { title: 'ENCOUNTER COMPLETE', bodyHtml, choiceA: { label: 'CONTINUE' } },
      () => {
        screens.hideChoiceModal();
        onContinue();
      }
    );
  }

  showZombieNedReward() {
    screens.showChoiceModal(ZOMBIE_NED_REWARD, (choice) => {
      const resultText = choice.apply(this.runState);
      recordDiscoveries(this.meta, ['leftHandedUppercut', 'neighborlyShield', 'flandersFirstAidKit']);
      saveMeta(this.meta);
      screens.hideChoiceModal();
      saveActiveRun(this.runState);
      screens.showBanner(resultText, 3200);
      this.showBoard();
    });
  }

  // Winning a "DEFEND THE BAR"/"HELP APU" fight clears the crisis for good
  // (rather than letting it silently time out later), and pays off with the
  // relationship bump the location's own NPC config promises.
  resolveLocationInvasionVictory(locationId) {
    delete this.runState.world.locationInvasions[locationId];
    delete this.runState.world.locationStates[locationId];
    const npc = INVASION_CONFIG[locationId]?.npc;
    const toasts = [`${LOCATIONS[locationId].name.toUpperCase()} SAVED`];
    if (npc) {
      shiftRelationship(this.runState, npc, 2);
      toasts.push(`${npc.toUpperCase()} RELATIONSHIP UP`);
    }
    screens.showRewardToasts(toasts);
  }

  onSegmentBossVictory() {
    if (isFinalSegment(this.runState)) {
      this.finalizeRun(true);
      return;
    }
    this.showCommercialBreak();
  }

  onBattleDefeat() {
    this.battle = null;
    this.finalizeRun(false);
  }

  // onDone defaults to returning to the map -- an ambush victory instead
  // continues the interrupted trip (arriveAt the original destination)
  // rather than dropping the player back on the board mid-road.
  showAbilityDraftScreen(locationId, choices, milestone, onDone = () => this.showBoard()) {
    screens.showScreen('screen-ability-draft');
    screens.populateAbilityDraft(
      {
        locationName: this.currentLocation ? this.currentLocation.name : LOCATIONS[locationId]?.name || 'Springfield',
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
        onDone();
      },
      { milestone }
    );
  }

  // ---------- COMMERCIAL BREAK (segment-boundary reward) ----------
  showCommercialBreak() {
    screens.showScreen('screen-commercial-break');
    const products = rollProductChoices(3);
    screens.populateCommercialBreak(
      products,
      (product) => {
        product.apply(this.runState);
        recordDiscoveries(this.meta, [product.id]);
        saveMeta(this.meta);
        this.advanceToNextSegment();
      },
      () => this.advanceToNextSegment()
    );
  }

  advanceToNextSegment() {
    this.runState.segmentIndex += 1;
    this.runState.world.currentLocationId = null;
    this.runState.world.segmentVisitedLocationIds = [];
    this.activateCurrentSegmentRule();
    saveActiveRun(this.runState);
    this.showSegmentTitleCard();
  }

  // ---------- END OF RUN ----------
  finalizeRun(victory) {
    const stats = this.runState.stats;
    const nodesCleared = this.runState.world.visitedLocationIds.length;

    const ending = resolveEnding(this.runState, { victory, stats });
    const couchGag = pickCouchGag(ending.id);

    let rating = victory ? 3 : 1;
    if (stats.peakMayhem >= 50) rating += 1;
    if (this.runState.relics.length >= 2) rating += 1;
    rating = clamp(rating, 1, 5);

    const castNames = this.runState.cast.map((id) => getCharacterInfo(id)?.name || id);
    const horrorRuleNames = this.runState.activeHorrorRuleIds.map((id) => HORROR_RULES[id]?.name).filter(Boolean);

    const result = {
      season: this.meta.season,
      episodeNum: this.meta.episodeInSeason + 1,
      title: this.runState.episode.title,
      character: this.runState.character.name,
      cast: castNames,
      horrorRuleNames,
      endingId: ending.id,
      ending: { id: ending.id, name: ending.name, description: ending.description },
      couchGag: { id: couchGag.id, description: couchGag.description },
      victory,
      rating,
      viewers: (Math.random() * 8 + rating * 2).toFixed(1),
      nodesCleared,
      lastLocationName: this.currentLocation ? this.currentLocation.name : '???',
      stats: { ...stats },
      abilitiesLearned: this.runState.abilityDeck.length - STARTER_ABILITY_IDS.length,
      relicsCollected: this.runState.relics.length,
    };

    const legacyBefore = this.meta.legacyPoints;
    recordEpisodeResult(this.meta, result);
    result.legacyPointsEarned = this.meta.legacyPoints - legacyBefore;

    recordEnding(this.meta, ending.id);
    recordCouchGag(this.meta, couchGag.id);
    saveMeta(this.meta);

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
