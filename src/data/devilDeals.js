import { STATUS } from './statusEffects.js';
import { addStatus } from '../systems/statusEngine.js';
import { RELICS } from './relics.js';
import { ITEMS } from './items.js';

// Devil Ned's mid-combat "deal" offers (Phase 1 TEMPTATION, Phase 3 THE
// CONTRACT -- see data/bosses.js devilNed) and his post-victory reward
// choice. All three share one shape -- {title, prompt, choiceA, choiceB},
// each choice {label, apply(runState, battle) => resultText} -- so they all
// go through the same generic ui/screens.js showChoiceModal, whether it's
// framed as accept/refuse or as picking a reward.
export const DEVIL_DEALS = {
  temptationMaxHp: {
    id: 'temptationMaxHp',
    title: 'TEMPTATION',
    prompt: 'Devil Ned: "I\'ll make this simple, Homer. Give me 20 Max HP, and I\'ll make this fight a whole lot easier on you."',
    choiceA: {
      label: 'ACCEPT (-20 Max HP)',
      apply(runState, battle) {
        runState.maxHp = Math.max(20, runState.maxHp - 20);
        runState.hp = Math.min(runState.hp, runState.maxHp);
        battle.player.maxHp = runState.maxHp;
        battle.player.hp = runState.hp;
        addStatus(battle.enemies[0], STATUS.WEAK, 3);
        return 'Devil Ned grins. "Pleasure doing business." He seems slightly less dangerous now. (-20 Max HP, Devil Ned Weakened)';
      },
    },
    choiceB: {
      label: 'REFUSE',
      apply() {
        return 'Devil Ned shrugs. "Your loss." Nothing happens. Yet.';
      },
    },
  },
  finalContract: {
    id: 'finalContract',
    title: 'THE CONTRACT',
    prompt: 'Devil Ned: "Last offer, Homer. Give me Moe Szyslak\'s soul, and this all ends right now. Your choice."',
    choiceA: {
      label: 'GIVE UP MOE',
      apply(runState, battle) {
        runState.cast = runState.cast.filter((id) => id !== 'moe');
        runState.world.locationFlags.moeIsDead = true;
        if (!runState.relics.includes('devilsPitchfork')) runState.relics.push('devilsPitchfork');
        battle.outcome = 'victory';
        battle.flags.dealWinReason = 'gaveUpMoe';
        return 'Devil Ned smiles wide. "Pleasure, as always." Moe is gone. Somewhere, a bar goes quiet forever. THE DEVIL\'S PITCHFORK IS YOURS.';
      },
    },
    choiceB: {
      label: 'REFUSE',
      apply() {
        return 'Devil Ned: "Suit yourself, Homer. The hard way it is."';
      },
    },
  },
  victoryReward: {
    id: 'devilNedReward',
    title: 'HIS FINAL GIFT',
    prompt: 'Devil Ned dissolves into ash and sulfur. Something of his is left behind. Take your pick, Homer.',
    choiceA: {
      label: `${RELICS.devilsPitchfork.emoji} DEVIL'S PITCHFORK`,
      apply(runState) {
        if (!runState.relics.includes('devilsPitchfork')) runState.relics.push('devilsPitchfork');
        return "You take the pitchfork. It's warm to the touch. THE DEVIL'S PITCHFORK JOINS YOUR RELICS.";
      },
    },
    choiceB: {
      label: `${ITEMS.forbiddenDonut.emoji} FORBIDDEN DONUT`,
      apply(runState) {
        ITEMS.forbiddenDonut.apply(runState);
        return 'You eat the Forbidden Donut immediately. That was probably supposed to be savored. FORBIDDEN POWER COURSES THROUGH YOU.';
      },
    },
  },
};
