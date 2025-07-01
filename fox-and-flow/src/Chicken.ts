import * as THREE from 'three';
import { UImanager } from './UImanager';
import { AudioListener, PositionalAudio } from 'three';

interface Collidable {
  mesh: THREE.Object3D;
  radius: number;
  centerOffset: THREE.Vector3;
}

export class Chicken {
  private wasInside     = false;
  private chaseSpeed    = 2.1;
  private jumpTime      = 0;
  private fallbackDir   = new THREE.Vector3();
  private fallbackTimer = 0;
  private cluckAudio: PositionalAudio;
  private scheduleId!: number;

  private collidables: Collidable[];
  private radius: number;

  constructor(
    public mesh: THREE.Object3D,
    private home: THREE.Vector3,
    private chaseDist: number,
    private ui: UImanager,
    private onChaseStart: () => void, 
    collidables: Collidable[],   // remember that this is a list containing all the objects considered as obstacles in the scene
    radius: number,              // chicken collision radius
    private listener: AudioListener,
    private cluckBuffer: AudioBuffer,
  ) {
    this.collidables = collidables;
    this.radius      = radius;
    this.cluckAudio = new PositionalAudio(this.listener);
    this.cluckAudio.setBuffer(this.cluckBuffer);
    this.cluckAudio.setRefDistance(4);     // distance from which sound is reproduced at the original volume
    this.cluckAudio.setMaxDistance(20);    // distance from which the sound is not reproduced 
    this.cluckAudio.setRolloffFactor(1.3); // how quickly the volume decreases with distance
    this.cluckAudio.setVolume(2.0);
    this.mesh.add(this.cluckAudio);
    this.scheduleNextCluck();
  }

  public update(delta: number, foxPos: THREE.Vector3): 'caught'|'escaped'|'none' {
    const wrapper = this.mesh;           // Group
    const model   = wrapper.children[0]; // the model is inside
    const pos2D = new THREE.Vector2(wrapper.position.x, wrapper.position.z);
    const fox2D = new THREE.Vector2(foxPos.x, foxPos.z);
    const dist  = pos2D.distanceTo(fox2D);
    if (dist < 0.5) return 'caught';
    // enter/exit from chase
    if (dist <= this.chaseDist && !this.wasInside) {
      this.wasInside = true;
      this.onChaseStart(); 
    }
    if (this.wasInside && dist > this.chaseDist) {
      this.wasInside = false;
      this.ui.showTemporaryMessage('You sowed the chicken!', 1.5);
      return 'escaped';
    }
    if (this.wasInside) {
      // vertical bobbing only on the model
      this.jumpTime += delta;
      (model as THREE.Object3D).position.y = Math.abs(Math.sin(this.jumpTime * 5)) * 0.2;
      // “base” direction toward the fox
      let dir = new THREE.Vector3(foxPos.x - wrapper.position.x, 0,foxPos.z - wrapper.position.z).normalize();
      // here I make the chicken try angular offsets in order to avoid and get around the obstacles
      const angles = [0, 0.5, -0.5, 1.0, -1.0];
      let moved = false;
      for (const a of angles) {
        const testDir = dir.clone().applyAxisAngle(new THREE.Vector3(0,1,0), a);
        const candidate = wrapper.position.clone().addScaledVector(testDir, this.chaseSpeed * delta);
        if (!this._collides(candidate)) {
          wrapper.position.copy(candidate);
          dir.copy(testDir);
          moved = true;
          this.fallbackTimer = 0;
          break;
        }
      }
      // random fallback for 0.5s if the chicken was not able to move forward
      if (!moved) {
        if (this.fallbackTimer <= 0) {
          this.fallbackDir.set(Math.random()*2-1,0, Math.random()*2-1).normalize();
          this.fallbackTimer = 0.5;
        }
        wrapper.position.addScaledVector(this.fallbackDir, this.chaseSpeed * delta);
        this.fallbackTimer = Math.max(0, this.fallbackTimer - delta);
      }
      // to make the chicken look at the fox
      const lookAt = foxPos.clone();
      lookAt.y = wrapper.position.y;
      wrapper.lookAt(lookAt);
    } else {
      // out of chase: reset bobbing
      this.jumpTime = 0;
      (model as THREE.Object3D).position.y = 0;
    }
    return 'none';
  }

  // collision only on XZ
  private _collides(candidate: THREE.Vector3): boolean {
    const c2D = new THREE.Vector2(candidate.x, candidate.z);
    for (const c of this.collidables) {
      if (c.mesh === this.mesh) continue; //to avoid self collision
      const wp = c.mesh.getWorldPosition(new THREE.Vector3());
      const center = new THREE.Vector2(wp.x + c.centerOffset.x, wp.z + c.centerOffset.z);
      if (c2D.distanceTo(center) < this.radius + c.radius) {
        return true;
      }
    }
    return false;
  }

  private scheduleNextCluck() {
    const delay = 5000 + Math.random() * 10000; // between 5 and 15 secs
    this.scheduleId = window.setTimeout(() => {
      if (this.cluckAudio.isPlaying) this.cluckAudio.stop(); 
      this.cluckAudio.play();
      this.scheduleNextCluck();
    }, delay);
  }
}
