// Menu/game audio hooks. No audio files are wired in yet -- every function
// here is a safe no-op until a URL is registered below, so call sites never
// need to change when real audio assets arrive. To add a sound: drop the file
// under public/assets/audio/, add its path to SOUND_URLS, done.
const SOUND_URLS = {
  menuMove: null,
  menuSelect: null,
  menuBack: null,
  episodeStart: null,
  music: null,
};

const cache = new Map();

function getAudio(key) {
  const url = SOUND_URLS[key];
  if (!url) return null;
  if (!cache.has(url)) {
    const audio = new Audio(url);
    cache.set(url, audio);
  }
  return cache.get(url);
}

function play(key) {
  const audio = getAudio(key);
  if (!audio) return;
  try {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch (e) {
    // Ignore playback errors (autoplay policy, missing file, etc.)
  }
}

export function playMenuMove() {
  play('menuMove');
}

export function playMenuSelect() {
  play('menuSelect');
}

export function playMenuBack() {
  play('menuBack');
}

export function playEpisodeStart() {
  play('episodeStart');
}

export function startMenuMusic() {
  const audio = getAudio('music');
  if (!audio) return;
  audio.loop = true;
  audio.play().catch(() => {});
}

export function stopMenuMusic() {
  const audio = getAudio('music');
  if (!audio) return;
  audio.pause();
}
