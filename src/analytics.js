// Tiny privacy-friendly beacons. No cookies, no IDs; the server records only
// anonymous aggregates (country via Cloudflare header, device/browser from UA,
// plus the screen info below). Never sends anything about the photo.

function send(path, payload) {
  try {
    const body = payload ? JSON.stringify(payload) : "";
    if (navigator.sendBeacon) {
      navigator.sendBeacon(path, new Blob([body], { type: "application/json" }));
    } else {
      fetch(path, { method: "POST", body, keepalive: true });
    }
  } catch {
    /* analytics must never affect the app */
  }
}

/** Record a page view with the bits the User-Agent can't tell us. */
export function trackVisit() {
  send("/api/hit", {
    w: screen.width,
    h: screen.height,
    dpr: window.devicePixelRatio || 1,
    lang: navigator.language,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
}

/** Record a click on the "buy me a coffee" link. */
export function trackCoffee() {
  send("/api/coffee");
}

/** Record a named UI action (e.g. "download", "emoji" with the glyph as label). */
export function trackEvent(action, label) {
  send("/api/event", { action, label });
}
