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
  // ---- Map expansion: each of these has its own distinct "why go here"
  // beyond just another fight -- see data/events.js for the event tied to
  // each, and data/journeys.js for how it's wired into each segment.
  policeStation: {
    id: 'policeStation',
    name: 'Springfield Police Station',
    emoji: '🚓',
    npcId: 'chiefWiggum',
    flavorNormal: ['Chief Wiggum: "Situation\'s handled. I think. What was the situation again?"'],
    flavorCorrupted: ['The holding cells are empty. The doors were opened from the inside.'],
  },
  krustyBurger: {
    id: 'krustyBurger',
    name: 'Krusty Burger',
    emoji: '🍔',
    npcId: 'krusty',
    flavorNormal: ['A flickering sign reads "OVER 1 BILLION EMPTY CALORIES SERVED."'],
    flavorCorrupted: ['The meat in the walk-in freezer is doing something meat should not do.'],
  },
  androidsDungeon: {
    id: 'androidsDungeon',
    name: "The Android's Dungeon",
    emoji: '💾',
    npcId: 'comicBookGuy',
    flavorNormal: ['Comic Book Guy: "Worst outbreak ever. Mint condition, though."'],
    flavorCorrupted: ['Every comic on the wall has been replaced with the same hand-drawn warning.'],
  },
  bowlarama: {
    id: 'bowlarama',
    name: 'Barney\'s Bowlarama',
    emoji: '🎳',
    flavorNormal: ['The lanes are empty except for one ball, still rolling, for way too long.'],
    flavorCorrupted: ['The pins have been arranged into a shape that is definitely not standard.'],
  },
  springfieldHospital: {
    id: 'springfieldHospital',
    name: 'Springfield General Hospital',
    emoji: '🏥',
    npcId: 'drHibbert',
    flavorNormal: ['Dr. Hibbert (chuckling nervously): "Oh, it\'s bad. Heh heh heh. Very bad."'],
    flavorCorrupted: ['Every bed is occupied. None of the patients are resting.'],
  },
  burnsManor: {
    id: 'burnsManor',
    name: 'Burns Manor',
    emoji: '🏰',
    npcId: 'mrBurns',
    flavorNormal: ['Mr. Burns: "Smithers, release the hounds. All of them. Every hound we have."'],
    flavorCorrupted: ['The hounds are no longer barking. They are no longer breathing, either.'],
  },
  retirementCastle: {
    id: 'retirementCastle',
    name: 'Springfield Retirement Castle',
    emoji: '🧓',
    npcId: 'grampa',
    flavorNormal: ['Grampa: "Back in my day, the dead stayed dead and we liked it that way."'],
    flavorCorrupted: ['Half the residents have wandered off. The other half never will again.'],
  },
  springfieldChurch: {
    id: 'springfieldChurch',
    name: 'First Church of Springfield',
    emoji: '⛪',
    npcId: 'lovejoy',
    flavorNormal: ['Reverend Lovejoy: "Hell hasn\'t been this popular around here since the last bake sale."'],
    flavorCorrupted: ['The stained glass windows are warm to the touch. All of them.'],
  },
  springfieldSewer: {
    id: 'springfieldSewer',
    name: 'The Springfield Sewer',
    emoji: '🕳️',
    flavorNormal: ['Something down here has been eating better than you have.'],
    flavorCorrupted: ['The walls are lined with something that used to be tile.'],
  },
};
