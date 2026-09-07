// Turn-based status effects shared by the player and enemies in battle
// (systems/battleEngine.js). Every status is just a named stack count on
// whichever combatant holds it -- `decay` says what happens to that stack
// count at the start of the holder's own turn; damage/defense math itself
// lives in systems/statusEngine.js, not here.
export const STATUS = {
  STRENGTH: 'strength', // +1 flat damage per stack on abilities that deal damage. Never decays.
  ARMOR: 'armor', // Absorbs incoming damage 1-for-1 before HP is touched. Never decays on its own (only consumed by damage).
  WEAK: 'weak', // -25% damage dealt while stacks remain. Decays by 1 at the start of the holder's turn.
  VULNERABLE: 'vulnerable', // +50% damage taken while stacks remain. Decays by 1 at the start of the holder's turn.
  DODGE: 'dodge', // Negates the next attack entirely. Consumed on hit, not decayed.
  STUN: 'stun', // Skips the holder's next turn/intent entirely. Consumed at that turn.
  RADIATION: 'radiation', // A stacking resource other abilities/relics consume for bonus effects. Never decays on its own.
  POISON: 'poison', // Deals damage equal to its stack count at the end of the holder's turn, then decays by 1.
  TIPSY: 'tipsy', // +10% damage taken per stack for the rest of the battle. Never decays (it's a drawback, not a buff to wear off).
  // ---- Combat redesign additions (systems/statusEngine.js DOT_STATUSES /
  // effectiveMaxEnergy / status() special-cases) ----
  BURNING: 'burning', // Same tick as Poison (fire flavor, separate stack) -- deals damage equal to stacks at turn end, then decays.
  BLEEDING: 'bleeding', // Same tick as Poison/Burning (physical flavor, separate stack).
  CONFUSED: 'confused', // While any stacks remain, every ability costs +1 Energy. Decays by 1 at the start of the holder's turn.
  TERRIFIED: 'terrified', // Max Energy is reduced by 1 (floor 1) while active. Decays by 1 at the start of the holder's turn.
  EXHAUSTED: 'exhausted', // Max Energy is reduced by 1 PER STACK (floor 1) while active. Decays by 1 at the start of the holder's turn.
  ANGRY: 'angry', // The next enemy-targeted ability played deals +50% damage. Consumed on that play, not decayed.
  SLIMED: 'slimed', // Armor/Block gained is halved (rounded down) while active. Decays by 1 at the start of the holder's turn.
  CURSED: 'cursed', // Healing received is halved (rounded down) while active. Decays by 1 at the start of the holder's turn.
  SOAKED: 'soaked', // +25% damage taken while active -- a lighter Vulnerable, meant to be applied/removed by environment interactions (sprinklers, water). Decays by 1 at the start of the holder's turn.
};

// `iconId` keys into data/icons.js's `status` category (see ui/icons.js) --
// `icon` (emoji) stays only as a data-file fallback label, never rendered
// directly in combat UI anymore.
export const STATUS_INFO = {
  [STATUS.STRENGTH]: { name: 'Strength', icon: '💪', iconId: 'strength', color: '#d0021b', description: '+1 damage per stack.' },
  [STATUS.ARMOR]: { name: 'Armor', icon: '🛡️', iconId: 'armor', color: '#8c8c99', description: 'Absorbs incoming damage.' },
  [STATUS.WEAK]: { name: 'Weak', icon: '🔻', iconId: 'weak', color: '#8a6aa8', description: '-25% damage dealt.' },
  [STATUS.VULNERABLE]: { name: 'Vulnerable', icon: '💢', iconId: 'vulnerable', color: '#e0642a', description: '+50% damage taken.' },
  [STATUS.DODGE]: { name: 'Dodge', icon: '💨', iconId: 'dodge', color: '#3ec24c', description: 'Negates the next attack.' },
  [STATUS.STUN]: { name: 'Stunned', icon: '😵', iconId: 'stun', color: '#f6d217', description: 'Skips their next turn.' },
  [STATUS.RADIATION]: { name: 'Radiation', icon: '☢️', iconId: 'radiation', color: '#7cff3a', description: 'Stacks up for radiation-consuming abilities.' },
  [STATUS.POISON]: { name: 'Infected', icon: '🧟', iconId: 'infection', color: '#3ec24c', description: 'Takes damage equal to stacks at turn end, then decays.' },
  [STATUS.TIPSY]: { name: 'Tipsy', icon: '🍺', iconId: 'tipsy', color: '#e0a04a', description: '+10% damage taken per stack, all battle.' },
  [STATUS.BURNING]: { name: 'Burning', icon: '🔥', iconId: 'burn', color: '#ff5a3c', description: 'Takes damage equal to stacks at turn end, then decays.' },
  [STATUS.BLEEDING]: { name: 'Bleeding', icon: '🩸', iconId: 'bleed', color: '#b3001b', description: 'Takes damage equal to stacks at turn end, then decays.' },
  [STATUS.CONFUSED]: { name: 'Confused', icon: '😵‍💫', iconId: 'confused', color: '#a04ae0', description: 'Every ability costs +1 Energy.' },
  [STATUS.TERRIFIED]: { name: 'Terrified', icon: '😱', iconId: 'fear', color: '#3b6de0', description: 'Max Energy -1 while active.' },
  [STATUS.EXHAUSTED]: { name: 'Exhausted', icon: '😩', iconId: 'exhausted', color: '#8c8c99', description: 'Max Energy -1 per stack while active.' },
  [STATUS.ANGRY]: { name: 'Angry', icon: '😠', iconId: 'rage', color: '#ff2222', description: 'Next Attack deals +50% damage.' },
  [STATUS.SLIMED]: { name: 'Slimed', icon: '🟢', iconId: 'slimed', color: '#7cd63a', description: 'Armor gained is halved while active.' },
  [STATUS.CURSED]: { name: 'Cursed', icon: '💀', iconId: 'cursed', color: '#6a2ab0', description: 'Healing received is halved while active.' },
  [STATUS.SOAKED]: { name: 'Soaked', icon: '💧', iconId: 'soaked', color: '#3ec2ff', description: '+25% damage taken while active.' },
};

// DoT statuses that all tick the same way (statusEngine.js tickTurnEnd):
// deal damage equal to their stack count at the holder's turn end, then
// decay by 1. Distinct ids/flavors (fire vs blood) so future enemies can
// apply the one that fits them, but one shared damage/decay rule.
export const DOT_STATUSES = [STATUS.POISON, STATUS.BURNING, STATUS.BLEEDING];

export const DECAYING_ON_OWN_TURN = new Set([
  STATUS.WEAK,
  STATUS.VULNERABLE,
  STATUS.CONFUSED,
  STATUS.TERRIFIED,
  STATUS.EXHAUSTED,
  STATUS.SLIMED,
  STATUS.CURSED,
  STATUS.SOAKED,
]);
