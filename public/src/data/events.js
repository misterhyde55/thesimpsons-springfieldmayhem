import { shiftRelationship } from '../systems/relationships.js';
import { setCallbackFlag } from '../systems/callbackEngine.js';
import { getRelicShopPool } from './relics.js';

// Event nodes present a prompt and a small set of options, each with its own
// outcome. `apply(runState)` mutates the run; `resultText` is shown after
// the player picks -- some outcomes are deliberately not previewable before
// choosing (glowingDonut), which is the point: the game never tells you
// what "EAT IT" does ahead of time.
export const EVENTS = {
  flandersNeedsHelp: {
    id: 'flandersNeedsHelp',
    title: 'Flanders Needs Help',
    emoji: '🏡',
    npcId: 'flanders',
    prompt: 'Ned: "Homer! My tool shed\'s gone all poltergeist on me. Help a neighborino out?"',
    options: [
      {
        id: 'help',
        label: 'Help Flanders',
        resultText: 'You wrestle a haunted lawnmower into submission. Ned slips you a donut for the trouble.',
        apply(runState) {
          shiftRelationship(runState, 'flanders', 1);
          runState.donutsCurrency += 1;
        },
      },
      {
        id: 'ignore',
        label: 'Nah, not today',
        resultText: "You walk away. Ned's muffled hollering fades behind you.",
        apply(runState) {
          shiftRelationship(runState, 'flanders', -1);
        },
      },
    ],
  },
  snakesShakedown: {
    id: 'snakesShakedown',
    title: "Snake's Shakedown",
    emoji: '🚬',
    prompt: 'Snake: "Nice donuts. Be a shame if something happened to \'em. Hand \'em over?"',
    options: [
      {
        id: 'pay',
        label: 'Hand over 2 donuts',
        resultText: 'Snake peels off, mildly satisfied. Probably for the best.',
        apply(runState) {
          runState.donutsCurrency = Math.max(0, runState.donutsCurrency - 2);
        },
      },
      {
        id: 'fight',
        label: 'Stand your ground',
        resultText: 'Snake backs off, but not before clipping you with a tire iron.',
        apply(runState) {
          runState.hp = Math.max(1, runState.hp - 15);
        },
      },
    ],
  },
  lardLadDare: {
    id: 'lardLadDare',
    title: 'The Lard Lad Dare',
    emoji: '🍩',
    prompt: 'A dare-devil kid bets you can\'t eat the entire 50-pound Lard Lad donut statue prop in one bite.',
    options: [
      {
        id: 'dare',
        label: 'DO IT',
        resultText: 'You inhale a donut the size of a tire. Sugar shock hits like a truck, but so does the rush. +5 max HP, -10 HP now.',
        apply(runState) {
          runState.maxHp += 5;
          runState.hp = Math.max(1, runState.hp - 10);
        },
      },
      {
        id: 'decline',
        label: 'Absolutely not',
        resultText: 'You keep your dignity and your stomach lining intact.',
        apply() {},
      },
    ],
  },
  glowingDonut: {
    id: 'glowingDonut',
    title: 'A Glowing Donut',
    emoji: '🍩',
    prompt: 'A donut sits glowing faintly in a puddle of something radioactive. What does Homer do?',
    options: [
      {
        id: 'eat',
        label: 'EAT IT',
        // No static resultText -- apply() returns the line to show, decided
        // only once the player has already committed to eating it.
        apply(runState) {
          const lucky = Math.random() < 0.5;
          if (lucky) {
            runState.maxHp += 20;
            runState.hp += 20;
            return 'It tastes like victory and mild radiation poisoning. +20 max HP.';
          }
          runState.hp = Math.max(1, runState.hp - 25);
          return 'Bad. Very bad. That was a mistake. -25 HP.';
        },
      },
      {
        id: 'take',
        label: 'TAKE IT (for later)',
        apply(runState) {
          const pool = getRelicShopPool().filter((r) => !runState.relics.includes(r.id));
          if (pool.length === 0) return 'You pocket it. Nothing else happens.';
          const relic = pool[Math.floor(Math.random() * pool.length)];
          runState.relics.push(relic.id);
          return `You pocket it for later. Somehow it turns into: ${relic.emoji} ${relic.name}.`;
        },
      },
      {
        id: 'leave',
        label: 'LEAVE',
        resultText: 'Nothing happens. Probably wise.',
        apply() {},
      },
    ],
  },
  kwikEMartRobbery: {
    id: 'kwikEMartRobbery',
    title: 'Kwik-E-Mart Robbery',
    emoji: '🏪',
    npcId: 'apu',
    prompt: 'You duck into the Kwik-E-Mart for supplies. Snake is robbing the place mid-outbreak. Apu looks terrified.',
    options: [
      {
        id: 'fight',
        label: 'Fight Snake',
        resultText: 'Snake bolts, dropping a fistful of donut currency.',
        apply(runState) {
          runState.donutsCurrency += 3;
        },
      },
      {
        id: 'steal',
        label: 'Steal a Squishee during the robbery',
        resultText: 'You grab a Squishee mid-chaos and heal up. Apu will remember this.',
        apply(runState) {
          runState.hp = Math.min(runState.maxHp, runState.hp + 15);
          shiftRelationship(runState, 'apu', -2);
        },
      },
      {
        id: 'hide',
        label: 'Hide behind the counter',
        resultText: 'You avoid the chaos entirely. Your dignity does not survive.',
        apply() {},
      },
    ],
  },
  mysteriousButton: {
    id: 'mysteriousButton',
    title: 'A Mysterious Button',
    emoji: '🔴',
    prompt: 'Behind a loose panel in the hallway, there is a single, unlabeled red button.',
    options: [
      {
        id: 'press',
        label: 'PRESS IT',
        resultText: 'Nothing happens. You continue on, slightly disappointed. (Or so it seems.)',
        apply(runState) {
          setCallbackFlag(runState, 'pressedButton');
        },
      },
      {
        id: 'leave',
        label: 'Leave it alone',
        resultText: "That's probably the smart choice. You'll never know.",
        apply() {},
      },
    ],
  },
  strangeLights: {
    id: 'strangeLights',
    title: 'Strange Lights',
    emoji: '🛸',
    prompt: 'Marge points at the sky. Something is up there, and it is not a weather balloon.',
    options: [
      {
        id: 'investigate',
        label: 'Go investigate',
        resultText: 'You get a closer look than you wanted. Something has definitely noticed you now.',
        apply(runState) {
          runState.donutsCurrency += 1;
        },
      },
      {
        id: 'hide',
        label: 'Get everyone inside',
        resultText: 'You lock the doors. It does not feel like it will help.',
        apply() {},
      },
    ],
  },
  milhouseTrustTest: {
    id: 'milhouseTrustTest',
    title: 'Milhouse Appears',
    emoji: '🤓',
    npcId: 'milhouse',
    prompt: 'Milhouse: "Homer! I saw the UFO! It probed me! Well -- it looked at me weird. Can I come with you?"',
    options: [
      {
        id: 'join',
        label: 'Let Milhouse join',
        resultText: 'MILHOUSE HAS JOINED THE EPISODE. Probably fine. Probably.',
        apply(runState) {
          if (!runState.cast.includes('milhouse')) runState.cast.push('milhouse');
        },
      },
      {
        id: 'question',
        label: 'Question him first',
        resultText: 'He answers every question correctly. Suspiciously correctly. You let him tag along anyway.',
        apply(runState) {
          if (!runState.cast.includes('milhouse')) runState.cast.push('milhouse');
        },
      },
      {
        id: 'attack',
        label: 'Attack him, just in case',
        resultText: "It's really just Milhouse. He's crying now. He will not be joining you.",
        apply(runState) {
          runState.hp = Math.max(1, runState.hp - 5);
        },
      },
      {
        id: 'leave',
        label: 'Leave him behind',
        resultText: 'You walk away. Milhouse watches you go, betrayed.',
        apply() {},
      },
    ],
  },
  // ---- Map expansion events: each gives its location a reason to visit
  // beyond "another fight" -- see data/journeys.js for which segments use
  // which, and data/locations.js for the flavor these pair with.
  policeEvidenceRoom: {
    id: 'policeEvidenceRoom',
    title: 'The Evidence Room',
    emoji: '🚓',
    npcId: 'chiefWiggum',
    prompt: 'Chief Wiggum: "The evidence room\'s a disaster zone. I\'d ask Lou, but... Lou\'s not really Lou anymore. Give me a hand?"',
    options: [
      {
        id: 'help',
        label: 'Help him sort it out',
        resultText: 'Buried under a decade of unfiled parking tickets, you find a stash of confiscated donut money.',
        apply(runState) {
          runState.donutsCurrency += 4;
        },
      },
      {
        id: 'pocket',
        label: 'Pocket some evidence instead',
        resultText: 'Wiggum doesn\'t notice. Wiggum rarely notices.',
        apply(runState) {
          runState.donutsCurrency += 2;
        },
      },
      {
        id: 'leave',
        label: 'Not your problem',
        resultText: 'You leave Wiggum to it. He salutes you for no reason.',
        apply() {},
      },
    ],
  },
  krustyBurgerCombo: {
    id: 'krustyBurgerCombo',
    title: 'The Clown Combo',
    emoji: '🍔',
    npcId: 'krusty',
    prompt: 'Krusty: "Kid, the grill\'s barely running, but I got SOMETHING back there. You want the special?"',
    options: [
      {
        id: 'eatSpecial',
        label: 'Eat the Special (free)',
        apply(runState) {
          const lucky = Math.random() < 0.6;
          if (lucky) {
            runState.hp = Math.min(runState.maxHp, runState.hp + 22);
            return 'Surprisingly decent. (+22 HP)';
          }
          runState.hp = Math.max(1, runState.hp - 10);
          runState.infection = (runState.infection || 0) + 1;
          return "You immediately regret it. Krusty brand quality control was never great, even before the apocalypse. (-10 HP, +1 Infection)";
        },
      },
      {
        id: 'payForReal',
        label: 'Pay for something that isn\'t expired (2 donuts)',
        resultText: 'Krusty finds you an unopened box. It\'s fine. Genuinely fine.',
        apply(runState) {
          if (runState.donutsCurrency < 2) return;
          runState.donutsCurrency -= 2;
          runState.hp = Math.min(runState.maxHp, runState.hp + 25);
        },
      },
      {
        id: 'pass',
        label: "I'll pass",
        resultText: 'Wise. Krusty nods, mildly offended.',
        apply() {},
      },
    ],
  },
  androidsDungeonGamble: {
    id: 'androidsDungeonGamble',
    title: 'The Mystery Longbox',
    emoji: '💾',
    npcId: 'comicBookGuy',
    prompt: 'Comic Book Guy: "For 4 donuts, one mystery longbox. Contents unknown. Refunds: never."',
    options: [
      {
        id: 'buy',
        label: 'Buy the longbox (4 donuts)',
        apply(runState) {
          if (runState.donutsCurrency < 4) return "You don't have 4 donuts. Comic Book Guy is unmoved.";
          runState.donutsCurrency -= 4;
          const pool = getRelicShopPool().filter((r) => !runState.relics.includes(r.id));
          if (!pool.length) return 'The box is empty. "Worst purchase ever," he agrees.';
          const relic = pool[Math.floor(Math.random() * pool.length)];
          runState.relics.push(relic.id);
          return `Inside: ${relic.emoji} ${relic.name}. "Mint condition. Was."`;
        },
      },
      {
        id: 'browse',
        label: 'Just browse',
        resultText: 'You flip through decades of unsold inventory. None of it helps you right now.',
        apply() {},
      },
    ],
  },
  bowlaramaFrame: {
    id: 'bowlaramaFrame',
    title: 'One Frame',
    emoji: '🎳',
    prompt: 'The lanes are dead quiet. One ball return still works. Might as well.',
    options: [
      {
        id: 'bowl',
        label: 'BOWL A FRAME',
        apply(runState) {
          const strike = Math.random() < 0.5;
          if (strike) {
            runState.maxHp += 8;
            runState.hp += 8;
            return 'STRIKE! Somewhere, deep down, this feels important. (+8 max HP)';
          }
          runState.hp = Math.max(1, runState.hp - 6);
          return 'The ball bounces back out of the gutter and clips your shin on the return. (-6 HP)';
        },
      },
      {
        id: 'skip',
        label: 'Not in the mood',
        resultText: 'You leave the ball spinning in the gutter, forever.',
        apply() {},
      },
    ],
  },
  grampasStory: {
    id: 'grampasStory',
    title: "Grampa's Story",
    emoji: '🧓',
    npcId: 'grampa',
    prompt: 'Grampa: "Sit down, sit down. Didja ever hear about the time I fought a corpse in the war? All of the wars?"',
    options: [
      {
        id: 'listen',
        label: 'Listen to the whole thing',
        resultText: 'It goes nowhere and takes forever, but somewhere in there is real, hard-won advice. You feel better. (+18 HP)',
        apply(runState) {
          runState.hp = Math.min(runState.maxHp, runState.hp + 18);
        },
      },
      {
        id: 'cutOff',
        label: 'Politely cut him off',
        resultText: 'Grampa looks wounded, then immediately forgets why.',
        apply() {},
      },
    ],
  },
  hospitalTriage: {
    id: 'hospitalTriage',
    title: 'Triage',
    emoji: '🏥',
    npcId: 'drHibbert',
    prompt: 'Dr. Hibbert: "I can patch you up properly, Homer, but the hospital isn\'t exactly running on donations right now."',
    options: [
      {
        id: 'payFull',
        label: 'Pay for real treatment (3 donuts)',
        apply(runState) {
          if (runState.donutsCurrency < 3) return "You don't have 3 donuts. Dr. Hibbert offers you a lollipop instead. It does not help.";
          runState.donutsCurrency -= 3;
          runState.hp = runState.maxHp;
          runState.infection = Math.max(0, (runState.infection || 0) - 4);
          return 'A real doctor, real bandages, real everything. Fully healed, Infection reduced. (Heh heh.)';
        },
      },
      {
        id: 'waitingRoom',
        label: 'Wait in the waiting room (free)',
        resultText: 'Three hours pass in a plastic chair. You feel slightly better and deeply bored. (+10 HP)',
        apply(runState) {
          runState.hp = Math.min(runState.maxHp, runState.hp + 10);
        },
      },
    ],
  },
  churchConfession: {
    id: 'churchConfession',
    title: 'Confession',
    emoji: '⛪',
    npcId: 'lovejoy',
    prompt: 'Reverend Lovejoy: "Homer. In all my years, I have never seen Springfield like this. Have you got something to confess?"',
    options: [
      {
        id: 'confess',
        label: 'Confess everything',
        resultText: 'It doesn\'t fix anything. It just makes the next part slightly easier to carry. (Mayhem -5)',
        apply(runState) {
          runState.mayhem = Math.max(0, runState.mayhem - 5);
        },
      },
      {
        id: 'sitQuietly',
        label: 'Just sit quietly for a while',
        resultText: 'The pews are empty. The quiet helps more than you\'d expect. (+12 HP)',
        apply(runState) {
          runState.hp = Math.min(runState.maxHp, runState.hp + 12);
        },
      },
      {
        id: 'leaveChurch',
        label: 'Leave. This isn\'t the time.',
        resultText: 'Lovejoy watches you go, looking more worried than you\'ve ever seen him.',
        apply() {},
      },
    ],
  },
};

export function getEvent(eventId) {
  return EVENTS[eventId];
}
