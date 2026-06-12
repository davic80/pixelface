// pixelface backend: serves the built static app, a tiny privacy-friendly
// analytics collector, and a protected /stats dashboard. Zero dependencies.
//
// Privacy: we never store IPs or set cookies. Country is derived from
// Cloudflare's CF-IPCountry header (the IP itself is never written). Each event
// is anonymous and cannot be tied to an individual.

import {
  appendFileSync,
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT || 80);
const DATA_DIR = process.env.DATA_DIR || "/data";
const STATS_USER = process.env.STATS_USER || "admin";
const STATS_PASSWORD = process.env.STATS_PASSWORD || "";
const DIST = fileURLToPath(new URL("../dist", import.meta.url));
const EVENTS = join(DATA_DIR, "events.ndjson");

mkdirSync(DATA_DIR, { recursive: true });

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".tflite": "application/octet-stream",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

// --- Analytics ------------------------------------------------------------
function parseUA(ua = "") {
  let device = "desktop";
  if (/iPad|Tablet|PlayBook/i.test(ua)) device = "tablet";
  else if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(ua)) device = "mobile";
  else if (/Android/i.test(ua)) device = "tablet";

  let os = "Other";
  if (/Windows NT/i.test(ua)) os = "Windows";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Linux/i.test(ua)) os = "Linux";

  let browser = "Other";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/i.test(ua)) browser = "Opera";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Chrome\//i.test(ua)) browser = "Chrome";
  else if (/Safari\//i.test(ua) && /Version\//i.test(ua)) browser = "Safari";

  return { device, os, browser };
}

const clampInt = (v) => (Number.isFinite(+v) ? Math.max(0, Math.min(20000, Math.round(+v))) : 0);
const clampNum = (v) => (Number.isFinite(+v) ? Math.max(0, Math.min(10, +v)) : 0);

function record(type, req, body) {
  const { device, os, browser } = parseUA(req.headers["user-agent"] || "");
  const ev = {
    t: Date.now(),
    type,
    country: String(req.headers["cf-ipcountry"] || "ZZ")
      .toUpperCase()
      .slice(0, 2),
    device,
    os,
    browser,
    w: clampInt(body.w),
    h: clampInt(body.h),
    dpr: clampNum(body.dpr),
    lang: String(body.lang || "").slice(0, 12),
    tz: String(body.tz || "").slice(0, 40),
  };
  if (type === "action") {
    ev.action = String(body.action || "")
      .toLowerCase()
      .replace(/[^a-z_]/g, "")
      .slice(0, 24);
    ev.label = String(body.label || "").slice(0, 24);
  }
  try {
    appendFileSync(EVENTS, `${JSON.stringify(ev)}\n`);
  } catch {
    /* best-effort: never break the response on a write error */
  }
}

function readEvents() {
  if (!existsSync(EVENTS)) return [];
  const out = [];
  for (const line of readFileSync(EVENTS, "utf8").split("\n")) {
    if (!line) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      /* skip malformed line */
    }
  }
  return out;
}

// --- HTTP helpers ---------------------------------------------------------
function text(res, code, body) {
  res.writeHead(code, { "content-type": "text/plain; charset=utf-8" });
  res.end(body);
}

function collect(type, req, res) {
  let raw = "";
  req.on("data", (c) => {
    raw += c;
    if (raw.length > 2048) req.destroy();
  });
  req.on("end", () => {
    let body = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      /* ignore bad JSON */
    }
    record(type, req, body);
    res.writeHead(204).end();
  });
}

function serveStatic(pathname, res) {
  let rel = normalize(decodeURIComponent(pathname));
  if (rel.endsWith("/")) rel += "index.html";
  let file = join(DIST, rel);
  if (!file.startsWith(DIST)) return text(res, 403, "forbidden");
  if (!existsSync(file) || !statSync(file).isFile()) {
    if (extname(rel)) return text(res, 404, "not found");
    file = join(DIST, "index.html"); // SPA fallback
  }
  const ext = extname(file);
  const headers = { "content-type": MIME[ext] || "application/octet-stream" };
  if (rel.startsWith("/assets/")) headers["cache-control"] = "public, max-age=31536000, immutable";
  res.writeHead(200, headers);
  createReadStream(file).pipe(res);
}

// --- /stats dashboard -----------------------------------------------------
function authed(req) {
  const [type, val] = (req.headers.authorization || "").split(" ");
  if (type !== "Basic" || !val) return false;
  const [u, p] = Buffer.from(val, "base64").toString("utf8").split(":");
  return u === STATS_USER && p === STATS_PASSWORD && STATS_PASSWORD !== "";
}

function flag(cc) {
  if (!/^[A-Z]{2}$/.test(cc)) return "🏳️";
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

function tally(items) {
  const m = new Map();
  for (const k of items) m.set(k, (m.get(k) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function bars(entries, { label = (k) => esc(k), max = 12 } = {}) {
  const top = entries.slice(0, max);
  const peak = top.length ? top[0][1] : 1;
  return top
    .map(
      ([k, n]) => `<div class="row"><span class="k">${label(k)}</span>
      <span class="bar"><i style="width:${(n / peak) * 100}%"></i></span>
      <span class="n">${n}</span></div>`,
    )
    .join("");
}

function renderStats(events) {
  const hits = events.filter((e) => e.type === "hit");
  const coffee = events.filter((e) => e.type === "coffee");
  const actions = events.filter((e) => e.type === "action");
  const ac = (a) => actions.filter((e) => e.action === a).length;

  const dayKey = (t) => new Date(t).toISOString().slice(0, 10);
  const days = new Map();
  for (const e of hits) days.set(dayKey(e.t), (days.get(dayKey(e.t)) || 0) + 1);
  const lastDays = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10);
    return [d.slice(5), days.get(d) || 0];
  });

  const hours = Array.from({ length: 24 }, (_, h) => [
    `${String(h).padStart(2, "0")}h`,
    hits.filter((e) => new Date(e.t).getUTCHours() === h).length,
  ]);

  const card = (title, inner) => `<section class="card"><h2>${title}</h2>${inner}</section>`;
  const big = (n, label) => `<div class="big"><b>${n}</b><span>${label}</span></div>`;

  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>pixelface · stats</title>
<style>
:root{--bg:#0f1115;--surface:#171a21;--surface2:#1f2430;--text:#e8eaed;--muted:#9aa3b2;--accent:#5b8cff;--accent2:#7c5bff;--border:#2a3040}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:24px;max-width:1000px;margin:0 auto}
h1{font-size:1.4rem;margin:0 0 4px}.sub{color:var(--muted);font-size:.85rem;margin:0 0 20px}
.bigrow{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:18px}
.big{flex:1;min-width:140px;background:linear-gradient(135deg,var(--accent),var(--accent2));border-radius:14px;padding:16px}
.big b{display:block;font-size:2rem;line-height:1}.big span{font-size:.8rem;opacity:.9}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px 16px}
.card h2{font-size:.95rem;margin:0 0 12px}
.row{display:grid;grid-template-columns:90px 1fr 40px;align-items:center;gap:8px;margin:5px 0;font-size:.82rem}
.k{color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bar{background:var(--surface2);border-radius:6px;height:14px;overflow:hidden}
.bar i{display:block;height:100%;background:linear-gradient(90deg,var(--accent),var(--accent2))}
.n{text-align:right;font-variant-numeric:tabular-nums}
.foot{color:var(--muted);font-size:.78rem;margin-top:22px}
</style></head><body>
<h1>pixelface · stats</h1>
<p class="sub">Analíticas anónimas — sin IP, sin cookies. Las horas son UTC.</p>
<div class="bigrow">
  ${big(hits.length, "páginas servidas")}
  ${big(ac("load_photo"), "fotos cargadas")}
  ${big(ac("download"), "descargas")}
  ${big(ac("new_photo"), "otra foto")}
  ${big(coffee.length, "clics en ☕ café")}
  ${big(tally(hits.map((e) => e.country)).length, "países")}
</div>
<div class="grid">
  ${card("Visitas por día", bars(lastDays, { max: 30 }))}
  ${card("Visitas por hora (UTC)", bars(hours, { max: 24 }))}
  ${card("Países", bars(tally(hits.map((e) => e.country)), { label: (k) => `${flag(k)} ${esc(k)}` }))}
  ${card("Dispositivo", bars(tally(hits.map((e) => e.device))))}
  ${card("Navegador", bars(tally(hits.map((e) => e.browser))))}
  ${card("Sistema", bars(tally(hits.map((e) => e.os))))}
  ${card("Resolución", bars(tally(hits.filter((e) => e.w).map((e) => `${e.w}×${e.h}`))))}
  ${card("Idioma", bars(tally(hits.filter((e) => e.lang).map((e) => e.lang))))}
  ${card("Acciones", bars(tally(actions.map((e) => e.action))))}
  ${card("Emojis usados", bars(tally(actions.filter((e) => e.action === "emoji" && e.label).map((e) => e.label))))}
</div>
<p class="foot">pixelface — las fotos nunca salen del navegador; estas estadísticas son agregadas y anónimas.</p>
</body></html>`;
}

function stats(req, res) {
  if (!authed(req)) {
    res.writeHead(401, {
      "www-authenticate": 'Basic realm="pixelface stats"',
      "content-type": "text/plain; charset=utf-8",
    });
    return res.end("auth required");
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(renderStats(readEvents()));
}

// --- Router ---------------------------------------------------------------
const server = createServer((req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  if (req.method === "POST" && pathname === "/api/hit") return collect("hit", req, res);
  if (req.method === "POST" && pathname === "/api/coffee") return collect("coffee", req, res);
  if (req.method === "POST" && pathname === "/api/event") return collect("action", req, res);
  if (pathname === "/healthz") return text(res, 200, "ok");
  if (pathname === "/stats") return stats(req, res);
  if (req.method !== "GET" && req.method !== "HEAD") return text(res, 405, "method not allowed");
  return serveStatic(pathname, res);
});

server.listen(PORT, () => console.log(`pixelface listening on :${PORT} (data: ${DATA_DIR})`));
