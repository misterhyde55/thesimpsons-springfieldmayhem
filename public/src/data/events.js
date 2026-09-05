import { shiftRelationship } from '../systems/relationships.js';
import { addTimedBuff } from '../systems/timedBuffs.js';

// Event nodes present a prompt and a small set of options, each with its own
// outcome. `apply(runState)` mutates the run; `resultText` is shown after the
// player picks. Reference an event from a journey node via `eventId`.
export const EVENTS = {
  flandersNeedsHelp: {
    id: 'flandersNeedsHelp',
    title: "Flanders Needs Help",
    emoji: '🏡',
    prompt: 'Ned: "Homer! My tool shed\'s gone all poltergeist on me. Help a neighborino out?"',
    options: [
      {
        id: 'help',
        label: 'Help Flanders',
        resultText: "You wrestle a haunted lawnmower into submission. Ned slips you a donut for the trouble.",
        apply(runState) {
          shiftRelationship(runState, 'flanders', 1);
          runState.stats.donutsEaten += 0;
          runState.donutsCurrency += 1;
        },
      },
      {
        id: 'ignore',
        label: "Nah, not today",
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
        resultText: "Snake backs off, but not before clipping you with a tire iron.",
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
        resultText: 'You inhale a donut the size of a tire. Sugar shock hits like a truck, but so does the rush.',
        apply(runState) {
          addTimedBuff(runState, 'damageMult', 0.5, 6000);
          addTimedBuff(runState, 'speedMult', -0.3, 6000);
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
};

export function getEvent(eventId) {
  return EVENTS[eventId];
}
