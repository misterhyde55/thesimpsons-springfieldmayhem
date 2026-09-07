// ==================== CENTRAL AUDIO MANAGER ====================
// The only module allowed to touch a raw <audio> element or a music/SFX
// URL. Everything else -- game.js, ui/screens.js -- asks for sound by id
// or by scene, never by file. Two independent channels (Music, SFX) sit
// under one shared master mute + master volume, so a future MASTER/MUSIC/
// SFX volume panel in Options has real channels to turn, not just a
// single flag pretending to be three.
//
// Scene-aware music: call playMusicForScene(SCENE.MAP) etc. at each major
// screen transition instead of naming a track directly. Only MAIN_MENU has
// a track assigned today (see SCENE_MUSIC below) -- every other scene
// resolves to silence on purpose, never a fallback to the menu track, so
// dropping in a real Springfield Map / Combat / Boss / Shop track later is
// a one-line change to SCENE_MUSIC, not a rewrite.
import { getMusicTrack } from '../data/musicRegistry.js';

// ---------- SFX ----------
// Each key maps to a URL once a real file is uploaded; every id below is a
// *prepared* slot (per the "prepare, don't fabricate" rule everywhere else
// in this codebase's asset registries) so call sites never need to change
// when the sound actually arrives -- playSFX on an unregistered id is
// already a safe, silent no-op.
const SOUND_URLS = {
  menuMove: null,
  menuSelect: null,
  menuBack: null,
  episodeStart: null,
  // Combat/UI SFX -- not implemented as real files yet, wired for later.
  cardPlayed: null,
  enemyHit: null,
  playerHit: null,
  block: null,
  critical: null,
  breakMeter: null,
  perfectInterrupt: null,
  purchase: null,
  heal: null,
  itemPickup: null,
  doorOpen: null,
  zombieNoise: null,
  mapWarning: null,
  questDiscovered: null,
};

const sfxCache = new Map();

function getSfxAudio(key) {
  const url = SOUND_URLS[key];
  if (!url) return null;
  if (!sfxCache.has(url)) sfxCache.set(url, new Audio(url));
  return sfxCache.get(url);
}

// ---------- shared channel state ----------
// `masterMuted` is the single HUD mute button ("SOUND ON"/"SOUND MUTED")
// -- an override that silences both channels at once, independent of the
// per-channel on/off switches (`musicEnabled`/`sfxEnabled`) Options keeps
// for "control these separately" later. Persistence (loading/saving these
// four numbers into meta.settings) is game.js's job, same as it already
// was for musicOn/musicVolume -- this module only holds runtime state.
let masterMuted = false;
let masterVolume = 1;
let musicEnabled = true;
let musicVolume = 1; // 0-1, the Options "MUSIC" slider value
let sfxEnabled = true;
let sfxVolume = 1; // 0-1, the Options "SFX" slider value

// "100%" in Options is a comfortable background level, not the source
// file's raw full volume -- these caps are what each slider's 100% means.
const MAX_MUSIC_GAIN = 0.55;
const MAX_SFX_GAIN = 0.8;

function musicGain() {
  if (masterMuted || !musicEnabled) return 0;
  return masterVolume * musicVolume * MAX_MUSIC_GAIN;
}

function sfxGain() {
  if (masterMuted || !sfxEnabled) return 0;
  return masterVolume * sfxVolume * MAX_SFX_GAIN;
}

function playSfx(key) {
  const gain = sfxGain();
  if (gain <= 0) return;
  const audio = getSfxAudio(key);
  if (!audio) return;
  try {
    audio.volume = gain;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch (e) {
    // Ignore playback errors (autoplay policy, missing file, etc.)
  }
}

export function playSFX(key) {
  playSfx(key);
}

export function playMenuMove() {
  playSfx('menuMove');
}

export function playMenuSelect() {
  playSfx('menuSelect');
}

export function playMenuBack() {
  playSfx('menuBack');
}

export function playEpisodeStart() {
  playSfx('episodeStart');
}

// ==================== MUSIC ====================
// One shared "now playing" slot for looping background music. Every
// screen that wants music should request its track through playMusic() (or
// better, playMusicForScene()) rather than creating its own <audio>, so a
// second track can never start underneath the first, and re-requesting the
// track that's already playing is always a safe no-op.
const FADE_STEP_MS = 40;

const audioCache = new Map(); // trackId -> <audio>, reused across plays so a resume continues rather than re-fetching/restarting.
let currentTrackId = null;
let fadeTimer = null;
let pendingAutoplayTrackId = null;
let autoplayListenersArmed = false;

function getMusicAudio(trackId) {
  const track = getMusicTrack(trackId);
  if (!track) return null;
  if (!audioCache.has(trackId)) {
    const audio = new Audio(track.url);
    audio.loop = !!track.loop;
    audio.volume = 0;
    audioCache.set(trackId, audio);
  }
  return audioCache.get(trackId);
}

function clearFade() {
  if (fadeTimer) {
    clearInterval(fadeTimer);
    fadeTimer = null;
  }
}

function fadeVolume(audio, to, durationMs, onDone) {
  clearFade();
  const from = audio.volume;
  const steps = Math.max(1, Math.round(durationMs / FADE_STEP_MS));
  let step = 0;
  fadeTimer = setInterval(() => {
    step += 1;
    const t = step / steps;
    audio.volume = Math.max(0, Math.min(1, from + (to - from) * t));
    if (step >= steps) {
      clearFade();
      if (onDone) onDone();
    }
  }, FADE_STEP_MS);
}

// Browsers block audio-with-sound before the player has interacted with
// the page at all. Rather than surface an error (or an ugly "click to
// play" button), silently arm one-time listeners that retry the exact same
// track the instant the player does anything -- click, tap, Enter, an
// arrow key -- then remove themselves.
function armAutoplayRetry(trackId) {
  pendingAutoplayTrackId = trackId;
  if (autoplayListenersArmed) return;
  autoplayListenersArmed = true;
  const retry = () => {
    document.removeEventListener('pointerdown', retry, true);
    document.removeEventListener('keydown', retry, true);
    autoplayListenersArmed = false;
    const id = pendingAutoplayTrackId;
    pendingAutoplayTrackId = null;
    if (id) playMusic(id, { fadeInMs: 500 });
  };
  document.addEventListener('pointerdown', retry, true);
  document.addEventListener('keydown', retry, true);
}

// Applies the Options "Music" on/off switch without starting/stopping
// anything by itself beyond pausing/resuming whatever's already current --
// call once at startup before any playMusic(), and again after Settings
// changes or a save reset.
export function setMusicEnabled(enabled) {
  musicEnabled = enabled;
  if (!enabled) pendingAutoplayTrackId = null;
  if (!currentTrackId) return;
  const audio = audioCache.get(currentTrackId);
  if (!audio) return;
  if (!enabled) {
    clearFade();
    audio.pause();
  } else if (audio.paused) {
    audio.volume = musicGain();
    audio.play().catch(() => armAutoplayRetry(currentTrackId));
  }
}

export function setMusicVolume(volume01) {
  musicVolume = Math.max(0, Math.min(1, volume01));
  if (!currentTrackId) return;
  const audio = audioCache.get(currentTrackId);
  if (audio && !audio.paused) audio.volume = musicGain();
}

export function setSfxEnabled(enabled) {
  sfxEnabled = enabled;
}

export function setSfxVolume(volume01) {
  sfxVolume = Math.max(0, Math.min(1, volume01));
}

export function setMasterVolume(volume01) {
  masterVolume = Math.max(0, Math.min(1, volume01));
  if (currentTrackId) {
    const audio = audioCache.get(currentTrackId);
    if (audio && !audio.paused) audio.volume = musicGain();
  }
}

// ---- the global HUD mute button ("SOUND ON" / "SOUND MUTED") ----
// One flag that silences Music AND SFX together, independent of the
// per-channel switches above -- muting here doesn't touch musicEnabled/
// sfxEnabled, so unmuting restores exactly whatever those were already set
// to. game.js persists `masterMuted` the same way it already persists
// musicOn/musicVolume (meta.settings -> localStorage via saveMeta).
export function setMuted(muted) {
  masterMuted = muted;
  if (!currentTrackId) return;
  const audio = audioCache.get(currentTrackId);
  if (!audio) return;
  if (muted) {
    clearFade();
    audio.pause();
  } else if (audio.paused && musicEnabled) {
    audio.volume = musicGain();
    audio.play().catch(() => armAutoplayRetry(currentTrackId));
  }
}

export function toggleMuted() {
  setMuted(!masterMuted);
  return masterMuted;
}

export function isMuted() {
  return masterMuted;
}

// Starts (or resumes) a looping track, fading it in. Re-requesting the
// track that's already current is a no-op so a screen re-populating itself
// never restarts the song from the beginning. Switching to a different
// track quickly fades the old one out first -- two tracks are never
// audible at once.
export function playMusic(trackId, { fadeInMs = 600 } = {}) {
  if (!musicEnabled || masterMuted) return;
  const audio = getMusicAudio(trackId);
  if (!audio) return;
  if (currentTrackId === trackId && !audio.paused) return;

  if (currentTrackId && currentTrackId !== trackId) {
    const previous = audioCache.get(currentTrackId);
    if (previous) fadeVolume(previous, 0, 400, () => previous.pause());
  }

  currentTrackId = trackId;
  const playPromise = audio.play();
  const beginFade = () => fadeVolume(audio, musicGain(), fadeInMs);
  if (playPromise && typeof playPromise.then === 'function') {
    playPromise.then(beginFade).catch(() => armAutoplayRetry(trackId));
  } else {
    beginFade();
  }
}

export function fadeMusicIn(ms = 600) {
  if (!currentTrackId) return;
  const audio = audioCache.get(currentTrackId);
  if (audio) fadeVolume(audio, musicGain(), ms);
}

// Fades the current track out and pauses it -- position is preserved (not
// reset) so a later playMusic() on the same track resumes rather than
// restarting; pass reset:true to actually rewind (e.g. leaving for good).
export function stopMusic({ fadeOutMs = 700, reset = false } = {}) {
  if (!currentTrackId) return;
  const audio = audioCache.get(currentTrackId);
  const stoppedId = currentTrackId;
  currentTrackId = null;
  if (pendingAutoplayTrackId === stoppedId) pendingAutoplayTrackId = null;
  if (!audio) return;
  fadeVolume(audio, 0, fadeOutMs, () => {
    audio.pause();
    if (reset) audio.currentTime = 0;
  });
}

export function fadeMusicOut(ms = 700) {
  stopMusic({ fadeOutMs: ms });
}

// Introspection only -- not used to drive any decision inside this module,
// just exposed for a debug overlay / test harness to confirm "is anything
// actually playing right now" without reaching into private state.
export function getCurrentTrackId() {
  return currentTrackId;
}

export function isCurrentTrackAudible() {
  if (!currentTrackId) return false;
  const audio = audioCache.get(currentTrackId);
  return !!audio && !audio.paused && audio.volume > 0;
}

// ==================== SCENE-AWARE MUSIC ====================
// The Springfield Map / Combat / Boss / Shop / Location / Event tracks
// this unlocks later all slot into SCENE_MUSIC below with zero changes
// anywhere else -- every call site already just says "we're on the map
// now" / "combat started" instead of naming a track.
export const SCENE = {
  MAIN_MENU: 'MAIN_MENU',
  MAP: 'MAP',
  COMBAT: 'COMBAT',
  BOSS: 'BOSS',
  SHOP: 'SHOP',
  LOCATION: 'LOCATION',
  EVENT: 'EVENT',
};

// Only MAIN_MENU is assigned today. Every other scene intentionally has NO
// entry -- playMusicForScene falls through to stopMusic() (silence), never
// back to the menu track. "Do NOT reuse the menu track as fallback
// gameplay music" is the whole point of this table existing separately
// from a single global "the song" concept.
const SCENE_MUSIC = {
  [SCENE.MAIN_MENU]: 'homeMenuMusic',
};

let currentScene = null;

// Called once per major screen transition (see game.js). Re-entering the
// scene you're already in is a no-op, same guarantee playMusic() itself
// gives for a single track -- so a screen re-render never restarts or
// re-fades anything.
export function playMusicForScene(scene, opts) {
  if (scene === currentScene) return;
  currentScene = scene;
  const trackId = SCENE_MUSIC[scene];
  if (trackId) playMusic(trackId, opts);
  else stopMusic(opts);
}
