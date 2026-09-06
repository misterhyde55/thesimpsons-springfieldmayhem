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
};

export const DECAYING_ON_OWN_TURN = new Set([STATUS.WEAK, STATUS.VULNERABLE]);
