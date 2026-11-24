import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildHair, buildHead, disposeObject } from './styles.ts';
import type { HairstyleKey } from './styles.ts';

type Stage = { scene: THREE.Scene; hair: THREE.Group | null };

/** A rotatable 3D head wearing the chosen hairstyle. Drag to turn it. */
export function HairViewer({ styleKey, color }: { styleKey: HairstyleKey; color: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Stage | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    camera.position.set(0, 0.1, 7.2);

    scene.add(new THREE.HemisphereLight('#fff4e0', '#3a312b', 1.6));
    const key = new THREE.DirectionalLight('#ffffff', 2.2);
    key.position.set(2.5, 3, 4);
    scene.add(key);

    const head = buildHead();
    scene.add(head);
    const stage: Stage = { scene, hair: null };
    stageRef.current = stage;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, -0.35, 0);
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.minPolarAngle = Math.PI * 0.3;
    controls.maxPolarAngle = Math.PI * 0.62;

    const resize = () => {
      const size = host.clientWidth || 300;
      renderer.setSize(size, host.clientHeight || size, false);
      camera.aspect = size / (host.clientHeight || size);
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    observer?.observe(host);

    let frame = 0;
    const tick = () => {
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      controls.dispose();
      disposeObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
      stageRef.current = null;
    };
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    if (stage.hair) {
      stage.scene.remove(stage.hair);
      disposeObject(stage.hair);
    }
    stage.hair = buildHair(styleKey, color);
    stage.scene.add(stage.hair);
  }, [styleKey, color, failed]);

  return (
    <div className="viewer" ref={hostRef} role="img" aria-label="3D head wearing the chosen hairstyle. Drag to turn it.">
      {failed && <p className="viewer-fallback">3D preview is not available on this device</p>}
    </div>
  );
}
