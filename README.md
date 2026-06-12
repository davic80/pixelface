# pixelface

Pixela y censura caras en tus fotos — **100% privado**. Todo el procesamiento ocurre
en tu navegador: la imagen **nunca se sube a ningún servidor**.

🌐 [pixelface.ojoalprecio.com](https://pixelface.ojoalprecio.com)

## ¿Cómo funciona?

1. Subes (o arrastras) una foto.
2. Se detectan las caras automáticamente, en tu dispositivo.
3. Eliges qué caras tapar y con qué estilo: **pixelado**, **desenfoque** o **emoji**.
4. Descargas la imagen — sin metadatos EXIF.

La detección usa [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe)
(BlazeFace) compilado a WASM y ejecutado en el cliente. El modelo y el runtime WASM se
sirven desde este mismo contenedor, así que **no se hace ni una sola petición a
terceros** con tus datos.

## Privacidad

- La foto nunca sale del navegador. No hay backend de subida.
- No se almacena nada. No hay tracking de imágenes.
- Los metadatos EXIF (GPS, cámara) se eliminan al exportar.

## Desarrollo

Requiere Node 22+.

```bash
npm install
npm run setup:assets   # copia el WASM y descarga el modelo a public/
npm run dev            # servidor de desarrollo (Vite)
```

Otros comandos:

```bash
npm run lint     # Biome (lint + format check)
npm run format   # Biome (autoformat)
npm run build    # build de producción -> dist/
```

> `setup:assets` descarga el modelo de MediaPipe **una vez**, en build, para luego
> autoalojarlo. Es lo único que toca la red, y ocurre en tu máquina/CI, no en runtime.

## Despliegue

Imagen Docker con nginx sirviendo los estáticos:

```bash
docker build -t pixelface .
docker run -p 8080:80 pixelface
```

La CI de GitHub Actions hace lint + build y publica la imagen en GHCR en cada push a
`main`. En el servidor, detrás del reverse proxy, se expone como
`pixelface.ojoalprecio.com`.

## Stack

JavaScript vanilla · [Vite](https://vitejs.dev/) · [Biome](https://biomejs.dev/) ·
[MediaPipe Tasks Vision](https://www.npmjs.com/package/@mediapipe/tasks-vision) ·
nginx · Docker.

## Licencia

[MIT](./LICENSE) · Si te resulta útil, ☕
[invítame a un café](https://www.paypal.com/donate/?hosted_button_id=7Z6JDTBCDCWHC).
