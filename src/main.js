import "./style.css";
import { renderCensored } from "./censor.js";
import { detectFaces, getDetector } from "./detector.js";
import { applyTranslations, detectLang, setLang, t } from "./i18n.js";
import { APP_VERSION } from "./version.js";

// --- App state ------------------------------------------------------------
// A box is an editable area:
//   { id, x, y, w, h, on, baseW, baseH, scale }
// - on:    whether the censor effect is applied to it
// - base*: the box size at scale 1 (detected size, or drawn size)
// - scale: size multiplier driven by the per-area slider
const state = {
  image: null, // HTMLImageElement at natural resolution
  boxes: [],
  activeId: null, // box currently selected for editing
  drawMode: false, // drawing a new area by dragging
  style: "pixelate",
  intensity: 50,
  emoji: "😀",
};

let nextId = 1;

// --- DOM refs -------------------------------------------------------------
const $ = (sel) => document.querySelector(sel);
const dropzone = $("#dropzone");
const fileInput = $("#file-input");
const editor = $("#editor");
const canvas = $("#canvas");
const ctx = canvas.getContext("2d");
const overlay = $("#overlay");
const statusEl = $("#status");
const facesSummary = $("#faces-summary");
const boxEditor = $("#box-editor");
const boxSize = $("#box-size");
const boxToggle = $("#box-toggle");
const addAreaBtn = $("#add-area");

// --- Boot -----------------------------------------------------------------
function boot() {
  $("#version").textContent = `v${APP_VERSION}`;
  setLang(detectLang());
  applyTranslations();

  for (const btn of document.querySelectorAll(".lang-switch button")) {
    btn.addEventListener("click", () => {
      setLang(btn.dataset.lang);
      refreshSummary();
      syncBoxEditor();
    });
  }

  // Upload interactions
  dropzone.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
  });
  for (const ev of ["dragover", "dragenter"]) {
    dropzone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropzone.classList.add("is-drag");
    });
  }
  for (const ev of ["dragleave", "drop"]) {
    dropzone.addEventListener(ev, () => dropzone.classList.remove("is-drag"));
  }
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file?.type.startsWith("image/")) loadFile(file);
  });

  // Face controls
  $("#select-all").addEventListener("click", () => setAll(true));
  $("#select-none").addEventListener("click", () => setAll(false));
  addAreaBtn.addEventListener("click", toggleDrawMode);

  // Per-area editor
  boxSize.addEventListener("input", (e) => resizeActive(Number(e.target.value) / 100));
  boxToggle.addEventListener("click", toggleActiveOn);
  $("#box-delete").addEventListener("click", deleteActive);

  // Style controls
  $("#style-seg").addEventListener("click", onStyleClick);
  $("#emoji-picker").addEventListener("click", onEmojiClick);
  $("#intensity").addEventListener("input", (e) => {
    state.intensity = Number(e.target.value);
    render();
  });
  $("#download").addEventListener("click", download);
  $("#reset").addEventListener("click", reset);

  // Drawing new areas on the overlay.
  overlay.addEventListener("pointerdown", onDrawStart);

  // Warm up the detector in the background so the first photo feels instant.
  getDetector().catch(() => {});
}

// --- Image loading & detection -------------------------------------------
async function loadFile(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = async () => {
    URL.revokeObjectURL(url);
    state.image = img;
    state.boxes = [];
    state.activeId = null;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    dropzone.hidden = true;
    editor.hidden = false;
    syncBoxEditor();

    setStatus(t("status.detecting"));
    render();
    try {
      const found = await detectFaces(img);
      state.boxes = found.map((b) => makeBox(b.x, b.y, b.w, b.h));
      setStatus(state.boxes.length ? t("status.faces", state.boxes.length) : t("status.noFaces"));
    } catch (err) {
      console.error(err);
      setStatus(t("status.error"));
    }
    refreshSummary();
    render();
  };
  img.onerror = () => setStatus(t("status.error"));
  img.src = url;
}

function makeBox(x, y, w, h) {
  return { id: nextId++, x, y, w, h, on: true, baseW: w, baseH: h, scale: 1 };
}

function boxById(id) {
  return state.boxes.find((b) => b.id === id) ?? null;
}

// --- Rendering ------------------------------------------------------------
function render() {
  if (!state.image) return;
  renderCensored(
    ctx,
    state.image,
    state.boxes.filter((b) => b.on),
    { style: state.style, intensity: state.intensity, emoji: state.emoji },
  );
  drawOverlay();
}

function drawOverlay() {
  overlay.innerHTML = "";
  const { width, height } = canvas;
  for (const box of state.boxes) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "facebox";
    el.classList.toggle("on", box.on);
    el.classList.toggle("active", box.id === state.activeId);
    el.style.left = `${(box.x / width) * 100}%`;
    el.style.top = `${(box.y / height) * 100}%`;
    el.style.width = `${(box.w / width) * 100}%`;
    el.style.height = `${(box.h / height) * 100}%`;
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      selectBox(box.id);
    });
    overlay.appendChild(el);
  }
}

// --- Selection & per-area editing ----------------------------------------
function selectBox(id) {
  state.activeId = id;
  syncBoxEditor();
  drawOverlay();
}

function syncBoxEditor() {
  const box = boxById(state.activeId);
  boxEditor.hidden = !box;
  if (!box) return;
  boxSize.value = String(Math.round(box.scale * 100));
  boxToggle.textContent = box.on ? t("editor.exclude") : t("editor.include");
}

function resizeActive(scale) {
  const box = boxById(state.activeId);
  if (!box) return;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  box.scale = scale;
  box.w = Math.max(8, Math.round(box.baseW * scale));
  box.h = Math.max(8, Math.round(box.baseH * scale));
  box.x = Math.round(cx - box.w / 2);
  box.y = Math.round(cy - box.h / 2);
  render();
}

function toggleActiveOn() {
  const box = boxById(state.activeId);
  if (!box) return;
  box.on = !box.on;
  syncBoxEditor();
  refreshSummary();
  render();
}

function deleteActive() {
  state.boxes = state.boxes.filter((b) => b.id !== state.activeId);
  state.activeId = null;
  syncBoxEditor();
  refreshSummary();
  render();
}

// --- Drawing a new area ---------------------------------------------------
function toggleDrawMode() {
  state.drawMode = !state.drawMode;
  overlay.classList.toggle("drawing", state.drawMode);
  addAreaBtn.classList.toggle("active", state.drawMode);
}

// Map a pointer event to image-pixel coordinates.
function toImageCoords(e) {
  const r = overlay.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * canvas.width,
    y: ((e.clientY - r.top) / r.height) * canvas.height,
  };
}

function onDrawStart(e) {
  if (!state.drawMode) return;
  e.preventDefault();
  const start = toImageCoords(e);
  const band = document.createElement("div");
  band.className = "rubberband";
  overlay.appendChild(band);

  const onMove = (ev) => {
    const p = toImageCoords(ev);
    const x = Math.min(start.x, p.x);
    const y = Math.min(start.y, p.y);
    const w = Math.abs(p.x - start.x);
    const h = Math.abs(p.y - start.y);
    band.style.left = `${(x / canvas.width) * 100}%`;
    band.style.top = `${(y / canvas.height) * 100}%`;
    band.style.width = `${(w / canvas.width) * 100}%`;
    band.style.height = `${(h / canvas.height) * 100}%`;
  };

  const onUp = (ev) => {
    overlay.removeEventListener("pointermove", onMove);
    overlay.removeEventListener("pointerup", onUp);
    band.remove();
    const p = toImageCoords(ev);
    const x = Math.round(Math.min(start.x, p.x));
    const y = Math.round(Math.min(start.y, p.y));
    const w = Math.round(Math.abs(p.x - start.x));
    const h = Math.round(Math.abs(p.y - start.y));
    toggleDrawMode(); // leave draw mode after one area
    if (w >= 8 && h >= 8) {
      const box = makeBox(x, y, w, h);
      state.boxes.push(box);
      state.activeId = box.id;
      syncBoxEditor();
      refreshSummary();
    }
    render();
  };

  overlay.setPointerCapture?.(e.pointerId);
  overlay.addEventListener("pointermove", onMove);
  overlay.addEventListener("pointerup", onUp);
}

// --- Bulk + style controls ------------------------------------------------
function setAll(on) {
  for (const b of state.boxes) b.on = on;
  syncBoxEditor();
  refreshSummary();
  render();
}

function applyStyle(style) {
  state.style = style;
  for (const b of $("#style-seg").children) {
    b.classList.toggle("active", b.dataset.style === style);
  }
  $("#intensity-label").hidden = style === "emoji";
  render();
}

function onStyleClick(e) {
  const btn = e.target.closest("[data-style]");
  if (btn) applyStyle(btn.dataset.style);
}

function onEmojiClick(e) {
  const btn = e.target.closest("button");
  if (!btn) return;
  state.emoji = btn.textContent.trim();
  for (const b of e.currentTarget.children) b.classList.toggle("active", b === btn);
  // Picking an emoji implies you want the emoji style.
  applyStyle("emoji");
}

function refreshSummary() {
  const total = state.boxes.length;
  const on = state.boxes.filter((b) => b.on).length;
  facesSummary.textContent = total === 0 ? t("status.noFaces") : `${on} / ${total}`;
}

function setStatus(msg) {
  statusEl.textContent = msg;
  statusEl.hidden = !msg;
}

// --- Output ---------------------------------------------------------------
function download() {
  // toBlob re-encodes from canvas pixels only -> no EXIF metadata carried over.
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pixelface.png";
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

function reset() {
  state.image = null;
  state.boxes = [];
  state.activeId = null;
  state.drawMode = false;
  overlay.classList.remove("drawing");
  addAreaBtn.classList.remove("active");
  fileInput.value = "";
  editor.hidden = true;
  dropzone.hidden = false;
  syncBoxEditor();
  setStatus("");
}

boot();
