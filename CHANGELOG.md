# Changelog

All notable changes to this project are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/).

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
