// Copies the MediaPipe WASM runtime out of node_modules and downloads the
// face-detection model, so that EVERYTHING is served from our own container.
// No third-party CDN is ever contacted at runtime (privacy requirement).
//
// Run after `npm install`:  npm run setup:assets

import { access, cp, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const WASM_SRC = resolve(root, "node_modules/@mediapipe/tasks-vision/wasm");
const WASM_DEST = resolve(root, "public/wasm");

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";
const MODEL_DEST = resolve(root, "public/models/blaze_face_short_range.tflite");

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function copyWasm() {
  if (!(await exists(WASM_SRC))) {
    throw new Error(
      `No encuentro el WASM de MediaPipe en ${WASM_SRC}. ¿Has ejecutado 'npm install'?`,
    );
  }
  await mkdir(WASM_DEST, { recursive: true });
  await cp(WASM_SRC, WASM_DEST, { recursive: true });
  console.log(`✓ WASM copiado a ${WASM_DEST}`);
}

async function downloadModel() {
  if (await exists(MODEL_DEST)) {
    console.log(`✓ Modelo ya presente en ${MODEL_DEST}`);
    return;
  }
  await mkdir(dirname(MODEL_DEST), { recursive: true });
  console.log(`↓ Descargando modelo desde ${MODEL_URL}`);
  const res = await fetch(MODEL_URL);
  if (!res.ok) {
    throw new Error(`Descarga del modelo falló: HTTP ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(MODEL_DEST, buf);
  console.log(`✓ Modelo guardado en ${MODEL_DEST} (${(buf.length / 1024).toFixed(0)} KB)`);
}

await copyWasm();
await downloadModel();
console.log("\nAssets listos. La app no hará llamadas a terceros en runtime.");
