// Minimal i18n: a flat dictionary keyed by dotted paths matching data-i18n
// attributes in index.html. Spanish + English (spec §4).

const STRINGS = {
  es: {
    "hero.title": "Pixela caras",
    "hero.privacy": "100% privado · todo en tu móvil",
    "upload.cta": "<strong>Elige una foto</strong>",
    "upload.hint": "No sale de tu dispositivo",
    "controls.faces": "Caras",
    "controls.facesHint": "Toca o arrastra un área · + Área para añadir",
    "controls.selectAll": "Todas",
    "controls.selectNone": "Ninguna",
    "controls.addArea": "+ Área",
    "editor.title": "Área seleccionada",
    "editor.size": "Tamaño",
    "editor.exclude": "No censurar",
    "editor.include": "Censurar",
    "editor.delete": "Borrar",
    "controls.style": "Estilo",
    "controls.styleArea": "Estilo (esta área)",
    "controls.styleDefault": "Estilo (todas)",
    "style.pixelate": "Pixelado",
    "style.emoji": "Emoji",
    "controls.intensity": "Intensidad",
    "controls.download": "Descargar",
    "controls.reset": "Otra foto",
    "footer.privacy": "🔒 Privado, en tu dispositivo",
    "footer.coffee": "☕ Café",
    "status.detecting": "Detectando…",
    "status.noFaces": "Sin caras. Prueba otra foto.",
    "status.faces": (n) => `${n} ${n === 1 ? "cara" : "caras"}`,
    "status.error": "Error al procesar la imagen.",
  },
  en: {
    "hero.title": "Pixelate faces",
    "hero.privacy": "100% private · all on your phone",
    "upload.cta": "<strong>Pick a photo</strong>",
    "upload.hint": "Stays on your device",
    "controls.faces": "Faces",
    "controls.facesHint": "Tap or drag an area · + Area to add",
    "controls.selectAll": "All",
    "controls.selectNone": "None",
    "controls.addArea": "+ Area",
    "editor.title": "Selected area",
    "editor.size": "Size",
    "editor.exclude": "Don't censor",
    "editor.include": "Censor",
    "editor.delete": "Delete",
    "controls.style": "Style",
    "controls.styleArea": "Style (this area)",
    "controls.styleDefault": "Style (all)",
    "style.pixelate": "Pixelate",
    "style.emoji": "Emoji",
    "controls.intensity": "Intensity",
    "controls.download": "Download",
    "controls.reset": "New photo",
    "footer.privacy": "🔒 Private, on your device",
    "footer.coffee": "☕ Coffee",
    "status.detecting": "Detecting…",
    "status.noFaces": "No faces. Try another photo.",
    "status.faces": (n) => `${n} ${n === 1 ? "face" : "faces"}`,
    "status.error": "Error processing the image.",
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
