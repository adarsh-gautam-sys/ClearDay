import * as THREE from "three";
import { createSoftParticleTexture, MAX_PARTICLES } from "./atmospherePalette";

export interface SmogSceneResources {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  particleGeo: THREE.BufferGeometry;
  particleMat: THREE.PointsMaterial;
  posAttr: THREE.Float32BufferAttribute;
  velocities: Float32Array;
  hazeMat: THREE.MeshBasicMaterial;
  hazeLower: THREE.Mesh;
  targetParticleColor: THREE.Color;
  targetHazeColor: THREE.Color;
  dispose: () => void;
}

/**
 * Allocates the static Three.js winter particulate buffer and volumetric haze plane
 * once per WebGL mount so the animation loop performs zero heap allocations.
 */
export function createSmogScene(): SmogSceneResources {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 2, 0.1, 100);
  camera.position.set(0, 0, 12);

  const positions = new Float32Array(MAX_PARTICLES * 3);
  const velocities = new Float32Array(MAX_PARTICLES * 3);
  for (let i = 0; i < MAX_PARTICLES; i++) {
    const i3 = i * 3;
    positions[i3] = (Math.random() - 0.5) * 26;
    positions[i3 + 1] = (Math.random() - 0.5) * 11;
    positions[i3 + 2] = (Math.random() - 0.5) * 10;
    velocities[i3] = (Math.random() - 0.5) * 0.35 + 0.12;
    velocities[i3 + 1] = (Math.random() - 0.5) * 0.18 - 0.04;
    velocities[i3 + 2] = (Math.random() - 0.5) * 0.12;
  }

  const particleGeo = new THREE.BufferGeometry();
  const posAttr = new THREE.Float32BufferAttribute(positions, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  particleGeo.setAttribute("position", posAttr);

  const spriteTex = createSoftParticleTexture();
  const particleMat = new THREE.PointsMaterial({
    size: 0.36,
    map: spriteTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.6,
    color: new THREE.Color(0x6e4e37),
  });

  const points = new THREE.Points(particleGeo, particleMat);
  points.frustumCulled = false;
  scene.add(points);

  const hazeGeo = new THREE.PlaneGeometry(34, 6);
  const hazeMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0xc29e78),
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
  });
  const hazeLower = new THREE.Mesh(hazeGeo, hazeMat);
  hazeLower.position.set(0, -1.6, -2);
  scene.add(hazeLower);

  return {
    scene,
    camera,
    particleGeo,
    particleMat,
    posAttr,
    velocities,
    hazeMat,
    hazeLower,
    targetParticleColor: new THREE.Color(),
    targetHazeColor: new THREE.Color(),
    dispose() {
      particleGeo.dispose();
      particleMat.dispose();
      hazeGeo.dispose();
      hazeMat.dispose();
      spriteTex.dispose();
    },
  };
}
