import * as THREE from 'three';

export type HairstyleKey = 'buzz' | 'sidepart' | 'quiff' | 'curly';

export const HAIRSTYLES: { key: HairstyleKey; name: string }[] = [
  { key: 'buzz', name: 'Buzz cut' },
  { key: 'sidepart', name: 'Side part' },
  { key: 'quiff', name: 'Quiff' },
  { key: 'curly', name: 'Curly top' },
];

export const HAIR_COLORS: { name: string; hex: string }[] = [
  { name: 'Black', hex: '#1b1b1b' },
  { name: 'Brown', hex: '#5a3825' },
  { name: 'Blonde', hex: '#c9a25d' },
  { name: 'Red', hex: '#8c3b20' },
];

export const DEFAULT_STYLE: HairstyleKey = 'buzz';
export const DEFAULT_COLOR = HAIR_COLORS[0].hex;

/** The head is a sphere of this radius centred at (0, HEAD_CENTER_Y, 0), facing +z. */
export const HEAD_RADIUS = 1;
export const HEAD_CENTER_Y = 0;
/** The sphere is stretched into a skull shape; hair uses the same stretch so it hugs the head. */
export const HEAD_SCALE: [number, number, number] = [0.9, 1.1, 0.97];

/** How far the hairline is tipped back, so the forehead is bare and the nape is covered. */
const HAIRLINE_TILT = -0.35;

export function isHairstyleKey(v: unknown): v is HairstyleKey {
  return typeof v === 'string' && HAIRSTYLES.some((s) => s.key === v);
}

export function isHairColor(v: unknown): v is string {
  return typeof v === 'string' && HAIR_COLORS.some((c) => c.hex === v);
}

export function hairstyleName(key: string | null): string | null {
  return HAIRSTYLES.find((s) => s.key === key)?.name ?? null;
}

function blob(
  material: THREE.Material,
  radius: number,
  position: [number, number, number],
  scale: [number, number, number] = [1, 1, 1],
  segments = 24,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, segments, Math.max(6, segments / 2)), material);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  return mesh;
}

/** A skull cap: the top of a sphere down to `polar` (in units of pi) from the crown. */
function cap(material: THREE.Material, radius: number, polar: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 40, 20, 0, Math.PI * 2, 0, Math.PI * polar), material);
  mesh.rotation.x = HAIRLINE_TILT;
  return mesh;
}

export function buildHead(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'head';
  const skin = new THREE.MeshStandardMaterial({ color: '#d9a47c', roughness: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ color: '#221a15', roughness: 0.5 });
  const cloth = new THREE.MeshStandardMaterial({ color: '#2f5d8a', roughness: 0.9 });

  group.add(blob(skin, HEAD_RADIUS, [0, HEAD_CENTER_Y, 0], HEAD_SCALE, 48));
  group.add(blob(skin, 0.2, [-0.9, -0.05, 0], [0.5, 1, 0.8]));
  group.add(blob(skin, 0.2, [0.9, -0.05, 0], [0.5, 1, 0.8]));
  group.add(blob(skin, 0.12, [0, -0.15, 0.97], [0.9, 1.2, 1]));
  group.add(blob(dark, 0.075, [-0.32, 0.12, 0.83]));
  group.add(blob(dark, 0.075, [0.32, 0.12, 0.83]));
  group.add(blob(dark, 0.2, [0, -0.52, 0.8], [1, 0.14, 0.5]));

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.9, 24), skin);
  neck.position.set(0, -1.35, -0.05);
  group.add(neck);
  group.add(blob(cloth, 1.25, [0, -2.55, -0.05], [1.25, 0.75, 0.7], 32));
  return group;
}

const BUILDERS: Record<HairstyleKey, (m: THREE.Material) => THREE.Object3D[]> = {
  buzz: (m) => [cap(m, 1.03, 0.52)],

  sidepart: (m) => {
    const sweep = blob(m, 0.62, [0.26, 0.84, 0.1], [1.2, 0.45, 1.3]);
    sweep.rotation.z = -0.25;
    return [cap(m, 1.06, 0.5), sweep, blob(m, 0.36, [0.36, 0.66, 0.68], [1.4, 0.5, 0.8])];
  },

  quiff: (m) => {
    // A wide roll over the forehead, swept up and tapering towards the crown.
    const front = blob(m, 0.44, [0, 0.9, 0.62], [1.45, 0.85, 0.85]);
    front.rotation.x = -0.5;
    return [
      cap(m, 1.05, 0.5),
      front,
      blob(m, 0.42, [0, 1.0, 0.2], [1.4, 0.6, 1.2]),
      blob(m, 0.36, [0, 0.93, -0.3], [1.35, 0.5, 1.1]),
    ];
  },

  curly: (m) => {
    const parts: THREE.Object3D[] = [cap(m, 1.04, 0.5)];
    const curls = new THREE.Group();
    curls.rotation.x = HAIRLINE_TILT;
    const count = 30;
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      // Spread points evenly over the crown (golden-angle spiral), out to 0.42 pi from the top.
      const polar = Math.acos(1 - (i + 0.5) / count * (1 - Math.cos(Math.PI * 0.42)));
      const around = i * golden;
      const r = 1.12;
      const size = 0.2 + (i % 3) * 0.025;
      curls.add(
        blob(m, size, [r * Math.sin(polar) * Math.cos(around), r * Math.cos(polar), r * Math.sin(polar) * Math.sin(around)], [1, 1, 1], 10),
      );
    }
    parts.push(curls);
    return parts;
  },
};

export function buildHair(key: HairstyleKey, colorHex: string): THREE.Group {
  const build = BUILDERS[key];
  if (!build) throw new Error(`Unknown hairstyle: ${key}`);
  const material = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.85, side: THREE.DoubleSide });
  const group = new THREE.Group();
  group.name = `hair-${key}`;
  group.position.y = HEAD_CENTER_Y;
  group.scale.set(...HEAD_SCALE);
  group.add(...build(material));
  return group;
}

/** Free the GPU memory held by everything under `root`. */
export function disposeObject(root: THREE.Object3D): void {
  const materials = new Set<THREE.Material>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(m);
  });
  for (const m of materials) m.dispose();
}
