// Central registry of background music tracks, mirroring data/assets.js's
// (category, id) -> URL pattern. engine/audio.js's Music Manager is the
// only thing that should ever read this -- screens request a track by id
// (e.g. playMusic('homeMenuMusic')) and never touch a URL or an <audio>
// element directly, so two tracks can never play at once no matter how
// many screens ask for music.
//
// To add a new track: drop the file under public/assets/<folder>/, add one
// entry below, done. Planned future tracks (not wired to any screen yet):
// springfieldMap, combat, bossBattle, moesTavern, kwikEMart, treehouseScene,
// commercialBreak, victory, death, couchGag.
const BASE = '/assets';

export const MUSIC_TRACKS = {
  homeMenuMusic: {
    id: 'homeMenuMusic',
    // Real filename has spaces and an ampersand -- encoded so the browser
    // requests it correctly; Vercel's static host is also case-sensitive,
    // so the rest of the name must match exactly too.
    url: `${BASE}/ui/The%20Simpsons%20Hit%20%26%20Run%20-%20Start%20Menu%20Music.mp3`,
    loop: true,
  },
};

export function getMusicTrack(id) {
  return MUSIC_TRACKS[id];
}
