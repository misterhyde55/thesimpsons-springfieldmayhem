// Springfield locations double as battle backdrops and board-node flavor.
// `flavorNormal` plays at low Mayhem; `flavorCorrupted` replaces it once the
// run's Mayhem meter (state/gameState.js) crosses CORRUPTION_MAYHEM_THRESHOLD
// (see game.js), so the same location visibly gets worse as the episode
// goes on instead of the whole town flipping all at once.
export const LOCATIONS = {
  simpsonHouse: {
    id: 'simpsonHouse',
    name: '742 Evergreen Terrace',
    emoji: '🏠',
    flavorNormal: ['Marge: "Homer, something is very wrong outside."'],
    flavorCorrupted: ['The living room TV only shows static and low moaning.'],
  },
  kwikEMart: {
    id: 'kwikEMart',
    name: 'Kwik-E-Mart',
    emoji: '🏪',
    npcId: 'apu',
    flavorNormal: ['Apu: "Thank you, come again! ...If you can still walk."'],
    flavorCorrupted: ['Apu: "The Squishee machine is dispensing something that used to be a customer."'],
  },
  flandersHouse: {
    id: 'flandersHouse',
    name: "Flanders' House",
    emoji: '🏡',
    npcId: 'flanders',
    flavorNormal: ['Ned: "Hi-diddly-- ho, is that MY arm?"'],
    flavorCorrupted: ['Something wearing Ned\'s sweater vest is dragging itself through the hedge.'],
  },
  springfieldElementary: {
    id: 'springfieldElementary',
    name: 'Springfield Elementary',
    emoji: '🏫',
    npcId: 'skinner',
    flavorNormal: ['A hand-written sign reads: "DETENTION IS MANDATORY. FOREVER."'],
    flavorCorrupted: ['The chalkboard is covered edge-to-edge in the same sentence, over and over.'],
  },
  moesTavern: {
    id: 'moesTavern',
    name: "Moe's Tavern",
    emoji: '🍺',
    hasMoeRelationship: true,
    npcId: 'moe',
    flavorNormal: ['Moe: "We\'re closed. Well -- I\'m closed. The regulars ain\'t leaving."'],
    flavorCorrupted: ['Moe: "Barney\'s been standing in the corner for six hours not blinking. Usual?"'],
  },
  springfieldCemetery: {
    id: 'springfieldCemetery',
    name: 'Springfield Cemetery',
    emoji: '⚰️',
    flavorNormal: ['The freshly-turned dirt is moving. All of it.'],
    flavorCorrupted: ['Every headstone in sight is now empty.'],
  },
  nuclearPlant: {
    id: 'nuclearPlant',
    name: 'Springfield Nuclear Power Plant',
    emoji: '☢️',
    flavorNormal: ['A safety poster reads "SECTOR 7-G: 0 DAYS SINCE A REANIMATION."'],
    flavorCorrupted: ['The core glows a green that makes your teeth hurt to look at.'],
  },
};
