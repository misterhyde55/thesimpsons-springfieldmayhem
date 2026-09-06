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
  // Priority 4's Devil Ned reveal. Payoff for eating the Cursed Donut
  // (data/events.js, which sets both flags below) -- fires the first time
  // the player arrives ANYWHERE at least 3 locations after eating it (see
  // game.js arriveAt's 'locationArrival' check), darkening the screen into
  // the devilNedRevealed Treehouse Scene. `fire` only sets the flag that
  // permanently corrupts First Church of Springfield into an optional
  // Devil Ned fight (data/journeys.js getLocationContent) -- the actual
  // FACE/AVOID choice lives in the scene itself.
  devilNedAppears: {
    id: 'devilNedAppears',
    triggerPoint: 'locationArrival',
    title: 'CALLBACK!',
    condition(runState) {
      if (!runState.callbackFlags.ateCursedDonut) return false;
      const since = runState.world.visitedLocationIds.length - (runState.callbackFlags.ateCursedDonutVisitCount || 0);
      return since >= 3;
    },
    fire(runState) {
      runState.world.locationFlags.hasDevilPortal = true;
      return { text: 'Something has been waiting for you.' };
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
