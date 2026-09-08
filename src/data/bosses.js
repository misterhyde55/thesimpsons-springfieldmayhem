import { DEVIL_DEALS } from './devilDeals.js';
import { STATUS } from './statusEffects.js';
import { gainArmor, addStatus, applyIncomingDamage } from '../systems/statusEngine.js';
import { RELICS } from './relics.js';
import { ITEMS } from './items.js';

// Turn-based bosses. `phases` swap the enemy's intent pool at HP thresholds
// (see systems/enemyAI.js) so a fight visibly escalates. `intro` is shown on
// the dramatic boss-intro screen before the fight starts. A phase's
// optional `name` shows in the "BOSS -- PHASE N -- NAME" readout
// (ui/screens.js bossPhaseInfo) -- every other boss below leaves it off and
// just gets the plain numbered label.
export const BOSSES = {
  // ---- Homer vs. Zombie Ned, Flanders House (Segment I) ----
  // The combat-redesign prototype encounter: every mechanic below exists
  // to make THIS fight specifically good, not to be a template every other
  // enemy copies wholesale -- future enemies should reuse the underlying
  // systems (interruptible intents, Break, onPlayerAbility reactions,
  // checkMidFightEvent, onPhaseChange) with their OWN personality, the way
  // Devil Ned's 'deal' intents already do for a completely different
  // problem (a mid-combat choice, not a reaction to how you're fighting).
  zombieNed: {
    id: 'zombieNed',
    name: 'Zombie Ned',
    emoji: '🧟',
    hp: 90,
    breakMax: 18,
    subtitle: 'OKILLY DOKILLY',
    intro: 'Ned Flanders shambles out from behind the hedge, still smiling. "Hi-diddly-ho, Homer... I could just eat you up."',
    // Forgiveness: every 3rd Attack (target:'enemy') play landed on Ned
    // specifically grants him Armor -- mindlessly mashing Attack becomes
    // inefficient, so the fight rewards mixing in Skills/environment
    // objects instead. Uses the generic per-enemy onPlayerAbility hook
    // (battleEngine.js playAbility/playEnvironmentAction), fired for every
    // played card/environment action regardless of who it targeted.
    onPlayerAbility(battle, runState, enemy, ability, targetEnemy) {
      if (targetEnemy !== enemy || ability.target !== 'enemy') return;
      enemy.forgivenessCount = (enemy.forgivenessCount || 0) + 1;
      if (enemy.forgivenessCount % 3 === 0) {
        gainArmor(enemy, 8);
        battle.flags.forgivenessTriggered = (battle.flags.forgivenessTriggered || 0) + 1;
      }
    },
    // Rod & Todd, mid-fight: fires once, the first time Ned drops to half
    // HP (checked from game.js after any damaging play -- see
    // checkMidFightEvent call sites). Reuses the exact showChoiceModal
    // shape Devil Ned's 'deal' intents already use for "pause combat for a
    // real decision," just triggered by an HP threshold instead of an
    // intent roll.
    checkMidFightEvent(battle, runState, enemy) {
      if (battle.flags.rodAndToddChecked) return null;
      if (enemy.hp / enemy.maxHp > 0.5) return null;
      battle.flags.rodAndToddChecked = true;
      return {
        title: 'A MUFFLED VOICE',
        icon: 'horror',
        speaker: 'ROD & TODD',
        prompt: '"Help! We\'re stuck in here!" A door rattles somewhere behind Ned -- the boys are trapped inside the house.',
        choiceA: {
          id: 'rescue',
          category: 'risk',
          tone: 'danger',
          label: 'RESCUE ROD & TODD',
          description: 'Break away from the fight and kick the door in.',
          cost: 'This turn',
          danger: 2,
          warnings: ['Ned gets a free hit in the confusion (~10-16 dmg)'],
          effects: ['Rod & Todd rescued -- may pay off later'],
          apply(rs, b) {
            const dmg = 10 + Math.floor(Math.random() * 7);
            const { dealt } = applyIncomingDamage(b.player, dmg);
            b.flags.rodAndToddSaved = true;
            return {
              text: 'You kick down the door and pull the boys to safety. Ned gets a free swing in the confusion.',
              effects: ['ROD & TODD RESCUED', `HOMER -${dealt} HP`, 'ZOMBIE NED ACTS FREE', 'CALLBACK FLAG ADDED'],
            };
          },
        },
        choiceB: {
          id: 'ignore',
          category: 'escape',
          tone: 'safe',
          label: 'KEEP FIGHTING',
          description: "You can't risk it right now. Stay focused on Ned.",
          danger: 1,
          effects: ['No immediate cost'],
          warnings: ['The voice fades -- this chance may not come back'],
          apply(rs, b) {
            b.flags.rodAndToddSaved = false;
            return {
              text: "You can't risk it right now. The voice fades. Maybe later.",
              effects: ['ROD & TODD LEFT BEHIND', 'CALLBACK FLAG ADDED'],
            };
          },
        },
      };
    },
    // "Ned Snaps" -- entering Phase 2, he loses his composure (and his
    // guard): reuses the existing Vulnerable status rather than inventing a
    // bespoke "lower defense" number, so it reads on the same status pip the
    // player already understands.
    onPhaseChange(battle, runState, enemy, phaseIndex) {
      if (phaseIndex === 1) addStatus(enemy, STATUS.VULNERABLE, 3);
    },
    // A fixed 4-step `pattern` per phase instead of a weighted `intents`
    // pool (REDESIGN COMBAT: "give him an actual pattern... this gives
    // players something to learn") -- enemyAI.js's rollIntent cycles through
    // it by enemy.turnsInPhase, always restarting at step 0 the moment a
    // fresh phase begins (battleEngine.js checkPhaseTransition resets the
    // counter). Phase 2 kicks in at the same 50% HP line
    // checkMidFightEvent above already uses for Rod & Todd, so the "Ned
    // snaps" moment and their rescue land together. A pattern step's
    // optional `dialogue` surfaces once per lap (see game.js
    // animateEnemyActions) -- personality without nagging every turn.
    phases: [
      {
        minHpPct: 0.5,
        name: 'OKILLY DOKILLY',
        pattern: [
          { type: 'attack', value: 10, label: 'Righteous Swipe', icon: '🧟', dialogue: 'Hi-diddly-ho, Homer! This is gonna hurt me more than it hurts you. Probably.' },
          { type: 'infect', value: 3, label: 'Holy Hunger', icon: '☣️' },
          { type: 'defend', value: 10, label: 'Barricade', icon: '🛡️' },
          { type: 'summon', value: 1, summonId: 'zombieBarfly', label: 'Neighborly Backup', icon: '📣' },
        ],
      },
      {
        minHpPct: 0,
        name: 'UNHOLY NEIGHBOR',
        transitionLine: 'Okie dokie...',
        pattern: [
          { type: 'attackTwice', value: 16, label: 'Frenzy', icon: '😡', dialogue: "Brains, neighborino... so many brains." },
          { type: 'prayer', value: 12, label: 'Holy Hunger', icon: '🙏', interruptible: true, interruptThreshold: 15 },
          { type: 'weaken', value: 2, label: 'Unholy Sermon', icon: '📖' },
          { type: 'attack', value: 18, label: 'Final Bite', icon: '🦷', dialogue: "Let's pray... FOR YOUR DEATH!" },
        ],
      },
    ],
  },
  zombieSkinner: {
    id: 'zombieSkinner',
    name: 'Zombie Principal Skinner',
    emoji: '🧟‍♂️',
    hp: 140,
    subtitle: 'THE DETENTION FROM HELL',
    intro: '"DEEETENTIOOOON," moans the thing that used to be Principal Skinner.',
    phases: [
      {
        minHpPct: 0.5,
        intents: [
          { type: 'attack', value: 16, weight: 45, label: 'Attack', icon: '🩸' },
          { type: 'defend', value: 20, weight: 30, label: 'Defend', icon: '🛡️' },
          { type: 'infect', value: 3, weight: 25, label: 'Detention Slap', icon: '☣️' },
        ],
      },
      {
        minHpPct: 0,
        intents: [
          { type: 'attack', value: 22, weight: 40, label: 'Attack', icon: '🩸' },
          { type: 'infect', value: 6, weight: 35, label: 'Infect', icon: '☣️' },
          { type: 'buff', value: 6, weight: 25, label: 'Enrage', icon: '💪' },
        ],
      },
    ],
  },
  kodos: {
    id: 'kodos',
    name: 'Kodos',
    emoji: '👽',
    hp: 150,
    subtitle: 'THE PROBE FROM RIGEL 7',
    intro: '"Do not be alarmed, Earthlings. It is only mostly hopeless."',
    phases: [
      {
        minHpPct: 0.5,
        intents: [
          { type: 'attack', value: 17, weight: 40, label: 'Ray Blast', icon: '⚡' },
          { type: 'phase', value: 2, weight: 35, label: 'Phase Out', icon: '👽' },
          { type: 'defend', value: 18, weight: 25, label: 'Shield', icon: '🛡️' },
        ],
      },
      {
        minHpPct: 0,
        intents: [
          { type: 'attack', value: 24, weight: 45, label: 'Ray Blast', icon: '⚡' },
          { type: 'phase', value: 3, weight: 30, label: 'Phase Out', icon: '👽' },
          { type: 'buff', value: 6, weight: 25, label: 'Overcharge', icon: '💪' },
        ],
      },
    ],
  },
  // Segment III finale -- Kang & Kodos, empowered by whatever else is still
  // active by the time the player reaches them (see game.js's boss intro
  // line, which lists the currently-stacked Horror Rules).
  kangKodos: {
    id: 'kangKodos',
    name: 'Kang & Kodos',
    emoji: '👽',
    hp: 220,
    subtitle: 'THE END OF THE EPISODE',
    intro: '"Your Earth music has poisoned your simple minds. Now feel our wrath!"',
    phases: [
      {
        minHpPct: 0.65,
        intents: [
          { type: 'attack', value: 20, weight: 35, label: 'Twin Blast', icon: '⚡' },
          { type: 'infect', value: 5, weight: 25, label: 'Infect', icon: '☣️' },
          { type: 'phase', value: 2, weight: 20, label: 'Phase Out', icon: '👽' },
          { type: 'defend', value: 20, weight: 20, label: 'Shield', icon: '🛡️' },
        ],
      },
      {
        minHpPct: 0.3,
        intents: [
          { type: 'attack', value: 26, weight: 35, label: 'Twin Blast', icon: '⚡' },
          { type: 'infect', value: 7, weight: 30, label: 'Infect', icon: '☣️' },
          { type: 'buff', value: 8, weight: 20, label: 'Overcharge', icon: '💪' },
          { type: 'phase', value: 3, weight: 15, label: 'Phase Out', icon: '👽' },
        ],
      },
      {
        minHpPct: 0,
        intents: [
          { type: 'attackTwice', value: 24, weight: 45, label: 'Barrage', icon: '⚡' },
          { type: 'infect', value: 10, weight: 30, label: 'Infect', icon: '☣️' },
          { type: 'buff', value: 10, weight: 25, label: 'Overcharge', icon: '💪' },
        ],
      },
    ],
  },
  // Optional secret boss (Priority 4). Discovered via a Cursed Donut event
  // (data/events.js), revealed several locations later through the
  // 'devilNedAppears' CALLBACK (data/callbacks.js, data/treehouseScenes.js),
  // fought at a corrupted First Church of Springfield (data/journeys.js's
  // getLocationContent override). Explicitly NOT a damage sponge: each
  // phase changes what the fight IS, not just how hard it hits -- 'deal'
  // intents (see systems/enemyAI.js) pause combat for a real choice instead
  // of resolving like a normal attack.
  devilNed: {
    id: 'devilNed',
    name: 'Devil Ned',
    emoji: '😈',
    hp: 130,
    subtitle: 'THE DEVIL YOU KNOW — OPTIONAL BOSS',
    intro: 'Devil Ned: "Hi-diddly-ho, Homer. I believe you owe me a donut. Or your soul. Whichever\'s worth more today."',
    phases: [
      {
        minHpPct: 0.65,
        name: 'TEMPTATION',
        intents: [
          { type: 'attack', value: 10, weight: 40, label: 'Pitchfork Jab', icon: '🔱' },
          { type: 'defend', value: 10, weight: 20, label: 'Fireproof Hide', icon: '🛡️' },
          { type: 'deal', value: 0, weight: 40, label: 'Makes You An Offer', icon: '🤝', deal: DEVIL_DEALS.temptationMaxHp },
        ],
      },
      {
        minHpPct: 0.25,
        name: 'HELLFIRE',
        intents: [
          { type: 'attack', value: 16, weight: 30, label: 'Hellfire', icon: '🔥' },
          { type: 'infect', value: 8, weight: 25, label: 'Curse', icon: '☠️' },
          { type: 'steal', value: 6, weight: 20, label: 'Soul Tax', icon: '💰' },
          { type: 'summon', value: 0, weight: 25, label: 'Summon Demon', icon: '👹', summonId: 'demonImp' },
        ],
      },
      {
        minHpPct: 0,
        name: 'THE CONTRACT',
        intents: [
          { type: 'attack', value: 20, weight: 60, label: 'Final Pitchfork', icon: '🔱' },
          { type: 'deal', value: 0, weight: 40, label: 'The Contract', icon: '📜', deal: DEVIL_DEALS.finalContract },
        ],
      },
    ],
  },
};

// Zombie Ned's post-victory reward choice (game.js's onBattleVictory,
// after the ENCOUNTER COMPLETE summary). Same shape as DEVIL_DEALS --
// {title, prompt, choiceA/choiceB, each {label, apply(runState) => resultText}}
// -- so it goes through the same generic ui/screens.js showChoiceModal.
export const ZOMBIE_NED_REWARD = {
  id: 'zombieNedReward',
  title: 'A NEIGHBORLY SPOILS',
  prompt: 'Ned finally falls still. Something of his is worth taking. Pick one, Homer.',
  choiceA: {
    label: '🥊 LEFT-HANDED UPPERCUT (New Ability)',
    apply(runState) {
      if (!runState.abilityDeck.includes('leftHandedUppercut')) runState.abilityDeck.push('leftHandedUppercut');
      return 'You learn a dirty trick. LEFT-HANDED UPPERCUT JOINS YOUR ABILITIES.';
    },
  },
  choiceB: {
    label: `${RELICS.neighborlyShield.emoji} ${RELICS.neighborlyShield.name.toUpperCase()} (Relic)`,
    apply(runState) {
      if (!runState.relics.includes('neighborlyShield')) runState.relics.push('neighborlyShield');
      return `You take Ned's garden shield off the fence. ${RELICS.neighborlyShield.name.toUpperCase()} JOINS YOUR RELICS.`;
    },
  },
  choiceC: {
    label: `${ITEMS.flandersFirstAidKit.emoji} ${ITEMS.flandersFirstAidKit.name.toUpperCase()} (Item)`,
    apply(runState) {
      runState.consumables.flandersFirstAidKit = (runState.consumables.flandersFirstAidKit || 0) + 1;
      return `You grab a first aid kit off his shelf. ${ITEMS.flandersFirstAidKit.name.toUpperCase()} JOINS YOUR ITEMS.`;
    },
  },
};
