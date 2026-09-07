// Powers the interactive map sidebar (ui/worldMapView.js) -- turns the
// artwork's own baked-in legend from decoration into a real filter/
// intelligence tool. Every category here reads live runState rather than
// guessing, so "SHOP: 2" etc. always matches what's actually true right
// now, and nothing here reveals content the player couldn't already see
// via the map's own hotspot icons (no new fog-of-war system, just making
// what's already visible searchable).
import { WORLD_LOCATIONS, getReachableLocationIds } from '../data/worldMap.js';
import { LOCATIONS } from '../data/locations.js';
import { getCurrentSegment, isBossLocationUnlocked } from './board.js';
import { INVASION_CONFIG } from './locationInvasions.js';

const SEWER_ID = 'springfieldSewer';

// Real locations currently "on the map" -- every WORLD_LOCATIONS entry
// except the sewer, which stays a genuine secret until the Mysterious Key
// is found (matches the existing map/road-gating design, not a new rule).
function knownLocationIds(runState) {
  return Object.keys(WORLD_LOCATIONS).filter((id) => id !== SEWER_ID || runState.world.locationFlags.hasMysteriousKey);
}

function locationPurpose(locationId) {
  switch (locationId) {
    case 'moesTavern':
      return 'Rest • Duff • Rumors';
    case 'kwikEMart':
      return 'Shop • Consumables • Rumors';
    case 'simpsonHouse':
      return 'Home base';
    case 'springfieldElementary':
      return 'Combat • Story';
    case 'springfieldCemetery':
      return 'Dangerous fights • Rare rewards';
    case 'nuclearPlant':
      return 'Combat • Boss';
    case 'springfieldChurch':
      return 'Story • Devil Ned';
    case 'policeStation':
      return 'Events • Wiggum';
    case 'burnsManor':
      return 'Combat • Secret';
    case 'bowlarama':
    case 'androidsDungeon':
    case 'krustyBurger':
    case 'springfieldHospital':
    case 'retirementCastle':
      return 'Random event';
    default:
      return 'Combat';
  }
}

function segmentContentFor(runState, locationId) {
  return getCurrentSegment(runState).content[locationId] || null;
}

// Every FILTER_DEFS entry: {id, label, icon, description, getEntries(runState)}
// getEntries returns a Map<locationId, {lines: string[], urgent?: boolean}>
// -- lines render in the hover/click info panel, urgent adds a warning style.
export const FILTER_DEFS = [
  {
    id: 'location',
    label: 'LOCATION',
    icon: '🏠',
    description: 'Highlight every location currently known on the map.',
    getEntries(runState) {
      const map = new Map();
      for (const id of knownLocationIds(runState)) map.set(id, { lines: [locationPurpose(id)] });
      return map;
    },
  },
  {
    id: 'shop',
    label: 'SHOP',
    icon: '🛒',
    description: 'Highlight locations where Homer can buy items, heal, or upgrade his build.',
    getEntries(runState) {
      const map = new Map();
      const specialty = { kwikEMart: 'Consumables', moesTavern: 'Duff / Rest' };
      for (const [id, label] of Object.entries(specialty)) {
        const state = runState.world.locationStates[id];
        if (state === 'overrun') continue;
        const lines = [label];
        if (state === 'underAttack' || runState.world.locationInvasions[id]) lines.push('⚠ UNDER ATTACK');
        map.set(id, { lines, urgent: !!runState.world.locationInvasions[id] });
      }
      return map;
    },
  },
  {
    id: 'combat',
    label: 'COMBAT',
    icon: '⚔️',
    description: 'Highlight known standard combat encounters.',
    getEntries(runState) {
      const map = new Map();
      for (const id of knownLocationIds(runState)) {
        const content = segmentContentFor(runState, id);
        if (content && content.type === 'combat' && !content.elite) {
          map.set(id, { lines: ['Zombie activity', `Threat: ${'★'.repeat(2)}`] });
        }
      }
      return map;
    },
  },
  {
    id: 'elite',
    label: 'ELITE',
    icon: '💀',
    description: 'Highlight known high-risk, high-reward elite fights.',
    getEntries(runState) {
      const map = new Map();
      for (const id of knownLocationIds(runState)) {
        const content = segmentContentFor(runState, id);
        if (content && content.type === 'combat' && content.elite) {
          map.set(id, { lines: ['ELITE ENCOUNTER', `Threat: ${'★'.repeat(5)}`, 'Possible Reward: Rare item/ability'] });
        }
      }
      return map;
    },
  },
  {
    id: 'boss',
    label: 'BOSS',
    icon: '😈',
    description: 'Show all currently known boss encounters.',
    getEntries(runState) {
      const map = new Map();
      const segment = getCurrentSegment(runState);
      if (segment.bossLocationId) {
        map.set(segment.bossLocationId, {
          lines: [isBossLocationUnlocked(runState) ? 'BOSS READY' : 'BOSS (explore more first)'],
        });
      }
      if (runState.world.locationFlags.hasDevilPortal && !runState.world.locationFlags.devilNedDefeated) {
        const nedAt = runState.world.devilNedPosition || 'springfieldChurch';
        map.set(nedAt, { lines: ['DEVIL NED', 'OPTIONAL BOSS'], urgent: true });
      }
      return map;
    },
  },
  {
    id: 'event',
    label: 'EVENT',
    icon: '⚠️',
    description: 'Highlight active, time-sensitive world events.',
    getEntries(runState) {
      const map = new Map();
      for (const [id, invasion] of Object.entries(runState.world.locationInvasions)) {
        const label = INVASION_CONFIG[id] ? 'UNDER ATTACK' : 'CRISIS';
        map.set(id, { lines: [label, `EXPIRES AFTER: ${invasion.turnsLeft} TRAVEL${invasion.turnsLeft === 1 ? '' : 'S'}`], urgent: true });
      }
      return map;
    },
  },
  {
    id: 'visited',
    label: 'VISITED',
    icon: '✅',
    description: "Highlight every location Homer has already entered this episode.",
    getEntries(runState) {
      const map = new Map();
      for (const id of runState.world.visitedLocationIds) {
        if (!WORLD_LOCATIONS[id]) continue;
        const lines = ['VISITED'];
        if (runState.world.locationInvasions[id] || runState.world.locationFlags[id]) lines.push('NEW ACTIVITY!');
        map.set(id, { lines });
      }
      return map;
    },
  },
  {
    id: 'locked',
    label: 'LOCKED',
    icon: '🔒',
    description: 'Show discovered but currently inaccessible locations.',
    getEntries(runState) {
      const map = new Map();
      const segment = getCurrentSegment(runState);
      if (segment.bossLocationId && !isBossLocationUnlocked(runState)) {
        const exploredElsewhere = runState.world.segmentVisitedLocationIds.filter((id) => id !== segment.bossLocationId).length;
        map.set(segment.bossLocationId, { lines: ['LOCKED', `Requirement: Explore ${2 - exploredElsewhere} more location(s)`] });
      }
      if (!runState.world.locationFlags.hasMysteriousKey) {
        map.set(SEWER_ID, { lines: ['LOCKED', 'Requirement: Mysterious Key'] });
      }
      return map;
    },
  },
  {
    id: 'rumor',
    label: 'RUMOR',
    icon: '💬',
    description: 'Highlight locations tied to information Homer has heard, but not confirmed.',
    getEntries(runState) {
      const map = new Map();
      for (const [id, flag] of Object.entries(runState.world.locationFlags)) {
        if (typeof flag === 'string' && WORLD_LOCATIONS[id]) {
          map.set(id, { lines: ['RUMOR', `"${flag}"`] });
        }
      }
      return map;
    },
  },
  {
    id: 'quest',
    label: 'QUEST',
    icon: '📋',
    description: 'Highlight all locations connected to active quests.',
    getEntries(runState) {
      const map = new Map();
      if (runState.quests.wheresBarney === 'active') {
        map.set('springfieldCemetery', { lines: ["WHERE'S BARNEY?", 'Reward: Moe Relationship, ???'] });
      }
      if (runState.quests.helpApu === 'active') {
        map.set('springfieldElementary', { lines: ["APU'S FAVOR", 'Search here, then report to Apu'] });
        map.set('kwikEMart', { lines: ["APU'S FAVOR", 'Report back once found'] });
      }
      if (runState.quests.missingOfficers === 'active') {
        map.set('burnsManor', { lines: ['THE MISSING OFFICERS', 'Search here'] });
        map.set('policeStation', { lines: ['THE MISSING OFFICERS', 'Report back once found'] });
      }
      return map;
    },
  },
  {
    id: 'safe',
    label: 'SAFE',
    icon: '🛡️',
    description: 'Highlight locations that currently offer recovery.',
    getEntries(runState) {
      const map = new Map();
      for (const id of ['moesTavern', 'kwikEMart']) {
        const state = runState.world.locationStates[id];
        if (state === 'overrun' || state === 'underAttack' || runState.world.locationInvasions[id]) continue;
        map.set(id, { lines: ['SAFE', 'Recovery available'] });
      }
      return map;
    },
  },
];

export function getFilterDef(id) {
  return FILTER_DEFS.find((f) => f.id === id);
}

// "YOU ARE HERE" is a one-off action (recenter + info), not a toggleable
// highlight set like the rest, so it's exposed separately.
export function youAreHereInfo(runState) {
  const here = runState.world.currentLocationId || 'simpsonHouse';
  const reachable = getReachableLocationIds(runState).length;
  return {
    locationId: here,
    name: LOCATIONS[here]?.name || 'Springfield',
    reachableCount: reachable,
    hp: runState.hp,
    maxHp: runState.maxHp,
  };
}
