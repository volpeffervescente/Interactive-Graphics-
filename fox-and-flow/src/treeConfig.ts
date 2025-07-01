// src/treeConfig.ts
import * as THREE from 'three';

export interface TreeCollisionConfig {
  path: string;              
  count: number;             
  scale: number;              
  offsetY: number;            // vertical offset after centering
  collisionRadius: number;    // collision sphere radius
  centerOffset: THREE.Vector3;// offset from pivot to sphere center
}

export const TREE_CONFIGS: TreeCollisionConfig[] = [
  {
    path: '/models/low_poly_tree_fall.glb',
    count: 50,
    scale: 6,
    offsetY: -0.5,
    collisionRadius: 0.2,
    centerOffset: new THREE.Vector3(0, 2.5, 0),
  },
  {
    path: '/models/low_poly_tree.glb',
    count: 67,
    scale: 0.8,
    offsetY: 0,
    collisionRadius: 0.2,
    centerOffset: new THREE.Vector3(0, 1.5, 0),
  },
  {
    path: '/models/cherry_tree_in_bloom.glb',
    count: 60,
    scale: 0.8,
    offsetY: 0,
    collisionRadius: 0.25,
    centerOffset: new THREE.Vector3(0, 1.5, 0),
  },
  {
    path: '/models/tree_5.glb',
    count: 60,
    scale: 0.9,
    offsetY: 0,
    collisionRadius: 0.3,
    centerOffset: new THREE.Vector3(0, 2, 0),
  },
  {
    path: '/models/tree_8.glb',
    count: 50,
    scale: 0.8,
    offsetY: 0,
    collisionRadius: 0.3,
    centerOffset: new THREE.Vector3(0, 2, 0),
  },
  {
    path: '/models/low_poly_tree_colorful.glb',
    count: 47,
    scale: 0.8,
    offsetY: -1.5,
    collisionRadius: 0.5,
    centerOffset: new THREE.Vector3(0, 2.5, 0),
  },
];
