// Rolled once per road hop (see game.js travelTo) -- "Traveling between
// buildings can itself create encounters." 'nothing' is heavily weighted
// so the map doesn't feel like a slot machine; most trips are quiet.
// `apply` runs immediately and returns {text, blocked?} for the travel
// screen to show, or null for a silent no-op. A `blocked: true` result
// closes the road it fired on for the rest of the run (data/worldMap.js
// blockRoad), which is what makes a route decision matter later --
// the cemetery<->plant road can wash out in a zombie outbreak, forcing the
// long way around through the school.
import { blockRoad } from './worldMap.js';
import { getRelicShopPool } from './relics.js';
import { getDraftPool, RARITY } from './abilities.js';
import { learnAbility } from '../systems/abilityDraft.js';

// Shared by both zombie ambush tiers below -- low-HP, no-name zombies (the
// same sprites the board's generic mob encounters use), appropriate for a
// fast "something jumped out of the dark" fight rather than a scripted one.
const AMBUSH_ENEMY_POOL = ['zombieBarfly', 'zombieMobGuy', 'shamblingIntern', 'undeadCafeteriaLady', 'zombieGroundskeeper'];
// Same idea for the Segment II+ alien ambushes -- only two non-elite alien
// templates exist (data/enemies.js), so this pool is smaller than the
// zombie one on purpose; alienEnforcer stays reserved for the scripted
// elite/boss fights, never a random road ambush.
const ALIEN_AMBUSH_ENEMY_POOL = ['alienProbe', 'abductedCitizen'];

function randomEnemyIds(pool, count) {
  return Array.from({ length: count }, () => pool[Math.floor(Math.random() * pool.length)]);
}

function randomAmbushEnemyIds(count) {
  return randomEnemyIds(AMBUSH_ENEMY_POOL, count);
}

export const TRAVEL_EVENTS = {
  nothing: {
    id: 'nothing',
    // Bumped up from 6 to keep roughly the same "most trips are quiet"
    // ratio (~60%) now that ~11 more short "Springfield moments" (below)
    // are in the pool too -- "do not make every trip an interruption."
    weight: 30,
    condition: () => true,
    apply() {
      return null;
    },
  },
  // `ambushCombat` on the returned outcome is a signal game.js's travelTo
  // specifically looks for -- it detours into a real fight before the
  // player actually arrives, then continues on to the original
  // destination's own content after victory (see game.js enterAmbushBattle).
  zombieAmbush: {
    id: 'zombieAmbush',
    weight: 4,
    condition: (runState) => runState.activeHorrorRuleIds.includes('zombieOutbreak'),
    apply() {
      return {
        text: 'SCREAMING. Something lunges out of the dark before you can react.',
        ambushCombat: { enemyIds: randomAmbushEnemyIds(1) },
      };
    },
  },
  // Segment II+ only -- a real 3-4 enemy horde, not the single beefy
  // "Zombie Horde" elite unit some locations use. Bigger risk, bigger
  // payout (grantVictoryCash already scales cash by enemy count).
  zombieHordeAmbush: {
    id: 'zombieHordeAmbush',
    weight: 2,
    condition: (runState) => runState.activeHorrorRuleIds.includes('zombieOutbreak') && runState.segmentIndex >= 1,
    apply() {
      return {
        text: '⚠ HORDE! A whole pack shambles out of the shadows, all at once, cutting off the road ahead.',
        ambushCombat: { enemyIds: randomAmbushEnemyIds(3 + Math.floor(Math.random() * 2)) },
      };
    },
  },
  zombieRoadblock: {
    id: 'zombieRoadblock',
    weight: 3,
    condition: (runState, fromId, toId) =>
      runState.activeHorrorRuleIds.includes('zombieOutbreak') &&
      [fromId, toId].includes('springfieldCemetery') &&
      [fromId, toId].includes('nuclearPlant'),
    apply(runState, fromId, toId) {
      blockRoad(runState, fromId, toId);
      return { text: 'A shambling mass fills the road ahead, packed in too tight to push through. This route is a dead end now -- literally.', blocked: true };
    },
  },
  // ---- Segment II+ alien-themed ambushes, mirroring the zombie pair above
  // -- Segment II ("Invasion of the Homer Snatchers") had a real Horror
  // Rule of its own but no road encounters of its own flavor; every ambush
  // a player hit was still zombie-themed even mid-invasion.
  alienAmbush: {
    id: 'alienAmbush',
    weight: 4,
    condition: (runState) => runState.activeHorrorRuleIds.includes('alienInvasion'),
    apply() {
      return {
        text: 'A beam of white light pins you in place for a half-second before something solid slams into you.',
        ambushCombat: { enemyIds: randomEnemyIds(ALIEN_AMBUSH_ENEMY_POOL, 1) },
      };
    },
  },
  alienHordeAmbush: {
    id: 'alienHordeAmbush',
    weight: 2,
    condition: (runState) => runState.activeHorrorRuleIds.includes('alienInvasion') && runState.segmentIndex >= 1,
    apply() {
      return {
        text: '⚠ The sky flickers green. A whole squad decloaks around you at once, cutting off every direction but one.',
        ambushCombat: { enemyIds: randomEnemyIds(ALIEN_AMBUSH_ENEMY_POOL, 3 + Math.floor(Math.random() * 2)) },
      };
    },
  },
  // Segment III's whole premise ("When Horrors Collide") made real on the
  // road itself, not just in its title card -- only fires once BOTH Horror
  // Rules are stacked (Horror Rules never turn back off, see
  // data/journeys.js), so it's exclusive to Segment II's tail end onward.
  collidingHorrorsAmbush: {
    id: 'collidingHorrorsAmbush',
    weight: 3,
    condition: (runState) => runState.activeHorrorRuleIds.includes('zombieOutbreak') && runState.activeHorrorRuleIds.includes('alienInvasion'),
    apply() {
      return {
        text: "A zombie shambles directly into a beam of alien light -- and doesn't fall. It just keeps coming, faster now, wrong in a whole new way.",
        ambushCombat: { enemyIds: [...randomEnemyIds(AMBUSH_ENEMY_POOL, 1), ...randomEnemyIds(ALIEN_AMBUSH_ENEMY_POOL, 1)] },
      };
    },
  },
  // The one ambush that isn't gated behind either Horror Rule -- Springfield
  // had ordinary dangers before the sky/ground opened up, and keeps having
  // them the whole run. Low weight (unconditional pool competes with
  // 'nothing' every single hop) and a mundane, non-horror enemy so it never
  // reads as a diluted version of the "real" ambushes above.
  strayAnimalAmbush: {
    id: 'strayAnimalAmbush',
    weight: 2,
    condition: () => true,
    apply() {
      return {
        text: "Something snarls from behind a chain-link fence. It's just a dog. An extremely committed dog.",
        ambushCombat: { enemyIds: ['rabidStrayDog'] },
      };
    },
  },
  smallFind: {
    id: 'smallFind',
    weight: 2,
    condition: () => true,
    apply(runState) {
      runState.donutsCurrency += 2;
      return { text: 'A couple of stray donuts sit untouched on the curb. (+2 donuts)' };
    },
  },
  roughPatch: {
    id: 'roughPatch',
    weight: 1,
    condition: (runState) => runState.mayhem >= 30,
    apply(runState) {
      runState.hp = Math.max(1, runState.hp - 8);
      return { text: 'Something takes a swipe at you out of the dark before vanishing again. (-8 HP)' };
    },
  },

  // ---- ~10 short "random Springfield moments" (Priority 6) -- mostly pure
  // flavor, a few with a small mechanical nudge, none of them a real
  // decision (that's what location events are for). The point is texture:
  // "Springfield should feel ALIVE," not a second layer of choices on top
  // of the road itself.
  carCrash: {
    id: 'carCrash',
    weight: 2,
    condition: () => true,
    apply(runState) {
      runState.donutsCurrency += 2;
      return { text: "A car alarm blares, then cuts off mid-note. The car's abandoned, doors open, radio still playing. You help yourself to the change in the cupholder. (+2 donuts)" };
    },
  },
  distantScream: {
    id: 'distantScream',
    weight: 2,
    condition: () => true,
    apply() {
      return { text: 'A scream echoes from a few blocks over. Then nothing. You keep walking.' };
    },
  },
  phoneBooth: {
    id: 'phoneBooth',
    weight: 2,
    condition: () => true,
    apply(runState) {
      runState.hp = Math.min(runState.maxHp, runState.hp + 6);
      return { text: 'A payphone rings. It\'s Marge, somehow, just checking in. Hearing her voice helps more than it should. (+6 HP)' };
    },
  },
  duffTruck: {
    id: 'duffTruck',
    weight: 2,
    condition: () => true,
    apply(runState) {
      runState.hp = Math.min(runState.maxHp, runState.hp + 10);
      return { text: 'A Duff Beer truck lies jackknifed across a driveway, completely unguarded. You take a "structural integrity sample." (+10 HP)' };
    },
  },
  zombieGlassDoor: {
    id: 'zombieGlassDoor',
    weight: 2,
    condition: (runState) => runState.activeHorrorRuleIds.includes('zombieOutbreak'),
    apply() {
      return { text: 'A zombie shambles face-first into a sliding glass door. Then does it again. You leave it to its business.' };
    },
  },
  alienShipFlicker: {
    id: 'alienShipFlicker',
    weight: 2,
    condition: (runState) => runState.activeHorrorRuleIds.includes('alienInvasion'),
    apply() {
      return { text: 'A saucer-shaped shadow flickers across the moon, there and gone. The streetlights dim for exactly as long as it takes to notice.' };
    },
  },
  mysteriousPortal: {
    id: 'mysteriousPortal',
    weight: 1,
    condition: () => true,
    apply(runState) {
      const pool = getRelicShopPool().filter((r) => !runState.relics.includes(r.id));
      if (pool.length && Math.random() < 0.5) {
        const relic = pool[Math.floor(Math.random() * pool.length)];
        runState.relics.push(relic.id);
        return `Something shimmers at the end of the alley. You reach through without thinking too hard about it and pull back with: ${relic.emoji} ${relic.name}.`;
      }
      return 'Something shimmers at the end of the alley. By the time you get there, it\'s just an alley.';
    },
  },
  dogWithItem: {
    id: 'dogWithItem',
    weight: 2,
    condition: () => true,
    apply(runState) {
      runState.donutsCurrency += 1;
      return "A dog trots past carrying something shiny in its mouth. It won't give it up, but it drops a donut on the way, apparently as a consolation prize. (+1 donut)";
    },
  },
  tvInWindow: {
    id: 'tvInWindow',
    weight: 2,
    condition: () => true,
    apply() {
      return { text: 'A TV flickers on by itself in a dark, empty-looking house. It\'s just static. You decide not to think about it.' };
    },
  },
  alleyVoice: {
    id: 'alleyVoice',
    weight: 2,
    condition: () => true,
    apply() {
      return { text: 'Someone calls your name from a dark alley. You don\'t recognize the voice. You keep walking.' };
    },
  },
  roadDonut: {
    id: 'roadDonut',
    weight: 2,
    condition: () => true,
    apply(runState) {
      runState.donutsCurrency += 2;
      return { text: 'A donut sits in the middle of the road, suspiciously undisturbed. You take it anyway. (+2 donuts)' };
    },
  },

  // ---- MAJOR MAP + ENCOUNTER GAMEPLAY UPDATE: decision-based travel
  // events, not just flavor text or an automatic ambush. `apply` returns
  // `{decision: {title, speaker, prompt, choiceA/B/C}}` -- the exact same
  // shape Devil Ned's deals and Snake's reward already use (data/
  // devilDeals.js, data/events.js SNAKE_DEFEAT_REWARD), rendered through
  // the same generic ui/screens.js showChoiceModal (game.js travelTo).
  // "EVENT CHOICES MUST EXPLAIN CONSEQUENCES" -- every label says exactly
  // what it costs/risks, not a blind guess.
  ralphEncounter: {
    id: 'ralphEncounter',
    weight: 2,
    condition: () => true,
    apply() {
      return {
        decision: {
          title: 'RALPH WIGGUM',
          speaker: 'Ralph',
          prompt: '"I\'m helping!" Ralph stands alone in the middle of the street, seemingly unaware that anything is wrong at all.',
          choiceA: {
            label: 'HELP RALPH (walk him somewhere safer)',
            apply() {
              return 'You walk Ralph back toward a lit porch. He waves as you go. "Bye, doggy!" There is no dog.';
            },
          },
          choiceB: {
            label: 'GIVE HIM A DONUT (-2 donuts, ??? chance of a strange reward)',
            apply(runState) {
              if (runState.donutsCurrency < 2) return 'You check your pockets. You have nothing to give him. Ralph looks disappointed but not surprised.';
              runState.donutsCurrency -= 2;
              const pool = getRelicShopPool().filter((r) => !runState.relics.includes(r.id));
              if (pool.length && Math.random() < 0.5) {
                const relic = pool[Math.floor(Math.random() * pool.length)];
                runState.relics.push(relic.id);
                return `Ralph eats the whole thing in one bite. "My cat's breath smells like cat food." RALPH'S BLESSING: ${relic.emoji} ${relic.name}. (-2 donuts)`;
              }
              return 'Ralph eats the whole thing in one bite. "My cat\'s breath smells like cat food." Nothing else happens. Probably. (-2 donuts)';
            },
          },
          choiceC: {
            label: 'KEEP MOVING',
            apply() {
              return 'You keep moving. Ralph waves at nothing in particular.';
            },
          },
        },
      };
    },
  },
  wiggumRoadblock: {
    id: 'wiggumRoadblock',
    weight: 2,
    condition: () => true,
    apply() {
      return {
        decision: {
          title: 'SPRINGFIELD POLICE ROADBLOCK',
          speaker: 'Chief Wiggum',
          prompt: '"Road\'s closed. Mostly because I parked sideways."',
          choiceA: {
            label: 'PAY $5 (continue immediately)',
            apply(runState) {
              if (runState.donutsCurrency < 5) return 'You check your pockets. Wiggum shrugs and waves you through anyway, bored. "Eh, go on."';
              runState.donutsCurrency -= 5;
              return 'Wiggum pockets the cash without looking up. "Never happened." (-5 donuts)';
            },
          },
          choiceB: {
            label: 'HELP WIGGUM find his donut',
            apply(runState) {
              runState.donutsCurrency += 3;
              return 'You find his donut under the cruiser in about four seconds. Grateful (and a little embarrassed), he waves you through and hands you a couple of his own. (+3 donuts)';
            },
          },
          choiceC: {
            label: 'TAKE THE DETOUR',
            apply() {
              return 'You backtrack and find another way around. It costs you a few minutes and nothing else.';
            },
          },
        },
      };
    },
  },
  // HELP OTTO leads to real combat (`special: 'combat'`, same convention
  // showInteriorRandomEvent/onInteriorFollowUp already use), and JUMP ON
  // is the one choice in this pass that actually changes the destination
  // -- "the destination should remain the player's destination unless the
  // event explicitly changes it" -- via `redirectTo` on the returned
  // result, read by game.js travelTo. Never rolls when Springfield
  // Elementary is already where the player is headed (redirecting there
  // would be a no-op choice).
  ottoEncounter: {
    id: 'ottoEncounter',
    weight: 2,
    condition: (runState, fromId, toId) => toId !== 'springfieldElementary',
    apply() {
      return {
        decision: {
          title: 'SCHOOL BUS!',
          speaker: 'Otto',
          prompt: 'A school bus barrels down the street, swerving hard. Otto leans out the window: "DUDE! THERE ARE ZOMBIES ON THE BUS!"',
          choiceA: {
            label: 'HELP OTTO (Fight Zombie Students)',
            special: 'combat',
            combatContent: { type: 'combat', enemyIds: ['zombieStudent', 'zombieStudent'], grantRelicId: 'ottosMixtape' },
          },
          choiceB: {
            label: 'JUMP ON (travel to Springfield Elementary immediately)',
            apply() {
              return { text: 'You swing aboard as the doors hiss shut behind you. Otto floors it, still cheering.', redirectTo: 'springfieldElementary' };
            },
          },
          choiceC: {
            label: 'IGNORE',
            apply() {
              return 'The bus roars past, still swerving. You decide this is somebody else\'s problem.';
            },
          },
        },
      };
    },
  },
  comicBookGuyEncounter: {
    id: 'comicBookGuyEncounter',
    weight: 2,
    condition: () => true,
    apply() {
      return {
        decision: {
          title: 'COMIC BOOK GUY',
          speaker: 'Comic Book Guy',
          prompt: '"I have survived many fictional apocalypses. This one is disappointingly derivative." He holds out a single card, face-down.',
          choiceA: {
            label: 'BUY THE MYSTERY CARD ($15, unknown outcome)',
            apply(runState) {
              if (runState.donutsCurrency < 15) return 'You check your pockets. "Hmph. Poverty is the WORST kind of derivative." He pockets the card and shuffles off.';
              runState.donutsCurrency -= 15;
              const roll = Math.random();
              if (roll < 0.4) {
                const pool = getDraftPool(runState.cast).filter(
                  (a) => (a.rarity === RARITY.RARE || a.rarity === RARITY.EPIC) && !runState.abilityDeck.includes(a.id)
                );
                if (pool.length) {
                  const ability = pool[Math.floor(Math.random() * pool.length)];
                  learnAbility(runState, ability);
                  return `He flips the card over. "...huh. Mint condition." ${ability.name.toUpperCase()} learned. (-15 donuts)`;
                }
              }
              if (roll < 0.7) {
                runState.hp = Math.max(1, runState.hp - 10);
                return 'He flips the card over. It\'s cursed. You feel it immediately. "Worst curse ever, honestly." (-10 HP, -15 donuts)';
              }
              return 'He flips the card over. It\'s a 1994 Non-Sport Update Bazooka Joe promo, water-damaged. "...huh. Worthless." (-15 donuts, nothing else happens)';
            },
          },
          choiceB: {
            label: 'NO THANKS',
            apply() {
              return '"Your loss. Worst customer ever." He shrugs and wanders off, muttering about continuity errors.';
            },
          },
        },
      };
    },
  },
  grandpaEncounter: {
    id: 'grandpaEncounter',
    weight: 2,
    condition: () => true,
    apply() {
      return {
        decision: {
          title: 'GRANDPA',
          speaker: 'Grandpa',
          prompt: '"I know exactly how this whole zombie business got started, you know."',
          choiceA: {
            label: 'LISTEN (small chance he actually knows something)',
            apply(runState) {
              // "Keep it SHORT enough not to annoy the player" -- one line
              // either way, no multi-step dialogue.
              if (Math.random() < 0.25) {
                runState.donutsCurrency += 4;
                return 'Grandpa: "...and that\'s how I met a man who later turned into your grandmother. Anyway, it was the mailbox. I\'m almost certain." Somehow, that tip pays off. (+4 donuts)';
              }
              return 'Grandpa: "Now, back in my day, the Army gave us cough drops made of real tobacco..." You nod and keep moving before the story finds a second act.';
            },
          },
          choiceB: {
            label: "HELP GRANDPA HOME (escort him to the Retirement Castle)",
            apply(runState) {
              if (!runState.relics.includes('grandpasWarStory')) runState.relics.push('grandpasWarStory');
              return 'You walk him all the way back to the Retirement Castle. He pats your arm. "You\'re alright, for a... whoever you are." GRANDPA\'S WAR STORY learned.';
            },
          },
          choiceC: {
            label: 'KEEP MOVING',
            apply() {
              return "You keep moving. He waves after you, mid-sentence, about something involving an onion tied to his belt.";
            },
          },
        },
      };
    },
  },
};

// FIX BURNS MANSION MAP POSITION's sibling ask for encounters: "use a
// controlled/random encounter system... implement protection against
// repeated events." Two knobs, both driven by runState so they persist
// across the whole run rather than resetting every hop:
//
// 1. Mayhem-scaled encounter chance (LOW ~22%, MID ~35%, HIGH ~45%,
//    matching data/episodes.js's own MAYHEM_BANDS tiers) -- achieved by
//    solving for whatever 'nothing' weight makes the CURRENT eligible
//    pool (conditions already narrow it a lot early-run) land on that
//    target percentage, rather than 'nothing' staying a flat constant
//    that drifts wildly high or low as more events become eligible.
// 2. A short memory of the last two non-'nothing' event ids
//    (runState.recentTravelEventIds) that halves those events' weight
//    the next time they're eligible -- "if the player just experienced a
//    travel encounter, reduce the chance of another immediately
//    afterward" AND "prevent the same encounter from repeating
//    constantly," without banning a small pool down to nothing.
const RECENT_EVENT_MEMORY = 2;

function targetEncounterChance(mayhem) {
  if (mayhem <= 40) return 0.22;
  if (mayhem <= 80) return 0.35;
  return 0.45;
}

export function rollTravelEvent(runState, fromId, toId) {
  const recent = runState.recentTravelEventIds || [];
  const eligible = Object.values(TRAVEL_EVENTS).filter((e) => e.id !== 'nothing' && e.condition(runState, fromId, toId));
  // Pity/variety: an event seen in the last RECENT_EVENT_MEMORY hops rolls
  // at half weight instead of being banned outright -- still possible
  // (a 2-3 event eligible pool shouldn't ever hard-lock), just less likely
  // to repeat back-to-back.
  const weighted = eligible.map((e) => ({ event: e, weight: recent.includes(e.id) ? e.weight / 2 : e.weight }));
  const nonNothingWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
  const target = targetEncounterChance(runState.mayhem || 0);
  // Solve for the 'nothing' weight that makes THIS pool land on the target
  // chance: nonNothing / (nonNothing + nothingWeight) = target.
  const nothingWeight = nonNothingWeight > 0 ? nonNothingWeight * (1 - target) / target : 1;

  const totalWeight = nonNothingWeight + nothingWeight;
  let roll = Math.random() * totalWeight;
  for (const { event, weight } of weighted) {
    roll -= weight;
    if (roll <= 0) {
      runState.recentTravelEventIds = [event.id, ...recent].slice(0, RECENT_EVENT_MEMORY);
      return event;
    }
  }
  return TRAVEL_EVENTS.nothing;
}
