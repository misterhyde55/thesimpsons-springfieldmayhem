// Temporary, expiring stat modifiers (a sugar rush, a Duff-fueled attack-speed
// window, ...) layered on top of the run's permanent buffs. `statKey` matches
// whichever runState.buffs field the stat getters already read (speedMult,
// damageMult, cooldownMult, ...).
export function addTimedBuff(runState, statKey, amount, durationMs, now = performance.now()) {
  runState.timedBuffs.push({ statKey, amount, expiresAt: now + durationMs });
}

export function pruneTimedBuffs(runState, now = performance.now()) {
  runState.timedBuffs = runState.timedBuffs.filter((b) => b.expiresAt > now);
}

export function getTimedBuffTotal(runState, statKey) {
  let total = 0;
  for (const buff of runState.timedBuffs) {
    if (buff.statKey === statKey) total += buff.amount;
  }
  return total;
}
