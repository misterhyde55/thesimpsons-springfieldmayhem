import { Game } from './game.js';
import * as board from './systems/board.js';
import * as worldMap from './data/worldMap.js';
import * as audio from './engine/audio.js';

const game = new Game();
game.init();

window.__springfieldMayhemGame = game;
window.__board = board;
window.__worldMap = worldMap;
window.__audio = audio;
