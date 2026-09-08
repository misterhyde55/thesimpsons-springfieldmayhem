// Three initial multi-location quests (Priority 5). Unlike a normal event
// or interior interaction, a quest crosses locations and changes Springfield
// permanently once resolved -- runState.quests[id] tracks status
// ('active'/'resolved'/a specific outcome string), and a resolution
// mutates runState.world.locationFlags / relationships / cast the same way
// a callback does, just started and paid off in two different places
// instead of one.
//
// Quests deliberately reuse existing pieces rather than a new engine: a
// quest "starts" from an ordinary dialogue follow-up or event option
// (data/interiors.js, data/events.js) setting a runState.quests flag, and
// "resolves" either through a normal battle victory (see
// applyQuestResolution, called from game.js onBattleVictory when
// content.questResolution is set) or a `type: 'questChoice'` location
// content override (data/journeys.js getLocationContent) -- the same
// {title, prompt, options} shape ui/screens.js's populateEvent already
// renders, with options additionally allowed to set `leadsTo: 'combat'` +
// `combatContent` (see game.js showQuestChoiceScreen).
import { getRelicShopPool } from './relics.js';

// ---------- QUEST 1: WHERE'S BARNEY? ----------
// Started by data/interiors.js's Moe's Tavern zombieOutbreak "WHAT HAPPENED
// TO BARNEY?" follow-up. Resolved at Springfield Cemetery (see
// getLocationContent's override below) with a real FIGHT/CURE/RUN choice --
// FIGHT permanently removes him (an infected character killed), CURE saves
// him (joins the cast, Moe becomes a devoted best friend, and sets up a
// later callback payoff), RUN leaves it unresolved for the rest of the run.
export function wheresBarneyCemeteryContent() {
  return {
    type: 'questChoice',
    title: 'Zombie Barney',
    emoji: '🧟',
    npcId: 'barney',
    prompt: 'Behind a crumbling mausoleum, something is dragging itself across the grass. It used to be Barney.',
    options: [
      {
        id: 'fight',
        label: 'FIGHT HIM',
        leadsTo: 'combat',
        combatContent: { type: 'combat', enemyIds: ['zombieBarney'], questResolution: 'barneyKilled' },
        apply() {
          return "There's no version of this where you talk him down. You raise your fists.";
        },
      },
      {
        id: 'cure',
        label: 'USE THE EMERGENCY KIT ON HIM',
        apply(runState) {
          if (!runState.consumables.krustyEmergencyKit) {
            return "You don't have anything that could actually help him. Whatever you do next, you're doing it empty-handed.";
          }
          runState.consumables.krustyEmergencyKit -= 1;
          if (runState.consumables.krustyEmergencyKit <= 0) delete runState.consumables.krustyEmergencyKit;
          runState.quests.wheresBarney = 'saved';
          if (!runState.cast.includes('barney')) runState.cast.push('barney');
          runState.relationships.moe = 'bestFriend';
          runState.callbackFlags.savedBarney = true;
          return 'The kit does something. Barney blinks, human again, confused. "Is it Tuesday? Is the keg okay?" BARNEY JOINED THE CAST. Moe will never forget this.';
        },
      },
      {
        id: 'run',
        label: 'RUN',
        apply(runState) {
          runState.quests.wheresBarney = 'fled';
          return "You back away slowly. Whatever happens to him now, it wasn't you. Probably.";
        },
      },
    ],
  };
}

// ---------- QUEST 2: HELP APU ----------
// Started by any of the three "ask about Springfield Elementary" follow-ups
// across Kwik-E-Mart's Horror Rule states (data/interiors.js). Resolved via
// a new Kwik-E-Mart interaction, appended below, visible once the player
// has actually been to the school and can report back -- "help Apu" nudges
// the relationship straight to bestFriend, i.e. a permanently better shop
// (economy.js apuPriceModifier) for the rest of the run.
export function helpApuReportInteraction() {
  return {
    id: 'reportToApu',
    label: 'TELL APU WHAT YOU FOUND',
    cost: 1,
    secondary: true,
    visible(runState) {
      return runState.quests.helpApu === 'active' && runState.world.visitedLocationIds.includes('springfieldElementary');
    },
    run(runState) {
      runState.quests.helpApu = 'resolved';
      runState.relationships.apu = 'bestFriend';
      runState.donutsCurrency += 3;
      return { text: 'Apu: "You went and checked, for me? Homer, you are a true friend of this store." (Apu considers you his best customer from now on. +3 donuts.)' };
    },
  };
}

// ---------- QUEST 4: WHERE'S BART? ----------
// Started by a Kwik-E-Mart "TALK TO APU" follow-up (data/interiors.js
// bartQuestApuFollowUp). Resolved at Springfield Elementary (see
// getLocationContent's override below), same "found him, now his tricks
// are yours" payoff as Milhouse's cast-join event: joining the cast makes
// Bart's own abilities (SLINGSHOT, COWABUNGA -- data/abilities.js
// characterId: 'bart') draftable, and unlocks the homerBart synergy.
export function whereIsBartSchoolContent() {
  return {
    type: 'questChoice',
    title: 'There He Is',
    emoji: '🛹',
    npcId: 'bart',
    prompt: 'Bart is crouched behind the bike rack, skateboard raised like a weapon, eyes wide. "Dad?! Something followed me from the Kwik-E-Mart!"',
    options: [
      {
        id: 'fightItOff',
        label: 'FIGHT IT OFF',
        leadsTo: 'combat',
        combatContent: { type: 'combat', enemyIds: ['zombieStudent'], questResolution: 'bartFound' },
        apply() {
          return "Whatever it is, it's between you and Bart now.";
        },
      },
      {
        id: 'grabAndRun',
        label: 'GRAB BART AND RUN',
        apply(runState) {
          runState.quests.whereIsBart = 'resolved';
          if (!runState.cast.includes('bart')) runState.cast.push('bart');
          runState.donutsCurrency += 4;
          return 'You yank Bart up by the collar and sprint. "Cowabunga," he wheezes. BART JOINED THE CAST. He empties his pockets on the way: +4 donuts, mostly in nickels.';
        },
      },
    ],
  };
}

// ---------- QUEST 3: THE MISSING OFFICERS ----------
// Started by data/events.js's policeEvidenceRoom 4th option. Resolved by
// winning the fight at Burns Manor (any segment already has combat content
// there -- see the `questResolution: 'officersFound'` added in
// data/journeys.js) while the quest is active, then reported back at
// Police Station via the getLocationContent override below, which
// permanently marks the station safer.
export function missingOfficersReportContent() {
  return {
    type: 'questChoice',
    title: 'Case Closed',
    emoji: '🚓',
    npcId: 'chiefWiggum',
    prompt: 'Chief Wiggum: "You found \'em? At Burns Manor? Well I\'ll be. This station owes you one, Simpson."',
    options: [
      {
        id: 'collectReward',
        label: 'COLLECT THE REWARD',
        apply(runState) {
          runState.quests.missingOfficers = 'reported';
          runState.world.locationFlags.policeStationSecured = true;
          runState.donutsCurrency += 6;
          const pool = getRelicShopPool().filter((r) => !runState.relics.includes(r.id));
          if (pool.length) {
            const relic = pool[Math.floor(Math.random() * pool.length)];
            runState.relics.push(relic.id);
            return `Wiggum empties the evidence locker's "lost and found" into your arms: +6 donuts, and ${relic.emoji} ${relic.name}. THE STATION IS SECURED.`;
          }
          return 'Wiggum empties the evidence locker\'s "lost and found" into your arms. +6 donuts. THE STATION IS SECURED.';
        },
      },
    ],
  };
}

// ---------- QUEST 5: WHERE'S LISA? ----------
// Started by a Moe's Tavern "TALK TO MOE" follow-up (data/interiors.js
// lisaQuestMoeFollowUp). Resolved at First Church of Springfield -- Lisa,
// being Lisa, went somewhere quiet to think. Joining the cast unlocks
// SAX ATTACK/SEES RIGHT THROUGH YOU and the homerLisa synergy.
export function whereIsLisaChurchContent() {
  return {
    type: 'questChoice',
    title: 'A Quiet Pew',
    emoji: '🎷',
    npcId: 'lisa',
    prompt: 'Lisa is sitting alone in the front pew, saxophone across her knees. "Dad. I needed somewhere that wasn\'t falling apart. Something followed me anyway."',
    options: [
      {
        id: 'fightItOff',
        label: 'FIGHT IT OFF',
        leadsTo: 'combat',
        combatContent: { type: 'combat', enemyIds: ['shamblingIntern'], questResolution: 'lisaFound' },
        apply() {
          return "She's already on her feet, saxophone raised like a bat. Might as well back her up.";
        },
      },
      {
        id: 'grabAndRun',
        label: 'LEAVE QUIETLY, TOGETHER',
        apply(runState) {
          runState.quests.whereIsLisa = 'resolved';
          if (!runState.cast.includes('lisa')) runState.cast.push('lisa');
          runState.donutsCurrency += 4;
          return 'Lisa slips her hand into yours without a word. LISA JOINED THE CAST. She had a granola bar in her bag: +4 donuts, only a little stale.';
        },
      },
    ],
  };
}

// ---------- QUEST 6: WHERE'S MARGE? ----------
// Started by a Kwik-E-Mart "TALK TO APU" follow-up (data/interiors.js
// margeQuestApuFollowUp). Resolved at the Retirement Castle -- Marge went
// to check on Grampa and hasn't come back. Joining the cast unlocks
// HOMIE!/THE LOOK and the homerMarge synergy.
export function whereIsMargeRetirementCastleContent() {
  return {
    type: 'questChoice',
    title: 'Checking On Grampa',
    emoji: '🧹',
    npcId: 'marge',
    prompt: 'Marge is braced against a supply closet door, holding it shut with both hands. "Homer! I came to check on your father and now half the residents are -- well, you\'ll see."',
    options: [
      {
        id: 'fightItOff',
        label: 'FIGHT IT OFF',
        leadsTo: 'combat',
        combatContent: { type: 'combat', enemyIds: ['zombieGrandpa'], questResolution: 'margeFound' },
        apply() {
          return "She lets go of the door the second you're beside her. Not exactly a fair fight for either of you now.";
        },
      },
      {
        id: 'grabAndRun',
        label: 'PULL HER OUT THE WINDOW',
        apply(runState) {
          runState.quests.whereIsMarge = 'resolved';
          if (!runState.cast.includes('marge')) runState.cast.push('marge');
          runState.donutsCurrency += 4;
          return 'Marge climbs out without complaint, which is how you know it was bad in there. MARGE JOINED THE CAST. She grabbed the petty cash tin on the way: +4 donuts.';
        },
      },
    ],
  };
}

// ---------- QUEST 7: WHERE'S MAGGIE? ----------
// Unlike the others, this one is already 'active' the instant the episode
// begins (state/gameState.js createRunState) -- Maggie went missing when
// the outbreak started, no NPC needs to mention it. Resolved at Krusty
// Burger, where a baby has apparently been fine the entire time. Joining
// the cast unlocks the single, deliberately rare PACIFIER SHOT.
export function whereIsMaggieKrustyBurgerContent() {
  return {
    type: 'questChoice',
    title: 'The Ball Pit',
    emoji: '👶',
    npcId: 'maggie',
    prompt: 'Maggie is sitting in the Krusty Burger ball pit, entirely unbothered, sucking on her pacifier while a very confused zombie paces just outside the netting.',
    options: [
      {
        id: 'fightItOff',
        label: 'DEAL WITH THE ZOMBIE',
        leadsTo: 'combat',
        combatContent: { type: 'combat', enemyIds: ['shamblingIntern'], questResolution: 'maggieFound' },
        apply() {
          return "It hasn't figured out how ball pits work yet. You have the advantage.";
        },
      },
      {
        id: 'grabAndRun',
        label: 'SCOOP HER UP AND GO',
        apply(runState) {
          runState.quests.whereIsMaggie = 'resolved';
          if (!runState.cast.includes('maggie')) runState.cast.push('maggie');
          return 'You wade in and grab her before the zombie notices either of you. She hands you her pacifier as a reward. MAGGIE JOINED THE CAST.';
        },
      },
    ],
  };
}

// ---------- QUEST TRACKER (player-facing) ----------
// runState.quests only ever stores a bare status string ('active',
// 'resolved', or an outcome like 'saved'/'killed') -- this is the display
// metadata layer so the board HUD can show WHY a quest matters without the
// player having to remember dialogue from ten minutes ago.
// `locationId` is where "go do the thing" currently points -- safe to name
// just one per quest here since a quest only ever shows in the tracker
// (getActiveQuestsSummary below) while its status is 'active', and every
// quest here flips OFF 'active' (to 'resolved'/'killed'/etc, see
// applyQuestResolution and interiors.js's report interactions) the instant
// that single objective is actually done, before any "now go report back"
// second leg would need its own map target.
export const QUEST_DISPLAY = {
  wheresBarney: {
    title: "WHERE'S BARNEY?",
    hint: 'Last seen: Springfield Cemetery.',
    reward: 'Moe Relationship • ???',
    locationId: 'springfieldCemetery',
  },
  helpApu: {
    title: "APU'S FAVOR",
    hint: 'Search Springfield Elementary, then report back to Apu at the Kwik-E-Mart.',
    reward: 'Apu Relationship • Cash',
    locationId: 'springfieldElementary',
  },
  missingOfficers: {
    title: 'THE MISSING OFFICERS',
    hint: 'Search Burns Manor, then report to the Police Station.',
    reward: 'Cash • Relic • Safer Police Station',
    locationId: 'burnsManor',
  },
  whereIsBart: {
    title: "WHERE'S BART?",
    hint: 'Last seen near Springfield Elementary.',
    reward: 'Bart Joins the Cast',
    locationId: 'springfieldElementary',
  },
  whereIsLisa: {
    title: "WHERE'S LISA?",
    hint: 'Try First Church of Springfield.',
    reward: 'Lisa Joins the Cast',
    locationId: 'springfieldChurch',
  },
  whereIsMarge: {
    title: "WHERE'S MARGE?",
    hint: 'She went to check on Grampa. Try the Retirement Castle.',
    reward: 'Marge Joins the Cast',
    locationId: 'retirementCastle',
  },
  whereIsMaggie: {
    title: "WHERE'S MAGGIE?",
    hint: "She's been missing since the outbreak began. Try Krusty Burger.",
    reward: 'Maggie Joins the Cast',
    locationId: 'krustyBurger',
  },
};

// Only 'active' quests show -- once resolved, the reward toast/banner at
// the resolution point already told the player what happened, so the
// tracker doesn't need a second "completed" list cluttering it up.
export function getActiveQuestsSummary(runState) {
  return Object.entries(runState.quests)
    .filter(([, status]) => status === 'active')
    .map(([id]) => QUEST_DISPLAY[id])
    .filter(Boolean);
}

// Applies a battle-victory quest resolution (see game.js onBattleVictory) --
// a no-op if the relevant quest isn't actually active, so this is always
// safe to check even outside the quest.
export function applyQuestResolution(runState, resolutionId) {
  if (resolutionId === 'barneyKilled') {
    runState.quests.wheresBarney = 'killed';
    runState.cast = runState.cast.filter((id) => id !== 'barney');
    runState.world.locationFlags.barneyGone = true;
  } else if (resolutionId === 'officersFound' && runState.quests.missingOfficers === 'active') {
    runState.quests.missingOfficers = 'resolved';
  } else if (resolutionId === 'bartFound' && runState.quests.whereIsBart === 'active') {
    runState.quests.whereIsBart = 'resolved';
    if (!runState.cast.includes('bart')) runState.cast.push('bart');
  } else if (resolutionId === 'lisaFound' && runState.quests.whereIsLisa === 'active') {
    runState.quests.whereIsLisa = 'resolved';
    if (!runState.cast.includes('lisa')) runState.cast.push('lisa');
  } else if (resolutionId === 'margeFound' && runState.quests.whereIsMarge === 'active') {
    runState.quests.whereIsMarge = 'resolved';
    if (!runState.cast.includes('marge')) runState.cast.push('marge');
  } else if (resolutionId === 'maggieFound' && runState.quests.whereIsMaggie === 'active') {
    runState.quests.whereIsMaggie = 'resolved';
    if (!runState.cast.includes('maggie')) runState.cast.push('maggie');
  }
}
