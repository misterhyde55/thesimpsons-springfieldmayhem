// LOCATION INTERACTION SYSTEM -- enterable location interiors as small,
// data-driven interactive scenes rather than a single board-node encounter
// or a bespoke screen per building. An INTERIORS entry is
// `{npcId?, image? | (background & portrait)?, states: {...}}`; the same
// shape works for Moe (a single combined scene photo) and Apu (a real
// location background with the NPC's own chat portrait composited on top)
// today, and is meant to be reused as-is for future NPCs (Comic Book Guy,
// Dr. Hibbert, Chief Wiggum, Krusty, Skinner, Mr. Burns, ...) with entirely
// different gameplay functions -- only the `states`/interactions differ.
//
// `states` is keyed by Horror Rule id (plus 'normal'); systems/
// locationInterior.js resolves which state is showing right now
// (resolveInteriorStateId below) so the SAME building reacts to whichever
// Horror Rules the run has stacked up -- see data/horrorRules.js for why a
// state id doubles as a rule id.
//
// Each state is `{background, intro, interactions: [...]}`. `background`
// is the emoji fallback shown only when no `image`/`background`+`portrait`
// art is set on the interior. `intro` is either a plain string or a
// `(runState) => string` for state that reacts to the player (e.g. Moe
// reacting to Homer's current HP) -- see ui/screens.js populateLocationInterior.
//
// An interaction is `{id, label, cost, run(runState) => {text, followUps?},
// secondary?, isUsed?(runState), usedLabel?}` -- `run` resolves immediately
// and can mutate runState (heal, spend currency, flag a rumor, discover a
// secret, upgrade a card). `secondary: true` renders it as a small chip
// instead of a large primary button (ui/screens.js). `isUsed`/`usedLabel`
// disable it and swap its label once a once-per-visit/once-per-checkpoint
// limit is spent (e.g. "ALREADY HAD ONE", "UPGRADE USED"), without needing
// a separate `visible` check that would just remove the button outright.
// `followUps` are a dialogue's own reply options (free -- they're part of
// the one "talk" action, not a new one), each shaped the same as an
// interaction but without its own `cost`, and can themselves return further
// `followUps` -- game.js onInteriorFollowUp chains them, so a reply can open
// another round of replies (e.g. TALK TO MOE -> UPGRADE A CARD -> pick a
// card -> CURRENT/UPGRADED preview -> CONFIRM). An interaction/followUp can
// instead set `special: 'shop'`, `special: 'abilityDraft'`, or (on a
// followUp) `special: 'combat'` to hand off to an existing full-screen flow
// rather than resolving inline.
import { shiftRelationship, moeDuffTerms, moeGreeting } from '../systems/relationships.js';
import { getRelicShopPool } from './relics.js';
import { getEvent } from './events.js';
import { ITEMS } from './items.js';
import { ABILITIES } from './abilities.js';
import { getUpgradableAbilities, upgradeAbility } from '../systems/cardUpgrades.js';
import { sellPriceFor } from '../systems/economy.js';
import { helpApuReportInteraction } from './quests.js';

// Moe's "WHAT'VE YOU GOT?" -- three priced services shown as the dialogue's
// followUps (see game.js onInteriorFollowUp, which now spends a followUp's
// own `cost` rather than treating every reply as free). HAVE A DUFF goes
// through moeDuffTerms so Moe's Favor (runState.relationships.moe) actually
// moves the price/heal, same discount system Duff orders already used.
function moeServiceFollowUps(runState) {
  const duff = moeDuffTerms(runState, 3, 10);
  const duffPriceLabel = duff.cost === 0 ? 'FREE' : `${duff.cost} donut${duff.cost === 1 ? '' : 's'}`;
  return [
    {
      id: 'serviceDuff',
      label: `HAVE A DUFF (${duffPriceLabel})`,
      cost: 1,
      run(rs) {
        if (rs.donutsCurrency < duff.cost) return { text: 'Moe: "No tab, Homer."' };
        rs.donutsCurrency -= duff.cost;
        rs.hp = Math.min(rs.maxHp, rs.hp + duff.heal);
        shiftRelationship(rs, 'moe', 1);
        const priceLine = duff.cost === 0 ? 'On the house.' : `-${duff.cost} donut${duff.cost === 1 ? '' : 's'}.`;
        return { text: `Moe slides a cold Duff across the bar. (+${duff.heal} HP, ${priceLine})` };
      },
    },
    {
      id: 'serviceSnacks',
      label: 'BAR SNACKS (2 donuts, once per visit)',
      cost: 1,
      run(rs) {
        if (rs.world.locationFlags.moeSnacksThisVisit) return { text: 'Moe: "You ate the whole bowl already, Homer."' };
        if (rs.donutsCurrency < 2) return { text: "You're a little short." };
        rs.donutsCurrency -= 2;
        rs.hp = Math.min(rs.maxHp, rs.hp + 10);
        rs.world.locationFlags.moeSnacksThisVisit = true;
        return { text: 'Stale pretzels never tasted so good. (+10 HP, -2 donuts)' };
      },
    },
    {
      id: 'serviceMystery',
      label: "MOE'S MYSTERY SHOT (4 donuts, ??? risk)",
      cost: 1,
      run(rs) {
        if (rs.donutsCurrency < 4) return { text: "You're a little short." };
        rs.donutsCurrency -= 4;
        const roll = Math.random();
        if (roll < 0.35) {
          rs.hp = Math.min(rs.maxHp, rs.hp + 30);
          return { text: 'Whatever that was, you feel AMAZING. (+30 HP, -4 donuts)' };
        }
        if (roll < 0.7) {
          rs.hp = Math.min(rs.maxHp, rs.hp + 12);
          return { text: 'Tastes like regret and lime. (+12 HP, -4 donuts)' };
        }
        rs.hp = Math.max(1, rs.hp - 10);
        return { text: 'Your whole body goes numb for a second. That was a mistake. (-10 HP, -4 donuts)' };
      },
    },
  ];
}

// Moe's "HEARD ANYTHING?" -- reveals one real, previously-unknown piece of
// map information as the same locationFlags-string "rumor" convention the
// old TALK TO MOE followup already used (see mapIntel.js's RUMOR filter,
// which reads these same flags), instead of inventing a new info system.
const RUMOR_POOL = [
  { locationId: 'springfieldElementary', flag: 'Possible Infection', text: 'Moe: "Barney swears he saw somethin\' shufflin\' around the school. I told him to lay off the tap."' },
  { locationId: 'policeStation', flag: 'Officers Missing', text: 'Moe: "Wiggum\'s boys went quiet on the radio. Nobody\'s heard from the station all night."' },
  { locationId: 'burnsManor', flag: 'Something Big', text: 'Moe: "Guy came in ramblin\' about lights on at the Manor. Old man Burns don\'t leave lights on for nobody."' },
  { locationId: 'springfieldCemetery', flag: 'Ground Disturbed', text: 'Moe: "Groundskeeper quit on the spot. Said the dirt out at the cemetery ain\'t layin\' right anymore."' },
];

function moeRumor(runState) {
  const candidates = RUMOR_POOL.filter((r) => runState.world.locationFlags[r.locationId] !== r.flag);
  if (!candidates.length) return 'Moe: "Told you everything I know, Homer. You\'re on your own now."';
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  runState.world.locationFlags[pick.locationId] = pick.flag;
  return `${pick.text} (NEW MAP INFORMATION)`;
}

// Moe's is primarily a RECOVERY stop -- one obvious primary button, once per
// visit, that scales with how bad the night has gotten (REDESIGN MOE'S
// TAVERN: EARLY GAME = Duff, MID GAME = Duff+, LATE GAME = Moe's Special).
function moeBeerTier(runState) {
  if (runState.mayhem >= 65) return { heal: 35, pour: "MOE'S SPECIAL" };
  if (runState.mayhem >= 30) return { heal: 30, pour: 'A DUFF+' };
  return { heal: 25, pour: 'A COLD DUFF' };
}

function haveABeerInteraction() {
  return {
    id: 'haveABeer',
    label: 'HAVE A BEER',
    cost: 1,
    isUsed: (runState) => !!runState.world.locationFlags.moeBeerThisVisit,
    usedLabel: 'ALREADY HAD ONE',
    run(runState) {
      if (runState.world.locationFlags.moeBeerThisVisit) {
        return { text: 'Moe: "You already had one, Homer. Bar\'s not a hotel."' };
      }
      const tier = moeBeerTier(runState);
      const before = Math.round(runState.hp);
      runState.hp = Math.min(runState.maxHp, runState.hp + tier.heal);
      runState.world.locationFlags.moeBeerThisVisit = true;
      return { text: `Moe slides ${tier.pour} across the bar. "Woo-hoo!" HP ${before}/${runState.maxHp} -> ${Math.round(runState.hp)}/${runState.maxHp}. (+${tier.heal} HP)` };
    },
  };
}

// Moe's SECOND reason to visit even at full HP -- a free, general card
// upgrade (any archetype, unlike Bowlarama/Nuclear Plant's archetype-locked
// paid stations). Limited to one per segment ("episode checkpoint") via
// runState.world.moeUpgradeUsedSegment so leaving and immediately walking
// back in doesn't grant unlimited free upgrades -- it naturally opens back
// up the moment the run advances to the next segment/Act.
function moeUpgradeInteraction() {
  return {
    id: 'moeUpgradeCard',
    label: 'UPGRADE A CARD',
    cost: 1,
    isUsed: (runState) => runState.world.moeUpgradeUsedSegment === runState.segmentIndex,
    usedLabel: 'UPGRADE USED',
    run(runState) {
      if (runState.world.moeUpgradeUsedSegment === runState.segmentIndex) {
        return { text: 'Moe: "Already sorted you out this time around, Homer. Come back later."' };
      }
      const candidates = getUpgradableAbilities(runState, null);
      if (!candidates.length) {
        return { text: "Moe: \"Nothin' in that deck of yours left to sharpen up.\"" };
      }
      const followUps = candidates.map((ability) => {
        const upgraded = ABILITIES[ability.upgradesToId];
        return {
          id: `moePreview_${ability.id}`,
          label: ability.name.toUpperCase(),
          run() {
            return {
              text: `CURRENT:\n${ability.description}\n\nUPGRADED:\n${upgraded.description}`,
              followUps: [
                {
                  id: `moeConfirm_${ability.id}`,
                  label: `CONFIRM: ${upgraded.name.toUpperCase()}`,
                  run(rs) {
                    const result = upgradeAbility(rs, ability.id);
                    rs.world.moeUpgradeUsedSegment = rs.segmentIndex;
                    return { text: `Moe works it over for a minute. "There. ${result.name}. Don't say I never did nothin' for ya." (CARD UPGRADED)` };
                  },
                },
                {
                  id: `moeCancel_${ability.id}`,
                  label: 'NEVER MIND',
                  run() {
                    return { text: 'Moe shrugs and goes back to wiping the bar.' };
                  },
                },
              ],
            };
          },
        };
      });
      return { text: 'Moe: "Whaddya want sharpened up?"', followUps };
    },
  };
}

function grantUndiscoveredRelic(runState) {
  const pool = getRelicShopPool().filter((r) => !runState.relics.includes(r.id));
  if (!pool.length) return null;
  const relic = pool[Math.floor(Math.random() * pool.length)];
  runState.relics.push(relic.id);
  return relic;
}

// The Kwik-E-Mart's primary reason to visit alongside the STORE -- a small,
// repeatable cash-for-HP heal (REDESIGN KWIK-E-MART: weaker than Moe's free
// Duff, so spend-money-healing-now vs. save-for-the-store is a real choice).
function eatAHotDogInteraction() {
  return {
    id: 'eatAHotDog',
    label: 'EAT A HOT DOG',
    cost: 1,
    run(runState) {
      if (runState.donutsCurrency < 5) return { text: "Apu: \"That's five donuts, Homer. Not five IOUs.\"" };
      runState.donutsCurrency -= 5;
      runState.hp = Math.min(runState.maxHp, runState.hp + 15);
      return { text: 'Apu: "Please do not ask how long that has been rotating." (+15 HP, -5 donuts)' };
    },
  };
}

// Starts WHERE'S BART? (data/quests.js whereIsBartSchoolContent) -- returns
// null once the quest has already started/resolved so TALK TO APU's
// dialogue tree only offers it once. Wired into every kwikEMart state's
// followUps below.
function bartQuestApuFollowUp(runState) {
  if (runState.quests.whereIsBart) return null;
  return {
    id: 'apuMentionsBart',
    label: 'HAVE YOU SEEN BART?',
    run(rs) {
      rs.quests.whereIsBart = 'active';
      return { text: 'Apu: "Now that you mention it -- he knocked over the Squishee machine, screamed something about a shortcut, and bolted toward the school." (QUEST STARTED: WHERE\'S BART?)' };
    },
  };
}

// Available in every interior/state (appended below, after INTERIORS is
// defined) -- lets Homer use a rare Kwik-E-Mart find (data/items.js
// `rare: true` entries, held in runState.consumables) wherever he happens
// to be, not just back at the store.
function useItemInteraction() {
  return {
    id: 'useItem',
    label: 'USE AN ITEM',
    cost: 1,
    secondary: true,
    run(runState) {
      const entries = Object.entries(runState.consumables || {}).filter(([, qty]) => qty > 0);
      if (!entries.length) return { text: 'You check your bag. Nothing in there but lint and a coupon.' };
      const followUps = entries.map(([itemId, qty]) => {
        const item = ITEMS[itemId];
        return {
          id: `use_${itemId}`,
          label: `${item.emoji} ${item.name} x${qty}`,
          run(rs) {
            rs.consumables[itemId] -= 1;
            if (rs.consumables[itemId] <= 0) delete rs.consumables[itemId];
            item.apply(rs);
            return { text: `You use the ${item.name}. ${item.description}` };
          },
        };
      });
      return { text: 'What do you want to use?', followUps };
    },
  };
}

// A location-tied upgrade station (REDESIGN COMBAT GAMEPLAY: "locations
// around Springfield should interact with the deck") -- `archetype` gates
// which owned cards show up (data/abilities.js `archetype`), `price` is a
// donut cost, and an optional `risk` (e.g. Nuclear Plant's "risk Radiation",
// modeled as an immediate HP cost since there's no persisted out-of-combat
// Radiation meter to spend against) applies alongside it. Every eligible
// card is offered as its own followUp, same shape as moeServiceFollowUps.
function upgradeCardInteraction(archetype, { price, risk } = {}) {
  return {
    id: 'upgradeCard',
    label: 'UPGRADE A CARD',
    cost: 1,
    secondary: true,
    run(runState) {
      const candidates = getUpgradableAbilities(runState, archetype);
      if (!candidates.length) {
        return { text: "You check your deck. Nothing here left to upgrade -- or nothing worth upgrading yet." };
      }
      const riskLabel = risk ? `, ${risk.label}` : '';
      const followUps = candidates.map((ability) => {
        const upgraded = ABILITIES[ability.upgradesToId];
        return {
          id: `upgrade_${ability.id}`,
          label: `${ability.name} -> ${upgraded.name} (${price} donuts${riskLabel})`,
          run(rs) {
            if (rs.donutsCurrency < price) return { text: "You're a little short." };
            rs.donutsCurrency -= price;
            let riskText = '';
            if (risk) riskText = ` ${risk.apply(rs)}`;
            const result = upgradeAbility(rs, ability.id);
            return { text: `${ability.name} becomes ${result.name}! ${result.description} (-${price} donuts)${riskText}` };
          },
        };
      });
      return { text: 'Which card?', followUps };
    },
  };
}

// Kwik-E-Mart only -- Apu is the one buying it back.
function sellItemInteraction() {
  return {
    id: 'sellItem',
    label: 'SELL AN ITEM',
    cost: 1,
    secondary: true,
    visible(runState) {
      return runState.world.locationStates.kwikEMart !== 'overrun';
    },
    run(runState) {
      const entries = Object.entries(runState.consumables || {}).filter(([, qty]) => qty > 0);
      if (!entries.length) return { text: 'Apu: "You\'ve got nothing I\'ll buy off you."' };
      const followUps = entries.map(([itemId, qty]) => {
        const item = ITEMS[itemId];
        const price = sellPriceFor(itemId);
        return {
          id: `sell_${itemId}`,
          label: `${item.emoji} ${item.name} x${qty} — sell for ${price}`,
          run(rs) {
            rs.consumables[itemId] -= 1;
            if (rs.consumables[itemId] <= 0) delete rs.consumables[itemId];
            rs.donutsCurrency += price;
            return { text: `Apu takes the ${item.name} off your hands without asking questions. (+${price} donuts)` };
          },
        };
      });
      return { text: 'Apu: "Whaddya got?"', followUps };
    },
  };
}

// Only shows up once Homer is carrying the Mysterious Key (a rare
// Kwik-E-Mart find) -- see the `visible` check systems/locationInterior.js
// (via game.js's refreshInteriorScreen) filters interactions through.
function unlockStorageCageInteraction() {
  return {
    id: 'unlockStorageCage',
    label: 'UNLOCK THE STORAGE CAGE',
    cost: 1,
    secondary: true,
    visible(runState) {
      return !!runState.world.locationFlags.hasMysteriousKey;
    },
    run(runState) {
      if (runState.world.secretsFoundIds.includes('kwikEMartStorageCage')) {
        return { text: "The cage is already hanging open. Whatever was in here is already yours." };
      }
      runState.world.secretsFoundIds.push('kwikEMartStorageCage');
      const relic = grantUndiscoveredRelic(runState);
      runState.donutsCurrency += 8;
      if (relic) return { text: `The key turns. Behind the cage: ${relic.emoji} ${relic.name}, and a fat roll of donut money. (+8 donuts)` };
      return { text: 'The key turns. Just a fat roll of donut money behind the cage. (+8 donuts)' };
    },
  };
}

export const INTERIORS = {
  kwikEMart: {
    npcId: 'apu',
    // Two real, separately-uploaded assets composited by ui/screens.js
    // populateLocationInterior -- the actual store scene as the stage's
    // full background (buildings/kwikemart.png) with Apu's own chat
    // portrait (ui/apuChat) layered on top, instead of moesTavern's single
    // combined bar photo below. Different presentation, deliberately not
    // reusing Moe's art -- see the LOCATION INTERACTION SYSTEM comment atop
    // this file for how `image` vs `background`+`portrait` are resolved.
    background: { category: 'buildings', id: 'kwikEMart' },
    portrait: { category: 'ui', id: 'apuChat' },
    // Checked once after any interaction while the visit is in this state
    // (see systems/locationInterior.js) -- fires at most once per run.
    // 'normal' is only ever showing before Segment I's Horror Rule activates
    // (i.e. never, in practice, once a run is underway) -- list every state
    // so Snake's robbery can actually happen during real play, not just in
    // a hypothetical Mayhem-free Springfield.
    randomInterrupt: { flagId: 'kwikEMartRobberyFired', chance: 0.4, stateIds: ['normal', 'zombieOutbreak', 'alienInvasion'], eventId: 'kwikEMartRobbery' },
    states: {
      normal: {
        background: '🏪',
        intro: 'Apu: "Welcome to the Kwik-E-Mart, Homer. Please purchase something before the undead do."',
        interactions: [
          eatAHotDogInteraction(),
          { id: 'buySomething', label: 'STORE', cost: 1, special: 'shop' },
          {
            id: 'talkToApu',
            label: 'TALK TO APU',
            cost: 0,
            secondary: true,
            run(runState) {
              const followUps = [
                {
                  id: 'whatHappened',
                  label: "WHAT'S HAPPENED?",
                  run(rs) {
                    rs.world.locationFlags.springfieldElementary = 'Possible Infection';
                    rs.quests.helpApu = 'active';
                    return { text: 'Apu: "I saw something shamble past Springfield Elementary. It wasn\'t walking right." (SPRINGFIELD ELEMENTARY: NEW INFORMATION)' };
                  },
                },
                {
                  id: 'freeSquishee',
                  label: 'CAN I HAVE IT FOR FREE?',
                  run(rs) {
                    const level = rs.relationships.apu;
                    if (level === 'friendly' || level === 'bestFriend') {
                      rs.hp = Math.min(rs.maxHp, rs.hp + 20);
                      return { text: 'Apu: "For my best customer? Of course." (+20 HP)' };
                    }
                    shiftRelationship(rs, 'apu', -1);
                    return { text: 'Apu: "This is a business, Homer, not a charity."' };
                  },
                },
                {
                  id: 'lookAround',
                  label: 'LOOK AROUND',
                  run() {
                    return { text: 'Chips, magazines, a lottery machine that only prints question marks. Nothing useful.' };
                  },
                },
                {
                  id: 'backRoom',
                  label: 'INVESTIGATE THE BACK ROOM',
                  run(rs) {
                    if (rs.world.secretsFoundIds.includes('kwikEMartBackRoom')) {
                      return { text: "Just boxes of expired hot dogs. You've already checked." };
                    }
                    rs.world.secretsFoundIds.push('kwikEMartBackRoom');
                    const relic = grantUndiscoveredRelic(rs);
                    if (relic) return { text: `SECRET FOUND! Behind a case of expired hot dogs: ${relic.emoji} ${relic.name}.` };
                    rs.donutsCurrency += 5;
                    return { text: 'SECRET FOUND! A cigar box full of donut money. +5 donuts.' };
                  },
                },
              ];
              const sell = sellItemInteraction();
              if (sell.visible(runState)) followUps.push({ id: sell.id, label: sell.label, cost: sell.cost, run: sell.run });
              const bartFollowUp = bartQuestApuFollowUp(runState);
              if (bartFollowUp) followUps.push(bartFollowUp);
              followUps.push({ id: 'thanksApu', label: 'THANKS, APU.', run() { return { text: 'Apu: "Good luck out there, my friend."' }; } });
              return { text: 'Apu: "Homer! Something very strange is happening tonight."', followUps };
            },
          },
        ],
      },
      zombieOutbreak: {
        background: '🧟',
        intro: 'The shelves are on their sides. Apu is crouched behind the counter with a broken hockey stick.',
        interactions: [
          {
            id: 'squisheeMachine',
            label: 'GRAB A BITE',
            cost: 1,
            run(runState) {
              runState.hp = Math.min(runState.maxHp, runState.hp + 10);
              return { text: "The Squishee machine still works. It's the blue kind. You try not to think about the color too hard. (+10 HP)" };
            },
          },
          { id: 'buySomething', label: 'STORE', cost: 1, special: 'shop' },
          {
            id: 'talkToApu',
            label: 'TALK TO APU',
            cost: 0,
            secondary: true,
            run(runState) {
              const followUps = [
                {
                  id: 'whatHappenedZ',
                  label: 'WHAT HAPPENED HERE?',
                  run(rs) {
                    rs.world.locationFlags.springfieldElementary = 'Possible Infection';
                    rs.quests.helpApu = 'active';
                    return { text: 'Apu: "A whole busload of them came from the school. Be careful there." (SPRINGFIELD ELEMENTARY: NEW INFORMATION)' };
                  },
                },
                {
                  id: 'backRoom',
                  label: 'INVESTIGATE THE NOISE OUT BACK',
                  run(rs) {
                    if (rs.world.secretsFoundIds.includes('kwikEMartBackRoom')) {
                      return { text: "Whatever it was, it's gone now." };
                    }
                    rs.world.secretsFoundIds.push('kwikEMartBackRoom');
                    if (Math.random() < 0.5) {
                      rs.donutsCurrency += 5;
                      return { text: 'SECRET FOUND! Just a raccoon in the dumpster. It left behind a bag of donut money. +5 donuts.' };
                    }
                    rs.hp = Math.max(1, rs.hp - 12);
                    return { text: 'SECRET FOUND! Not a raccoon. You get clawed before slamming the door. (-12 HP)' };
                  },
                },
              ];
              const bartFollowUp = bartQuestApuFollowUp(runState);
              if (bartFollowUp) followUps.push(bartFollowUp);
              followUps.push({
                id: 'staySafe',
                label: 'STAY SAFE, APU.',
                run() {
                  return { text: 'Apu nods, gripping his hockey stick tighter.' };
                },
              });
              return { text: 'Apu (whispering): "Thank Vishnu. I thought you were one of them."', followUps };
            },
          },
        ],
      },
      alienInvasion: {
        background: '🛸',
        intro: 'The fluorescent lights hum a little too rhythmically. Apu is staring at the Squishee machine like it just spoke to him.',
        interactions: [
          eatAHotDogInteraction(),
          { id: 'buySomething', label: 'STORE', cost: 1, special: 'shop' },
          {
            id: 'talkToApu',
            label: 'TALK TO APU',
            cost: 0,
            secondary: true,
            run(runState) {
              const followUps = [
                {
                  id: 'questionLights',
                  label: 'QUESTION THE LIGHTS',
                  run(rs) {
                    rs.world.locationFlags.springfieldElementary = 'Possible Infection';
                    rs.quests.helpApu = 'active';
                    return { text: 'Apu: "They circled the school twice. I counted." (SPRINGFIELD ELEMENTARY: NEW INFORMATION)' };
                  },
                },
                {
                  id: 'roofAccess',
                  label: 'CHECK THE ROOF ACCESS',
                  run(rs) {
                    if (rs.world.secretsFoundIds.includes('kwikEMartBackRoom')) {
                      return { text: 'The hatch is still welded shut, same as last time.' };
                    }
                    rs.world.secretsFoundIds.push('kwikEMartBackRoom');
                    const relic = grantUndiscoveredRelic(rs);
                    if (relic) return { text: `SECRET FOUND! Someone welded the roof hatch shut from the outside -- and left this behind: ${relic.emoji} ${relic.name}.` };
                    return { text: 'SECRET FOUND! The roof hatch is welded shut from the outside. That\'s new.' };
                  },
                },
              ];
              const bartFollowUp = bartQuestApuFollowUp(runState);
              if (bartFollowUp) followUps.push(bartFollowUp);
              followUps.push({
                id: 'neverMind',
                label: 'NEVER MIND, APU.',
                run() {
                  return { text: 'Apu blinks, slow and unsettling, and goes back to restocking.' };
                },
              });
              return { text: 'Apu: "Homer. Have you looked at the sky tonight? Really looked?"', followUps };
            },
          },
        ],
      },
      // Triggered by systems/locationInvasions.js -- see moesTavern's
      // underAttack state for how resolveInteriorStateId routes here.
      underAttack: {
        background: '🔥',
        intro: 'The front window caves in. Apu is backed against the register, hockey stick raised. "HOMER! A LITTLE HELP!"',
        interactions: [
          {
            id: 'helpApu',
            label: 'HELP APU FIGHT THEM OFF',
            cost: 1,
            special: 'combat',
            combatContent: { type: 'combat', enemyIds: ['zombieBarfly', 'zombieMobGuy'], resolvesInvasionId: 'kwikEMart' },
          },
          {
            id: 'fleeStore',
            label: 'RUN FOR IT',
            cost: 1,
            run(runState) {
              delete runState.world.locationInvasions.kwikEMart;
              runState.world.locationStates.kwikEMart = 'overrun';
              return { text: 'You bolt. Behind you, the shelves go over one by one.' };
            },
          },
        ],
      },
      overrun: {
        background: '💀',
        intro: 'The Kwik-E-Mart is dark, glass everywhere, shelves stripped bare. No sign of Apu.',
        interactions: [
          {
            id: 'lookForSupplies',
            label: 'LOOK FOR ANYTHING USEFUL',
            cost: 1,
            run(runState) {
              if (runState.world.secretsFoundIds.includes('kwikEMartOverrunSearch')) {
                return { text: 'You already picked this place clean.' };
              }
              runState.world.secretsFoundIds.push('kwikEMartOverrunSearch');
              runState.donutsCurrency += 4;
              return { text: 'SECRET FOUND! A few crumpled bills under a fallen shelf. +4 donuts. No sign of Apu.' };
            },
          },
        ],
      },
    },
  },
  moesTavern: {
    npcId: 'moe',
    // The uploaded Moe's Tavern scene photo (Moe behind the bar) -- the
    // visual centerpiece of this interior (see ui/screens.js
    // populateLocationInterior), used across every state below rather than
    // the small emoji `background` glyph other interiors still use.
    image: 'moeChat',
    states: {
      // REDESIGN: Moe's Tavern as a real rest/social/rumor room, not a menu
      // page. The five top-level buttons are a free dialogue tree (cost: 0
      // -- talking to Moe never spends an action); the ACTIONS that
      // dialogue leads to (a paid service, a rest, a rumor) carry their own
      // cost on the followUp instead (see game.js onInteriorFollowUp).
      normal: {
        background: '🍺',
        // HP-aware greeting -- Moe actually reacts to how banged-up Homer
        // looks instead of the same flavor line at 150/150 and 12/150.
        intro(runState) {
          if (runState.hp / runState.maxHp < 0.4) return 'Moe: "Geez, Homer. You look terrible."';
          if (runState.hp / runState.maxHp < 0.8) return 'Moe: "Rough night, huh? Siddown."';
          return "Moe wipes a glass that was already dirty before he started. Barney's asleep sitting up at the bar.";
        },
        interactions: [
          haveABeerInteraction(),
          moeUpgradeInteraction(),
          {
            id: 'talkToMoe',
            label: 'TALK TO MOE',
            cost: 0,
            secondary: true,
            run(runState) {
              return {
                text: `${moeGreeting(runState)} He slides a few things across the bar.`,
                followUps: [
                  ...moeServiceFollowUps(runState),
                  {
                    id: 'heardAnything',
                    label: 'HEARD ANYTHING?',
                    cost: 1,
                    run(rs) {
                      return { text: moeRumor(rs) };
                    },
                  },
                  {
                    id: 'wheresBarney',
                    label: "WHERE'S BARNEY?",
                    run(rs) {
                      if (rs.quests.wheresBarney === 'active') {
                        return { text: 'Moe: "Still no sign of him. Guy owes me for three Duffs, too."' };
                      }
                      if (rs.quests.wheresBarney === 'complete') {
                        return { text: 'Moe: "Barney\'s fine. Or as fine as Barney gets."' };
                      }
                      rs.quests.wheresBarney = 'active';
                      return { text: 'Moe: "Now that you mention it, ain\'t seen him all night... Actually, go check on him, would ya? Somethin\' about it\'s buggin\' me." (QUEST STARTED: WHERE\'S BARNEY?)' };
                    },
                  },
                  {
                    id: 'talkBarney',
                    label: 'TALK TO BARNEY',
                    run() {
                      return { text: 'Barney (waking up): "Ohhh, is it Tuesday? *BURRRP* Homer! Buy a guy a drink?"' };
                    },
                  },
                  // Not the HP rest above -- this is Moe's-flavored ability
                  // drafting (the old rest-node "LEARN ABILITY" mechanic).
                  { id: 'oldTimersTrick', label: "PICK UP AN OLD TIMER'S TRICK", special: 'abilityDraft' },
                  {
                    id: 'backRoom',
                    label: 'CHECK THE BACK ROOM',
                    run(rs) {
                      if (rs.world.secretsFoundIds.includes('moesBackRoom')) {
                        return { text: "Same crates. Same weird stain on the floor you're choosing not to think about." };
                      }
                      rs.world.secretsFoundIds.push('moesBackRoom');
                      const relic = grantUndiscoveredRelic(rs);
                      if (relic) return { text: `SECRET FOUND! Moe's "emergency stash" behind a loose floorboard: ${relic.emoji} ${relic.name}.` };
                      return { text: "SECRET FOUND! Moe's illegal back-room poker game, mid-hand. Everyone stares. You leave quietly." };
                    },
                  },
                ],
              };
            },
          },
        ],
      },
      // This is the state actually showing during Segment I ("Night of the
      // Living Flanders" stacks the zombieOutbreak Horror Rule immediately),
      // so it gets the same dialogue-tree redesign as `normal` above, plus
      // three specific fixes the old version needed: BARRICADE and
      // INVESTIGATE THE BLOOD move from standing buttons into TALK TO MOE's
      // dialogue, REST AT THE BAR is retired as a duplicate of I NEED A
      // MINUTE., and THE REGULARS ARE MOVING WRONG becomes a real 3-choice
      // event (CONFRONT/LOCK THE DOORS/PRETEND) instead of an instant fight.
      zombieOutbreak: {
        background: '🩸',
        intro: 'The lights flicker. Bar stools lie overturned. A blood trail leads toward the back room. Moe is holding a shotgun. Barney is nowhere in sight.',
        interactions: [
          haveABeerInteraction(),
          moeUpgradeInteraction(),
          {
            id: 'talkToMoe',
            label: 'TALK TO MOE',
            cost: 0,
            secondary: true,
            run(runState) {
              const followUps = [
                {
                  id: 'itsOkayMoe',
                  label: "IT'S OKAY, MOE.",
                  run(rs) {
                    shiftRelationship(rs, 'moe', 1);
                    return { text: 'Moe lowers the shotgun an inch. "...Thanks, Homer."' };
                  },
                },
                {
                  id: 'askBlood',
                  label: 'WHAT HAPPENED TO THE BLOOD TRAIL?',
                  run() {
                    return { text: 'Moe: "Leads straight to the back room door. I ain\'t opened it." It\'s now very firmly closed.' };
                  },
                },
                {
                  id: 'offerBarricade',
                  label: 'LET ME BARRICADE THAT DOOR.',
                  run(rs) {
                    if (rs.world.locationFlags.moesTavern === 'Barricaded') {
                      return { text: 'Moe: "Already done, Homer. Keep up."' };
                    }
                    rs.world.locationFlags.moesTavern = 'Barricaded';
                    shiftRelationship(rs, 'moe', 1);
                    return { text: 'You wedge a pool table against the front door. Moe nods. "...Yeah. Okay. That helps." (MOE\'S TAVERN: BARRICADED)' };
                  },
                },
                ...moeServiceFollowUps(runState),
                {
                  id: 'heardAnything',
                  label: 'HEARD ANYTHING?',
                  cost: 1,
                  run(rs) {
                    return { text: moeRumor(rs) };
                  },
                },
                {
                  id: 'wheresBarney',
                  label: "WHERE'S BARNEY?",
                  run(rs) {
                    if (rs.quests.wheresBarney === 'active') {
                      return { text: 'Moe: "Still lookin\'? Back room, probably. If you\'re brave."' };
                    }
                    if (rs.quests.wheresBarney === 'complete') {
                      return { text: 'Moe: "Barney\'s fine. Or as fine as Barney gets."' };
                    }
                    rs.quests.wheresBarney = 'active';
                    return { text: 'Moe: "He went to the back for a keg. That was an hour ago." (QUEST STARTED: WHERE\'S BARNEY?)' };
                  },
                },
                { id: 'oldTimersTrickZ', label: "PICK UP AN OLD TIMER'S TRICK", special: 'abilityDraft' },
              ];
              if (runState.quests.wheresBarney === 'active') {
                followUps.push({
                  id: 'searchBarney',
                  label: 'SEARCH FOR BARNEY',
                  run(rs) {
                    if (rs.world.secretsFoundIds.includes('moesBackRoom')) {
                      return { text: 'Still no sign of him back here.' };
                    }
                    rs.world.secretsFoundIds.push('moesBackRoom');
                    if (Math.random() < 0.5) {
                      rs.quests.wheresBarney = 'complete';
                      return { text: 'SECRET FOUND! Barney, alive, hiding in the walk-in fridge. "Is it over? Is the keg okay?" He stumbles out, rattled but fine. (WHERE\'S BARNEY?: COMPLETE)' };
                    }
                    rs.hp = Math.max(1, rs.hp - 15);
                    return { text: "SECRET FOUND! It's not Barney anymore. It lunges before you slam the door shut. (-15 HP)" };
                  },
                });
              }
              // A real 3-choice horror event instead of an instant fight --
              // CONFRONT LENNY hands off to a real battle the same way a
              // top-level `special: 'combat'` interaction always has (see
              // game.js onInteriorFollowUp's matching case), now chained one
              // level deeper under TALK TO MOE.
              if (!runState.world.locationFlags.moesRegularsFought) {
                followUps.push({
                  id: 'regularsWrong',
                  label: 'THE REGULARS ARE MOVING WRONG',
                  run() {
                    return {
                      text: "Lenny, Carl, and Barney haven't moved from the corner booth in a while. Haven't blinked either.",
                      followUps: [
                        {
                          id: 'confrontLenny',
                          label: 'CONFRONT LENNY',
                          special: 'combat',
                          flagId: 'moesRegularsFought',
                          combatContent: { type: 'combat', enemyIds: ['zombieLenny', 'zombieCarl', 'zombieBarney'] },
                        },
                        {
                          id: 'lockDoors',
                          label: 'TELL MOE TO LOCK THE DOORS',
                          run(rs) {
                            shiftRelationship(rs, 'moe', 1);
                            rs.mayhem = Math.min(100, rs.mayhem + 5);
                            rs.world.locationFlags.moesRegularsFought = true;
                            return { text: 'Moe locks the doors without asking why. The three of them just... sit there. Nobody sleeps tonight. (MOE FAVOR UP, MAYHEM +5%)' };
                          },
                        },
                        {
                          id: 'pretendDidntNotice',
                          label: "PRETEND YOU DIDN'T NOTICE",
                          run(rs) {
                            rs.world.locationFlags.moesRegularsFought = true;
                            return { text: "You look away. Nothing happens. Yet." };
                          },
                        },
                      ],
                    };
                  },
                });
              }
              return { text: 'Moe (not lowering the shotgun): "One of \'em got in. I handled it. Mostly."', followUps };
            },
          },
        ],
      },
      alienInvasion: {
        background: '🛸',
        intro: 'Everything looks mostly normal. Moe is wiping the same glass in a perfect, unblinking rhythm. Something about his eyes catches the light wrong.',
        interactions: [
          haveABeerInteraction(),
          moeUpgradeInteraction(),
          {
            id: 'talkToMoe',
            label: 'TALK TO MOE',
            cost: 0,
            secondary: true,
            run() {
              return {
                text: 'Moe: "Evenin\', Homer. Beautiful night for... observing local customs."',
                followUps: [
                  {
                    id: 'questionMoe',
                    label: 'QUESTION MOE',
                    run() {
                      return Math.random() < 0.5
                        ? { text: 'Moe blinks (normally, this time). "The hell\'s wrong with you? It\'s me, Moe."' }
                        : { text: 'Moe smiles with slightly too many teeth. "Fascinating... species."' };
                    },
                  },
                  {
                    id: 'orderDuffAlien',
                    label: 'ORDER A DUFF.',
                    run(rs) {
                      if (rs.donutsCurrency < 1) return { text: "You're out of money." };
                      rs.donutsCurrency -= 1;
                      rs.hp = Math.min(rs.maxHp, rs.hp + 12);
                      return { text: 'It tastes normal. Suspiciously normal. (+12 HP, -1 donut)' };
                    },
                  },
                  {
                    id: 'checkBasement',
                    label: 'CHECK THE BASEMENT',
                    run(rs) {
                      if (rs.world.secretsFoundIds.includes('moesBackRoom')) {
                        return { text: 'Just kegs. Still just kegs. Probably.' };
                      }
                      rs.world.secretsFoundIds.push('moesBackRoom');
                      const relic = grantUndiscoveredRelic(rs);
                      if (relic) return { text: `SECRET FOUND! A humming metal case among the kegs, definitely not brewing equipment: ${relic.emoji} ${relic.name}.` };
                      return { text: 'SECRET FOUND! A humming metal case among the kegs. You decide not to open it.' };
                    },
                  },
                ],
              };
            },
          },
        ],
      },
      // Triggered by systems/locationInvasions.js, not a Horror Rule --
      // resolveInteriorStateId checks runState.world.locationInvasions
      // before falling through to the Horror Rule stack, so this shows up
      // the moment the crisis fires regardless of segment/Horror Rule.
      underAttack: {
        background: '🔥',
        intro: "GLASS SHATTERS. A horde is pouring through the front window. Moe's screaming your name over the noise.",
        interactions: [
          {
            id: 'defendBar',
            label: 'DEFEND THE BAR',
            cost: 1,
            special: 'combat',
            combatContent: { type: 'combat', enemyIds: ['zombieBarfly', 'zombieBarfly', 'zombieMobGuy'], resolvesInvasionId: 'moesTavern' },
          },
          {
            id: 'fleeBar',
            label: 'RUN FOR IT',
            cost: 1,
            run(runState) {
              delete runState.world.locationInvasions.moesTavern;
              runState.world.locationStates.moesTavern = 'overrun';
              return { text: "You bail. Moe's screams fade behind you as the window finally gives way." };
            },
          },
        ],
      },
      // Permanent for the rest of the episode once set (locationStates
      // override) -- no Duff, no rest, no ability draft. A bad decision the
      // player can't take back.
      overrun: {
        background: '💀',
        intro: "Moe's is a burnt-out shell. Broken stools, a shattered Duff sign swinging on one hinge. Whatever happened here, it's over now.",
        interactions: [
          {
            id: 'lookForSurvivors',
            label: 'LOOK FOR SURVIVORS',
            cost: 1,
            run(runState) {
              if (runState.world.secretsFoundIds.includes('moesOverrunSearch')) {
                return { text: 'Nothing left to find here.' };
              }
              runState.world.secretsFoundIds.push('moesOverrunSearch');
              runState.donutsCurrency += 4;
              return { text: 'SECRET FOUND! A cashbox someone never got to. +4 donuts. No sign of Moe.' };
            },
          },
        ],
      },
    },
  },
  // ---- Upgrade-station locations (REDESIGN COMBAT GAMEPLAY: "BOWLARAMA --
  // Upgrade: BOWLING BALL... NUCLEAR PLANT -- Upgrade: NUCLEAR cards but
  // risk Radiation"). Unlike kwikEMart/moesTavern above, these two are
  // ordinary per-segment board locations (data/journeys.js still owns their
  // combat/event content for every segment) that ALSO now have a menu --
  // `deferVisitToContent: true` tells game.js's leaveInterior not to burn
  // that segment content just for walking in to browse the upgrade station
  // and walking back out (see game.js onInteriorInteract's 'segmentContent'
  // special case, which is the only thing that actually consumes it). Kept
  // deliberately minimal (one state, no secrets/rumors) rather than a full
  // Moe's/Apu's-style dialogue interior -- the upgrade station is the point.
  bowlarama: {
    deferVisitToContent: true,
    states: {
      normal: {
        background: '🎳',
        intro: "The lanes are dim except for one, lit up and humming quietly to itself. Nobody's manning the counter, but the ball return still works.",
        interactions: [
          { id: 'bowlAFrame', label: 'SEE WHAT HAPPENS HERE TONIGHT', cost: 1, special: 'segmentContent' },
          upgradeCardInteraction('bowling', { price: 6 }),
          {
            id: 'leaveDialogueBowlarama',
            label: 'LEAVE',
            cost: 0,
            run() {
              return { text: 'You let the door swing shut behind you.' };
            },
          },
        ],
      },
    },
  },
  nuclearPlant: {
    deferVisitToContent: true,
    states: {
      normal: {
        background: '☢️',
        intro: 'Sector 7-G hums louder than it should. A workbench near the core is scattered with tools someone left in a hurry -- and half-finished modifications to what looks like your gear.',
        interactions: [
          { id: 'reactorFloor', label: 'HEAD FOR THE REACTOR FLOOR', cost: 1, special: 'segmentContent' },
          upgradeCardInteraction('nuclear', {
            price: 4,
            risk: {
              label: '-8 HP',
              apply(rs) {
                rs.hp = Math.max(1, rs.hp - 8);
                return "You lean into the core's warm glow a little too long. (-8 HP)";
              },
            },
          }),
          {
            id: 'leaveDialogueNuclearPlant',
            label: 'LEAVE',
            cost: 0,
            run() {
              return { text: 'You step back out past the "0 DAYS SINCE A REANIMATION" sign.' };
            },
          },
        ],
      },
    },
  },
};

// Wire the shared bag interactions into every state after the fact, rather
// than repeating them in each block above -- USE AN ITEM everywhere, SELL AN
// ITEM only where Apu is standing behind the counter.
// SELL AN ITEM now lives inside TALK TO APU's dialogue tree (normal state)
// instead of standing on its own -- only the rarer, key/quest-gated finds
// still get their own small secondary button.
for (const state of Object.values(INTERIORS.kwikEMart.states)) {
  state.interactions.push(unlockStorageCageInteraction(), helpApuReportInteraction());
}
for (const interior of Object.values(INTERIORS)) {
  for (const state of Object.values(interior.states)) {
    state.interactions.push(useItemInteraction());
  }
}
// Moe's own general UPGRADE A CARD (moeUpgradeInteraction, added inline to
// normal/zombieOutbreak/alienInvasion above) replaces the old paid,
// duff-only upgradeCardInteraction station -- underAttack/overrun stay
// combat-only/looted, same as they never got haveABeerInteraction either.

// Prefers the most-recently-activated Horror Rule that defines a state for
// this location (so Segment II's rule wins over Segment I's once both are
// stacked), falls back through the stack, then 'normal'. A manual override
// in runState.world.locationStates (set by e.g. a callback that destroys a
// building) wins over all of it -- see data/travelEvents.js.
export function resolveInteriorStateId(locationId, runState) {
  const interior = INTERIORS[locationId];
  const override = runState.world.locationStates[locationId];
  if (override && interior.states[override]) return override;
  if (runState.world.locationInvasions[locationId] && interior.states.underAttack) return 'underAttack';
  const ruleIds = [...runState.activeHorrorRuleIds].reverse();
  for (const ruleId of ruleIds) {
    if (interior.states[ruleId]) return ruleId;
  }
  return 'normal';
}

export function getInteriorState(locationId, runState) {
  const interior = INTERIORS[locationId];
  const stateId = resolveInteriorStateId(locationId, runState);
  return { interior, stateId, state: interior.states[stateId] };
}

// Rolled once after any interaction inside a qualifying state -- "Locations
// should contain secrets" is one thing, but "something can suddenly happen"
// is another; this is a location's own random event, distinct from a board
// combat/event node. Fires at most once per run per interior (flagId).
export function checkRandomInterrupt(locationId, stateId, runState) {
  const cfg = INTERIORS[locationId].randomInterrupt;
  if (!cfg || !cfg.stateIds.includes(stateId)) return null;
  if (runState.world.locationFlags[cfg.flagId]) return null;
  if (Math.random() >= cfg.chance) return null;
  runState.world.locationFlags[cfg.flagId] = true;
  return getEvent(cfg.eventId);
}
