# Changelog

All notable changes to this project are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/).

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
