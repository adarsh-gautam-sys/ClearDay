import * as THREE from "three";

export const MAX_PARTICLES = 900;

export interface AtmospherePalette {
  topBg: string;
  bottomBg: string;
  particleHex: number;
  hazeHex: number;
  hazeOpacity: number;
  particleOpacity: number;
  speedScale: number;
}

export function getAtmospherePalette(pm25: number): AtmospherePalette {
  if (pm25 <= 15) {
    return {
      topBg: "#DCEEF7",
      bottomBg: "#F4F8FA",
      particleHex: 0x3b7a8c,
      hazeHex: 0x9ec6d8,
      hazeOpacity: 0.14,
      particleOpacity: 0.42,
      speedScale: 0.45,
    };
  }
  if (pm25 <= 55) {
    return {
      topBg: "#E6E4DC",
      bottomBg: "#F5F2EA",
      particleHex: 0x64635b,
      hazeHex: 0xc2b9a5,
      hazeOpacity: 0.24,
      particleOpacity: 0.56,
      speedScale: 0.72,
    };
  }
  if (pm25 <= 150) {
    return {
      topBg: "#DCD0BE",
      bottomBg: "#EFE8DC",
      particleHex: 0x6e4e37,
      hazeHex: 0xc29e78,
      hazeOpacity: 0.34,
      particleOpacity: 0.68,
      speedScale: 0.95,
    };
  }
  return {
    topBg: "#CEB8A3",
    bottomBg: "#E8DDD0",
    particleHex: 0x4f3528,
    hazeHex: 0x9e775a,
    hazeOpacity: 0.44,
    particleOpacity: 0.78,
    speedScale: 1.15,
  };
}

export function createSoftParticleTexture(): THREE.CanvasTexture {
  const size = 64;
  const sprite = document.createElement("canvas");
  sprite.width = size;
  sprite.height = size;
  const ctx = sprite.getContext("2d");
  if (ctx) {
    const grad = ctx.createRadialGradient(
      size / 2,
      size / 2,
      1,
      size / 2,
      size / 2,
      size / 2,
    );
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.45, "rgba(255,255,255,0.62)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(sprite);
  tex.needsUpdate = true;
  return tex;
}
