//creates the container and  initializes Game module
import './style.css'
import { Game } from './Game'
const container = document.getElementById('app') as HTMLDivElement;
const game = new Game(container);
