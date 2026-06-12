// Face detection running entirely in the browser via MediaPipe Tasks Vision
// (BlazeFace short-range), with the WASM runtime and model served from our own
// origin (/wasm, /models). No third-party request is made at runtime.

import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";

let detectorPromise = null;

function createDetector() {
  return (async () => {
    const vision = await FilesetResolver.forVisionTasks("/wasm");
    return FaceDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "/models/blaze_face_short_range.tflite",
      },
      runningMode: "IMAGE",
      minDetectionConfidence: 0.5,
    });
  })();
}

/** Lazily build (and cache) the detector. */
export function getDetector() {
  if (!detectorPromise) detectorPromise = createDetector();
  return detectorPromise;
}

/**
 * Detect faces in an HTMLImageElement / canvas.
 * Returns an array of axis-aligned boxes in image pixel coordinates:
 *   { x, y, w, h }
 */
export async function detectFaces(source) {
  const detector = await getDetector();
  const result = detector.detect(source);
  return (result.detections ?? []).map((d) => {
    const b = d.boundingBox;
    return {
      x: Math.max(0, Math.round(b.originX)),
      y: Math.max(0, Math.round(b.originY)),
      w: Math.round(b.width),
      h: Math.round(b.height),
    };
  });
}
