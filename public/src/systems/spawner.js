import { ENEMIES, enemiesForScenario } from '../data/enemies.js';
import { ITEMS } from '../data/items.js';
import { ARENA_WIDTH, ARENA_HEIGHT } from '../engine/config.js';
import { randRange, pickRandom } from '../engine/collision.js';

const NON_DONUT_ITEM_IDS = Object.keys(ITEMS).filter((id) => ITEMS[id].category !== 'donut');

function randomPoint(margin = 60) {
  return {
    x: randRange(margin, ARENA_WIDTH - margin),
    y: randRange(margin, ARENA_HEIGHT - margin - 120),
  };
}

export function buildEnemyWave(location, stageIndex, scenarioId, twistActive) {
  const pool = twistActive ? enemiesForScenario(scenarioId) : enemiesForScenario('any');
  const waveSize = (location.waveBase || 0) + Math.floor(stageIndex / 2);
  const wave = [];
  for (let i = 0; i < waveSize; i += 1) {
    const template = pickRandom(pool);
    const point = randomPoint();
    wave.push({ template, x: point.x, y: point.y });
  }
  return wave;
}

export function buildPickups(location) {
  const pickups = [];
  const donutCount = Math.random() < 0.5 ? 1 : 2;
  for (let i = 0; i < donutCount; i += 1) {
    const point = randomPoint(80);
    pickups.push({ kind: 'donut', x: point.x, y: point.y });
  }
  const itemCount = location.itemDropCount || 0;
  const chosenIds = new Set();
  let attempts = 0;
  while (chosenIds.size < itemCount && attempts < itemCount * 6) {
    attempts += 1;
    chosenIds.add(pickRandom(NON_DONUT_ITEM_IDS));
  }
  for (const itemId of chosenIds) {
    const point = randomPoint(80);
    pickups.push({ kind: 'item', itemId, x: point.x, y: point.y });
  }
  return pickups;
}

export { ENEMIES };
