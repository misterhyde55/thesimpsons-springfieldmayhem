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
    visible(runState) {
      return runState.quests.helpApu === 'active' && runState.world.visitedLocationIds.includes('springfieldElementary');
    },
    run(runState) {
      runState.quests.helpApu = 'resolved';
      runState.relationships.apu = 'bestFriend';
      runState.donutsCurrency += 3;
      return 'Apu: "You went and checked, for me? Homer, you are a true friend of this store." (Apu considers you his best customer from now on. +3 donuts.)';
    },
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
  }
}
