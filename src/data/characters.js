// Each character is a roguelike "class". Only Homer is playable in this prototype;
// the rest are registered here so unlocking one later is a data change, not a rewrite.
export const CHARACTERS = {
  homer: {
    id: 'homer',
    name: 'Homer Simpson',
    unlocked: true,
    maxHp: 150,
    moveSpeed: 150,
    radius: 20,
    color: '#f6d217',
    emoji: '🍩',
    startingWeapon: 'fists',
    tagline: 'Tank / Melee / Food.',
  },
  bart: {
    id: 'bart',
    name: 'Bart Simpson',
    unlocked: false,
    maxHp: 85,
    moveSpeed: 230,
    radius: 16,
    color: '#f6d217',
    emoji: '🛹',
    startingWeapon: 'slingshot',
    tagline: 'Speed / Tricks / Ranged. Coming soon.',
  },
  lisa: {
    id: 'lisa',
    name: 'Lisa Simpson',
    unlocked: false,
    maxHp: 90,
    moveSpeed: 170,
    radius: 16,
    color: '#f6d217',
    emoji: '🎷',
    startingWeapon: 'saxophone',
    tagline: 'Intelligence / Status Effects. Coming soon.',
  },
  marge: {
    id: 'marge',
    name: 'Marge Simpson',
    unlocked: false,
    maxHp: 110,
    moveSpeed: 160,
    radius: 18,
    color: '#38b6ff',
    emoji: '🧹',
    startingWeapon: 'fryingPan',
    tagline: 'Control / Defense. Coming soon.',
  },
  maggie: {
    id: 'maggie',
    name: 'Maggie Simpson',
    unlocked: false,
    secret: true,
    maxHp: 60,
    moveSpeed: 140,
    radius: 12,
    color: '#38b6ff',
    emoji: '👶',
    startingWeapon: 'pacifier',
    tagline: 'Secret character. ???',
  },
};

export function getUnlockedCharacters() {
  return Object.values(CHARACTERS).filter((c) => c.unlocked);
}
