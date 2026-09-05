import { enemiesForScenario } from '../data/enemies.js';
import { ARENA_WIDTH, ARENA_HEIGHT } from '../engine/config.js';
import { randRange, pickRandom } from '../engine/collision.js';

function randomPoint(margin = 60) {
  return {
    x: randRange(margin, ARENA_WIDTH - margin),
    y: randRange(margin, ARENA_HEIGHT - margin - 120),
  };
}

// `progressCount` (nodes already completed this run) scales the wave up as
// the board goes on; `elite` (a harder branch-choice node) adds more on top.
export function buildEnemyWave(location, progressCount, scenarioId, twistActive, elite = false) {
  const pool = twistActive ? enemiesForScenario(scenarioId) : enemiesForScenario('any');
  let waveSize = (location.waveBase || 0) + Math.floor(progressCount / 2);
  if (elite) waveSize += 2;
  const wave = [];
  for (let i = 0; i < waveSize; i += 1) {
    const template = pickRandom(pool);
    const point = randomPoint();
    wave.push({ template, x: point.x, y: point.y });
  }
  return wave;
}

// Combat levels only drop donuts now — non-donut build-crafting comes from
// the level-complete upgrade choice (systems/upgradeSystem.js) and shop nodes.
export function buildPickups() {
  const pickups = [];
  const donutCount = Math.random() < 0.5 ? 1 : 2;
  for (let i = 0; i < donutCount; i += 1) {
    const point = randomPoint(80);
    pickups.push({ kind: 'donut', x: point.x, y: point.y });
  }
  return pickups;
}
