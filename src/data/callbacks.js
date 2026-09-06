// Callbacks let an early, seemingly-throwaway decision reach forward and
// change something much later -- the game remembers a flag set by an event
// (via systems/callbackEngine.js `setCallbackFlag`) and, the first time its
// `condition` matches at the right `triggerPoint`, fires once and never
// again (systems/callbackEngine.js tracks that in runState.firedCallbackIds).
// `fire(runState, context)` should be light -- most of the real effect
// happens where the trigger point is checked (see game.js), since a
// callback firing at 'bossIntro' can't yet touch a battle that doesn't
// exist; it just leaves a breadcrumb (`runState.pendingCallbackEffects`)
// for the moment that does.
export const CALLBACKS = {
  buttonActivates: {
    id: 'buttonActivates',
    triggerPoint: 'bossIntro',
    title: 'CALLBACK!',
    condition(runState) {
      return !!runState.callbackFlags.pressedButton;
    },
    fire(runState) {
      runState.pendingCallbackEffects.vulnerableBoss = true;
      return { text: 'THE BUTTON ACTIVATES. Something deep in the walls groans and gives way.' };
    },
  },
  milhouseSaves: {
    id: 'milhouseSaves',
    triggerPoint: 'lowHp',
    title: 'CALLBACK!',
    condition(runState, context) {
      return runState.cast.includes('milhouse') && context.hpPct < 0.25;
    },
    fire(runState, context) {
      const { battle } = context;
      battle.player.hp = Math.min(battle.player.maxHp, battle.player.hp + 20);
      return { text: 'MILHOUSE APPEARS out of nowhere and shoves you out of the way. (+20 HP)' };
    },
  },
};
