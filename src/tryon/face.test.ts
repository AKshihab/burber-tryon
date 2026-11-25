import { expect, test } from 'vitest';
import * as THREE from 'three';
import { HEAD_SCALE } from '../hair/styles.ts';
import { FACE_CAMERA, GUIDE, HEAD_FIT, HINT_TEXT, applyFaceMatrix, applyHeadFit, cameraErrorMessage, guideHint, toVisible } from './face.ts';
import type { GuideHint, Point } from './face.ts';

/** Four corner points of a box, in normalised image coordinates. */
const box = (cx: number, cy: number, width: number, height = width * 1.3): Point[] => [
  { x: cx - width / 2, y: cy - height / 2 },
  { x: cx + width / 2, y: cy - height / 2 },
  { x: cx - width / 2, y: cy + height / 2 },
  { x: cx + width / 2, y: cy + height / 2 },
];

test('no face gives no hint to follow', () => {
  expect(guideHint(undefined)).toBe('none');
  expect(guideHint([])).toBe('none');
});

test('a centred face of a good size is ok', () => {
  expect(guideHint(box(GUIDE.cx, GUIDE.cy, 0.4))).toBe('ok');
});

test('a small face should come closer, a big one should move back', () => {
  expect(guideHint(box(0.5, 0.45, 0.2))).toBe('closer');
  expect(guideHint(box(0.5, 0.45, 0.7))).toBe('farther');
});

test('an off-centre face should centre, sideways or up and down', () => {
  expect(guideHint(box(0.8, 0.45, 0.4))).toBe('center');
  expect(guideHint(box(0.5, 0.75, 0.4))).toBe('center');
});

test('centring comes before distance', () => {
  expect(guideHint(box(0.8, 0.45, 0.2))).toBe('center');
});

test('every hint has words', () => {
  const hints: GuideHint[] = ['none', 'center', 'closer', 'farther', 'ok'];
  for (const h of hints) expect(HINT_TEXT[h].length).toBeGreaterThan(0);
  expect(HINT_TEXT.closer).toBe('Move closer');
});

test('the camera matches the one the face tracker assumes', () => {
  expect(FACE_CAMERA).toEqual({ fovDeg: 63, near: 1, far: 10000 });
});

test('applyFaceMatrix places the anchor from column-major data', () => {
  const anchor = new THREE.Group();
  applyFaceMatrix(anchor, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 2, -30, 1]);
  anchor.updateMatrixWorld(true);
  expect(anchor.matrixAutoUpdate).toBe(false);
  expect(new THREE.Vector3().setFromMatrixPosition(anchor.matrixWorld).toArray()).toEqual([1, 2, -30]);
});

test('applyFaceMatrix ignores data of the wrong length', () => {
  const anchor = new THREE.Group();
  applyFaceMatrix(anchor, [1, 2, 3]);
  expect(anchor.matrix.equals(new THREE.Matrix4())).toBe(true);
});

test('the fitted head is the size and place of a real one, in centimetres from the face origin', () => {
  // Measured against a tracked portrait: brows sit near y +4.5, the hairline near +11, the crown near +15.5.
  const fit = new THREE.Group();
  applyHeadFit(fit);
  fit.updateMatrixWorld(true);
  const at = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyMatrix4(fit.matrixWorld);
  const top = at(0, HEAD_SCALE[1], 0);
  const side = at(HEAD_SCALE[0], 0, 0);
  const front = at(0, 0, HEAD_SCALE[2]);
  expect(top.y).toBeGreaterThan(15);
  expect(top.y).toBeLessThan(18);
  expect(side.x).toBeGreaterThan(8); // wider than the face (about 7.7 cm either side) so real hair at the temples is covered
  expect(side.x).toBeLessThan(9.5);
  expect(side.y).toBeGreaterThan(6); // the hair's lower edge at the temples stays above the eyes and brows
  expect(front.z).toBeGreaterThan(3); // forehead, behind the nose tip (about 7.5 cm)
  expect(front.z).toBeLessThan(6.5);
  expect(HEAD_FIT.scale.every((n) => n > 0)).toBe(true);
});

test('landmarks are judged against the part of the picture the customer can see', () => {
  // A landscape webcam (4:3) shown in a portrait frame (3:4) is cropped at the sides to 56.25% of its width.
  const [left, mid, right] = toVisible([{ x: 0.21875, y: 0.3 }, { x: 0.5, y: 0.5 }, { x: 0.78125, y: 0.9 }], 4 / 3, 3 / 4);
  expect(left.x).toBeCloseTo(0);
  expect(left.y).toBeCloseTo(0.3);
  expect(mid.x).toBeCloseTo(0.5);
  expect(right.x).toBeCloseTo(1);
  // A tall picture in a wide frame is cropped top and bottom instead.
  const [p] = toVisible([{ x: 0.2, y: 0.5 }], 3 / 4, 4 / 3);
  expect(p.x).toBeCloseTo(0.2);
  expect(p.y).toBeCloseTo(0.5);
  // Same shape: nothing changes.
  expect(toVisible([{ x: 0.1, y: 0.9 }], 1, 1)[0]).toEqual({ x: 0.1, y: 0.9 });
});

test('a face that fills a cropped view is ok even though it is small in the full frame', () => {
  const inFrame = box(0.5, 0.45, 0.26);
  expect(guideHint(inFrame)).toBe('ok');
  expect(guideHint(box(0.5, 0.45, 0.2))).toBe('closer');
  expect(guideHint(toVisible(box(0.5, 0.45, 0.2), 4 / 3, 3 / 4))).toBe('ok');
});

test('camera problems are explained in plain words', () => {
  expect(cameraErrorMessage({ name: 'NotAllowedError' }, false)).toBe('The camera only works on a secure (https) page.');
  expect(cameraErrorMessage({ name: 'NotAllowedError' }, true)).toBe(
    'Camera permission was denied. Allow the camera for this site and try again.',
  );
  expect(cameraErrorMessage({ name: 'NotFoundError' }, true)).toBe('No camera was found on this device.');
  expect(cameraErrorMessage({ name: 'OverconstrainedError' }, true)).toBe('No camera was found on this device.');
  expect(cameraErrorMessage(new Error('x'), true)).toBe('The camera could not be started.');
  expect(cameraErrorMessage(null, true)).toBe('The camera could not be started.');
});

test('a face that leaves no room above it for hair should move back', () => {
  expect(guideHint(box(GUIDE.cx, GUIDE.cy, 0.55))).toBe('farther');
});

test('the biggest accepted face leaves room for a tall haircut', () => {
  const top = GUIDE.cy - (GUIDE.maxWidth * 1.35) / 2;
  expect(top).toBeGreaterThan(0.15);
});
