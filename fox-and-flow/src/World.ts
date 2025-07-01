import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';
import { TREE_CONFIGS } from './treeConfig';
import type { TreeCollisionConfig } from './treeConfig';
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js';
import { UImanager } from './UImanager';
import { Chicken } from './Chicken';
import { SoundManager } from './SoundManager';
import { Lake } from './Lake';

type FoxState = 'idle' | 'walk' | 'run' | 'jump'
interface Collidable {
  mesh: THREE.Object3D;
  radius: number;
  centerOffset: THREE.Vector3;
}

export class World {
  private ui: UImanager;
  private sound: SoundManager;
  public isRunning = false; // flag to start/stop the logic
  private collidables: Collidable[] = [];
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private foxState: FoxState = 'idle';
  private jumpStartTime = 0;
  private fallingLeaves: THREE.Mesh[] = [];
  private clock = new THREE.Clock();
  private foxContainer = new THREE.Group();
  private model!: THREE.Group;
  private noise = new ImprovedNoise();
  private bushRefs: THREE.Object3D[]   = [];
  private stoneRefs: THREE.Object3D[]  = [];
  private coopRef:  THREE.Object3D | null = null;
  private items: Array<{
    mesh: THREE.Object3D;   
    type: 'mushroom' | 'egg' | 'ruby';
    radius: number;
  }> = [];
  private rubyModel?: THREE.Group;
  private chickenModel?: THREE.Group;
  private ambientLight: THREE.AmbientLight;
  private chickens: Chicken[] = [];
  private spawnDistance = 40;
  private foxCollisionRadiusX = 0.1; 
  private foxCollisionRadiusZ = 0.6; 
  private placedObstacles: Array<{ pos: THREE.Vector2; radius: number }> = [];
  private vec2(x: number, z: number) { return new THREE.Vector2(x, z); }
  private explorationMode: boolean = false;
  private keys: Record<string, boolean> = {};
  private walkSpeed = 2;
  private runSpeed = 5;
  private isDragging = false;          
  private previousMouse = { x: 0, y: 0 };
  //l'azimut è l'angolo orizzontale (o l'angolo rispetto al piano orizzontale) che indica la posizione della telecamera rispetto a un oggetto o punto di riferimento
  private cameraAzimuth  = 0; // orizzontal angles (in radiants)
  private cameraElevation = Math.PI / 6; // vertical angle (0 is orizzontal, > 0 is over)
  private groundObjects: THREE.Mesh[] = [];
  private lake: Lake;
  private skyUniforms: { [uniform: string]: THREE.IUniform } = {};
  private sunPosition = new THREE.Vector3();
  private dayFogColor = new THREE.Color(0xD0D0D0);
  private nightFogColor = new THREE.Color(0x111133);
  private directionalLight: THREE.DirectionalLight | null = null;
  private audioListener;
  private bird!: THREE.Group
  private birdAngle = 0  
  private birdSpeed = 0.3 // radiants per sec 
  private birdRadius = 100 
  private foxSpawn = new THREE.Vector2(0, 0); 
  private treeSafeRadius = 4; 


  /* ===== fox model and animations variables ===== */
  // bones
  private spine1!: THREE.Bone;
  private spine2!: THREE.Bone;
  private head!: THREE.Bone;
  private tail1!: THREE.Bone;
  private tail2!: THREE.Bone;
  private tail3!: THREE.Bone;
  private leftLeg!: THREE.Bone;
  private rightLeg!: THREE.Bone;
  private leftArm!: THREE.Bone;
  private rightArm!: THREE.Bone;
  private leftForeArm!: THREE.Bone;
  private rightForeArm!: THREE.Bone;
  private leftHand!: THREE.Bone;
  private rightHand!: THREE.Bone;

  // Base bone values
  private leftLegBaseZ = 0;
  private rightLegBaseZ = 0;
  private leftArmBaseZ = 0;
  private rightArmBaseZ = 0;
  private leftForearmBaseZ = 0;
  private rightForearmBaseZ = 0;
  private leftHandBaseZ = 0;
  private rightHandBaseZ = 0;
  private spine1BaseZ = 0;
  private spine2BaseZ = 0;

  private baseY = 0; // base y value, used for sprint y model offset

  // Blend weights
  private idleWeight = 1;
  private walkWeight = 0;
  private sprintWeight = 0;

  // Animation state
  private isSprinting = false;

  // Leg phase constants
  private readonly phaseFL = 0;
  private readonly phaseHL = Math.PI;
  private readonly phaseFR = Math.PI / 2;
  private readonly phaseHR = (3 * Math.PI) / 2;

  private lastRotationTarget!: number;

  // Speed settings
  private readonly baseMoveSpeed = 2;
  private readonly baseWalkSpeed = 5;

  // Walk/Run animation settings
  private readonly walkAmplitudeLegs = 0.5;
  private readonly walkAmplitudeArms = 0.5;
  private readonly walkAmplitudeTail = 0.3;
  private readonly walkTailMovementSpeed = 1;
  private readonly walkAmplitudeForeArm = 0.5;
  private readonly walkAmplitudeHand = 0.3;

  // Blend settings
  private readonly blendSpeed = 0.2;
  /////////
  

  constructor(container: HTMLDivElement) {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(this.dayFogColor.getHex(), 0.0127);
    this.sound = new SoundManager();
    this.sound.loadBuffer('cluck', '/sounds/chicken.mp3');
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
    this.camera.position.set(0, 2, 6);
    this.camera.lookAt(0, 1, 0);
    const listener = new THREE.AudioListener();
    this.camera.add(listener);
    this.audioListener = listener; 
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    container.appendChild(this.renderer.domElement);

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });


    // INPUT HANDLING
    window.addEventListener('keydown', e => {
      if (['KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft'].includes(e.code)) {
        e.preventDefault();
        this.keys[e.code] = true;
      }
    });
    window.addEventListener('keyup', e => {
      if (['KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft'].includes(e.code)) {
        e.preventDefault();
        this.keys[e.code] = false;
      }
    });

    // camera rotation
    container.addEventListener('mousedown',  e => { this.isDragging = true;  this.previousMouse = { x: e.clientX, y: e.clientY }; });
    window.addEventListener   ('mouseup',    () =>   this.isDragging = false );
    window.addEventListener   ('mousemove',  e => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.previousMouse.x;
      const dy = e.clientY - this.previousMouse.y;
      this.previousMouse = { x: e.clientX, y: e.clientY };

      // drag sensibility 
      const AZIMUTH_SPEED  = 3/1000;     // orizzontal sensibility   
      const ELEVATION_SPEED = 1/1000;    // vertical sensibility 
      const MAX_CAMERA_ELEVATION = Math.PI/4 - 0.1; // max camera elevation (how much camera can rotate vertically)
     
      this.cameraAzimuth  -= dx * AZIMUTH_SPEED;
      this.cameraElevation = Math.max(0.1, Math.min(MAX_CAMERA_ELEVATION, this.cameraElevation - dy * ELEVATION_SPEED));   
    });

    this.createSimpleGround();  //I create the ground of the scene

    // lights tuning
    this.directionalLight = new THREE.DirectionalLight(0xffffff, 1.5); //I create a new directional light
    this.directionalLight.position.set(5, 10, 7.5);
    this.directionalLight.castShadow = true;
    this.directionalLight.shadow.mapSize.set(2048, 2048);
    this.directionalLight.shadow.camera.near = 0.5;
    this.directionalLight.shadow.camera.far = 200;
    this.directionalLight.shadow.camera.left = -75;
    this.directionalLight.shadow.camera.right = 75;
    this.directionalLight.shadow.camera.top = 75;
    this.directionalLight.shadow.camera.bottom = -75;
    this.scene.add(this.directionalLight);
    this.directionalLight.target.position.set(0, 0, 0);
    this.scene.add(this.directionalLight.target);
    
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(this.ambientLight);
    
    //here I add the lake that we can see on the right of the starting position
    this.lake = new Lake(this.scene);
    const lakePosition = new THREE.Vector3(15, 0, 0); 
    this.lake.setPosition(lakePosition.x, lakePosition.y, lakePosition.z);
    this.placedObstacles.push({
        pos: new THREE.Vector2(lakePosition.x, lakePosition.z),
        radius: this.lake.getLakeCollisionRadius() 
    });
    // here I add the lake ito collidables, so the fox cant go in it
    this.collidables.push({
        mesh: this.lake.getLakeGroup(), // so all pebbles, water, lilies, ecc
        radius: this.lake.getLakeCollisionRadius(),
        centerOffset: new THREE.Vector3(0, 0.5, 0) // Offset from group center to collision center, approximately
    });
    
    //this is for the imported mountains to be put on the sides of the scene
    this.placePerimeterModels([
      { path: '/models/mountain.glb', scale: 1.2 },
      { path: '/models/low_poly_mountain.glb', scale: 0.4 },
      { path: '/models/mountain.glb', scale: 1.2 },
      { path: '/models/low_poly_mountain.glb', scale: 0.4 },
    ]);

    // here I put the fall trees I made in random positions in the scene, according to certain constraints  
    for (let i = 0; i < 130; i++) {
      const tree = this.createTreeWithLeaves();
      // find a valid x and z without being inside the safe radius of the starting position of the fox 
      let x: number, z: number;
      do {
        x = Math.random() * 150 - 75;
        z = Math.random() * 150 - 75;
      } while (this.foxSpawn.distanceTo(new THREE.Vector2(x, z)) < this.treeSafeRadius);
      tree.position.set(x, 0, z);
      this.scene.add(tree);
      const collisionObject = tree.children.find(c => c.userData.isCollisionMesh);
      if (collisionObject && collisionObject instanceof THREE.Mesh) {
        const collisionRadius = 0.45; //this value corresponds to the one declared in the createtreeWithLeaves method
        const collisionHeight = 4.0;
        this.collidables.push({
          mesh: collisionObject, 
          radius: collisionRadius,
          centerOffset: new THREE.Vector3(0, 1 + collisionHeight / 2, 0) 
        });
      }
    }

    // here I add handmade pines created with createPine method
    for (let i = 0; i < 60; i++) {
      const pine = this.createPine();
      let x: number, z: number;
      do {
        x = Math.random() * 150 - 75;
        z = Math.random() * 150 - 75;
      } while (this.foxSpawn.distanceTo(new THREE.Vector2(x, z)) < this.treeSafeRadius);
      pine.position.set(x, 0, z);
      this.scene.add(pine);
      const collisionObject = pine.children.find(c => c.userData.isCollisionMesh);
      if (collisionObject && collisionObject instanceof THREE.Mesh) {
        const collisionRadius = 0.2;
        const collisionHeight = 4.0;
        this.collidables.push({
          mesh: collisionObject,
          radius: collisionRadius,
          centerOffset: new THREE.Vector3(0, collisionHeight / 2, 0) // Offset from pine pivot to the center of collisionMesh
        });
      }
    }
    
    //here I add to the scene a ring of handmade mountains, in order to fill the gap between the imported mountains, and to give more realism
    this.addProceduralRing(
      /*count*/       16,
      /*ringRadius*/  135,
      /*width*/       300,
      /*depth*/       80,
      /*heightScale*/ 120
    );

    const loader = new GLTFLoader(); //I need this loader for all the glb models to be correctly put in the scene

    //here i load the ruby model once
    loader.load('/models/low_poly_ruby.glb', gltf => {
      this.rubyModel = gltf.scene as THREE.Group;
      this.rubyModel.traverse(o => {
        if (o instanceof THREE.Mesh) {
          o.castShadow = o.receiveShadow = true;
          // sostituisci il materiale 
          o.material = new THREE.MeshPhysicalMaterial({
            color: 0xff0044,         
            metalness: 0.0,          // no metallic effect
            roughness: 0.1,          // almost smooth, to give perfect reflections
            transmission: 0.8,       // this is the alpha 
            thickness: 1.0,          
            ior: 1.5,                // ruby refraction index (~1.5)
            specularIntensity: 1.0,  // specular reflection intensity 
            transparent: true,      
            opacity: 0.9,            
            clearcoat: 1.0,         
            clearcoatRoughness: 0.1, 
          });
        }
      });
    });

    //here i load the bush model 
    loader.load('/models/low_poly_bushes.glb', gltf => {
      const bushModel = gltf.scene;
      bushModel.traverse(o => {
        if (o instanceof THREE.Mesh) {
          o.castShadow = o.receiveShadow = true;
        }
      });
      // fixed position : i add 5 bushes to the scene
      const bushPositions = [
        new THREE.Vector3( 20, 0,  20),
        new THREE.Vector3(-30, 0,  10),
        new THREE.Vector3(  5, 0, -25),
        new THREE.Vector3(-15, 0, -40),
        new THREE.Vector3( 40, 0, -15),
      ];
      for (const pos of bushPositions) {
        const inst = bushModel.clone();
        inst.scale.setScalar(0.4);
        //realign to the ground
        const box = new THREE.Box3().setFromObject(inst);
        const minY = box.min.y;
        const centerOffset2D = this.vec2(0, box.getSize(new THREE.Vector3()).y/2);
        const rawRadius = Math.max(box.getSize(new THREE.Vector3()).x, box.getSize(new THREE.Vector3()).z) / 2;
        const reducedRadius = rawRadius * 0.2; 
        const free = this.findFreePosition(rawRadius, centerOffset2D);
        inst.position.set(free.x, 0.1, free.y);
        inst.position.copy(pos);
        this.scene.add(inst);
        this.bushRefs.push(inst);
        this.collidables.push({  //fox cant pass through bushes neither!
          mesh: inst,
          radius: reducedRadius,
          centerOffset: new THREE.Vector3(0, box.getSize(new THREE.Vector3()).y/2, 0)
        });
        // here i register the bush as an obstacle
        this.placedObstacles.push({
          pos: free.clone().add(centerOffset2D),
          radius: rawRadius
        });
      }
    });
    //here i add stones to the scene
    this.stoneRefs.length = 0; 
    const stoneLoader = new GLTFLoader();
    stoneLoader.load('/models/low_poly_stone_for_games.glb', gltf => {
      const rawStone = gltf.scene;
      rawStone.traverse(o => {
        if (o instanceof THREE.Mesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      //fixed position 
      const stonePositions = [
        new THREE.Vector3( 25, 0,  35),
        new THREE.Vector3(-35, 0,  30),
        new THREE.Vector3(  0, 0, -45),
      ];
      for (const basePos of stonePositions) {
        const inst = rawStone.clone();
        inst.scale.setScalar(0.01);
        // realign to the ground
        const box = new THREE.Box3().setFromObject(inst);
        const minY = box.min.y;
        inst.position.set(basePos.x, 0, basePos.z);
        this.scene.add(inst);
        this.stoneRefs.push(inst);
        const size = box.getSize(new THREE.Vector3());
        const radius = Math.max(size.x, size.z) / 2;
        const centerOffset = new THREE.Vector3(0, size.y / 2, 0);
        this.collidables.push({ //the fox cant pass through the stones too!
          mesh: inst,
          radius,
          centerOffset
        });
      }
    });

    //here i load the coop model (only one instance) 
    loader.load('/models/chicken_coop.glb', gltf => {
      const coop = gltf.scene;
      coop.traverse(o => {
        if (o instanceof THREE.Mesh) {
          o.castShadow = o.receiveShadow = true;
        }
      });2
      coop.scale.set(0.01, 0.01, 0.01); 
      coop.position.set(-10, -0.3, -20); // realign to the ground
      this.scene.add(coop);
      this.coopRef = coop;
      const bc = new THREE.Box3().setFromObject(coop);
      const rawRadiusCoop = Math.max(bc.getSize(new THREE.Vector3()).x, bc.getSize(new THREE.Vector3()).z) / 2;
      const reducedCoopRadius = rawRadiusCoop * 0.55;
      coop.position.set(-10, -0.3, -20); 
      this.collidables.push({ //added to collidables also the coop
        mesh: coop,
        radius: reducedCoopRadius,
        centerOffset: new THREE.Vector3(0, bc.getSize(new THREE.Vector3()).y/2, 0)
      });
    });

    //here i add the angry chicken to the scene as well!
    loader.load('/models/chicken.glb', gltf => {
      this.chickenModel = gltf.scene as THREE.Group;
      this.chickenModel.traverse(o => {
        if (o instanceof THREE.Mesh) {
          o.castShadow = o.receiveShadow = true;
        }
      });
    });

    // here I add the fox to the scene
    this.loadFoxModel();

    //here I add the imported trees
    for (const cfg of TREE_CONFIGS) {
      this.load3DTrees(cfg);
    }

    // here I add and setup the sky
    this.setupSky();
    // here I intilialize the sun exactly as I do in animate method, just to remove a bug
    const initialT    = 0;
    const cycleSpeed  = 0.01;
    const radius      = 100;
    this.sunPosition.set(
      Math.cos(initialT * cycleSpeed) * radius,
      Math.sin(initialT * cycleSpeed) * radius,
      Math.cos(initialT * cycleSpeed * 0.5 + Math.PI / 4) * 50
    );
    //update light and shader
    if (this.directionalLight) {
      this.directionalLight.position.copy(this.sunPosition);
    }
    this.skyUniforms.uSunPosition.value.copy(this.sunPosition);
    
    //here I add the little bird that flies around the scene
    this.createEagle()

    // listen to the keyboard
    window.addEventListener('keydown',  e => this.keys[e.code] = true);
    window.addEventListener('keyup',    e => this.keys[e.code] = false);

    // UI MANAGER 
    this.ui = new UImanager(500);
    this.sound.playBgm();            // starts the loop
    this.sound.setBgmVolume(0.1);    // I set bgm vol. lower for when we are in main menu

    this.ui.onStart = () => {
      this.explorationMode = false;
      this.isRunning = true;
      this.sound.playBgm(); 
      this.sound.setBgmVolume(0.3);
      this.clock.start();
      this.clearSceneItems();
      this.spawnMushrooms(80);
      this.spawnEggs(this.bushRefs, 3);
      this.spawnRubies(this.stoneRefs, 2);
      this.spawnChickenAtCoop();
      this.sound.playBgm();
    };
    
    // when I click “Explore Map” (we are not spawning anything here)
    this.ui.onExplore = () => {
      this.explorationMode = true;
      this.isRunning = true;
      this.sound.playBgm(); 
      this.sound.setBgmVolume(0.1);
      this.clock.start();
      this.clearSceneItems();
    };
    

    // when I click on “Pause” button
    this.ui.onPause = () => {
      this.sound.setBgmVolume(0.1);
      this.isRunning = false;
    };
    
    // when I click on “Resume” button
    this.ui.onResume = () => {
      this.isRunning = true;
      this.sound.setBgmVolume(0.3); 
    };
    
    //when I click on “Quit to Menu” button (from pause, win or game over)
    this.ui.onQuit = () => {
      this.isRunning = false;
      this.explorationMode = false;
      this.sound.playBgm();
      this.sound.setBgmVolume(0.1); 
    };
    
    // when I click on “Restart” button (from Game Over alert)
    this.ui.onRestart = () => window.location.reload();
    
    //here I call the animate method 
    this.animate();
  } 
  //end of constructor method--------------------------------------------------------------------------------------------------------------------------------------
  

  //this method generates a random position xz in [-75,75] so that it does not overlap on already placed obstacles. 
  //it uses centerOffset2D for the real center
  private findFreePosition(
    radius: number,
    centerOffset2D: THREE.Vector2,
    maxTries = 20 //max number of tries for each object. If we get over it, we simply do not spawn that object(see fallback part).
  ): THREE.Vector2 {
    for (let i = 0; i < maxTries; i++) {
      const x = Math.random() * 150 - 75;
      const z = Math.random() * 150 - 75;
      const c = new THREE.Vector2(x + centerOffset2D.x, z + centerOffset2D.y);
      let ok = true;
      for (const o of this.placedObstacles) {
        if (c.distanceTo(o.pos) < o.radius + radius) {
          ok = false;
          break;
        }
      }
      if (ok) return new THREE.Vector2(x, z);
    }
    // fallback 
    return new THREE.Vector2(
      Math.random() * 150 - 75,
      Math.random() * 150 - 75
    );
  }
  
  private createTreeWithLeaves(): THREE.Group {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 5, 8),
      new THREE.MeshStandardMaterial({ color: 0x8b4513 })
    );
    trunk.position.y = 1;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    tree.add(trunk);
    const foliageMaterial = new THREE.MeshStandardMaterial({ color: 0xffa500 });
    const chiomaRadius = 1.4;
    for (let i = 0; i < 5; i++) {
      const foliage = new THREE.Mesh(new THREE.SphereGeometry(chiomaRadius, 8, 8), foliageMaterial);
      foliage.position.set((Math.random() - 0.5) * 0.8, 4.5 + Math.random() * 0.5,(Math.random() - 0.5) * 0.8);
      foliage.castShadow = true;
      foliage.receiveShadow = true;
      tree.add(foliage);
    }
    const leafColors = [0xffa500, 0xffd700, 0x8b4513]; //fall colors
    for (let i = 0; i < 12; i++) { //12 leaves for each tree
      const leafShape = new THREE.Shape();
      leafShape.moveTo(0, 0);
      // Cubic Bézier curves use four points (P0->P3) and two control handles (P1,P2) to create smooth interpolations via B(t) = (1−t)³P0 + 3(1−t)²tP1 + 3(1−t)t²P2 + t³P3.
      // In Three.js, Shape.bezierCurveTo(x1,y1, x2,y2, x3,y3) adds a segment from the current point to (x3,y3), “pulled” toward (x1,y1) and (x2,y2).
      leafShape.bezierCurveTo( 0.03,  0.07,   0.06, 0.15,   0, 0.25);
      leafShape.bezierCurveTo(-0.06,  0.15,  -0.03, 0.07,   0, 0);
      const leafGeometry = new THREE.ShapeGeometry(leafShape, 8);
      const color = leafColors[
        Math.floor(Math.random() * leafColors.length)
      ];
      const leafMaterial = new THREE.MeshStandardMaterial({
        color,
        side: THREE.DoubleSide
      });
      const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
      leaf.scale.set(1.2, 1.2, 1.2);
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * chiomaRadius;
      leaf.position.set(Math.cos(angle) * radius, 4.5 + Math.random(), Math.sin(angle) * radius);
      leaf.rotation.set(Math.random(), Math.random(), Math.random());
      leaf.userData = {
        velocity: 0.002 + Math.random() * 0.003,
        falling: true,
        windPhase: Math.random() * Math.PI * 2,
        resetTime: 0
      };
      leaf.castShadow = true;
      leaf.receiveShadow = true;
      tree.add(leaf);
      this.fallingLeaves.push(leaf);
    }
    //here I add a collision sphere for the entire tree
    const collisionRadius = 0.45; 
    const collisionHeight = 4.0; 
    const centerOffset2D = new THREE.Vector2(0, 1 + collisionHeight / 2);
    const pos2D = this.findFreePosition(collisionRadius, centerOffset2D);
    tree.position.set(pos2D.x, 0, pos2D.y);
    const collisionGeometry = new THREE.CylinderGeometry(
      collisionRadius,
      collisionRadius,
      collisionHeight,
      8 
    );
    const collisionMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true, visible: false, transparent: true, opacity: 0.5 });
    const collisionMesh = new THREE.Mesh(collisionGeometry, collisionMaterial);
    collisionMesh.position.y = 1 + collisionHeight / 2; 
    tree.add(collisionMesh);
    collisionMesh.userData.isCollisionMesh = true;  // save a reference so that later is easier to find it
    this.placedObstacles.push({   //mark as obstacle for next spawns  
          pos: new THREE.Vector2(pos2D.x + centerOffset2D.x, pos2D.y + centerOffset2D.y),    
          radius: collisionRadius    
      });
    return tree;
  }

  private createPine(): THREE.Group {
    const pine = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.3, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0x8b4513 })
    );
    trunk.position.y = 2;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    pine.add(trunk);
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x2e8b57 });
    const levels = 4;
    for (let i = 0; i < levels; i++) {
      const factor = 1 - i / levels;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.5 * factor, 1.5, 8), foliageMat);
      cone.position.y = 4 + i * 1.1;
      cone.castShadow = true;
      cone.receiveShadow = true;
      pine.add(cone);
    }
    const collisionRadius = 0.2; 
    const collisionHeight = 4.0; 
    const centerOffset2D = new THREE.Vector2(0, collisionHeight / 2);
    const pos2D = this.findFreePosition(collisionRadius, centerOffset2D);
    pine.position.set(pos2D.x, 0, pos2D.y);
    const collisionGeometry = new THREE.CylinderGeometry(
      collisionRadius,
      collisionRadius,
      collisionHeight,
      8
    );
    const collisionMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true, visible: false, transparent: true, opacity: 0.5 });
    const collisionMesh = new THREE.Mesh(collisionGeometry, collisionMaterial);
    collisionMesh.position.y = collisionHeight / 2; // in order to center on the ground the position
    pine.add(collisionMesh);
    collisionMesh.userData.isCollisionMesh = true;
    this.placedObstacles.push({
      pos: new THREE.Vector2(pos2D.x + centerOffset2D.x, pos2D.y + centerOffset2D.y),
      radius: collisionRadius
    });
    return pine;
  }

  //this method creates an orizzontal plateau deformed by noise
  public createProceduralMountain(width: number, depth: number, widthSeg: number, depthSeg: number, heightScale: number): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(width, depth, widthSeg, depthSeg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, this.noise.noise(x / width * 2, z / depth * 2, 0) * heightScale);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      color: 0x888888,
      flatShading: true,
      roughness: 1,
      metalness: 0.1
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = mesh.receiveShadow = true;
    return mesh;
  }

  public addProceduralRing(
    count: number,
    ringRadius: number,
    width: number,
    depth: number,
    heightScale: number
  ) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const x = Math.cos(angle) * ringRadius;
      const z = Math.sin(angle) * ringRadius;
      const m = this.createProceduralMountain(width, depth, 16, 8, heightScale);
      m.position.set(x, 0, z);
      m.lookAt(0, 0, 0);
      this.scene.add(m); 
    }
  }

  private placePerimeterModels(specs: { path: string; scale: number }[]) {
    const loader = new GLTFLoader();
    const sceneSize = 230; //here I have increased the scene size just to set the mountains a little further away 
    const half = sceneSize / 2;
    const perimeter = sceneSize * 4;
    const step = perimeter / specs.length;
    specs.forEach((spec, i) => {
      loader.load(spec.path, gltf => {
        const model = gltf.scene;
        model.traverse(o => {
          if ((o as THREE.Mesh).isMesh) {
            (o as THREE.Mesh).castShadow = true;
            (o as THREE.Mesh).receiveShadow = true;
          }
        });
        model.scale.setScalar(spec.scale);
        // calculates distance along the perimeter 
        const d = i * step + step / 2; 
        let x = 0, z = 0;
        if (d < sceneSize) { //south side
          x = -half + d;
          z = -half;
        } else if (d < sceneSize * 2) { //east side
          x = +half;
          z = -half + (d - sceneSize);
        } else if (d < sceneSize * 3) { //north side
          x = +half - (d - sceneSize * 2);
          z = +half;
        } else { //west side
          x = -half;
          z = +half - (d - sceneSize * 3);
        }
        model.position.set(x, -1.4, z);
        model.lookAt(0, 0, 0);
        this.scene.add(model);
        const bbox = new THREE.Box3().setFromObject(model); //calculates bounding box of the model
        const size = bbox.getSize(new THREE.Vector3());
        let mountainCollisionRadius = 21.5; 
        let mountainCollisionCenterOffset = new THREE.Vector3(4, 0.5, 20);
        if (spec.path === '/models/low_poly_mountain.glb') {
          mountainCollisionRadius = 40;
          mountainCollisionCenterOffset = new THREE.Vector3(0, 0.5, 0); 
        }
        this.collidables.push({
          mesh: model, 
          radius: mountainCollisionRadius,
          centerOffset: mountainCollisionCenterOffset
        });
        const worldPos = model.getWorldPosition(new THREE.Vector3());
        this.placedObstacles.push({
          pos: this.vec2(worldPos.x + mountainCollisionCenterOffset.x, worldPos.z + mountainCollisionCenterOffset.z),
          radius: mountainCollisionRadius
        });
      });
    });
  }
  
  //here I create the bird that flies aroun the scene
  private createEagle() {
    const bird = new THREE.Group()
    const bodyGeo = new THREE.CylinderGeometry(0.5, 0.7, 2, 8)
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x444444, flatShading: true })
    const body = new THREE.Mesh(bodyGeo, bodyMat)
    body.rotation.z = Math.PI / 2
    bird.add(body)
    const headGeo = new THREE.SphereGeometry(0.5, 8, 8)
    const headMat = new THREE.MeshStandardMaterial({ color: 0x555555, flatShading: true })
    const head = new THREE.Mesh(headGeo, headMat)
    head.position.set(1.1, 0, 0)
    bird.add(head)
    const wingGeo = new THREE.BoxGeometry(3, 0.1, 1)
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x333333, flatShading: true })
    const leftWing = new THREE.Mesh(wingGeo, wingMat)
    const rightWing = leftWing.clone()
    leftWing.position.set(0, 0, 0.6)
    rightWing.position.set(0, 0, -0.6)
    bird.add(leftWing, rightWing)
    const beakGeo = new THREE.ConeGeometry(0.2, 0.8, 6)
    const beakMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, flatShading: true })
    const beak = new THREE.Mesh(beakGeo, beakMat)
    beak.rotation.z = Math.PI / 2
    beak.position.set(1.6, 0, 0)
    bird.add(beak)
    this.bird = bird
    this.scene.add(this.bird)
  }

  private loadFoxModel() {
    const loader = new GLTFLoader();
    loader.load('/models/NewFox.glb', gltf => {
      // set model
      this.model = gltf.scene as THREE.Group;
      this.model.traverse(o => {
        if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; }
      });
      this.foxContainer.add(this.model);
      this.foxContainer.scale.set(1.5, 1.5, 1.5);
      this.model.scale.set(0.012, 0.012, 0.012);
      this.foxContainer.position.y = -.02;
      this.foxContainer.rotation.y = Math.PI;
      this.scene.add(this.foxContainer);
      this.model.traverse((o) => {
        if (o instanceof THREE.Bone) {
          if (o.name === 'b_Spine01_02') {
            this.spine1 = o;
            this.spine1BaseZ = o.rotation.z; // for some bones we need also the base z rotation in order to handle the return to the idle animation
          }
          if (o.name === 'b_Spine02_03') {
            this.spine2 = o;
            this.spine2BaseZ = o.rotation.z;
          }
          if (o.name === 'b_Head_05') this.head = o;
          if (o.name === 'b_Tail01_012') this.tail1 = o;
          if (o.name === 'b_Tail02_013') this.tail2 = o;
          if (o.name === 'b_Tail03_014') this.tail3 = o;
          if (o.name === 'b_LeftLeg01_015') {
            this.leftLeg = o;
            this.leftLegBaseZ = o.rotation.z;
          }
          if (o.name === 'b_RightLeg01_019') {
            this.rightLeg = o;
            this.rightLegBaseZ = o.rotation.z;
          }
          if (o.name === 'b_LeftUpperArm_09') {
            this.leftArm = o;
            this.leftArmBaseZ = o.rotation.z;
          }
          if (o.name === 'b_RightUpperArm_06') {
            this.rightArm = o;
            this.rightArmBaseZ = o.rotation.z;
          }
          if (o.name === 'b_LeftForeArm_010') {
            this.leftForeArm = o;
            this.leftForearmBaseZ = o.rotation.z;
          }
          if (o.name === 'b_RightForeArm_07') {
            this.rightForeArm = o;
            this.rightForearmBaseZ = o.rotation.z;
          }
          if (o.name === 'b_LeftHand_011') {
            this.leftHand = o;
            this.leftHandBaseZ = o.rotation.z;
          }
          if (o.name === 'b_RightHand_08') {
            this.rightHand = o;
            this.rightHandBaseZ = o.rotation.z;
          }
          if (o.name === 'b_LeftHand_011') this.leftHand = o;
          if (o.name === 'b_RightHand_08') this.rightHand = o;
        }
      });
      this.baseY = this.model.position.y;
    });
  }
  
  //Prints the bone hierarchy to the console, for debugging.
  private printBoneHierarchy(object: THREE.Object3D, depth: number = 0): void {
    const indent = '  '.repeat(depth);
    console.log(`${indent}${object.name || '(no name)'}`);
    if (object.children) {
      object.children.forEach(child => {
        this.printBoneHierarchy(child, depth + 1);
      });
    }
  }

  //this method performs linear interpolation (lerp) between two angles, following the shortest path
  private lerpAngle(a: number, b: number, t: number): number {
    const shortestAngle = this.shortestAngleDifference(a, b);
    return a + shortestAngle * t;
  }

  //returns the shortest angular difference from a to b (in radiants), normalized between -π and π, accounting for angle periodicity.
  private shortestAngleDifference(a: number, b: number): number {
    let diff = b - a;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    return diff;
  }

  public setFoxState(state: FoxState) {
    if (state === 'jump' && this.foxState !== 'jump') {
      this.jumpStartTime = this.clock.getElapsedTime()
    }
    this.foxState = state
  }

  private load3DTrees(cfg: TreeCollisionConfig) {
    const { path, count, scale, offsetY, collisionRadius, centerOffset } = cfg;
    const loader = new GLTFLoader();
    loader.load(
      path,(gltf) => {
        const treeModel = gltf.scene;
        treeModel.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
            if (obj.material) {
              if (Array.isArray(obj.material)) {
                obj.material = obj.material.map(mat => mat.clone());
              } else {
                obj.material = obj.material.clone();
              }
            }
          }
        });
        const originalBBox = new THREE.Box3().setFromObject(treeModel);
        const originalSize = originalBBox.getSize(new THREE.Vector3());
        treeModel.position.set(
          -originalBBox.min.x - originalSize.x / 2,
          -originalBBox.min.y,
          -originalBBox.min.z - originalSize.z / 2
        );
        const treeContainer = new THREE.Group();
        treeContainer.add(treeModel);
        treeContainer.scale.set(scale, scale, scale);
        const currentBBox = new THREE.Box3().setFromObject(treeContainer);
        const finalOffsetY = offsetY - currentBBox.min.y;
        for (let i = 0; i < count; i++) {
          const instance = treeContainer.clone();
          const cfgOffset2D = new THREE.Vector2(centerOffset.x, centerOffset.z);
          const pos2D = this.findFreePosition(collisionRadius, cfgOffset2D);
          instance.position.set(pos2D.x, finalOffsetY, pos2D.y);
          instance.rotation.y = Math.random() * Math.PI * 2;
          this.scene.add(instance);
          this.collidables.push({
            mesh: instance, 
            radius: collisionRadius,
            centerOffset
          });
          this.placedObstacles.push({
            pos: new THREE.Vector2(pos2D.x + cfgOffset2D.x, pos2D.y + cfgOffset2D.y),
            radius: collisionRadius
          });
        }
      },
      undefined,
      (error) => {
        console.error(
          `Error loading tree model from ${path}:`,
          error
        );
      }
    );
  }
  /**
 * In WebGL/Three.js, rendering a mesh involves two small GPU programs:
 * 
 * 1. Vertex Shader
 *    • Runs once per vertex.
 *    • Transforms 3D positions (model → world → view → clip space).
 *    • Can deform geometry (e.g. waves, skinning) by adjusting vertex positions.
 *    • Passes data (varyings) to the fragment shader.
 * 
 * 2. Fragment Shader
 *    • Runs once per pixel (fragment) covered by a triangle.
 *    • Computes final color, lighting, reflections, fog, etc.
 *    • Can sample textures, cubemaps, and apply procedural effects.
 */
  private setupSky() {
    this.skyUniforms = { //Defines all controls (uniforms) for the sky appearance
      uTime: { value: 0 },
      uSunPosition: { value: new THREE.Vector3() },
      uSunColor: { value: new THREE.Color(0xffe0a0) },
      uHorizonColor: { value: new THREE.Color(0xff8800) },
      uZenithColor: { value: new THREE.Color(0x87ceeb) },
      uNightColor: { value: new THREE.Color(0x0a0a20) },
      uTwilightColor: { value: new THREE.Color(0x6a0dad) },
      uRayleigh: { value: 0.8 }, //scattering coefficients for atmosphere
      uMie: { value: 0.008 },    //scattering coefficients for atmosphere
      uTurbidity: { value: 20 }, //scattering coefficients for atmosphere
      uAtmosphereThickness: { value: 1.0 },
      uExposure: { value: 0.8 }
    };
    const skyGeometry = new THREE.SphereGeometry(1000, 32, 15); //Creates a large sphere and renders its inside (BackSide).
    const skyMaterial = new THREE.ShaderMaterial({ //Attaches a custom ShaderMaterial using my vertex & fragment code.
      uniforms: this.skyUniforms,
      vertexShader: this.getSkyVertexShader(), 
      fragmentShader: this.getSkyFragmentShader(),
      side: THREE.BackSide
    });
    this.scene.add(new THREE.Mesh(skyGeometry, skyMaterial));
  }
  
  // Computes vWorldPosition, outputs gl_Position.  vWorldPosition is passed to the fragment shader.
  private getSkyVertexShader(): string {
    return /* glsl */ `
      varying vec3 vWorldPosition;
      void main() {
        vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz; 
        //projectionMatrix è la matrice di proiezione della camera, 
        //modelViewMatrix è il prodotto di viewMatrix (la trasformazione della camera) e modelMatrix (la trasformazione dell’oggetto), quindi porta i vertici dallo spazio locale al viev space
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
  }

  private getSkyFragmentShader(): string {
    return /* glsl */ `
      uniform float uTime;
      uniform vec3 uSunPosition;
      uniform vec3 uSunColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uZenithColor;
      uniform vec3 uNightColor;
      uniform vec3 uTwilightColor;
      uniform float uRayleigh;
      uniform float uMie;
      uniform float uTurbidity;
      uniform float uAtmosphereThickness;
      uniform float uExposure;
      varying vec3 vWorldPosition;

      vec3 linearTosRGB(vec3 color) {
        return pow(color, vec3(1.0 / 2.2));
      }
      void main() {
        //1. Normalize directions: utile per calcoli come il dot product, riflessioni, ecc
        vec3 worldDirection = normalize(vWorldPosition - cameraPosition);
        vec3 sunDirection = normalize(uSunPosition);

        //2. Compute dot products:
        float sunDot = dot(worldDirection, sunDirection);
        float upDot = dot(worldDirection, vec3(0.0, 1.0, 0.0));
        float normalizedSunY = uSunPosition.y / 100.0; //to track sun above/below horizon
        vec3 dayHorizonZenithMix = mix(uHorizonColor, uZenithColor, max(0.0, upDot));

        //3. Day/Night/Evening color blending:
        float nightFactor = smoothstep(0.1, -0.2, normalizedSunY);
        float twilightFactor = 0.0;
        if (normalizedSunY < 0.3 && normalizedSunY > -0.3) {
          twilightFactor = smoothstep(0.3, 0.0, normalizedSunY) - smoothstep(0.0, -0.3, normalizedSunY);
        }
        twilightFactor = clamp(twilightFactor, 0.0, 1.0);
        vec3 finalSkyColor = mix(dayHorizonZenithMix, uNightColor, nightFactor);
        finalSkyColor = mix(finalSkyColor, uTwilightColor, twilightFactor);
        float lightMultiplier = smoothstep(-0.5, 0.5, normalizedSunY);

        //4. Rayleigh scattering (blue sky):
        float rayleighCoefficient = pow(max(0.0, 1.0 - upDot), 2.0); //Adds blueish tint to lower sky when sun is low.
        vec3 rayleighColor = uZenithColor * rayleighCoefficient * uRayleigh * lightMultiplier;
        finalSkyColor += rayleighColor;

        //5. Mie scattering (haze around sun):
        float mieCoefficient = pow(max(0.0, sunDot + 0.1), 10.0) * uMie; 
        vec3 mieColor = uSunColor * mieCoefficient * uTurbidity * lightMultiplier; //Adds warm glow near sun disk.
        finalSkyColor += mieColor;

        //6. Sun glare:
        float sunGlareVisibility = smoothstep(-0.1, 0.1, normalizedSunY);
        float sunAngularSpread = pow(max(0.0, sunDot), 200.0);

        //7. Exposure & sRGB:
        finalSkyColor += uSunColor * sunAngularSpread * sunGlareVisibility * 2.5;
        finalSkyColor *= uExposure; //Convert linear color to sRGB gamma via pow(color,1/2.2).

        //8. Output:
        gl_FragColor = vec4(linearTosRGB(finalSkyColor), 1.0);
      }
    `;
  }

  private smoothstep(edge0: number, edge1: number, x: number): number {
    x = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return x * x * (3 - 2 * x);
  }

  private createSimpleGround() {
    const loader = new THREE.TextureLoader();
    const grassTex = loader.load('/textures/grass4.jpg');
    // repeat the texture over x and z
    grassTex.wrapS = THREE.RepeatWrapping;
    grassTex.wrapT = THREE.RepeatWrapping;
    grassTex.repeat.set(20, 20);
    grassTex.colorSpace = THREE.SRGBColorSpace;
    const groundMaterial = new THREE.MeshStandardMaterial({
      map: grassTex,
      roughness: 2,
      metalness: -0.8
    });
    const groundGeometry = new THREE.PlaneGeometry(200, 200);
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.groundObjects.push(ground);
  }

  // here I make the mushrooms spawn randomly in the scene
  private spawnMushrooms(n: number) {
    const loader = new GLTFLoader();
    loader.load('/models/low_poly_mushroom_02.glb', gltf => {
      const mog = gltf.scene;
      mog.traverse(o => o instanceof THREE.Mesh && (o.castShadow = o.receiveShadow = true));
      for (let i = 0; i < n; i++) {
        const inst = mog.clone();
        inst.position.set(Math.random()*150-75, 0.0, Math.random()*150-75);
        inst.userData.spawnPosition = inst.position.clone();
        inst.scale.setScalar(0.05);
        this.scene.add(inst);
        const box = new THREE.Box3().setFromObject(inst);
        const size = box.getSize(new THREE.Vector3());
        const radius = Math.max(size.x, size.z) / 2;
        this.items.push({ mesh: inst, type: 'mushroom', radius });
      }
    });
  }

// here I make the eggs spawn near the bushes
private spawnEggs(bushes: THREE.Object3D[], perBush: number) {
  for (const bush of bushes) {
    const bbox = new THREE.Box3().setFromObject(bush);
    const center = bbox.getCenter(new THREE.Vector3());
    for (let i = 0; i < perBush; i++) {
      // 1) spawn position
      const angle = Math.random() * Math.PI * 2;
      const spawnDist = Math.max(bbox.getSize(new THREE.Vector3()).x, bbox.getSize(new THREE.Vector3()).z) / 2 + 1;
      const pos = center.clone().add(new THREE.Vector3(Math.cos(angle) * spawnDist, 0, Math.sin(angle) * spawnDist));
      const eggGeom = new THREE.SphereGeometry(0.15, 8, 8);
      const eggMat  = new THREE.MeshStandardMaterial({ color: 0xffff99 });
      const egg     = new THREE.Mesh(eggGeom, eggMat);
      egg.scale.set(0.7, 1.2, 0.7);   // oval
      // little random inclination to give realism
      const tiltMax = 20 * Math.PI / 180;
      egg.rotation.x = (Math.random() * 2 - 1) * tiltMax;
      egg.rotation.z = (Math.random() * 2 - 1) * tiltMax;
      egg.rotation.y = Math.random() * Math.PI * 2;
      egg.position.set(pos.x, 0.1, pos.z);
      egg.userData.spawnPosition = egg.position.clone();
      this.scene.add(egg);
      // here I calculate the real collision radius
      const eggBox = new THREE.Box3().setFromObject(egg);
      const eggSize = eggBox.getSize(new THREE.Vector3());
      const eggRadius = Math.max(eggSize.x, eggSize.z) / 2;
      this.items.push({ //to add to the score 
        mesh:   egg,
        type:   'egg',
        radius: eggRadius
      });
    }
  }
}

  // here i make the rubies spawn around the stones in the ground
  private spawnRubies(stones: THREE.Object3D[], perStone: number) {
    if (!this.rubyModel) return;
    for (const st of stones) {
      // stone center
      const bbox = new THREE.Box3().setFromObject(st);
      const center = bbox.getCenter(new THREE.Vector3());
      for (let i = 0; i < perStone; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.max(bbox.getSize(new THREE.Vector3()).x,bbox.getSize(new THREE.Vector3()).z) / 2 + 1;
        const pos = center.clone().add(new THREE.Vector3(Math.cos(angle) * r,0,Math.sin(angle) * r));
        // ruby clone and setup 
        const inst = this.rubyModel.clone();
        inst.scale.setScalar(0.2);
        inst.position.set(pos.x, 0.3, pos.z);
        inst.userData.spawnPosition = inst.position.clone();
        this.scene.add(inst);
        const rubyBox = new THREE.Box3().setFromObject(inst);
        const size    = rubyBox.getSize(new THREE.Vector3());
        const rubyRadius = Math.max(size.x, size.z) / 2 * 0.5; //half of half of the max dim
        this.items.push({ //to add to the score 
          mesh:   inst,
          type:   'ruby',
          radius: rubyRadius
        });      
      }
    }
  }
  //here i make the Chicken spawn from the coop
  private spawnChickenAtCoop() {
    if (!this.coopRef || !this.chickenModel) return;
    const spawnPos = this.coopRef.position.clone().add(new THREE.Vector3(3, 0, 3));
    const wrapper = new THREE.Group();
    wrapper.position.set(spawnPos.x, 0, spawnPos.z);
    const model = this.chickenModel.clone();
    model.scale.setScalar(3.45);
    wrapper.add(model);
    this.scene.add(wrapper);
    const chickenBox = new THREE.Box3().setFromObject(wrapper);
    const chickenSize = chickenBox.getSize(new THREE.Vector3());
    const chickenRadius =0.5;
    model.position.y = 0;
    model.rotation.y = -Math.PI / 2;
    this.chickens.push(
      new Chicken(
        wrapper,
        this.coopRef.position.clone(),
        this.spawnDistance,
        this.ui,
        () => { 
          this.sound.playAlert(); 
          this.ui.showTemporaryMessage('The chicken is looking for you...', 1.5);
        },
        this.collidables,    // here i pass the object list on which do avoidance
        chickenRadius, 
        this.audioListener, 
        this.sound.getBuffer('cluck')!
      )
    );
  }

  private clearSceneItems() {
    // removes all mushrooms, eggs, rubies and the chicken
    this.items.forEach(i => this.scene.remove(i.mesh));
    this.items.length = 0;
    this.chickens.forEach(c => this.scene.remove(c.mesh));
    this.chickens.length = 0;
  }

  //animate method---------------------------------------------------------------------------------------------------------------------------------------------------
  private animate = () => {
    // Schedule this.animate() to run again on the next browser repaint, creating a continuous render loop synchronized to the display refresh rate
    requestAnimationFrame(this.animate);
    const delta = this.clock.getDelta(); //seconds elapsed since the last frame. used for frame-rate independent updates
    const t = this.clock.getElapsedTime(); //total seconds elapsed since the clock was started.
    this.skyUniforms.uTime.value = t;
    this.lake.update(delta);

    if (!this.isRunning && !this.explorationMode) { // if the game hasnt started yet, I only render the scene
      this.renderer.render(this.scene, this.camera);
      return;
    }
    
    this.ui.update(delta);

    if (!this.explorationMode && this.ui.score >= 150) { //win check
      this.isRunning = false;
      this.sound.stopBgm();
      this.sound.playVictory();
      this.ui.showWin(this.ui.score);
      return; 
    }
    
    for (let i = this.chickens.length - 1; i >= 0; i--) {
      const res = this.chickens[i].update(delta, this.foxContainer.position);
      if (res === 'caught') { // caught, so remove the mesh and perform game over alert
        this.scene.remove(this.chickens[i].mesh);
        this.chickens.splice(i, 1);
        this.sound.stopBgm();
        this.sound.playDefeat();
        this.ui.showGameOver(this.ui.score);
        this.isRunning = false;
      }
      else if (res === 'escaped') {
        this.sound.playSowed();
      }
    }

    //day-night cycle tuning
    const cycleSpeed = 0.01;
    const angle = t * cycleSpeed;
    const radius = 100;
    this.sunPosition.set(Math.cos(angle) * radius, Math.sin(angle) * radius, Math.cos(angle * 0.5 + Math.PI / 4) * 50);
    if (this.directionalLight) {
      this.directionalLight.position.copy(this.sunPosition);
      this.skyUniforms.uSunPosition.value.copy(this.sunPosition);
      const lightIntensityFactor = this.smoothstep(-radius * 0.8, radius * 0.5, this.sunPosition.y);
      this.directionalLight.intensity = 0.5 + lightIntensityFactor * 2.0;
      this.directionalLight.castShadow = this.sunPosition.y > 5;
      //ambient: from 0.1 (night) to 0.8 (day)
      this.ambientLight.intensity = THREE.MathUtils.lerp(0.1, 0.8, lightIntensityFactor);
      //exposure: from 0.3 (night) to 1.0 (day)
      this.renderer.toneMappingExposure = THREE.MathUtils.lerp(0.3, 1.0, lightIntensityFactor);

      //lake reflex based on light intensity that changes during the cycle
      if (this.lake && this.lake.waterMaterial && this.lake.waterMaterial.uniforms.uLightIntensityFactor) {
        this.lake.waterMaterial.uniforms.uLightIntensityFactor.value = lightIntensityFactor;
      }
      //fog color based on light intensity that changes during the cycle
      if (this.scene.fog) {
        this.scene.fog.color.copy(this.nightFogColor.clone().lerp(this.dayFogColor, lightIntensityFactor));
      }
      // Gradually boost ambient light intensity as the sun dips below the horizon to prevent the scene from going completely dark.
      this.scene.children.forEach((obj) => {
        if (obj instanceof THREE.AmbientLight) {
          const ambientFactor = this.smoothstep(-radius, 0, -this.sunPosition.y);
          obj.intensity = 0.8 + ambientFactor * 1.2;
        }
      });
    }

    // bird animation 
    this.birdAngle += this.birdSpeed * delta
    const x = Math.cos(this.birdAngle) * this.birdRadius
    const z = Math.sin(this.birdAngle) * this.birdRadius
    const y = 15  // how high the bird flies from the ground
    this.bird.position.set(x, y, z)
    this.bird.lookAt(0, y, 0)

    // move wings with a simple oscillation 
    const flap = Math.sin( this.birdAngle * 8 ) * 0.5 + 0.5  
    ;(this.bird.children[2] as THREE.Mesh).rotation.y = flap * 0.5   // leftWing
    ;(this.bird.children[3] as THREE.Mesh).rotation.y = -flap * 0.5  // rightWing

    // fox Raycasting to perform collision detection
    if (this.model && this.groundObjects.length) {
      const terrainHeight = 0; // Il piano è a y=0
      const foxBaseOffset = 0;
      this.model.position.y = terrainHeight + foxBaseOffset;
    }

    // dynamic leaves animation
    for (const leaf of this.fallingLeaves) {
      const data = leaf.userData;
      if (data.falling) {
        leaf.position.y -= data.velocity;
        leaf.position.x += Math.sin(t * 2 + data.windPhase) * 0.0015;
        leaf.rotation.x += 0.01;
        leaf.rotation.y += 0.02;
        leaf.rotation.z += 0.005;
        if (leaf.position.y <= 0.05) { // leave a small distance from the plane
          leaf.position.y = 0.05;
          data.falling = false;
          data.resetTime = t + 3 + Math.random() * 4;
        }
      } else if (t > data.resetTime) {
        const angle2 = Math.random() * Math.PI * 2;
        const radius2 = Math.random() * 1.4;
        leaf.position.set(
          Math.cos(angle2) * radius2,
          4.5 + Math.random(),
          Math.sin(angle2) * radius2
        );
        data.falling = true;
      }
    }

    // fox movement and rotation
    if (this.foxContainer) {
      let moving = false;
      const fwd = new THREE.Vector3(0,0,1).applyQuaternion(this.foxContainer.quaternion);
      let dir = new THREE.Vector3();
      let moveSpeed = 0;
      let walkSpeed = 0;
      if (this.keys['KeyW']) {
        moving = true; dir.copy(fwd);
        this.isSprinting = this.keys['ShiftLeft'];
        moveSpeed = this.isSprinting ? this.baseMoveSpeed * 2.5 : this.baseMoveSpeed;     // container move speed
        walkSpeed = this.isSprinting ? this.baseWalkSpeed * 2.5 : this.baseWalkSpeed;     // anim move speed
      } else if (this.keys['KeyS']) {
        moving = true; dir.copy(fwd).negate();
        moveSpeed = this.baseMoveSpeed;
        walkSpeed = -this.baseWalkSpeed;
      } else
      {
        this.isSprinting = false;
        moving = false;
      }
      if (this.keys['KeyA']) this.foxContainer.rotation.y += 0.05;
      if (this.keys['KeyD']) this.foxContainer.rotation.y -= 0.05;
      if (moving) {
        const moveDelta = dir.clone().multiplyScalar(moveSpeed * delta);
        const desiredPos = this.foxContainer.position.clone().add(moveDelta);
        // centro della volpe in pianta
        const fox2D = new THREE.Vector2(desiredPos.x, desiredPos.z);
        let hit = false;
        for (const c of this.collidables) {
          const meshPos = c.mesh.getWorldPosition(new THREE.Vector3());
          const centerX = meshPos.x + c.centerOffset.x;
          const centerZ = meshPos.z + c.centerOffset.z;
          const dx = desiredPos.x - centerX;
          const dz = desiredPos.z - centerZ;
          // “raggio” della volpe + raggio dell'ostacolo, rispettivamente su X e Z
          const rx = this.foxCollisionRadiusX + c.radius;
          const rz = this.foxCollisionRadiusZ + c.radius;
          // se il punto cade dentro l’ellisse: collisione!
          if ((dx*dx)/(rx*rx) + (dz*dz)/(rz*rz) < 1) {
            hit = true;
            break;
          }
        }
        if (!hit) {
          this.foxContainer.position.copy(desiredPos);
          this.setFoxState(this.keys['ShiftLeft'] ? 'run' : 'walk');
        } else {
          this.setFoxState('idle');
        }
        // set rotation target for anim orientation (based on camera target)
        const cameraDirection = new THREE.Vector3(Math.sin(this.cameraAzimuth), 0, Math.cos(this.cameraAzimuth));
        const cameraRight = new THREE.Vector3().crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0)).normalize();
        const moveDir = new THREE.Vector3().addScaledVector(cameraDirection, dir.z).addScaledVector(cameraRight, -dir.x).normalize();
        const lerpSpeed = 0.012;
        const targetAngle = Math.atan2(moveDir.x, moveDir.z);   // restituisce l’angolo tra il punto (x, y) e l’origine (0, 0), determina in che direzione si muove il modello rispetto l'asse z
        //this.model.rotation.y = this.lerpAngle(this.model.rotation.y, targetAngle, lerpSpeed);
        this.lastRotationTarget = targetAngle;

      } else if (!moving && (this.foxState==='walk' || this.foxState==='run')) {
        this.setFoxState('idle');
        this.lastRotationTarget = 0;
      }
     
      // follow camera + camera rotation
      const radius = 3;  //fixed radius

      // coordinate sferiche -> cartesian:
      const x = radius * Math.cos(this.cameraElevation) * Math.sin(this.cameraAzimuth);
      const y = radius * Math.sin(this.cameraElevation);
      const z = radius * Math.cos(this.cameraElevation) * Math.cos(this.cameraAzimuth);

      const desiredPos = this.foxContainer.position.clone().add(new THREE.Vector3(x, y + 1, z));
      this.camera.position.lerp(desiredPos, 0.1);
      this.camera.lookAt(this.foxContainer.position.clone().add(new THREE.Vector3(0,1,-1)));

      //fox animations
      const time = performance.now() * 0.001;
      const isWalking = moving && !this.isSprinting;

      // Blend weights
      this.idleWeight += ((moving ? 0 : 1) - this.idleWeight) * this.blendSpeed;
      this.walkWeight += ((isWalking ? 1 : 0) - this.walkWeight) * this.blendSpeed;
      this.sprintWeight += ((this.isSprinting ? 1 : 0) - this.sprintWeight) * this.blendSpeed;

      // anim times
      const walkTime = time * this.baseWalkSpeed;
      const sprintTime = time * this.baseWalkSpeed * 2.5;

      // constants calcuated each frame to determine bones positions for each state
      // IDLE
      const idleLegLeft = this.leftLegBaseZ;
      const idleLegRight = this.rightLegBaseZ;
      const idleArmLeft = this.leftArmBaseZ;
      const idleArmRight = this.rightArmBaseZ;
      const idleForeArmLeft = this.leftForearmBaseZ;
      const idleForeArmRight = this.rightForearmBaseZ;
      const idleHandLeft = this.leftHandBaseZ;
      const idleHandRight = this.rightHandBaseZ;
      const idleHeadX = Math.sin(time * 0.9) * 0.03;
      const idleHeadY = 0;
      const idleTail1 = Math.sin(time * 2) * 0.1;
      const idleTail2 = Math.sin(time * 2 + 0.5) * 0.15;
      const idleTail3 = Math.sin(time * 2 + 1) * 0.2;
      const idleBodyY = 0;

      // WALK
      const walkLegLeft = this.leftLegBaseZ + Math.sin(walkTime) * this.walkAmplitudeLegs;
      const walkLegRight = this.rightLegBaseZ + Math.sin(walkTime + Math.PI) * this.walkAmplitudeLegs;
      const walkArmLeft = this.leftArmBaseZ + Math.sin(walkTime + Math.PI) * this.walkAmplitudeArms;
      const walkArmRight = this.rightArmBaseZ + Math.sin(walkTime) * this.walkAmplitudeArms;
      const walkForeArmLeft = Math.sin(walkTime + Math.PI) * this.walkAmplitudeForeArm;
      const walkForeArmRight = Math.sin(walkTime) * this.walkAmplitudeForeArm;
      const walkHandLeft = Math.sin(walkTime + Math.PI) * this.walkAmplitudeHand;
      const walkHandRight = Math.sin(walkTime) * this.walkAmplitudeHand;
      const walkHeadX = Math.sin(time * 1.5) * 0.1;

      let walkHeadY = 0;    // calculate walk head y rotation
      if (this.lastRotationTarget !== null) {
        const headDelta = this.shortestAngleDifference(this.cameraAzimuth, this.lastRotationTarget);
        const threshold = 0.4363; // turn head only if difference between current head angle and target angle is > 25°
        if (Math.abs(headDelta) > threshold) {
          walkHeadY = THREE.MathUtils.clamp(-headDelta, -0.3, 0.3);
        }
      }
      const walkTail1 = Math.sin(walkTime * this.walkTailMovementSpeed) * this.walkAmplitudeTail;
      const walkTail2 = Math.sin(walkTime * this.walkTailMovementSpeed + 0.5) * this.walkAmplitudeTail * 1.2;
      const walkTail3 = Math.sin(walkTime * this.walkTailMovementSpeed + 1) * this.walkAmplitudeTail * 1.4;
      const walkBodyY = Math.sin(walkTime) * 0.05;
      // SPRINT
      const ampLegs = this.walkAmplitudeLegs;
      const ampUpper = this.walkAmplitudeArms;
      const ampFore = this.walkAmplitudeForeArm;

      const sprintLegLeft = this.leftLegBaseZ + Math.sin(sprintTime + this.phaseFL) * ampLegs;
      const sprintLegRight = this.rightLegBaseZ + Math.sin(sprintTime + this.phaseHR) * ampLegs;
      const sprintArmLeft = this.leftArmBaseZ + Math.sin(sprintTime + this.phaseFR) * ampUpper;
      const sprintArmRight = this.rightArmBaseZ + Math.sin(sprintTime + this.phaseHL) * ampUpper;
      const sprintForeArmLeft = Math.sin(sprintTime + this.phaseFR) * ampFore;
      const sprintForeArmRight = Math.sin(sprintTime + this.phaseHL) * ampFore;

      const sprintHeadX = Math.sin(sprintTime + Math.PI / 2) * 0.07;
      const sprintHeadY = Math.sin(sprintTime + Math.PI) * 0.04;

      const sprintTailAmp = 0.3;
      const sprintTailSpeed = walkSpeed * 0.8;
      const sprintTailTime = time * sprintTailSpeed;
      const sprintTail1 = Math.sin(sprintTailTime) * sprintTailAmp;
      const sprintTail2 = Math.sin(sprintTailTime + 0.3) * sprintTailAmp * 1.2;
      const sprintTail3 = Math.sin(sprintTailTime + 0.6) * sprintTailAmp * 1.4;
      const sprintBodyY = THREE.MathUtils.clamp(Math.sin(sprintTime) * 0.1, 0, 1);

      // APPLY BLENDS
      this.model.position.y = this.baseY + 
        (idleBodyY * this.idleWeight + 
        walkBodyY * this.walkWeight + 
        sprintBodyY * this.sprintWeight)/3;

      if (this.spine1) {
        this.spine1.rotation.z = this.spine1BaseZ + Math.sin(sprintTime) * 0.05 * this.sprintWeight;
        this.spine1.rotation.x = Math.sin(sprintTime + 0.3) * 0.04 * this.sprintWeight;
      }
      if (this.spine2) {
        this.spine2.rotation.z = this.spine2BaseZ + Math.sin(sprintTime + 0.4) * 0.08 * this.sprintWeight;
        this.spine2.rotation.x = Math.sin(sprintTime + 0.6) * 0.03 * this.sprintWeight;
      }

      if (this.leftLeg) this.leftLeg.rotation.z =
        idleLegLeft * this.idleWeight +
        walkLegLeft * this.walkWeight +
        sprintLegLeft * this.sprintWeight;

      if (this.rightLeg) this.rightLeg.rotation.z =
        idleLegRight * this.idleWeight +
        walkLegRight * this.walkWeight +
        sprintLegRight * this.sprintWeight;

      if (this.leftArm) this.leftArm.rotation.z =
        idleArmLeft * this.idleWeight +
        walkArmLeft * this.walkWeight +
        sprintArmLeft * this.sprintWeight;

      if (this.rightArm) this.rightArm.rotation.z =
        idleArmRight * this.idleWeight +
        walkArmRight * this.walkWeight +
        sprintArmRight * this.sprintWeight;

      if (this.leftForeArm) this.leftForeArm.rotation.z =
        idleForeArmLeft * this.idleWeight +
        walkForeArmLeft * this.walkWeight +
        sprintForeArmLeft * this.sprintWeight;

      if (this.rightForeArm) this.rightForeArm.rotation.z =
        idleForeArmRight * this.idleWeight +
        walkForeArmRight * this.walkWeight +
        sprintForeArmRight * this.sprintWeight;

      if (this.leftHand) this.leftHand.rotation.z =
        idleHandLeft * this.idleWeight +
        walkHandLeft * this.walkWeight +
        0 * this.sprintWeight;

      if (this.rightHand) this.rightHand.rotation.z =
        idleHandRight * this.idleWeight +
        walkHandRight * this.walkWeight +
        0 * this.sprintWeight;

      if (this.head) {
        this.head.rotation.x =
          idleHeadX * this.idleWeight +
          walkHeadX * this.walkWeight +
          sprintHeadX * this.sprintWeight;

        this.head.rotation.y =
          idleHeadY * this.idleWeight +
          walkHeadY * this.walkWeight +
          sprintHeadY * this.sprintWeight;
      }

      if (this.tail1) this.tail1.rotation.y =
        idleTail1 * this.idleWeight +
        walkTail1 * this.walkWeight +
        sprintTail1 * this.sprintWeight;

      if (this.tail2) this.tail2.rotation.y =
        idleTail2 * this.idleWeight +
        walkTail2 * this.walkWeight +
        sprintTail2 * this.sprintWeight;

      if (this.tail3) this.tail3.rotation.y =
        idleTail3 * this.idleWeight +
        walkTail3 * this.walkWeight +
        sprintTail3 * this.sprintWeight;
    }

   
    //--------------GAME LOGIC--------------------

    // after fox moves:
    const foxPos = new THREE.Vector3();
    this.foxContainer.getWorldPosition(foxPos);
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      const itemPos = new THREE.Vector3();
      item.mesh.getWorldPosition(itemPos);
      // dist in xz
      const dx = foxPos.x - itemPos.x;
      const dz = foxPos.z - itemPos.z;
      const rx = 0.7 + item.radius;  
      const rz = 0.5 + item.radius; 
      if ((dx*dx)/(rx*rx) + (dz*dz)/(rz*rz) < 1) {
        // collision!
        this.scene.remove(item.mesh);
        this.items.splice(i, 1);
        // assign score!
        let pts = 0;
        switch (item.type) {
          case 'mushroom': pts = 1; break;
          case 'egg':      pts = 5; break;
          case 'ruby':     pts = 20; break;
        }
        this.ui.addScore(pts);
        this.sound.playPickup();
      }
    }  
    this.renderer.render(this.scene, this.camera);
  };
}