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
// `choices`, when present, turns the scene into a real decision, rendered
// by ui/screens.js as data-driven DECISION CARDS (never generic buttons --
// see the REDESIGN ALL DECISION / STORY SCREENS pass), each with:
//   category    -- data/icons.js `decision` id (also the small type badge:
//                  COMBAT/ESCAPE/PREPARE/TRICK/HORROR/...)
//   tone        -- 'safe' | 'danger' | 'trick' | 'supernatural': the
//                  card's accent color, independent of `category`
//   description -- one line of flavor under the label
//   cost        -- a plain string shown before the player commits ("1
//                  Donut"), or omitted if free
//   effects     -- known ✓ consequences, e.g. ['Heal 10 HP']
//   warnings    -- known ⚠ costs/risks, e.g. ['+8% Mayhem']
//   danger      -- 0-4 star rating shown in the corner, omitted for 0
//   unknown     -- true hides effects/warnings behind a single "???" line
//                  (mystery choices -- used sparingly, see section 8)
//   disabledReason(runState) -- optional; a non-null string disables the
//                  card and shows why (e.g. "Need 1 Donut")
// `apply(runState)` mutates state and returns either a plain string (old
// shape, still supported) or `{text, effects, mayhemDelta}` -- `effects` is
// shown as reward-toast chips (screens.showRewardToasts) so the player sees
// the actual consequence, not just narration; `mayhemDelta` is applied via
// game.js's increaseMayhem (respects the Devil's Pitchfork multiplier).
// `leadsTo` ('board' | 'combat') tells game.js what screen comes next. A
// scene with `choices: null` is just a beat -- read it, hit Continue, move
// on.
import { getAssetUrl } from './assets.js';
import { getReachableLocationIds } from './worldMap.js';
import { getLocationContent } from './journeys.js';
import { LOCATIONS } from './locations.js';
import { ITEMS } from './items.js';
import { setCallbackFlag } from '../systems/callbackEngine.js';

// A deliberately vague hint, not a spoiler -- "preserve mystery" (section 7
// of the redesign spec): the player learns the TYPE of what's waiting
// nearby, never the exact enemies or reward.
function intelHintForContentType(type) {
  if (type === 'boss') return 'something huge is holed up there.';
  if (type === 'combat') return 'zombies are gathering there.';
  if (type === 'event') return 'something strange is going on there.';
  return "it's quiet there. For now.";
}

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
        category: 'escape',
        tone: 'safe',
        description: 'Try to reach the family car before the zombies surround the house.',
        effects: ['Avoid the opening battle', 'Reach Springfield immediately'],
        warnings: ['35% chance of taking 8–15 damage'],
        danger: 1,
        leadsTo: 'board',
        apply(runState) {
          if (Math.random() < 0.35) {
            const dmg = 8 + Math.floor(Math.random() * 8);
            runState.hp = Math.max(1, runState.hp - dmg);
            return {
              text: 'A hand closes around Homer\'s sleeve on the way past. He yanks free and keeps running.',
              effects: [`HP -${dmg}`, 'ESCAPED COMBAT'],
            };
          }
          return {
            text: 'Homer barely makes it. The engine turns over on the second try -- always the second try.',
            effects: ['ESCAPED COMBAT'],
          };
        },
      },
      {
        id: 'fightThroughThem',
        label: 'FIGHT THROUGH THEM',
        category: 'combat',
        tone: 'danger',
        description: 'Take the zombies head-on.',
        combatPreview: '3 Springfield Zombies',
        effects: ['$15–25 Springfield Cash', 'Choose a new Action', 'Chance of a Consumable'],
        danger: 3,
        leadsTo: 'combat',
        combatLocationId: 'simpsonHouse',
        combatContent: { type: 'combat', enemyIds: ['zombieMobGuy', 'zombieMobGuy', 'zombieMobGuy'], bonusConsumableChance: 0.4 },
        apply() {
          return {
            text: "No time to think. You grab whatever's heavy and start swinging.",
            effects: ['COMBAT: 3 SPRINGFIELD ZOMBIES'],
          };
        },
      },
      {
        id: 'barricadeTheHouse',
        label: 'BARRICADE THE HOUSE',
        category: 'prepare',
        tone: 'safe',
        description: 'Return inside and buy yourself some time.',
        effects: ['Heal 10 HP', 'Gain HOMEMADE WEAPON (+8 Max HP)', 'Learn what’s waiting nearby'],
        warnings: ['+8% Mayhem'],
        danger: 0,
        leadsTo: 'board',
        apply(runState) {
          // The realized heal, not the label -- at the very start of a run
          // (this scene's only real firing point) Homer is already at full
          // HP, so a scripted "HP +10" toast would be an honest-sounding
          // lie about a heal that didn't happen. Report what actually
          // changed (REDESIGN ALL DECISION / STORY SCREENS -- "consequence
          // feedback" means true feedback, not the pre-written intent).
          const healed = Math.min(runState.maxHp, runState.hp + 10) - runState.hp;
          runState.hp += healed;
          ITEMS.homemadeWeapon.apply(runState);
          const nearby = getReachableLocationIds(runState);
          let intelLine = '';
          if (nearby.length) {
            const id = nearby[Math.floor(Math.random() * nearby.length)];
            const content = getLocationContent(runState, id);
            intelLine = ` Through the window, Homer spots ${LOCATIONS[id].name.toUpperCase()}: ${intelHintForContentType(content && content.type)}`;
          }
          const effects = [];
          if (healed > 0) effects.push(`HP +${healed}`);
          effects.push('HOMEMADE WEAPON (+8 Max HP)', '+8% MAYHEM');
          return {
            text: `You slam the door and throw the bolt, dragging furniture in front of it.${intelLine}`,
            effects,
            mayhemDelta: 8,
          };
        },
      },
      {
        id: 'throwDonut',
        label: 'THROW A DONUT',
        category: 'trick',
        tone: 'trick',
        description: "Use Homer's greatest weapon.",
        cost: '1 Donut',
        effects: ['Escape without combat', 'Zombies drawn toward another nearby location'],
        warnings: ['That location becomes THREATENED'],
        danger: 1,
        leadsTo: 'board',
        disabledReason(runState) {
          return runState.donutsCurrency < 1 ? 'Need 1 Donut' : null;
        },
        apply(runState) {
          runState.donutsCurrency = Math.max(0, runState.donutsCurrency - 1);
          setCallbackFlag(runState, 'threwDonutAtZombies');
          return {
            text: 'It works. They shuffle off after the donut instead of you, moaning happily.',
            effects: ['-1 DONUT', 'ESCAPED COMBAT', 'ZOMBIES DRAWN ELSEWHERE'],
          };
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
        category: 'horror',
        tone: 'supernatural',
        description: 'Turn and face what\'s wearing your neighbor.',
        effects: ['Boss Fight: Devil Ned', 'His reward is worth the risk'],
        danger: 4,
        leadsTo: 'combat',
        combatLocationId: 'springfieldChurch',
        combatContent: { type: 'boss', bossId: 'devilNed' },
        apply() {
          return {
            text: '"Hi-diddly-ho, Homer," says the thing wearing Ned Flanders. "I believe you owe me a donut."',
            effects: ['BOSS FIGHT: DEVIL NED'],
          };
        },
      },
      {
        id: 'avoidDevilNed',
        label: 'AVOID HIM (FOR NOW)',
        category: 'escape',
        tone: 'safe',
        description: 'Walk away. Whatever this is, it can wait.',
        effects: ['Avoid this fight entirely'],
        warnings: ['He now knows where to find you'],
        danger: 1,
        leadsTo: 'board',
        apply() {
          return {
            text: 'You turn and walk the other way. Somewhere behind you, you hear him start whistling. He knows where the church is. So do you, now.',
            effects: ['AVOIDED DEVIL NED'],
          };
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
