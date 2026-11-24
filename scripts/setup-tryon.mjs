// Puts everything the camera try-on needs under public/mediapipe so the app serves it itself:
//  - the MediaPipe wasm runtime, copied from node_modules (no network)
//  - the face landmarker model, downloaded only if it is missing (it is committed to the repo)
// Runs after `npm install`. Never fails the install.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wasmFrom = path.join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const wasmTo = path.join(root, 'public', 'mediapipe', 'wasm');
const model = path.join(root, 'public', 'mediapipe', 'face_landmarker.task');
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

try {
  if (fs.existsSync(wasmFrom)) {
    fs.mkdirSync(wasmTo, { recursive: true });
    for (const file of fs.readdirSync(wasmFrom)) fs.copyFileSync(path.join(wasmFrom, file), path.join(wasmTo, file));
    console.log('try-on: wasm runtime copied to public/mediapipe/wasm');
  } else {
    console.warn('try-on: @mediapipe/tasks-vision is not installed; the camera try-on will not work');
  }

  if (fs.existsSync(model) && fs.statSync(model).size > 1_000_000) {
    console.log('try-on: face model already present');
  } else {
    const res = await fetch(MODEL_URL);
    if (!res.ok) throw new Error(`download failed with status ${res.status}`);
    fs.mkdirSync(path.dirname(model), { recursive: true });
    fs.writeFileSync(model, Buffer.from(await res.arrayBuffer()));
    console.log('try-on: face model downloaded to public/mediapipe/face_landmarker.task');
  }
} catch (err) {
  console.warn(`try-on: setup incomplete (${err instanceof Error ? err.message : err}).`);
  console.warn('try-on: run "node scripts/setup-tryon.mjs" again when online.');
}
