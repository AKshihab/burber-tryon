import { expect, test } from 'vitest';
import * as THREE from 'three';
import { HAIRSTYLES, HAIR_COLORS, HEAD_RADIUS, buildHair, buildHead, isHairstyleKey } from './styles.ts';
import type { HairstyleKey } from './styles.ts';

const meshes = (root: THREE.Object3D): THREE.Mesh[] => {
  const found: THREE.Mesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) found.push(o as THREE.Mesh);
  });
  return found;
};

const vertexCount = (root: THREE.Object3D) =>
  meshes(root).reduce((n, m) => n + m.geometry.getAttribute('position').count, 0);

test('there are exactly four hairstyles, in tile order', () => {
  expect(HAIRSTYLES).toEqual([
    { key: 'buzz', name: 'Buzz cut' },
    { key: 'sidepart', name: 'Side part' },
    { key: 'quiff', name: 'Quiff' },
    { key: 'curly', name: 'Curly top' },
  ]);
});

test('hair colours', () => {
  expect(HAIR_COLORS).toEqual([
    { name: 'Black', hex: '#1b1b1b' },
    { name: 'Brown', hex: '#5a3825' },
    { name: 'Blonde', hex: '#c9a25d' },
    { name: 'Red', hex: '#8c3b20' },
  ]);
});

test.each(HAIRSTYLES.map((s) => s.key))('%s builds a named group in the asked colour', (key) => {
  const hair = buildHair(key, '#5a3825');
  expect(hair.name).toBe(`hair-${key}`);
  const parts = meshes(hair);
  expect(parts.length).toBeGreaterThan(0);
  for (const m of parts) expect((m.material as THREE.MeshStandardMaterial).color.getHexString()).toBe('5a3825');
});

test('the four styles are different shapes', () => {
  const signatures = HAIRSTYLES.map((s) => {
    const hair = buildHair(s.key, '#000000');
    return `${meshes(hair).length}:${vertexCount(hair)}`;
  });
  expect(new Set(signatures).size).toBe(4);
});

test('every style sits on the head, not floating away from it', () => {
  for (const s of HAIRSTYLES) {
    const box = new THREE.Box3().setFromObject(buildHair(s.key, '#000000'));
    expect(box.max.y).toBeGreaterThan(HEAD_RADIUS * 0.9);
    expect(box.max.y).toBeLessThan(HEAD_RADIUS * 2.2);
    expect(box.min.y).toBeGreaterThan(-HEAD_RADIUS * 0.6);
    expect(Math.max(Math.abs(box.min.x), Math.abs(box.max.x))).toBeLessThan(HEAD_RADIUS * 1.6);
  }
});

test('an unknown hairstyle is rejected', () => {
  expect(() => buildHair('mullet' as HairstyleKey, '#000')).toThrow('Unknown hairstyle: mullet');
});

test('the head has a face', () => {
  const head = buildHead();
  expect(head.name).toBe('head');
  expect(meshes(head).length).toBeGreaterThanOrEqual(4);
});

test('isHairstyleKey', () => {
  expect(isHairstyleKey('quiff')).toBe(true);
  expect(isHairstyleKey('x')).toBe(false);
  expect(isHairstyleKey(null)).toBe(false);
});
