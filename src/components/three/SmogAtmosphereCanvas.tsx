"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  createSoftParticleTexture,
  getAtmospherePalette,
  MAX_PARTICLES,
} from "./atmospherePalette";

interface SmogAtmosphereCanvasProps {
  pm25: number;
}

/**
 * Interactive WebGL winter atmospheric inversion & particulate chamber.
 * Pre-allocates static buffers and reusable THREE.Color targets so 60fps
 * animation runs with zero per-frame allocations.
 */
export function SmogAtmosphereCanvas({ pm25 }: SmogAtmosphereCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetPmRef = useRef(pm25);
  const [webglReady, setWebglReady] = useState(true);

  targetPmRef.current = pm25;
  const palette = getAtmospherePalette(pm25);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setWebglReady(false);
      return;
    }

    const probeCtx =
      canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!probeCtx) {
      setWebglReady(false);
      return;
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
    } catch {
      setWebglReady(false);
      return;
    }

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

    // Pre-allocated scratch colors to prevent GC pressure inside animate loop
    const targetParticleColor = new THREE.Color();
    const targetHazeColor = new THREE.Color();

    let pointerX = 0;
    let pointerY = 0;
    let lastPointerAt = 0;
    let isVisible = true;
    let contextLost = false;
    let rafId = 0;

    function handleResize() {
      if (!container) return;
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    function handlePointerMove(e: PointerEvent) {
      if (e.pointerType === "touch") return;
      const now = performance.now();
      if (now - lastPointerAt < 32 || !container) return;
      lastPointerAt = now;
      const rect = container.getBoundingClientRect();
      pointerX = ((e.clientX - rect.left) / Math.max(1, rect.width) - 0.5) * 2;
      pointerY = ((e.clientY - rect.top) / Math.max(1, rect.height) - 0.5) * 2;
    }

    function handleVisibility() {
      if (document.visibilityState === "visible" && isVisible && !contextLost) {
        lastTick = performance.now();
        if (!rafId) rafId = window.requestAnimationFrame(animate);
      } else if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
    }

    function handleContextLost(e: Event) {
      e.preventDefault();
      contextLost = true;
      setWebglReady(false);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        isVisible = entries[0]?.isIntersecting ?? true;
        handleVisibility();
      },
      { threshold: 0.05 },
    );
    observer.observe(container);

    handleResize();
    window.addEventListener("resize", handleResize);
    container.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("visibilitychange", handleVisibility);
    canvas.addEventListener("webglcontextlost", handleContextLost);

    let lastTick = performance.now();
    let smoothedPm = targetPmRef.current;

    function animate(now: number) {
      if (contextLost || !isVisible || document.visibilityState !== "visible") {
        rafId = 0;
        return;
      }

      const dt = Math.min(0.05, (now - lastTick) / 1000);
      lastTick = now;

      smoothedPm += (targetPmRef.current - smoothedPm) * Math.min(1, dt * 4);
      const pal = getAtmospherePalette(smoothedPm);

      const drawCount = Math.max(
        40,
        Math.min(MAX_PARTICLES, Math.round(smoothedPm * 3.1)),
      );
      particleGeo.setDrawRange(0, drawCount);
      targetParticleColor.setHex(pal.particleHex);
      targetHazeColor.setHex(pal.hazeHex);
      particleMat.color.lerp(targetParticleColor, 0.08);
      particleMat.opacity += (pal.particleOpacity - particleMat.opacity) * 0.08;
      hazeMat.color.lerp(targetHazeColor, 0.08);
      hazeMat.opacity += (pal.hazeOpacity - hazeMat.opacity) * 0.08;

      const arr = posAttr.array as Float32Array;
      const speed = pal.speedScale;
      for (let i = 0; i < drawCount; i++) {
        const i3 = i * 3;
        let x = (arr[i3] ?? 0) + (velocities[i3] ?? 0) * dt * speed;
        let y = (arr[i3 + 1] ?? 0) + (velocities[i3 + 1] ?? 0) * dt * speed;
        const z = arr[i3 + 2] ?? 0;

        if (x > 13) x = -13;
        if (x < -13) x = 13;
        if (y > 5.5) y = -5.5;
        if (y < -5.5) y = 5.5;

        arr[i3] = x;
        arr[i3 + 1] = y;
        arr[i3 + 2] = z;
      }
      posAttr.needsUpdate = true;

      camera.position.x += (pointerX * 0.65 - camera.position.x) * 0.06;
      camera.position.y += (-pointerY * 0.35 - camera.position.y) * 0.06;
      camera.lookAt(0, 0, 0);

      hazeLower.position.x = Math.sin(now * 0.00025) * 1.4;
      renderer.render(scene, camera);
      rafId = window.requestAnimationFrame(animate);
    }

    rafId = window.requestAnimationFrame(animate);

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      observer.disconnect();
      window.removeEventListener("resize", handleResize);
      container.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("visibilitychange", handleVisibility);
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      particleGeo.dispose();
      particleMat.dispose();
      hazeGeo.dispose();
      hazeMat.dispose();
      spriteTex.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      data-mode={webglReady ? "webgl" : "static"}
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] transition-colors duration-500"
      style={{
        background: `linear-gradient(160deg, ${palette.topBg} 0%, ${palette.bottomBg} 100%)`,
      }}
    >
      {webglReady && (
        <canvas ref={canvasRef} className="block h-full w-full" />
      )}
    </div>
  );
}
