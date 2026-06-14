// Face detection running entirely in the browser via MediaPipe Tasks Vision
// (BlazeFace short-range), with the WASM runtime and model served from our own
// origin (/wasm, /models). No third-party request is made at runtime.
//
// Small faces are hard for a single full-image pass: the model resizes its
// input to a small fixed size, so a tiny face becomes just a few pixels. To
// recover them we ALSO run detection over overlapping tiles of the image — in
// a tile a small face occupies a larger fraction of the frame — and then merge
// every detection with non-max suppression to drop duplicates.

import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";

let detectorPromise = null;

function createDetector() {
  return (async () => {
    const vision = await FilesetResolver.forVisionTasks("/wasm");
    return FaceDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "/models/blaze_face_full_range.tflite",
      },
      runningMode: "IMAGE",
      // Full-range model handles distant/angled faces better than short-range.
      // 0.45 still avoids false positives while recovering more real faces.
      minDetectionConfidence: 0.45,
    });
  })();
}

/** Lazily build (and cache) the detector. */
export function getDetector() {
  if (!detectorPromise) detectorPromise = createDetector();
  return detectorPromise;
}

function rawDetect(detector, source) {
  const result = detector.detect(source);
  return (result.detections ?? []).map((d) => {
    const b = d.boundingBox;
    return {
      x: b.originX,
      y: b.originY,
      w: b.width,
      h: b.height,
      score: d.categories?.[0]?.score ?? 1,
    };
  });
}

function clamp(box, maxW, maxH) {
  const x = Math.max(0, box.x);
  const y = Math.max(0, box.y);
  return {
    x,
    y,
    w: Math.min(maxW - x, box.w),
    h: Math.min(maxH - y, box.h),
    score: box.score,
  };
}

// Tile start offsets along one axis, with overlap so faces on a seam are not
// split across two tiles.
function tileStarts(total, tile, overlap) {
  const step = Math.max(1, Math.floor(tile * (1 - overlap)));
  const starts = [];
  for (let s = 0; s < total; s += step) {
    if (s + tile >= total) {
      starts.push(Math.max(0, total - tile));
      break;
    }
    starts.push(s);
  }
  return [...new Set(starts)];
}

// Target tile side length: at this size a face occupies enough of the tile
// for the model to detect it reliably. Cap at 4 tiles per dimension.
const TARGET_TILE = 700;
const MAX_TILE_DIVS = 4;

function planTiles(W, H) {
  const longest = Math.max(W, H);
  if (longest < 500) return []; // small image: the full pass is enough
  const cols = Math.min(MAX_TILE_DIVS, Math.ceil(W / TARGET_TILE));
  const rows = Math.min(MAX_TILE_DIVS, Math.ceil(H / TARGET_TILE));
  const tw = Math.ceil(W / cols);
  const th = Math.ceil(H / rows);
  const overlap = 0.25; // wider overlap to avoid missing faces on seams
  const tiles = [];
  for (const y of tileStarts(H, th, overlap)) {
    for (const x of tileStarts(W, tw, overlap)) {
      tiles.push({ x, y, w: Math.min(tw, W - x), h: Math.min(th, H - y) });
    }
  }
  return tiles;
}

function iou(a, b) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  if (inter === 0) return 0;
  return inter / (a.w * a.h + b.w * b.h - inter);
}

// Greedy non-max suppression: keep the highest-scoring boxes, drop overlaps.
function nms(boxes, threshold) {
  const sorted = [...boxes].sort((p, q) => q.score - p.score);
  const keep = [];
  for (const b of sorted) {
    if (keep.every((k) => iou(k, b) < threshold)) keep.push(b);
  }
  return keep.map((b) => ({
    x: Math.round(b.x),
    y: Math.round(b.y),
    w: Math.round(b.w),
    h: Math.round(b.h),
  }));
}

/**
 * Detect faces in an HTMLImageElement / canvas.
 * Returns an array of axis-aligned boxes in image pixel coordinates:
 *   { x, y, w, h }
 */
export async function detectFaces(source) {
  const detector = await getDetector();
  const W = source.naturalWidth ?? source.width;
  const H = source.naturalHeight ?? source.height;

  const all = [];

  // 1) Full-image pass.
  for (const b of rawDetect(detector, source)) all.push(clamp(b, W, H));

  // 2) Tiled passes for small faces.
  const tiles = planTiles(W, H);
  if (tiles.length) {
    const cv = document.createElement("canvas");
    const cx = cv.getContext("2d", { willReadFrequently: true });
    for (const tile of tiles) {
      cv.width = tile.w;
      cv.height = tile.h;
      cx.clearRect(0, 0, tile.w, tile.h);
      cx.drawImage(source, tile.x, tile.y, tile.w, tile.h, 0, 0, tile.w, tile.h);
      for (const b of rawDetect(detector, cv)) {
        all.push(clamp({ ...b, x: b.x + tile.x, y: b.y + tile.y }, W, H));
      }
    }
  }

  return nms(all, 0.4);
}
