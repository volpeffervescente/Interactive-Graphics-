import * as THREE from 'three';
export class SoundManager {
    private pickupSfx  = new Audio('/sounds/pickup.mp3');
    private alertSfx   = new Audio('/sounds/error.mp3');
    private victorySfx = new Audio('/sounds/win.mp3');
    private defeatSfx  = new Audio('/sounds/lose.mp3');
    private sowedSfx   = new Audio('/sounds/relief.mp3');
    public bgm         = new Audio('/sounds/game-background.mp3');
    private loader = new THREE.AudioLoader();
    private buffers: Record<string, AudioBuffer> = {};
  
    constructor() {
      this.pickupSfx.volume  = 0.5;
      this.alertSfx.volume   = 0.7;
      this.victorySfx.volume = 0.7;
      this.defeatSfx.volume  = 0.6;
      this.sowedSfx.volume   = 0.6;
      this.bgm.volume        = 0.3;
      this.bgm.loop          = true; 
      this.bgm.load();     
  
      [ this.pickupSfx, this.alertSfx, this.victorySfx, this.defeatSfx, this.bgm ]
        .forEach(a => a.load());
    }
  
    public playPickup() {
      this.pickupSfx.currentTime = 0;
      this.pickupSfx.play();
    }
  
    public playAlert() {
      this.alertSfx.currentTime = 0;
      this.alertSfx.play();
    }
  
    public playVictory() {
      this.victorySfx.currentTime = 0;
      this.victorySfx.play();
    }
  
    public playDefeat() {
      this.defeatSfx.currentTime = 0;
      this.defeatSfx.play();
    }
    public playSowed()    {
        this.sowedSfx.currentTime   = 0; this.sowedSfx.play(); 
    }

    public playBgm() {
        if (!this.bgm.paused) return; 
        this.bgm.play();
      }
    public stopBgm() {
        this.bgm.pause();
        this.bgm.currentTime = 0;
    }
    public setBgmVolume(v: number) {
        this.bgm.volume = Math.min(1, Math.max(0, v));
    }
    public loadBuffer(name: string, url: string, onLoaded?: ()=>void) {
      this.loader.load(url, buf => {
        this.buffers[name] = buf;
        onLoaded?.();
      });
    }
    public getBuffer(name: string): AudioBuffer|undefined {
      return this.buffers[name];
    }
  }
  