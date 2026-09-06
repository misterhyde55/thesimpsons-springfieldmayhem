// Full-screen cinematic "story panel" moments -- illustrated Treehouse of
// Horror artwork with progressive narration and, sometimes, a decision.
// Distinct from data/scenes.js (the small text/emoji travel-screen flavor
// shown on every road hop): these are the BIG comic-panel beats -- a Horror
// Rule kicking in, a boss's dramatic entrance, a major callback -- built
// around real uploaded art under public/assets/treehouse/ (see
// data/assets.js `treehouse` category).
//
// `trigger` says which game.js moment consults the registry.
// 'horrorRuleActivated' fires right when a segment's Horror Rule turns on
// (see game.js showSegmentBreakingNews). Add more trigger strings as new
// beats need art -- nothing here needs to change to add one, just teach
// game.js where else to call pickTreehouseScene.
//
// `horrorRuleId` / `locationId` / `segmentIndex` / `mayhemRange` are all
// optional filters (omit or null = "any"); pickTreehouseScene narrows the
// pool by every filter that's set, same "specific match, not a random
// slideshow" principle as data/scenes.js. A scene with no registered image
// yet (getAssetUrl returns undefined) is automatically skipped, so this
// registry is safe to extend with placeholder metadata before the art for
// it exists.
//
// `choices`, when present, turns the scene into a real decision: each
// choice's `apply(runState)` mutates state and returns the one-line outcome
// shown before the scene resolves; `leadsTo` ('board' | 'combat') tells
// game.js what screen comes next. A scene with `choices: null` is just a
// beat -- read it, hit Continue, move on.
import { getAssetUrl } from './assets.js';

export const TREEHOUSE_SCENES = {
  zombieOutbreakBegins: {
    id: 'zombieOutbreakBegins',
    image: getAssetUrl('treehouse', 'zombieOutbreak'),
    title: 'THE DEAD HAVE RISEN!',
    trigger: 'horrorRuleActivated',
    horrorRuleId: 'zombieOutbreak',
    locationId: null,
    segmentIndex: 0,
    mayhemRange: null,
    rarity: 'common',
    narration: [
      'Screams echo through Springfield.',
      'The streets are filling with the undead.',
      'And somehow...',
      'Homer is still thinking about lunch.',
    ],
    choices: [
      {
        id: 'runForCar',
        label: 'RUN FOR THE CAR',
        leadsTo: 'board',
        apply() {
          return 'You bolt for the car. The engine turns over on the second try -- always the second try.';
        },
      },
      {
        id: 'fightThroughThem',
        label: 'FIGHT THROUGH THEM',
        leadsTo: 'combat',
        apply() {
          return "No time to think. You grab whatever's heavy and start swinging.";
        },
      },
      {
        id: 'runBackInside',
        label: 'RUN BACK INSIDE',
        leadsTo: 'board',
        apply() {
          return 'You slam the door and throw the bolt. That bought you a minute. Maybe.';
        },
      },
      {
        id: 'throwDonut',
        label: 'THROW A DONUT',
        leadsTo: 'board',
        apply(runState) {
          if (Math.random() < 0.5) {
            runState.donutsCurrency = Math.max(0, runState.donutsCurrency - 1);
            return 'It works. Sort of. They shuffle after the donut instead of you. (-1 donut)';
          }
          return "It just makes one of them hungrier. That was a mistake.";
        },
      },
    ],
  },
  alienInvasionBegins: {
    id: 'alienInvasionBegins',
    image: getAssetUrl('treehouse', 'alienInvasion'),
    title: 'THEY HAVE COME FOR SPRINGFIELD',
    trigger: 'horrorRuleActivated',
    horrorRuleId: 'alienInvasion',
    locationId: null,
    segmentIndex: 1,
    mayhemRange: null,
    rarity: 'common',
    narration: [
      'A light fills the sky, too slow to be a plane, too bright to be the moon.',
      'Every TV in Springfield switches to static at once.',
      "Kang and Kodos don't even bother hiding this time.",
    ],
    choices: null,
  },
  kangKodosBossIntro: {
    id: 'kangKodosBossIntro',
    image: getAssetUrl('treehouse', 'kangKodosCockpit'),
    title: 'GROUND ZERO',
    trigger: 'bossIntro',
    horrorRuleId: null,
    // Was `null` (any location) -- harmless while Kang & Kodos were the
    // only Segment III boss fight, but Devil Ned (data/bosses.js) can now
    // also be fought during Segment III at First Church of Springfield, and
    // this scene has no business showing there. Scope it to its real fight.
    locationId: 'springfieldCemetery',
    segmentIndex: 2,
    mayhemRange: null,
    rarity: 'common',
    narration: ['Somewhere above Springfield, two very smug aliens are watching the whole thing unfold.'],
    choices: null,
  },
  // Priority 4's CALLBACK! reveal -- fires once, several locations after
  // the player eats the Cursed Donut (data/events.js), regardless of where
  // they currently are (see the callback's own condition in
  // data/callbacks.js and the 'locationArrival' check in game.js arriveAt).
  devilNedRevealed: {
    id: 'devilNedRevealed',
    image: getAssetUrl('enemies', 'devilFlanders'),
    title: 'THE DEVIL HAS COME TO COLLECT',
    trigger: 'devilNedCallback',
    horrorRuleId: null,
    locationId: null,
    segmentIndex: null,
    mayhemRange: null,
    rarity: 'rare',
    narration: [
      'The temperature drops. Then it rises, fast, and keeps going.',
      'Someone is standing where no one was standing a second ago.',
      'He is wearing a very familiar sweater. It is on fire. He does not seem to mind.',
    ],
    choices: [
      {
        id: 'faceDevilNed',
        label: 'FACE HIM',
        leadsTo: 'combat',
        combatLocationId: 'springfieldChurch',
        combatContent: { type: 'boss', bossId: 'devilNed' },
        apply() {
          return '"Hi-diddly-ho, Homer," says the thing wearing Ned Flanders. "I believe you owe me a donut."';
        },
      },
      {
        id: 'avoidDevilNed',
        label: 'AVOID HIM (FOR NOW)',
        leadsTo: 'board',
        apply() {
          return 'You turn and walk the other way. Somewhere behind you, you hear him start whistling. He knows where the church is. So do you, now.';
        },
      },
    ],
  },
};

export function getTreehouseScene(id) {
  return TREEHOUSE_SCENES[id];
}

// Finds the best (first, most-specific-filters-satisfied) registered scene
// for this trigger + context, or null if nothing is registered yet -- an
// unmatched trigger is a silent no-op, not an error, since most trigger
// points won't have art for a long time.
export function pickTreehouseScene(trigger, context = {}) {
  return (
    Object.values(TREEHOUSE_SCENES).find((scene) => {
      if (scene.trigger !== trigger || !scene.image) return false;
      if (scene.horrorRuleId && scene.horrorRuleId !== context.horrorRuleId) return false;
      if (scene.locationId && scene.locationId !== context.locationId) return false;
      if (scene.segmentIndex !== null && scene.segmentIndex !== undefined && scene.segmentIndex !== context.segmentIndex) return false;
      if (scene.mayhemRange && (context.mayhem < scene.mayhemRange[0] || context.mayhem > scene.mayhemRange[1])) return false;
      return true;
    }) || null
  );
}
