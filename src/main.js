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
  drawMode: false, // tap-to-place mode for a new area
  // Default censor settings: applied to every area that hasn't overridden them.
  // Editing the style controls with no area selected changes these (all areas);
  // with an area selected it overrides just that area (box.style/intensity/emoji).
  defaults: { style: "pixelate", intensity: 50, emoji: "😀" },
};

let nextId = 1;
// Reference size of the active box captured when it is selected. The size slider
// is centered (100 = this size); right enlarges, left shrinks.
let sizeRef = null;

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
const styleSeg = $("#style-seg");
const intensityEl = $("#intensity");
const emojiPicker = $("#emoji-picker");
const styleHeading = $("#style-heading");

// --- Boot -----------------------------------------------------------------
function boot() {
  $("#version").textContent = `v${APP_VERSION}`;
  setLang(detectLang());
  applyTranslations();

  syncStyleControls();

  for (const btn of document.querySelectorAll(".lang-switch button")) {
    btn.addEventListener("click", () => {
      setLang(btn.dataset.lang);
      refreshSummary();
      syncBoxEditor();
      syncStyleControls();
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
  boxSize.addEventListener("input", (e) => resizeActive(Number(e.target.value)));
  boxToggle.addEventListener("click", toggleActiveOn);
  $("#box-delete").addEventListener("click", deleteActive);

  // Style controls (edit the active area, or the defaults when none is selected)
  styleSeg.addEventListener("click", onStyleClick);
  emojiPicker.addEventListener("click", onEmojiClick);
  intensityEl.addEventListener("input", (e) => {
    styleTarget().intensity = Number(e.target.value);
    render();
  });
  $("#download").addEventListener("click", download);
  $("#reset").addEventListener("click", reset);

  // Adding new areas: tap on the overlay while in add mode.
  overlay.addEventListener("pointerdown", onAddTap);

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
  return { id: nextId++, x, y, w, h, on: true };
}

function boxById(id) {
  return state.boxes.find((b) => b.id === id) ?? null;
}

// --- Rendering ------------------------------------------------------------
// Resolve a box's effective settings (its own overrides, else the defaults).
function effective(box) {
  const d = state.defaults;
  return {
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    style: box.style ?? d.style,
    intensity: box.intensity ?? d.intensity,
    emoji: box.emoji ?? d.emoji,
  };
}

function render() {
  if (!state.image) return;
  renderCensored(ctx, state.image, state.boxes.filter((b) => b.on).map(effective));
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
      if (box.id === state.activeId) deselect();
      else selectBox(box.id);
    });
    overlay.appendChild(el);
  }
}

// --- Selection & per-area editing ----------------------------------------
function selectBox(id) {
  state.activeId = id;
  const box = boxById(id);
  // Capture the current size as the slider's neutral (centered) reference.
  sizeRef = box ? { w: box.w, h: box.h } : null;
  boxSize.value = "100";
  syncBoxEditor();
  syncStyleControls();
  drawOverlay();
}

function deselect() {
  state.activeId = null;
  sizeRef = null;
  syncBoxEditor();
  syncStyleControls();
  drawOverlay();
}

// The object the style controls currently edit: the active box (override) or
// the shared defaults when no area is selected.
function styleTarget() {
  return boxById(state.activeId) ?? state.defaults;
}

// Reflect the active box's effective style (or the defaults) in the controls.
function syncStyleControls() {
  const box = boxById(state.activeId);
  const view = box ? effective(box) : state.defaults;
  for (const b of styleSeg.children) {
    b.classList.toggle("active", b.dataset.style === view.style);
  }
  intensityEl.value = String(view.intensity);
  $("#intensity-label").hidden = view.style === "emoji";
  for (const b of emojiPicker.children) {
    b.classList.toggle("active", b.textContent.trim() === view.emoji);
  }
  styleHeading.textContent = box ? t("controls.styleArea") : t("controls.styleDefault");
}

function syncBoxEditor() {
  const box = boxById(state.activeId);
  boxEditor.hidden = !box;
  if (box) boxToggle.textContent = box.on ? t("editor.exclude") : t("editor.include");
}

// pct is the slider value (100 = reference size); scales around the box center.
function resizeActive(pct) {
  const box = boxById(state.activeId);
  if (!box || !sizeRef) return;
  const f = pct / 100;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  box.w = Math.max(8, Math.round(sizeRef.w * f));
  box.h = Math.max(8, Math.round(sizeRef.h * f));
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
  sizeRef = null;
  syncBoxEditor();
  syncStyleControls();
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

// Size for a manually-added area: the average of the existing boxes, or a
// standard size (~15% of the shorter image side) when there are none.
function newAreaSize() {
  if (state.boxes.length) {
    const w = state.boxes.reduce((s, b) => s + b.w, 0) / state.boxes.length;
    const h = state.boxes.reduce((s, b) => s + b.h, 0) / state.boxes.length;
    return { w: Math.round(w), h: Math.round(h) };
  }
  const s = Math.round(Math.min(canvas.width, canvas.height) * 0.15);
  return { w: s, h: s };
}

// In add mode, a single tap drops a new area centered on the tap point.
function onAddTap(e) {
  if (!state.drawMode) return;
  e.preventDefault();
  const p = toImageCoords(e);
  const { w, h } = newAreaSize();
  const x = Math.max(0, Math.min(canvas.width - w, Math.round(p.x - w / 2)));
  const y = Math.max(0, Math.min(canvas.height - h, Math.round(p.y - h / 2)));
  const box = makeBox(x, y, w, h);
  state.boxes.push(box);
  toggleDrawMode(); // leave add mode after placing one area
  selectBox(box.id);
  refreshSummary();
  render();
}

// --- Bulk + style controls ------------------------------------------------
function setAll(on) {
  for (const b of state.boxes) b.on = on;
  syncBoxEditor();
  refreshSummary();
  render();
}

function applyStyle(style) {
  styleTarget().style = style;
  for (const b of styleSeg.children) {
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
  styleTarget().emoji = btn.textContent.trim();
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
  sizeRef = null;
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
