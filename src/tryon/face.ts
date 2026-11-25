import type * as THREE from 'three';
import { HEAD_CENTER_Y } from '../hair/styles.ts';

/** A point in normalised image coordinates: (0,0) top-left, (1,1) bottom-right. */
export type Point = { x: number; y: number };

export type GuideHint = 'none' | 'center' | 'closer' | 'farther' | 'ok';

/** Where the face should be: centre of the oval, how far off is fine, and how wide the face may be. */
export const GUIDE = { cx: 0.5, cy: 0.52, tolerance: 0.13, minWidth: 0.25, maxWidth: 0.5 };

export const HINT_TEXT: Record<GuideHint, string> = {
  none: 'Put your face inside the oval',
  center: 'Centre your face in the oval',
  closer: 'Move closer',
  farther: 'Move back a little',
  ok: 'Looking good — turn your head to see the sides',
};

/** Tell the customer how to stand, from the face landmarks of the current frame. */
export function guideHint(landmarks: Point[] | undefined): GuideHint {
  if (!landmarks || landmarks.length === 0) return 'none';
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of landmarks) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const offX = Math.abs((minX + maxX) / 2 - GUIDE.cx);
  const offY = Math.abs((minY + maxY) / 2 - GUIDE.cy);
  if (offX > GUIDE.tolerance || offY > GUIDE.tolerance) return 'center';
  const width = maxX - minX;
  if (width < GUIDE.minWidth) return 'closer';
  if (width > GUIDE.maxWidth) return 'farther';
  return 'ok';
}

/**
 * The camera MediaPipe's face geometry assumes: at the origin looking down -z,
 * 63 degrees vertical field of view. Its face matrix is expressed in this space, in centimetres.
 */
export const FACE_CAMERA = { fovDeg: 63, near: 1, far: 10000 };

/**
 * Maps the app's unit head onto MediaPipe's canonical face (centimetres; origin inside the head
 * behind the nose, +y up, +z towards the camera). Measured against a tracked portrait, the brows
 * sit near y +4.5, the hairline near y +11 and the crown near y +15.5; the face is about 7.7
 * either side and the nose tip about z +7.5. The head is fitted as the skull above the brows:
 * a little wider than tall, so the hair covers the temples and its front edge lands on the hairline.
 *
 * Tune these if hair sits too high/low (`center[1]`), too big/small (`scale`), or too far
 * forward/back (`center[2]`) on real faces.
 */
export const HEAD_FIT = {
  scale: [9.4, 8.2, 9.4] as [number, number, number],
  center: [0, 7.2, -5] as [number, number, number],
};

/** Give `group` the transform that places app-head-space children on the tracked face. */
export function applyHeadFit(group: THREE.Object3D): void {
  group.scale.set(...HEAD_FIT.scale);
  group.position.set(HEAD_FIT.center[0], HEAD_FIT.center[1] - HEAD_CENTER_Y * HEAD_FIT.scale[1], HEAD_FIT.center[2]);
}

/**
 * The camera picture is shown cropped to fill its frame (CSS object-fit: cover). Convert points
 * from the whole picture to the part the customer can actually see, so the guide matches the screen.
 */
export function toVisible(points: Point[], videoAspect: number, viewAspect: number): Point[] {
  if (!(videoAspect > 0) || !(viewAspect > 0) || videoAspect === viewAspect) return points;
  if (videoAspect > viewAspect) {
    const shown = viewAspect / videoAspect;
    return points.map((p) => ({ x: (p.x - (1 - shown) / 2) / shown, y: p.y }));
  }
  const shown = videoAspect / viewAspect;
  return points.map((p) => ({ x: p.x, y: (p.y - (1 - shown) / 2) / shown }));
}

/** Move `anchor` to the tracked face. `data` is MediaPipe's 4x4 matrix, column-major. */
export function applyFaceMatrix(anchor: THREE.Object3D, data: ArrayLike<number>): void {
  if (data.length !== 16) return;
  anchor.matrixAutoUpdate = false;
  anchor.matrix.fromArray(data);
  anchor.matrixWorldNeedsUpdate = true;
}

export function cameraErrorMessage(err: unknown, secure: boolean): string {
  if (!secure) return 'The camera only works on a secure (https) page.';
  const name = (err as { name?: unknown } | null)?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return 'Camera permission was denied. Allow the camera for this site and try again.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No camera was found on this device.';
  return 'The camera could not be started.';
}
