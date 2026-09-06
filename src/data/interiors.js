// Enterable location interiors -- small interactive scenes rather than a
// single board-node encounter. Each interior has one `states` map keyed by
// Horror Rule id (plus 'normal'); systems/locationInterior.js resolves
// which state is showing right now (resolveInteriorStateId below) so the
// SAME building reacts to whichever Horror Rules the run has stacked up --
// see data/horrorRules.js for why a state id doubles as a rule id.
//
// Each state is `{background, intro, interactions: [...]}`. An interaction
// is `{id, label, cost, run(runState) => {text, followUps?}}` -- `run`
// resolves immediately and can mutate runState (heal, spend currency, flag
// a rumor, discover a secret). `followUps` are a dialogue's own reply
// options (free -- they're part of the one "talk" action, not a new one),
// each shaped the same as an interaction but without its own `cost`. An
// interaction can instead set `special: 'shop'` or `special: 'abilityDraft'`
// to hand off to an existing full-screen flow (systems/economy.js's shop
// modal, or the ability draft) rather than resolving inline.
import { shiftRelationship } from '../systems/relationships.js';
import { getRelicShopPool } from './relics.js';
import { getEvent } from './events.js';
import { ITEMS } from './items.js';
import { sellPriceFor } from '../systems/economy.js';
import { helpApuReportInteraction } from './quests.js';

function grantUndiscoveredRelic(runState) {
  const pool = getRelicShopPool().filter((r) => !runState.relics.includes(r.id));
  if (!pool.length) return null;
  const relic = pool[Math.floor(Math.random() * pool.length)];
  runState.relics.push(relic.id);
  return relic;
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

// Kwik-E-Mart only -- Apu is the one buying it back.
function sellItemInteraction() {
  return {
    id: 'sellItem',
    label: 'SELL AN ITEM',
    cost: 1,
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
        intro: 'Apu stands behind the counter, humming along to a radio that only plays static tonight.',
        interactions: [
          {
            id: 'talkApu',
            label: 'TALK TO APU',
            cost: 1,
            run() {
              return {
                text: 'Apu: "Homer! Something very strange is happening tonight."',
                followUps: [
                  {
                    id: 'whatHappened',
                    label: "WHAT'S HAPPENED?",
                    run(runState) {
                      runState.world.locationFlags.springfieldElementary = 'Possible Infection';
                      runState.quests.helpApu = 'active';
                      return { text: 'Apu: "I saw something shamble past Springfield Elementary. It wasn\'t walking right." (SPRINGFIELD ELEMENTARY: NEW INFORMATION)' };
                    },
                  },
                  {
                    id: 'freeSquishee',
                    label: 'CAN I HAVE IT FOR FREE?',
                    run(runState) {
                      const level = runState.relationships.apu;
                      if (level === 'friendly' || level === 'bestFriend') {
                        runState.hp = Math.min(runState.maxHp, runState.hp + 20);
                        return { text: 'Apu: "For my best customer? Of course." (+20 HP)' };
                      }
                      shiftRelationship(runState, 'apu', -1);
                      return { text: 'Apu: "This is a business, Homer, not a charity."' };
                    },
                  },
                  {
                    id: 'thanksApu',
                    label: 'THANKS, APU.',
                    run() {
                      return { text: 'Apu: "Good luck out there, my friend."' };
                    },
                  },
                ],
              };
            },
          },
          { id: 'buySomething', label: 'BUY SOMETHING', cost: 1, special: 'shop' },
          {
            id: 'squishee',
            label: 'ORDER A SQUISHEE',
            cost: 1,
            run(runState) {
              if (runState.donutsCurrency < 1) return { text: "You're out of donuts to pay with. Apu isn't budging." };
              runState.donutsCurrency -= 1;
              runState.hp = Math.min(runState.maxHp, runState.hp + 20);
              shiftRelationship(runState, 'apu', 1);
              return { text: 'The brain freeze is almost worth it. (+20 HP, -1 donut)' };
            },
          },
          {
            id: 'lookAround',
            label: 'LOOK AROUND',
            cost: 1,
            run() {
              return { text: 'Chips, magazines, a lottery machine that only prints question marks. Nothing useful.' };
            },
          },
          {
            id: 'backRoom',
            label: 'INVESTIGATE THE BACK ROOM',
            cost: 1,
            run(runState) {
              if (runState.world.secretsFoundIds.includes('kwikEMartBackRoom')) {
                return { text: "Just boxes of expired hot dogs. You've already checked." };
              }
              runState.world.secretsFoundIds.push('kwikEMartBackRoom');
              const relic = grantUndiscoveredRelic(runState);
              if (relic) return { text: `SECRET FOUND! Behind a case of expired hot dogs: ${relic.emoji} ${relic.name}.` };
              runState.donutsCurrency += 5;
              return { text: 'SECRET FOUND! A cigar box full of donut money. +5 donuts.' };
            },
          },
        ],
      },
      zombieOutbreak: {
        background: '🧟',
        intro: 'The shelves are on their sides. Apu is crouched behind the counter with a broken hockey stick.',
        interactions: [
          {
            id: 'talkApu',
            label: 'TALK TO APU',
            cost: 1,
            run() {
              return {
                text: 'Apu (whispering): "Thank Vishnu. I thought you were one of them."',
                followUps: [
                  {
                    id: 'whatHappenedZ',
                    label: 'WHAT HAPPENED HERE?',
                    run(runState) {
                      runState.world.locationFlags.springfieldElementary = 'Possible Infection';
                      runState.quests.helpApu = 'active';
                      return { text: 'Apu: "A whole busload of them came from the school. Be careful there." (SPRINGFIELD ELEMENTARY: NEW INFORMATION)' };
                    },
                  },
                  {
                    id: 'staySafe',
                    label: 'STAY SAFE, APU.',
                    run() {
                      return { text: 'Apu nods, gripping his hockey stick tighter.' };
                    },
                  },
                ],
              };
            },
          },
          {
            id: 'squisheeMachine',
            label: 'CHECK THE SQUISHEE MACHINE',
            cost: 1,
            run(runState) {
              runState.hp = Math.min(runState.maxHp, runState.hp + 10);
              return { text: "It still works. It's the blue kind. You try not to think about the color too hard. (+10 HP)" };
            },
          },
          {
            id: 'backRoom',
            label: 'INVESTIGATE THE NOISE OUT BACK',
            cost: 1,
            run(runState) {
              if (runState.world.secretsFoundIds.includes('kwikEMartBackRoom')) {
                return { text: "Whatever it was, it's gone now." };
              }
              runState.world.secretsFoundIds.push('kwikEMartBackRoom');
              if (Math.random() < 0.5) {
                runState.donutsCurrency += 5;
                return { text: 'SECRET FOUND! Just a raccoon in the dumpster. It left behind a bag of donut money. +5 donuts.' };
              }
              runState.hp = Math.max(1, runState.hp - 12);
              return { text: 'SECRET FOUND! Not a raccoon. You get clawed before slamming the door. (-12 HP)' };
            },
          },
        ],
      },
      alienInvasion: {
        background: '🛸',
        intro: 'The fluorescent lights hum a little too rhythmically. Apu is staring at the Squishee machine like it just spoke to him.',
        interactions: [
          {
            id: 'talkApu',
            label: 'TALK TO APU',
            cost: 1,
            run() {
              return {
                text: 'Apu: "Homer. Have you looked at the sky tonight? Really looked?"',
                followUps: [
                  {
                    id: 'questionLights',
                    label: 'QUESTION THE LIGHTS',
                    run(runState) {
                      runState.world.locationFlags.springfieldElementary = 'Possible Infection';
                      runState.quests.helpApu = 'active';
                      return { text: 'Apu: "They circled the school twice. I counted." (SPRINGFIELD ELEMENTARY: NEW INFORMATION)' };
                    },
                  },
                  {
                    id: 'neverMind',
                    label: 'NEVER MIND, APU.',
                    run() {
                      return { text: 'Apu blinks, slow and unsettling, and goes back to restocking.' };
                    },
                  },
                ],
              };
            },
          },
          { id: 'buySomething', label: 'BUY SOMETHING', cost: 1, special: 'shop' },
          {
            id: 'roofAccess',
            label: 'CHECK THE ROOF ACCESS',
            cost: 1,
            run(runState) {
              if (runState.world.secretsFoundIds.includes('kwikEMartBackRoom')) {
                return { text: 'The hatch is still welded shut, same as last time.' };
              }
              runState.world.secretsFoundIds.push('kwikEMartBackRoom');
              const relic = grantUndiscoveredRelic(runState);
              if (relic) return { text: `SECRET FOUND! Someone welded the roof hatch shut from the outside -- and left this behind: ${relic.emoji} ${relic.name}.` };
              return { text: 'SECRET FOUND! The roof hatch is welded shut from the outside. That\'s new.' };
            },
          },
        ],
      },
    },
  },
  moesTavern: {
    npcId: 'moe',
    states: {
      normal: {
        background: '🍺',
        intro: "Moe wipes a glass that was already dirty before he started. Barney's asleep sitting up at the bar.",
        interactions: [
          {
            id: 'talkMoe',
            label: 'TALK TO MOE',
            cost: 1,
            run() {
              return {
                text: 'Moe: "Homer! What the hell happened to you?"',
                followUps: [
                  {
                    id: 'giveMeDuff',
                    label: 'GIVE ME A DUFF. ($2)',
                    run(runState) {
                      if (runState.donutsCurrency < 2) return { text: 'Moe: "No tab. Not for you, not after last time."' };
                      runState.donutsCurrency -= 2;
                      runState.hp = Math.min(runState.maxHp, runState.hp + 15);
                      shiftRelationship(runState, 'moe', 1);
                      return { text: 'Moe slides a Duff across the bar. (+15 HP, -2 donuts)' };
                    },
                  },
                  {
                    id: 'heardWeird',
                    label: 'HEARD ANYTHING WEIRD LATELY?',
                    run(runState) {
                      runState.world.locationFlags.springfieldElementary = 'Possible Infection';
                      return { text: 'Moe: "Barney swears he saw somethin\' shufflin\' around the school. I told him to lay off the tap." (SPRINGFIELD ELEMENTARY: NEW INFORMATION)' };
                    },
                  },
                  {
                    id: 'comeWithMe',
                    label: 'WANT TO COME WITH ME?',
                    run(runState) {
                      if (runState.cast.includes('moe')) return { text: 'Moe: "I\'m already comin\', ain\'t I?"' };
                      const level = runState.relationships.moe;
                      if (level === 'friendly' || level === 'bestFriend') {
                        runState.cast.push('moe');
                        return { text: 'Moe: "Eh, why not? Business is dead anyway." MOE JOINED THE CAST.' };
                      }
                      return { text: 'Moe: "Get lost, Homer."' };
                    },
                  },
                  {
                    id: 'backRoomQ',
                    label: "WHAT'S IN THE BACK ROOM?",
                    run() {
                      return { text: 'Moe: "...nothing." He will not make eye contact.' };
                    },
                  },
                ],
              };
            },
          },
          {
            id: 'talkBarney',
            label: 'TALK TO BARNEY',
            cost: 1,
            run() {
              return { text: 'Barney (waking up): "Ohhh, is it Tuesday? *BURRRP* Homer! Buy a guy a drink?"' };
            },
          },
          {
            id: 'orderDrink',
            label: 'ORDER A DRINK',
            cost: 1,
            run(runState) {
              if (runState.donutsCurrency < 1) return { text: "You're out of money. Moe doesn't do tabs." };
              runState.donutsCurrency -= 1;
              runState.hp = Math.min(runState.maxHp, runState.hp + 12);
              shiftRelationship(runState, 'moe', 1);
              return { text: 'One Duff, coming right up. (+12 HP, -1 donut)' };
            },
          },
          { id: 'takeABreather', label: 'TAKE A BREATHER', cost: 1, special: 'abilityDraft' },
          {
            id: 'backRoom',
            label: 'CHECK THE BACK ROOM',
            cost: 1,
            run(runState) {
              if (runState.world.secretsFoundIds.includes('moesBackRoom')) {
                return { text: "Same crates. Same weird stain on the floor you're choosing not to think about." };
              }
              runState.world.secretsFoundIds.push('moesBackRoom');
              const relic = grantUndiscoveredRelic(runState);
              if (relic) return { text: `SECRET FOUND! Moe's "emergency stash" behind a loose floorboard: ${relic.emoji} ${relic.name}.` };
              return { text: "SECRET FOUND! Moe's illegal back-room poker game, mid-hand. Everyone stares. You leave quietly." };
            },
          },
        ],
      },
      zombieOutbreak: {
        background: '🩸',
        intro: 'The lights flicker. Bar stools lie overturned. A blood trail leads toward the back room. Moe is holding a shotgun. Barney is nowhere in sight.',
        interactions: [
          {
            id: 'talkMoe',
            label: 'TALK TO MOE',
            cost: 1,
            run() {
              return {
                text: 'Moe (not lowering the shotgun): "One of \'em got in. I handled it. Mostly."',
                followUps: [
                  {
                    id: 'whereBarney',
                    label: 'WHAT HAPPENED TO BARNEY?',
                    run(runState) {
                      if (!runState.quests.wheresBarney) runState.quests.wheresBarney = 'active';
                      return { text: 'Moe: "He went to the back for a keg. That was an hour ago." (You should go looking for him.)' };
                    },
                  },
                  {
                    id: 'itsOkayMoe',
                    label: "IT'S OKAY, MOE.",
                    run(runState) {
                      shiftRelationship(runState, 'moe', 1);
                      return { text: 'Moe lowers the shotgun an inch. "...Thanks, Homer."' };
                    },
                  },
                ],
              };
            },
          },
          {
            id: 'investigateBlood',
            label: 'INVESTIGATE THE BLOOD',
            cost: 1,
            run() {
              return { text: 'It leads straight to the back room door, which is now very firmly closed.' };
            },
          },
          {
            id: 'barricade',
            label: 'BARRICADE THE DOOR',
            cost: 1,
            run(runState) {
              runState.world.locationFlags.moesTavern = 'Barricaded';
              return { text: 'You wedge a pool table against the front door. Should buy some time.' };
            },
          },
          {
            id: 'searchBarney',
            label: 'SEARCH FOR BARNEY',
            cost: 1,
            run(runState) {
              if (runState.world.secretsFoundIds.includes('moesBackRoom')) {
                return { text: 'Still no sign of him back here.' };
              }
              runState.world.secretsFoundIds.push('moesBackRoom');
              if (Math.random() < 0.5) {
                return { text: 'SECRET FOUND! Barney, alive, hiding in the walk-in fridge. "Is it over? Is the keg okay?" He stumbles out, rattled but fine.' };
              }
              runState.hp = Math.max(1, runState.hp - 15);
              return { text: "SECRET FOUND! It's not Barney anymore. It lunges before you slam the door shut. (-15 HP)" };
            },
          },
          // Hands off to a real fight (see game.js onInteriorInteract's
          // `special: 'combat'` case) instead of resolving inline -- the
          // "Moe's" encounter combo: Lenny and Carl buff each other for
          // fighting side by side, and Barney's just built like a tank.
          {
            id: 'regularsWrong',
            label: 'THE REGULARS ARE MOVING WRONG',
            cost: 1,
            special: 'combat',
            combatContent: { type: 'combat', enemyIds: ['zombieLenny', 'zombieCarl', 'zombieBarney'] },
            visible(runState) {
              return !runState.world.locationFlags.moesRegularsFought;
            },
          },
        ],
      },
      alienInvasion: {
        background: '🛸',
        intro: 'Everything looks mostly normal. Moe is wiping the same glass in a perfect, unblinking rhythm. Something about his eyes catches the light wrong.',
        interactions: [
          {
            id: 'talkMoe',
            label: 'TALK TO MOE',
            cost: 1,
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
                    run(runState) {
                      if (runState.donutsCurrency < 1) return { text: "You're out of money." };
                      runState.donutsCurrency -= 1;
                      runState.hp = Math.min(runState.maxHp, runState.hp + 12);
                      return { text: 'It tastes normal. Suspiciously normal. (+12 HP, -1 donut)' };
                    },
                  },
                ],
              };
            },
          },
          {
            id: 'checkBasement',
            label: 'CHECK THE BASEMENT',
            cost: 1,
            run(runState) {
              if (runState.world.secretsFoundIds.includes('moesBackRoom')) {
                return { text: 'Just kegs. Still just kegs. Probably.' };
              }
              runState.world.secretsFoundIds.push('moesBackRoom');
              const relic = grantUndiscoveredRelic(runState);
              if (relic) return { text: `SECRET FOUND! A humming metal case among the kegs, definitely not brewing equipment: ${relic.emoji} ${relic.name}.` };
              return { text: 'SECRET FOUND! A humming metal case among the kegs. You decide not to open it.' };
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
for (const state of Object.values(INTERIORS.kwikEMart.states)) {
  state.interactions.push(sellItemInteraction(), unlockStorageCageInteraction(), helpApuReportInteraction());
}
for (const interior of Object.values(INTERIORS)) {
  for (const state of Object.values(interior.states)) {
    state.interactions.push(useItemInteraction());
  }
}

// Prefers the most-recently-activated Horror Rule that defines a state for
// this location (so Segment II's rule wins over Segment I's once both are
// stacked), falls back through the stack, then 'normal'. A manual override
// in runState.world.locationStates (set by e.g. a callback that destroys a
// building) wins over all of it -- see data/travelEvents.js.
export function resolveInteriorStateId(locationId, runState) {
  const interior = INTERIORS[locationId];
  const override = runState.world.locationStates[locationId];
  if (override && interior.states[override]) return override;
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
