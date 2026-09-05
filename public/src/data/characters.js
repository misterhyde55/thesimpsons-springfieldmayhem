// Each character is a roguelike "class" with their own journey (data/journeys.js)
// and starter ability deck (data/abilities.js) through Springfield. Only
// Homer has a built journey/ability kit right now; the rest are registered
// so unlocking one later is a data + journey + ability-set addition, not a
// rewrite of the battle engine.
export const CHARACTERS = {
  homer: {
    id: 'homer',
    name: 'Homer Simpson',
    unlocked: true,
    maxHp: 150,
    emoji: '🍩',
    tagline: 'Tank / Food / Nuclear / Rage.',
    healthLabel: 'High',
    speedLabel: 'Slow',
    primaryAbility: 'Haymaker — a solid punch to start',
    specialPassive: 'Builds around food, Duff, radiation, bowling, or rage.',
    difficulty: 'Easy',
  },
  bart: {
    id: 'bart',
    name: 'Bart Simpson',
    unlocked: false,
    maxHp: 85,
    emoji: '🛹',
    tagline: 'Speed / Tricks / Ranged. Coming soon.',
    healthLabel: 'Low',
    speedLabel: 'Very Fast',
    primaryAbility: 'Slingshot — precision ranged attacks',
    specialPassive: 'Skateboard combos and traps.',
    difficulty: 'Hard',
  },
  lisa: {
    id: 'lisa',
    name: 'Lisa Simpson',
    unlocked: false,
    maxHp: 90,
    emoji: '🎷',
    tagline: 'Intelligence / Status Effects. Coming soon.',
    healthLabel: 'Low',
    speedLabel: 'Medium',
    primaryAbility: 'Saxophone — damaging sound waves',
    specialPassive: 'Manipulates enemy intents.',
    difficulty: 'Medium',
  },
  marge: {
    id: 'marge',
    name: 'Marge Simpson',
    unlocked: false,
    maxHp: 110,
    emoji: '🧹',
    tagline: 'Control / Defense. Coming soon.',
    healthLabel: 'Medium',
    speedLabel: 'Medium',
    primaryAbility: 'Frying Pan — wide crowd control',
    specialPassive: 'Tougher the lower her health gets.',
    difficulty: 'Medium',
  },
  maggie: {
    id: 'maggie',
    name: 'Maggie Simpson',
    unlocked: false,
    secret: true,
    maxHp: 60,
    emoji: '👶',
    tagline: 'Secret character. ???',
    healthLabel: '???',
    speedLabel: '???',
    primaryAbility: '???',
    specialPassive: '???',
    difficulty: '???',
  },
};

export function getUnlockedCharacters() {
  return Object.values(CHARACTERS).filter((c) => c.unlocked);
}
