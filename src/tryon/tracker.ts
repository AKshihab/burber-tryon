import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { Point } from './face.ts';

export type FaceResult = { landmarks: Point[]; matrix: ArrayLike<number> };

export type FaceTracker = {
  detect(video: HTMLVideoElement, timeMs: number): FaceResult | null;
  close(): void;
};

/** Both are served by the app itself (see scripts/setup-tryon.mjs); nothing is fetched from the internet. */
const WASM_DIR = '/mediapipe/wasm';
const MODEL = '/mediapipe/face_landmarker.task';

export async function createFaceTracker(): Promise<FaceTracker> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_DIR);
  const make = (delegate: 'GPU' | 'CPU') =>
    FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL, delegate },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFacialTransformationMatrixes: true,
    });

  let landmarker: FaceLandmarker;
  try {
    landmarker = await make('GPU');
  } catch {
    landmarker = await make('CPU');
  }

  return {
    detect(video, timeMs) {
      const result = landmarker.detectForVideo(video, timeMs);
      const landmarks = result.faceLandmarks[0];
      const matrix = result.facialTransformationMatrixes[0];
      return landmarks && matrix ? { landmarks, matrix: matrix.data } : null;
    },
    close() {
      landmarker.close();
    },
  };
}
