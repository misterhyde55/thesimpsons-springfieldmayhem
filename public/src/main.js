import { Game } from './game.js';
import * as board from './systems/board.js';

const game = new Game();
game.init();

window.__springfieldMayhemGame = game;
window.__board = board;
