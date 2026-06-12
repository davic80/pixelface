# Changelog

All notable changes to this project are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/).

## [0.3.2] - 2026-06-12

### Added
- **Move areas**: drag an area to reposition it (click-and-drag with the mouse,
  or tap-and-move on touch). A plain tap still selects/deselects.

## [0.3.1] - 2026-06-12

### Changed
- Removed the **blur** style — censor styles are now **pixelate** and **emoji**.
- Added a new emoji (🥸); the delete-area button now has a **red outline**.

## [0.3.0] - 2026-06-12

### Added
- **Per-area censor style**: each area can have its own style (pixelate / blur /
  emoji), intensity and emoji. Select an area and the style controls edit just
  that area; with no area selected they set the default applied to every area.
  Tap an already-selected area to deselect it.

### Changed
- Stronger blur so it reads clearly on desktop too.

## [0.2.4] - 2026-06-12

### Fixed
- **Blur now works on iOS/iPhone**: replaced the canvas `filter`-based blur (which
  iOS Safari ignores) with a downscale + smooth-upscale blur that works everywhere.

### Changed
- The per-area **size slider is now centered**: the middle is the current size,
  drag right to enlarge and left to shrink (relative to the size when selected).

## [0.2.3] - 2026-06-12

### Changed
- Adding an area is now **tap to place**: press **+ Área**, then tap the photo and
  a box appears centered there, sized to the average of the detected faces (or a
  standard size when none were detected). Resize it afterwards with the slider.
- Action bar aligned to the columns: **Download** spans the photo width, **New
  photo** spans the options width.

## [0.2.2] - 2026-06-12

### Changed
- The **Download** and **New photo** buttons now span the full editor width
  (below the photo and the options), instead of sitting narrow in the sidebar.

## [0.2.1] - 2026-06-12

### Fixed
- Creating areas now works on **mobile/touch**: the drag was being swallowed as a
  scroll/zoom gesture. Added `touch-action: none` and window-level pointer
  tracking (with `pointercancel` handling).

### Changed
- More robust deploys: removed the fixed `container_name` (cause of the
  "name already in use" conflict on redeploy) and pinned a `pixelface` network
  alias so the shared Caddy still reaches the app.

## [0.2.0] - 2026-06-12

### Added
- **Manual areas**: draw your own censor area with **+ Área** (drag on the photo).
- **Per-area editing**: tap an area to select it, then resize it with a **slider**,
  toggle whether it is censored, or delete it.
- GitHub Release per version: a release workflow on `v*` tags publishes the release
  (notes from this changelog) and tags the GHCR image with the version.

### Changed
- Detection is more conservative (confidence 0.5) to avoid false positives; missed
  small faces can now be added by hand.
- `deploy.sh` now updates the running stack via docker compose (git pull + compose
  pull + up), matching the shared-Caddy production setup.

## [0.1.2] - 2026-06-12

### Improved
- Fully responsive, mobile-first layout; minimal spacing and copy throughout
  (shorter labels and status messages, leaner hero).
- Picking an emoji now switches the style to "emoji" automatically; the emoji
  picker is always visible.

### Added
- Deploy tooling: `deploy.sh` (pulls the GHCR image and runs it bound to
  127.0.0.1), `.env.example`, and `DEPLOY.md` with Cloudflare DNS + reverse
  proxy (Caddy / nginx) instructions.
- `docker-compose.yml` (full stack: app + own Caddy with automatic TLS) and
  `docker-compose.shared.yml` (app only, joins an existing Caddy's Docker
  network — e.g. sharing the padelscores Caddy as a single edge).

### Planned (future patch)
- Per-face effect/emoji (different censor style per detected face).

## [0.1.1] - 2026-06-12

### Improved
- Much better detection of **small faces**: detection now runs on the full image
  plus overlapping tiles (multi-scale), merging results with non-max suppression.
  Detection confidence threshold lowered to 0.3 (duplicates removed by NMS).

### Changed
- Emoji set is now 😀 😎 🙈 😢 😂.

## [0.1.0] - 2026-06-12

### Added
- Initial scaffold of **pixelface**: in-browser face pixelation web app.
- Face detection with MediaPipe Tasks Vision (BlazeFace), running in WASM on the
  client. WASM runtime and model self-hosted (no third-party calls at runtime).
- Censoring styles: pixelate, blur, emoji — selectable, with intensity control.
- Graphic per-face selection (toggle which faces to censor).
- EXIF metadata stripped on export (canvas re-encode).
- Spanish + English UI.
- Clean minimalist design, privacy messaging, footer with version and
  "buy me a coffee" link.
- Dockerfile (nginx static), GitHub Actions CI (Biome + build + image to GHCR).
