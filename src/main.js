import { Game } from './game.js';

const canvas = document.getElementById('gameCanvas');
const game = new Game(canvas);
game.init();

window.__springfieldMayhemGame = game;
