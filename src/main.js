import "./style.css";
import { renderCensored } from "./censor.js";
import { detectFaces, getDetector } from "./detector.js";
import { applyTranslations, detectLang, setLang, t } from "./i18n.js";
import { APP_VERSION } from "./version.js";

// --- App state ------------------------------------------------------------
const state = {
  image: null, // HTMLImageElement at natural resolution
  boxes: [], // [{ x, y, w, h, selected }]
  style: "pixelate",
  intensity: 50,
  emoji: "😀",
};

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

// --- Boot -----------------------------------------------------------------
function boot() {
  $("#version").textContent = `v${APP_VERSION}`;
  setLang(detectLang());
  applyTranslations();

  for (const btn of document.querySelectorAll(".lang-switch button")) {
    btn.addEventListener("click", () => {
      setLang(btn.dataset.lang);
      refreshSummary();
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

  // Controls
  $("#select-all").addEventListener("click", () => setAll(true));
  $("#select-none").addEventListener("click", () => setAll(false));
  $("#style-seg").addEventListener("click", onStyleClick);
  $("#emoji-picker").addEventListener("click", onEmojiClick);
  $("#intensity").addEventListener("input", (e) => {
    state.intensity = Number(e.target.value);
    render();
  });
  $("#download").addEventListener("click", download);
  $("#reset").addEventListener("click", reset);

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
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    dropzone.hidden = true;
    editor.hidden = false;

    setStatus(t("status.detecting"));
    render(); // show the raw image while detecting
    try {
      const found = await detectFaces(img);
      state.boxes = found.map((b) => ({ ...b, selected: true }));
      if (state.boxes.length === 0) setStatus(t("status.noFaces"));
      else setStatus(t("status.faces", state.boxes.length));
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

// --- Rendering ------------------------------------------------------------
function render() {
  if (!state.image) return;
  const selected = state.boxes.filter((b) => b.selected);
  renderCensored(ctx, state.image, selected, {
    style: state.style,
    intensity: state.intensity,
    emoji: state.emoji,
  });
  drawOverlay();
}

function drawOverlay() {
  overlay.innerHTML = "";
  const { width, height } = canvas;
  for (const [i, box] of state.boxes.entries()) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = `facebox${box.selected ? " on" : ""}`;
    el.style.left = `${(box.x / width) * 100}%`;
    el.style.top = `${(box.y / height) * 100}%`;
    el.style.width = `${(box.w / width) * 100}%`;
    el.style.height = `${(box.h / height) * 100}%`;
    el.setAttribute("aria-pressed", String(box.selected));
    el.title = `#${i + 1}`;
    el.addEventListener("click", () => {
      box.selected = !box.selected;
      refreshSummary();
      render();
    });
    overlay.appendChild(el);
  }
}

// --- Controls -------------------------------------------------------------
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

function setAll(selected) {
  for (const b of state.boxes) b.selected = selected;
  refreshSummary();
  render();
}

function refreshSummary() {
  const total = state.boxes.length;
  const on = state.boxes.filter((b) => b.selected).length;
  if (total === 0) {
    facesSummary.textContent = t("status.noFaces");
  } else {
    facesSummary.textContent = `${on} / ${total}`;
  }
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
  fileInput.value = "";
  editor.hidden = true;
  dropzone.hidden = false;
  setStatus("");
}

boot();
