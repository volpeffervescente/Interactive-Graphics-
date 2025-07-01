// lake.ts

import * as THREE from 'three';

export class Lake {
    private scene: THREE.Scene;
    private lakeGroup: THREE.Group; 
    private waterMesh!: THREE.Mesh;
    public waterMaterial!: THREE.ShaderMaterial;
    private timeUniform: THREE.IUniform;
    private lakeCollisionRadius!: number;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.timeUniform = { value: 0 };
        this.lakeGroup = new THREE.Group(); 
        this.scene.add(this.lakeGroup);
        this.lakeCollisionRadius = 5.3; 
        this.createLake();
        this.createWaterLilies(); 
    }

    private createLake(): void {
        this.createWater();
        this.createPebbles();
    }

    private createWater(): void {
        const waterGeometry = new THREE.CircleGeometry(5, 64); 
        // here I define the GLSL shaders
        const waterVertexShader = `
            uniform float time;
            varying vec3 vNormal;
            varying vec3 vPosition;

            void main() {
                vNormal = normal;
                vPosition = position;

                // simple waves animation based on time and position xz:
                //I implement classic Gerstner waves: each vertex s position is offset by a sum of sinusoids, controlled by amplitude, wavelength, speed, and direction uniforms
                vec3 newPosition = position;
                float waveFrequency = 0.5; 
                float waveAmplitude = 0.1; 
                newPosition.y += sin(newPosition.x * waveFrequency + time) * waveAmplitude;
                newPosition.y += cos(newPosition.z * waveFrequency * 0.8 + time * 1.2) * waveAmplitude * 0.7;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
            }
        `;

        const waterFragmentShader = `
            uniform float time;
            uniform vec3 u_color; // water color
            uniform float uLightIntensityFactor;
            varying vec3 vNormal;
            varying vec3 vPosition;

            void main() {
                // computes a simple reflex/refraction
                vec3 viewDirection = normalize(cameraPosition - vPosition);
                vec3 normal = normalize(vNormal);
                vec3 waterColor = u_color; //base water color is blue 

                //here i simulate a slight color variation to give depth
                float depthFactor = (vPosition.y + 0.5) * 0.5; 
                waterColor = mix(waterColor, waterColor * 0.7, depthFactor); //the deeper, the darker the water color

                // here I add a bit of reflex/glitter based on visual angle
                float fresnel = dot(viewDirection, normal);
                fresnel = pow(1.0 - fresnel, 1.6); // power in order to control reflex intensity

                vec3 reflectionColor = vec3(0.8, 0.9, 1.0); // color for the reflexes (lighr from the sky)
                //to take  in account the changing light intensity based on the day-night cycle
                reflectionColor *= uLightIntensityFactor; 
                waterColor = mix(waterColor, reflectionColor, fresnel * 0.5);
                gl_FragColor = vec4(waterColor, 0.8); // 0.8 is alpha to assign transparency level
            }
        `;
        this.waterMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: this.timeUniform,
                u_color: { value: new THREE.Color(0x6699ff) }, //bright blue for the water
                uLightIntensityFactor: { value: 1.0 }
            },
            vertexShader: waterVertexShader,
            fragmentShader: waterFragmentShader,
            transparent: true,
            side: THREE.DoubleSide // makes water visible from both sides
        });
        this.waterMesh = new THREE.Mesh(waterGeometry, this.waterMaterial);
        this.waterMesh.rotation.x = -Math.PI / 2; // rotates to place water orizontally
        this.waterMesh.position.y = 0.1;          // slightly over the terrain
        this.lakeGroup.add(this.waterMesh); 
    }

    private createPebbles(): void {
        const numPebbles = 80; 
        const lakeRadius = 4.32;
        const pebbleRadius = 0.5; 

        for (let i = 0; i < numPebbles; i++) {
            const angle = (i / numPebbles) * Math.PI * 2;
            const radiusOffset = Math.random() * 0.8 + 0.5;// this hack is to have a non perfect radius, so the perimeter is a bit more  realistic
            const x = Math.cos(angle) * (lakeRadius + radiusOffset);
            const z = Math.sin(angle) * (lakeRadius + radiusOffset);
            const pebbleGeometry = new THREE.SphereGeometry(pebbleRadius * (Math.random() * 0.6 + 0.7), 8, 8); 
            const pebbleMaterial = new THREE.MeshLambertMaterial({
                color: new THREE.Color(Math.random() * 0.2 + 0.4, Math.random() * 0.1 + 0.3, Math.random() * 0.1 + 0.2)  
            });
            const pebble = new THREE.Mesh(pebbleGeometry, pebbleMaterial);
            pebble.position.set(x, 0, z); // Place pebbles around the lake
            // random rotation to add a more natural effect
            pebble.rotation.x = Math.random() * Math.PI;
            pebble.rotation.y = Math.random() * Math.PI;
            pebble.rotation.z = Math.random() * Math.PI;

            pebble.castShadow = true;
            pebble.receiveShadow = true;

            this.lakeGroup.add(pebble); 
        }
    }
    private createWaterLilies(): void {
        const numLilies = 8;
        const lilyRadius = 0.35; 
        const flowerRadiusFactor = 0.3; 
    
        for (let i = 0; i < numLilies; i++) {
            const angle = Math.random() * Math.PI * 2;
            // this in order to ensure that the lily does not spawn too close to the edge
            const distFromCenter = Math.random() * (this.lakeCollisionRadius - lilyRadius * 2);
            const x = Math.cos(angle) * distFromCenter;
            const z = Math.sin(angle) * distFromCenter;
            const lilyStemHeight = 0.05;
            const lilyBaseY = this.waterMesh.position.y;
            const lilyGeometry = new THREE.CircleGeometry(lilyRadius, 16); 
            const lilyMaterial = new THREE.MeshStandardMaterial({
                color: 0x228B22,
                side: THREE.DoubleSide
            });
            const lilyMesh = new THREE.Mesh(lilyGeometry, lilyMaterial);
            lilyMesh.rotation.x = -Math.PI / 2;
            lilyMesh.position.set(x, lilyBaseY + lilyStemHeight, z);
            const flowerGeometry = new THREE.SphereGeometry(lilyRadius * flowerRadiusFactor, 8, 8); 
            const flowerMaterial = new THREE.MeshStandardMaterial({ color: 0xffddff });
            const flowerMesh = new THREE.Mesh(flowerGeometry, flowerMaterial);
            flowerMesh.position.set(0, 0.03, 0); // Place slightly over the leaf
            lilyMesh.add(flowerMesh);
    
            lilyMesh.castShadow = true;
            lilyMesh.receiveShadow = true;
    
            this.lakeGroup.add(lilyMesh);
    
            lilyMesh.userData.baseX = x;
            lilyMesh.userData.baseZ = z;
            lilyMesh.userData.lilyBaseY = lilyBaseY + lilyStemHeight;
        }
    }

    public getLakeGroup(): THREE.Group {
        return this.lakeGroup;
    }

    public getLakeCollisionRadius(): number {
        return this.lakeCollisionRadius;
    }

    public setPosition(x: number, y: number, z: number): void {
        this.lakeGroup.position.set(x, y, z);
    }

    public update(deltaTime: number): void {
        // timeUniform receives delta in " (from the clock)
        this.timeUniform.value += deltaTime; 
        // this animates the lilies to make them float on the waves
        this.lakeGroup.traverse(object => {
            if (object instanceof THREE.Mesh && object.userData.lilyBaseY !== undefined) {
                const baseX = object.userData.baseX;
                const baseZ = object.userData.baseZ;
                const lilyBaseY = object.userData.lilyBaseY;
                // this Replicates the wave logic from the water shader
                const waveFrequency = 0.42;
                const waveAmplitude = 0.037; 
                let waveOffsetY = 0;
                waveOffsetY += Math.sin(baseX * waveFrequency + this.timeUniform.value) * waveAmplitude;
                waveOffsetY += Math.cos(baseZ * waveFrequency * 0.8 + this.timeUniform.value * 1.2) * waveAmplitude * 0.7;
                object.position.y = lilyBaseY + waveOffsetY;
            }
        });
    }
}