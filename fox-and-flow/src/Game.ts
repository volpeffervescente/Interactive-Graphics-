import { World } from './World'
import { UImanager } from './UImanager'

export class Game {
  private world: World
  private ui: UImanager

  constructor(container: HTMLDivElement) {
    // initializes game logic, Three.js and all world 
    this.world = new World(container)
    this.ui = new UImanager(500) 
    this.ui.onStart = () => {
    }
    this.ui.onRestart = () => {
      window.location.reload()
    }
  }
}

