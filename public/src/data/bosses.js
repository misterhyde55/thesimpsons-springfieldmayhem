import { DEVIL_DEALS } from './devilDeals.js';

// Turn-based bosses. `phases` swap the enemy's intent pool at HP thresholds
// (see systems/enemyAI.js) so a fight visibly escalates. `intro` is shown on
// the dramatic boss-intro screen before the fight starts. A phase's
// optional `name` shows in the "BOSS -- PHASE N -- NAME" readout
// (ui/screens.js bossPhaseInfo) -- every other boss below leaves it off and
// just gets the plain numbered label.
export const BOSSES = {
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
