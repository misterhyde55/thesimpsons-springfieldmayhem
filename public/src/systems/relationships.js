// Small relationship system: Moe remembers what Homer did at his bar. Wiring up
// another resident later means adding a key here and a hook wherever they appear.
const LEVELS = ['enemy', 'angry', 'annoyed', 'neutral', 'friendly', 'bestFriend'];

export function shiftRelationship(runState, who, delta) {
  const current = runState.relationships[who] || 'neutral';
  const idx = LEVELS.indexOf(current);
  const next = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, idx + delta))];
  runState.relationships[who] = next;
  return next;
}

export function moeSupportsInBossFight(runState) {
  const level = runState.relationships.moe;
  return level === 'friendly' || level === 'bestFriend';
}

// Duff gets cheaper and heals more as Moe warms up to Homer -- "dialogue
// actually leads to something" instead of relationship level being a flavor
// number nobody ever feels. baseCost/baseHeal are the 'neutral' numbers a
// given Moe's interaction already used before relationship tiers existed.
export function moeDuffTerms(runState, baseCost, baseHeal) {
  const level = runState.relationships.moe || 'neutral';
  if (level === 'bestFriend') return { cost: 0, heal: baseHeal + 7 };
  if (level === 'friendly') return { cost: Math.max(0, baseCost - 1), heal: baseHeal + 3 };
  return { cost: baseCost, heal: baseHeal };
}

export function moeGreeting(runState) {
  const level = runState.relationships.moe || 'neutral';
  if (level === 'angry' || level === 'enemy') {
    return 'Moe: "Aw great. This idiot again. Out!"';
  }
  if (level === 'annoyed') {
    return 'Moe: "You break it, you bought it, pal."';
  }
  if (level === 'friendly' || level === 'bestFriend') {
    return 'Moe: "Hey, it\'s my best customer! This one\'s on the house."';
  }
  return "Moe: \"What'll it be.\"";
}
