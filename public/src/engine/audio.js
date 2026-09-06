// Sound effects (short one-shots) and the Music Manager (looping background
// tracks) -- deliberately separate systems. SFX fire-and-forget through a
// per-key cached <audio>; music goes through one shared "now playing" slot
// so two tracks (or two overlapping plays of the same track) can never
// sound at once. Both fall back to silent no-ops until a real file is
// registered, so call sites never need to change when audio assets arrive.
import { getMusicTrack } from '../data/musicRegistry.js';

const SOUND_URLS = {
  menuMove: null,
  menuSelect: null,
  menuBack: null,
  episodeStart: null,
};

const sfxCache = new Map();

function getSfxAudio(key) {
  const url = SOUND_URLS[key];
  if (!url) return null;
  if (!sfxCache.has(url)) sfxCache.set(url, new Audio(url));
  return sfxCache.get(url);
}

function playSfx(key) {
  const audio = getSfxAudio(key);
  if (!audio) return;
  try {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch (e) {
    // Ignore playback errors (autoplay policy, missing file, etc.)
  }
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

// ==================== MUSIC MANAGER ====================
// One shared "now playing" slot for looping background music. Every screen
// that wants music -- the home menu today, Springfield Map/combat/Moe's/
// boss battles/etc. later -- should request its track through playMusic()
// rather than creating its own <audio>, so a second track can never start
// underneath the first, and re-requesting the track that's already playing
// is always a safe no-op (it never restarts just because a screen
// re-rendered or the player wandered into Settings and back).
//
// "100%" in the Options menu is a comfortable background level, not the
// source file's raw full volume -- MAX_MUSIC_GAIN caps what the slider can
// reach.
const MAX_MUSIC_GAIN = 0.55;
const FADE_STEP_MS = 40;

const audioCache = new Map(); // trackId -> <audio>, reused across plays so a resume continues rather than re-fetching/restarting.
let currentTrackId = null;
let musicEnabled = true;
let musicVolume = 1; // 0-1, the Options-menu slider value.
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

function targetGain() {
  return musicEnabled ? musicVolume * MAX_MUSIC_GAIN : 0;
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

// Applies a music preference (from state/gameState.js meta.settings)
// without starting/stopping anything itself -- call once at startup before
// any playMusic(), and again after Settings changes or a save reset.
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
    audio.volume = targetGain();
    audio.play().catch(() => armAutoplayRetry(currentTrackId));
  }
}

export function setMusicVolume(volume01) {
  musicVolume = Math.max(0, Math.min(1, volume01));
  if (!currentTrackId) return;
  const audio = audioCache.get(currentTrackId);
  if (audio && !audio.paused) audio.volume = targetGain();
}

// Starts (or resumes) a looping track, fading it in. Re-requesting the
// track that's already current is a no-op so a screen re-populating itself
// never restarts the song from the beginning. Switching to a different
// track quickly fades the old one out first.
export function playMusic(trackId, { fadeInMs = 600 } = {}) {
  if (!musicEnabled) return;
  const audio = getMusicAudio(trackId);
  if (!audio) return;
  if (currentTrackId === trackId && !audio.paused) return;

  if (currentTrackId && currentTrackId !== trackId) {
    const previous = audioCache.get(currentTrackId);
    if (previous) fadeVolume(previous, 0, 400, () => previous.pause());
  }

  currentTrackId = trackId;
  const playPromise = audio.play();
  const beginFade = () => fadeVolume(audio, targetGain(), fadeInMs);
  if (playPromise && typeof playPromise.then === 'function') {
    playPromise.then(beginFade).catch(() => armAutoplayRetry(trackId));
  } else {
    beginFade();
  }
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
