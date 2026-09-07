// Battlefield objects a player can interact with during a specific fight,
// separate from Homer's own ability deck (systems/battleEngine.js
// playEnvironmentAction) -- free, no Energy cost, limited by `uses` instead
// of affordability. Keyed by an environment id a location's boss/combat
// content points at (see data/journeys.js `environmentId`), NOT by
// location id directly, so the same set could be reused by a different
// fight at the same place later without copy-pasting it.
//
// Shape: { id, label, description, icon, uses, target: 'enemy'|'none',
// effect(api) } -- `effect` receives the exact same api shape an ability's
// `effect(api)` does (see battleEngine.js buildBattleApi), so it can
// damage/heal/status/reduceBreak exactly like a card would.
import { STATUS } from './statusEffects.js';

export const BATTLE_ENVIRONMENTS = {
  flandersHouse: [
    {
      id: 'gardenGnome',
      label: 'GARDEN GNOME',
      description: 'Throw the gnome. 12 damage. Also Stuns if the target is mid-charge on an interruptible move. One use.',
      icon: '🧙',
      uses: 1,
      target: 'enemy',
      effect(api) {
        api.damage(12);
        api.reduceBreak(10);
        const intent = api.target()?.intent;
        if (intent && intent.interruptible) api.status(STATUS.STUN, 1, 'target');
      },
    },
    {
      id: 'grill',
      label: "FLANDERS' GRILL",
      description: 'Kick it over. Applies Burning 4 to the target. Two uses.',
      icon: '🔥',
      uses: 2,
      target: 'enemy',
      effect(api) {
        api.status(STATUS.BURNING, 4, 'target');
      },
    },
    {
      id: 'sprinkler',
      label: 'SPRINKLER',
      description: 'Turn it on. Removes Burning from the target and Soaks them (+25% damage taken). Two uses.',
      icon: '💦',
      uses: 2,
      target: 'enemy',
      effect(api) {
        api.clearStatus(STATUS.BURNING, 'target');
        api.status(STATUS.SOAKED, 2, 'target');
      },
    },
    {
      id: 'mailbox',
      label: 'MAILBOX',
      description: 'Rip it out of the ground and swing. 20 damage. One use.',
      icon: '📪',
      uses: 1,
      target: 'enemy',
      effect(api) {
        api.damage(20);
      },
    },
  ],
};

export function getBattleEnvironment(environmentId) {
  return BATTLE_ENVIRONMENTS[environmentId] || [];
}
