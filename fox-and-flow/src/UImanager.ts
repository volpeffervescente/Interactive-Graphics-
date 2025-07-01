import { SoundManager } from './SoundManager';

export class UImanager {
  //references to new elements
  private veil         = document.getElementById('veil')! as HTMLDivElement;
  private mainMenu     = document.getElementById('main-menu')! as HTMLDivElement;
  private hud          = document.getElementById('hud')! as HTMLDivElement;
  private winScreen    = document.getElementById('win-screen')! as HTMLDivElement;
  private gameOverS    = document.getElementById('game-over-screen')! as HTMLDivElement;
  private pauseS       = document.getElementById('pause-screen')! as HTMLDivElement;
  private tempMsg      = document.getElementById('temp-message')! as HTMLDivElement;
  private sound: SoundManager;
  // HUD elements
  private scoreEl      = document.getElementById('score')! as HTMLDivElement;
  private timerEl      = document.getElementById('timer')! as HTMLDivElement;
  private finalScoreEl = document.getElementById('final-score')! as HTMLParagraphElement;
  private winScoreEl   = document.getElementById('win-score')! as HTMLParagraphElement;
  // buttons
  private btnStart        = document.getElementById('btn-start')! as HTMLButtonElement;
  private btnExplore      = document.getElementById('btn-explore')! as HTMLButtonElement;
  private btnPause        = document.getElementById('btn-pause')! as HTMLButtonElement;
  private btnResume       = document.getElementById('btn-resume')! as HTMLButtonElement;
  private btnPauseQuit    = document.getElementById('btn-pause-quit')! as HTMLButtonElement;
  private btnGameOverQuit = document.getElementById('btn-quit')! as HTMLButtonElement;
  private btnWinQuit      = document.getElementById('btn-win-quit')! as HTMLButtonElement;
  private pauseBtn: HTMLButtonElement;
  private pauseScreen: HTMLDivElement;
  // public callbacks (assigned by World)
  public onStart   : () => void = () => {};
  public onExplore : () => void = () => {};
  public onPause   : () => void = () => {};
  public onResume  : () => void = () => {};
  public onQuit    : () => void = () => {};
  public onRestart : () => void = () => {};
 
  private messageTimeoutId?: number;
  public score = 0;
  public timeLeft = 500;

  constructor(initialTime = 500) {
    this.timeLeft = initialTime;

    // buttons wiring 
    this.btnStart   .addEventListener('click', () => this.startGame());
    this.btnExplore .addEventListener('click', () => this.exploreMode());
    this.btnPause   .addEventListener('click', () => this.pauseGame());
    this.btnResume  .addEventListener('click', () => this.resumeGame());
    this.btnPauseQuit   .addEventListener('click', () => this.onRestart());
    this.btnGameOverQuit.addEventListener('click', () => this.onRestart());
    this.btnWinQuit      .addEventListener('click', () => this.onRestart());

    this.pauseBtn = document.getElementById('btn-pause') as HTMLButtonElement;
    this.pauseScreen  = document.getElementById('pause-screen')as HTMLDivElement;
    this.pauseBtn.disabled = true;
    this.pauseBtn.addEventListener('click', e => {
      if (this.pauseBtn.disabled) {
        e.stopImmediatePropagation();
        return;
      }
      this.showPause();
      this.onPause();
    });

    this.sound = new SoundManager();

    this.showMainMenu();
  }

  private hideAll() {
    [ this.mainMenu, this.hud, this.winScreen, this.gameOverS, this.pauseS, this.tempMsg ]
      .forEach(el => el.classList.add('hidden'));
    this.veil.classList.add('hidden');
  }

  public showMainMenu() {
    this.hideAll();
    this.score = 0;
    this.timeLeft = 500;
    this.updateHUD();
    this.veil.classList.remove('hidden');
    this.mainMenu.classList.remove('hidden');
    this.btnPause.style.display = 'none';
  }

  public showPause() {
    this.hideAll();
    this.veil.classList.remove('hidden');
    this.pauseScreen.classList.remove('hidden');
  }

  private startGame() {
    this.hideAll();
    this.score = 0;
    this.timeLeft = 500;
    this.updateHUD();
    this.hud.classList.remove('hidden');
    this.scoreEl.style.display = 'block';
    this.timerEl.style.display = 'block';
    this.pauseBtn.disabled = false;
    this.btnPause.style.display = 'block';
    this.onStart();
  }

  private exploreMode() {
    this.hideAll();
    this.hud.classList.remove('hidden');
    this.scoreEl.style.display = 'none';
    this.timerEl.style.display = 'none';
    this.btnPause.style.display = 'block';
    this.btnPause.disabled = false;
    this.onExplore();
  }

  public pauseGame() {
    this.hideAll();
    this.veil.classList.remove('hidden');
    this.pauseS.classList.remove('hidden');
    this.onPause();
  }

  private resumeGame() {
    this.hideAll();
    this.hud.classList.remove('hidden');
    this.btnPause.style.display = 'block';
    this.onResume();
  }

  public showWin(points: number) {
    this.hideAll();
    this.veil.classList.remove('hidden');
    this.winScoreEl.textContent = `You scored ${points} points`;
    this.winScreen.classList.remove('hidden');
    this.btnPause.style.display = 'none';
  }

  public showGameOver(points: number) {
    this.hideAll();
    this.veil.classList.remove('hidden');
    this.finalScoreEl.textContent = `You got ${points} points`;
    this.gameOverS.classList.remove('hidden');
    this.btnPause.style.display = 'none';
  }
  //HUD and messages:
  public update(delta: number) {
    if (this.timeLeft <= 0) return;
    this.timeLeft = Math.max(0, this.timeLeft - delta);
    this.timerEl.textContent = `Left Time: ${Math.ceil(this.timeLeft)}`;
    if (this.timeLeft === 0) this.showGameOver(this.score);
  }

  public addScore(points: number) {
    this.score += points;
    this.scoreEl.textContent = `Score: ${this.score}`;
    if (this.score >= 150) this.showWin(this.score);
  }

  private updateHUD() {
    this.scoreEl.textContent = `Score: ${this.score}`;
    this.timerEl.textContent = `Left Time: ${Math.ceil(this.timeLeft)}`;
  }

  public showTemporaryMessage(msg: string, seconds: number) {
    if (this.messageTimeoutId) clearTimeout(this.messageTimeoutId);
    this.tempMsg.textContent = msg;
    this.tempMsg.classList.remove('hidden');
    this.messageTimeoutId = window.setTimeout(() => {
      this.tempMsg.classList.add('hidden');
    }, seconds * 1000);
  }
}
