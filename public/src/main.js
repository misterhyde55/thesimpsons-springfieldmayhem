import { Game } from './game.js';
import * as board from './systems/board.js';
import * as worldMap from './data/worldMap.js';

const game = new Game();
game.init();

window.__springfieldMayhemGame = game;
window.__board = board;
window.__worldMap = worldMap;
