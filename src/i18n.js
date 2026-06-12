// Minimal i18n: a flat dictionary keyed by dotted paths matching data-i18n
// attributes in index.html. Spanish + English (spec §4).

const STRINGS = {
  es: {
    "hero.title": "Pixela las caras de tus fotos",
    "hero.subtitle": "Sube una foto, elige qué caras tapar y descárgala.",
    "hero.privacy": "100% privado. Todo se procesa en tu dispositivo. La foto nunca se sube.",
    "upload.cta": "<strong>Arrastra una foto</strong> o haz clic para elegir",
    "upload.hint": "La imagen no sale de tu navegador.",
    "controls.faces": "Caras detectadas",
    "controls.facesHint": "Toca un recuadro para incluir o excluir una cara.",
    "controls.selectAll": "Todas",
    "controls.selectNone": "Ninguna",
    "controls.style": "Estilo",
    "style.pixelate": "Pixelado",
    "style.blur": "Desenfoque",
    "style.emoji": "Emoji",
    "controls.intensity": "Intensidad",
    "controls.download": "Descargar",
    "controls.reset": "Otra foto",
    "footer.privacy": "🔒 Tus fotos nunca salen de tu dispositivo.",
    "footer.coffee": "☕ Invítame a un café",
    "status.loading": "Cargando detector…",
    "status.detecting": "Detectando caras…",
    "status.noFaces": "No se han detectado caras. Prueba con otra foto.",
    "status.faces": (n) => `${n} ${n === 1 ? "cara detectada" : "caras detectadas"}.`,
    "status.error": "Algo ha ido mal procesando la imagen.",
  },
  en: {
    "hero.title": "Pixelate the faces in your photos",
    "hero.subtitle": "Upload a photo, pick which faces to cover, and download it.",
    "hero.privacy": "100% private. Everything runs on your device. The photo is never uploaded.",
    "upload.cta": "<strong>Drag a photo</strong> or click to choose",
    "upload.hint": "The image never leaves your browser.",
    "controls.faces": "Detected faces",
    "controls.facesHint": "Tap a box to include or exclude a face.",
    "controls.selectAll": "All",
    "controls.selectNone": "None",
    "controls.style": "Style",
    "style.pixelate": "Pixelate",
    "style.blur": "Blur",
    "style.emoji": "Emoji",
    "controls.intensity": "Intensity",
    "controls.download": "Download",
    "controls.reset": "New photo",
    "footer.privacy": "🔒 Your photos never leave your device.",
    "footer.coffee": "☕ Buy me a coffee",
    "status.loading": "Loading detector…",
    "status.detecting": "Detecting faces…",
    "status.noFaces": "No faces detected. Try another photo.",
    "status.faces": (n) => `${n} ${n === 1 ? "face detected" : "faces detected"}.`,
    "status.error": "Something went wrong while processing the image.",
  },
};

const SUPPORTED = Object.keys(STRINGS);
let current = "es";

export function detectLang() {
  const stored = localStorage.getItem("pixelface.lang");
  if (stored && SUPPORTED.includes(stored)) return stored;
  const nav = (navigator.language || "es").slice(0, 2).toLowerCase();
  return SUPPORTED.includes(nav) ? nav : "es";
}

export function setLang(lang) {
  if (!SUPPORTED.includes(lang)) return;
  current = lang;
  localStorage.setItem("pixelface.lang", lang);
  document.documentElement.lang = lang;
  applyTranslations();
  for (const btn of document.querySelectorAll(".lang-switch button")) {
    btn.classList.toggle("active", btn.dataset.lang === lang);
  }
}

export function t(key, ...args) {
  const entry = STRINGS[current][key] ?? STRINGS.es[key] ?? key;
  return typeof entry === "function" ? entry(...args) : entry;
}

export function applyTranslations(root = document) {
  for (const el of root.querySelectorAll("[data-i18n]")) {
    el.innerHTML = t(el.dataset.i18n);
  }
}
