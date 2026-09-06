import { STATUS } from './statusEffects.js';
import { addStatus } from '../systems/statusEngine.js';

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
  // Payoff for CURING Zombie Barney (data/quests.js WHERE'S BARNEY?, which
  // sets this flag) -- a second "someone from the cast saves you" callback,
  // distinguished from milhouseSaves by granting Armor instead of a flat
  // heal (Barney "taking the hit for you" reads differently than Milhouse
  // shoving you out of the way).
  barneyReturnsFavor: {
    id: 'barneyReturnsFavor',
    triggerPoint: 'lowHp',
    title: 'CALLBACK!',
    condition(runState, context) {
      return !!runState.callbackFlags.savedBarney && runState.cast.includes('barney') && context.hpPct < 0.25;
    },
    fire(runState, context) {
      const { battle } = context;
      addStatus(battle.player, STATUS.ARMOR, 15);
      return { text: 'BARNEY STEPS IN FRONT OF YOU. "You saved me. Least I could do." (+15 Armor)' };
    },
  },
  // Payoff for standing your ground against Snake (data/events.js
  // snakesShakedown 'fight' option, which sets this flag) -- he gets his
  // own back the next time Homer's in real trouble, per the spec's own
  // "screwed over Snake earlier -> Snake steals 30 Springfield Cash during
  // an elite fight" example. Checked at the start of an elite battle (see
  // game.js startBattleForLocationContent's new 'eliteBattleStart' trigger).
  snakeGrudge: {
    id: 'snakeGrudge',
    triggerPoint: 'eliteBattleStart',
    title: 'CALLBACK!',
    condition(runState) {
      return !!runState.callbackFlags.snakeGrudge;
    },
    fire(runState) {
      const stolen = Math.min(runState.donutsCurrency, 30);
      runState.donutsCurrency -= stolen;
      return { text: `SNAKE AMBUSHES YOU before the fight even starts. He grabs ${stolen} donuts and vanishes. Should've paid him when you had the chance. (-${stolen} donuts)` };
    },
  },
  // Payoff for THE MISSING OFFICERS (data/quests.js, which sets
  // locationFlags.policeStationSecured on report-back) -- per the spec's
  // "helped Wiggum earlier -> his police car crashes in to save Homer from
  // lethal damage" example. Deliberately a higher HP threshold (0.15, not
  // milhouseSaves'/barneyReturnsFavor's 0.25) and a bigger heal, since this
  // one requires a whole quest to unlock rather than one dialogue choice.
  wiggumSaves: {
    id: 'wiggumSaves',
    triggerPoint: 'lowHp',
    title: 'CALLBACK!',
    condition(runState, context) {
      return !!runState.world.locationFlags.policeStationSecured && context.hpPct < 0.15;
    },
    fire(runState, context) {
      const { battle } = context;
      battle.player.hp = Math.min(battle.player.maxHp, battle.player.hp + 25);
      return { text: 'CHIEF WIGGUM\'S CRUISER CRASHES THROUGH THE WALL. "Nobody hurts Springfield\'s donut guy on MY watch!" (+25 HP)' };
    },
  },
};
