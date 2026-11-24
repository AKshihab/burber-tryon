import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { HEAD_CENTER_Y, HEAD_RADIUS, HEAD_SCALE, buildHair, disposeObject } from '../hair/styles.ts';
import type { HairstyleKey } from '../hair/styles.ts';
import { FACE_CAMERA, applyFaceMatrix, applyHeadFit, cameraErrorMessage, guideHint, toVisible } from './face.ts';
import type { GuideHint } from './face.ts';
import { createFaceTracker } from './tracker.ts';
import type { FaceTracker } from './tracker.ts';

type Props = {
  styleKey: HairstyleKey;
  color: string;
  onHint(hint: GuideHint): void;
  onError(message: string): void;
};

type Rig = { fit: THREE.Group; hair: THREE.Group | null };

/** An invisible head that only writes depth, so hair behind the real head is hidden by it. */
function buildOccluder(): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(HEAD_RADIUS * 0.98, 32, 24),
    new THREE.MeshBasicMaterial({ colorWrite: false }),
  );
  mesh.position.y = HEAD_CENTER_Y;
  mesh.scale.set(...HEAD_SCALE);
  mesh.renderOrder = 0;
  return mesh;
}

/** The live camera picture with the chosen hair drawn on the customer's head. */
export function TryOnView({ styleKey, color, onHint, onError }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rigRef = useRef<Rig | null>(null);
  const [hint, setHint] = useState<GuideHint>('none');
  const [ready, setReady] = useState(false);

  // Keep the latest callbacks without restarting the camera when the parent re-renders.
  const handlers = useRef({ onHint, onError });
  handlers.current = { onHint, onError };

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    let cancelled = false;
    let stream: MediaStream | null = null;
    let tracker: FaceTracker | null = null;
    let renderer: THREE.WebGLRenderer | null = null;
    let scene: THREE.Scene | null = null;
    let frame = 0;

    const fail = (message: string) => {
      if (!cancelled) handlers.current.onError(message);
    };

    async function start(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
      const secure = window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;
      if (!secure) return fail(cameraErrorMessage(null, false));

      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      } catch (err) {
        return fail(cameraErrorMessage(err, true));
      }
      if (cancelled) return;
      video.srcObject = stream;
      try {
        await video.play();
      } catch (err) {
        if (!cancelled) fail(cameraErrorMessage(err, true));
        return;
      }
      if (cancelled) return;

      try {
        tracker = await createFaceTracker();
      } catch {
        return fail('The face tracker could not be loaded. Use the 3D preview instead.');
      }
      if (cancelled) return;

      try {
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      } catch {
        return fail('3D drawing is not available on this device.');
      }
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 480;
      renderer.setSize(width, height, false);
      renderer.setClearColor(0x000000, 0);

      scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(FACE_CAMERA.fovDeg, width / height, FACE_CAMERA.near, FACE_CAMERA.far);
      scene.add(new THREE.HemisphereLight('#ffffff', '#55483c', 1.8));
      const key = new THREE.DirectionalLight('#ffffff', 1.6);
      key.position.set(20, 40, 60);
      scene.add(key);

      const anchor = new THREE.Group();
      anchor.visible = false;
      const fit = new THREE.Group();
      applyHeadFit(fit);
      fit.add(buildOccluder());
      anchor.add(fit);
      scene.add(anchor);
      rigRef.current = { fit, hair: null };
      setReady(true);

      let lastTime = -1;
      let lastHint: GuideHint = 'none';
      const tick = () => {
        frame = requestAnimationFrame(tick);
        if (video.readyState < 2 || video.currentTime === lastTime) return;
        lastTime = video.currentTime;
        let face = null;
        try {
          face = tracker!.detect(video, performance.now());
        } catch {
          /* a dropped frame: try again on the next one */
        }
        anchor.visible = face !== null;
        if (face) applyFaceMatrix(anchor, face.matrix);
        const stage = canvas.parentElement;
        const viewAspect = stage && stage.clientHeight ? stage.clientWidth / stage.clientHeight : width / height;
        const nextHint = guideHint(face ? toVisible(face.landmarks, width / height, viewAspect) : undefined);
        if (nextHint !== lastHint) {
          lastHint = nextHint;
          setHint(nextHint);
          handlers.current.onHint(nextHint);
        }
        renderer!.render(scene!, camera);
      };
      tick();
    }

    void start(video, canvas);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
      tracker?.close();
      if (scene) disposeObject(scene);
      renderer?.dispose();
      rigRef.current = null;
    };
  }, []);

  useEffect(() => {
    const rig = rigRef.current;
    if (!rig) return;
    if (rig.hair) {
      rig.fit.remove(rig.hair);
      disposeObject(rig.hair);
    }
    rig.hair = buildHair(styleKey, color);
    rig.hair.traverse((o) => {
      o.renderOrder = 1;
    });
    rig.fit.add(rig.hair);
  }, [styleKey, color, ready]);

  return (
    <div className="stage">
      <video ref={videoRef} playsInline muted aria-label="Your camera" />
      <canvas ref={canvasRef} aria-hidden="true" />
      <div className={hint === 'ok' ? 'guide ok' : 'guide'} aria-hidden="true" />
      {!ready && <p className="viewer-fallback">Starting the camera…</p>}
    </div>
  );
}
