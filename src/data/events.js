import { shiftRelationship } from '../systems/relationships.js';
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
};

export function getEvent(eventId) {
  return EVENTS[eventId];
}
