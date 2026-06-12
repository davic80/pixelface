# Changelog

All notable changes to this project are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/).

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
