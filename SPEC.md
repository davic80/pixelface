# pixelface — Especificación

> Webapp para pixelar/censurar caras en fotos. **Procesamiento 100% en el navegador**:
> la foto nunca se sube a ningún servidor. Privacidad total por diseño.

Estado: **en producción** (v0.4.0) en https://pixelface.ojoalprecio.com · Última actualización: 2026-06-13

> Nota: desde v0.4.0 hay un pequeño backend Node que sirve la app y un panel de
> analíticas anónimas en `/stats` (sin IP ni cookies). La promesa de "la foto nunca
> sale del navegador" se mantiene intacta.

---

## 1. Propósito y propuesta de valor

Subes una foto, se detectan las caras automáticamente y las censuras (pixelado,
desenfoque o emoji) antes de descargarla. El argumento diferencial es la privacidad
**radical**: el procesamiento ocurre íntegramente en el dispositivo del usuario, por lo
que la imagen **nunca llega al servidor**. No es "no la guardamos", es "nunca la recibimos".

## 2. Principios (no negociables)

- **La imagen nunca sale del navegador.** Cero subidas, cero red con la foto.
- **Cero almacenamiento, cero tracking** de la imagen.
- **Cero llamadas a terceros con datos del usuario.** Modelo de IA, WASM, fuentes y
  scripts se sirven desde nuestro propio contenedor. La app funciona offline tras cargar.
- **Se eliminan los metadatos EXIF** (GPS, cámara, fecha) en la imagen de salida.
- Mobile-first: la mayoría subirá fotos desde el móvil.

## 3. Flujo de usuario (v1)

1. **Cargar foto**: arrastrar/soltar, selector de archivo o cámara del dispositivo.
2. **Detección automática** de caras → se dibujan recuadros sobre cada una.
3. **Selección gráfica**: si hay varias caras, el usuario toca cada recuadro para
   marcar/desmarcar cuáles censurar. Por defecto, **todas** seleccionadas.
4. **Estilo de censura** (elegible por el usuario):
   - Pixelado (mosaico) — con control de intensidad.
   - Desenfoque (blur gaussiano) — con control de intensidad.
   - Emoji/sticker — tapa la cara con un emoji.
5. **Vista previa en vivo** sobre un `<canvas>`.
6. **Descargar** la imagen resultante (PNG, sin EXIF).
7. Bloque de **productos recomendados de Amazon** (monetización, ver §7).

### Diseño / UI

- Estética **súper limpia y minimalista**. Mensaje central y visible:
  **"100% privado — todo se procesa en tu dispositivo, la foto nunca se sube"**.
- **Footer común** (como en los demás proyectos):
  - Número de **versión** visible abajo.
  - Botón **"Invítame a un café"** → `https://www.paypal.com/donate/?hosted_button_id=7Z6JDTBCDCWHC`.
  - Slot de **publicidad (referidos)** abajo — se añade más adelante.

## 4. Arquitectura técnica

- **Tipo**: Single Page App estática, sin backend de aplicación. Solo se sirven
  ficheros estáticos (HTML/JS/CSS/WASM/modelo).
- **Lenguaje**: JavaScript vanilla (sin framework pesado), estructura modular.
- **Build**: [Vite](https://vitejs.dev/) para bundling y dev server.
- **Detección de caras**: [`@mediapipe/tasks-vision`](https://www.npmjs.com/package/@mediapipe/tasks-vision)
  `FaceDetector` (modelo BlazeFace short-range), ejecutado en **WASM en el cliente**.
  - El modelo (`.tflite`) y los binarios WASM se **alojan en nuestro contenedor**
    (`/public`), nunca se descargan de un CDN de Google en runtime.
- **Censura**: operaciones sobre `<canvas>` 2D:
  - Pixelado: downscale + upscale del recorte de la cara.
  - Blur: `ctx.filter = "blur(Npx)"` sobre el recorte.
  - Emoji: dibujar el glifo escalado a la caja de la cara.
- **Eliminación de EXIF**: redibujar la imagen en canvas y re-exportar con `toBlob()`
  descarta los metadatos automáticamente.
- **i18n**: Español + Inglés, mediante diccionario JS simple + detección de idioma del
  navegador y selector manual.

## 5. Calidad de código y CI/CD

- **Linter + formatter**: [Biome](https://biomejs.dev/) (un único binario, rápido,
  filosofía tipo `ruff` pero para JS/TS). *No hay Python en el repo.*
- **CI** (GitHub Actions):
  1. `biome ci` (lint + format check).
  2. Build con Vite.
  3. Construir imagen Docker y publicarla en GHCR (GitHub Container Registry).
- **Imagen Docker**: multi-stage — etapa Node para build, etapa final `nginx` mínimo
  sirviendo `dist/`.

## 6. Despliegue

- Servidor pequeño en Alemania, junto a padelscores.
- Subdominio: **`pixelface.ojoalprecio.com`** detrás del reverse proxy existente.
- Contenedor de solo lectura, sin volúmenes (no hay nada que persistir).

## 7. Monetización

- Bloque de **productos recomendados de Amazon** con el enlace referido de **ojoalprecio**.
- Configuración estática de productos (lista en JSON/JS), sin tracking invasivo del usuario
  (coherente con el mensaje de privacidad).
- Incluir el **aviso de afiliados de Amazon** requerido por su programa.

## 8. Privacidad / legal

- Licencia del repo: **MIT** (repo público en GitHub).
- Página/sección de privacidad explicando que la foto nunca se sube.
- Sin analítica que comprometa la privacidad (si acaso, métricas agregadas sin imagen;
  a decidir).
- Disclosure de afiliados de Amazon.

## 9. Backlog

- ✅ ~~Edición manual de recuadros (añadir área / borrar / redimensionar)~~ → hecho en **v0.2.0**.
- ✅ ~~Estilo de censura distinto por cara~~ → hecho en **v0.3.0**.
- Mover/arrastrar un área ya creada (ahora se redimensiona desde el centro, pero no se reposiciona).
- Detección de matrículas u otros objetos sensibles.
- Modo lote (varias fotos a la vez).
- Rotar el emoji según la orientación de la cara (usar keypoints de MediaPipe).
- Bloque de publicidad (referidos Amazon/ojoalprecio) en el slot `#ads`.

## 10. Decisiones tomadas

| Tema | Decisión |
|------|----------|
| Dónde se procesa | 100% en el navegador |
| Detector | MediaPipe Tasks Vision (BlazeFace), self-hosted |
| Estilos de censura | Pixelado, desenfoque, emoji (elegible por el usuario) |
| Idiomas | Español, Inglés |
| Tooling | Biome |
| Edición manual de recuadros | No en v1 (v2) |
| Despliegue | nginx estático en Docker, subdominio propio |
| Licencia | MIT, repo público |
