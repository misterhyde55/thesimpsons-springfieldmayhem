// Procedural couch gags, shown on the run-complete/run-failure screen and
// permanently collected in meta (state/gameState.js meta.couchGagsSeenIds).
// Picked from whichever entries list the run's ending id; ties broken at
// random so replaying the same ending doesn't always show the same gag.
export const COUCH_GAGS = {
  zombieShuffle: {
    id: 'zombieShuffle',
    endingIds: ['zombieEnding'],
    description: 'The Simpsons shuffle onto the couch as zombies, moaning contentedly in unison.',
  },
  alreadyThere: {
    id: 'alreadyThere',
    endingIds: ['kangKodosWin'],
    description: "Kang and Kodos are already sitting on the couch, remote in tentacle. \"You're late.\"",
  },
  emptyCouch: {
    id: 'emptyCouch',
    endingIds: ['everyoneDies'],
    description: 'The couch sits empty. The TV plays static. Eventually, it turns itself off.',
  },
  radioactiveGlow: {
    id: 'radioactiveGlow',
    endingIds: ['springfieldSaved', 'treehouseTranscendence'],
    description: 'Everyone sits down glowing a faint, comforting radioactive green.',
  },
  couchEatsCouch: {
    id: 'couchEatsCouch',
    endingIds: ['treehouseTranscendence'],
    description: 'The couch grows eyes, screams, and eats itself. The Simpsons shrug and sit on the floor.',
  },
};

export function pickCouchGag(endingId) {
  const candidates = Object.values(COUCH_GAGS).filter((g) => g.endingIds.includes(endingId));
  const pool = candidates.length ? candidates : Object.values(COUCH_GAGS);
  return pool[Math.floor(Math.random() * pool.length)];
}
