import { Game } from './game.js';
import * as board from './systems/board.js';

const canvas = document.getElementById('gameCanvas');
const game = new Game(canvas);
game.init();

window.__springfieldMayhemGame = game;
window.__board = board;
