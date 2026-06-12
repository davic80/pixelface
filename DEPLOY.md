# Despliegue de pixelface

La CI de GitHub Actions construye la imagen en cada push a `main` y la publica en
**GHCR** (`ghcr.io/davic80/pixelface`). El servidor solo necesita **Docker**: hace
`pull` de la imagen y la arranca. No hace falta clonar el código ni tener Node.

```
GitHub push → Actions build → GHCR ──pull──▶ servidor (Docker) ──▶ reverse proxy ──▶ Cloudflare ──▶ usuario
```

## 0. Una vez: hacer pública la imagen de GHCR (recomendado)

Aunque el repo sea público, el *paquete* (imagen) nace **privado**. Para poder hacer
`docker pull` sin login:

1. GitHub → tu perfil → **Packages** → `pixelface`.
2. **Package settings** → **Change visibility** → **Public**.

> Alternativa (si lo prefieres privado): en el servidor, `docker login ghcr.io` con un
> Personal Access Token con scope `read:packages`.

## 1. Arrancar en el servidor

### Opción A — docker compose (recomendado, todo en uno) ✅

Levanta la app **y** Caddy (reverse proxy con TLS automático) de una vez:

```bash
git clone https://github.com/davic80/pixelface.git
cd pixelface
cp .env.example .env        # pon tu PIXELFACE_HOST (y PIXELFACE_TAG si fijas versión)
docker compose up -d
```

`docker compose` hace `pull` de la imagen de GHCR, arranca `pixelface` (interno) y
`caddy` (puertos 80/443), y Caddy obtiene el certificado de Let's Encrypt para
`${PIXELFACE_HOST}` solo. Para actualizar tras un release:
`docker compose pull && docker compose up -d`.

> ⚠️ **Puertos 80/443:** este stack incluye su propio Caddy, así que necesita 80 y 443
> libres en el host. Si padelscores ya tiene un proxy ahí, no levantes este Caddy: usa
> la variante de **Caddy compartido** (§3, Opción B).
>
> Si ya lanzaste un contenedor suelto antes (`docker run --name pixelface`), bórralo
> primero: `docker rm -f pixelface`.

### Opción B — solo el contenedor (proxy aparte)

Si gestionas el reverse proxy por tu cuenta, `deploy.sh` arranca solo la app en
`127.0.0.1:8080`:

```bash
cp .env.example .env
./deploy.sh
```

## 2. Cloudflare (DNS)

En el panel de Cloudflare del dominio **`ojoalprecio.com`**:

1. **DNS → Records → Add record**
   - **Type:** `A`
   - **Name:** `pixelface`   (queda `pixelface.ojoalprecio.com`)
   - **IPv4 address:** la IP pública de tu servidor alemán
   - **TTL:** Auto

2. **Proxy status (la nube naranja):** elige según cómo termines el TLS:

   - **DNS only (nube gris)** — Cloudflare solo resuelve DNS. El TLS lo emite tu
     servidor con Let's Encrypt (ver §3, opción Caddy o nginx+certbot). *Lo más
     sencillo y robusto.*
   - **Proxied (nube naranja)** — Cloudflare hace de CDN/proxy y termina TLS en su
     borde. Entonces ve a **SSL/TLS → Overview** y pon el modo en **Full (strict)**,
     y en el origen instala un **Origin Certificate** de Cloudflare (SSL/TLS →
     Origin Server → Create Certificate) en tu reverse proxy. Da caché/protección
     extra, pero algo más de configuración.

> Recomendación para empezar: **DNS only + Let's Encrypt** en el servidor (con Caddy
> es automático). Si más tarde quieres CDN/caché, pasas a Proxied + Full (strict).

## 3. Reverse proxy

### Opción A — incluido en el compose (no hagas nada más)

Si usaste `docker compose up -d` (§1, Opción A), **el Caddy ya está dentro del stack**
con el `Caddyfile` del repo. No necesitas configurar nada más: el proxy y el TLS están
hechos. Salta al §4.

### Opción B — Caddy compartido (ya tienes un Caddy para padelscores) ✅

Como solo un Caddy puede usar 80/443, **el Caddy de padelscores pasa a ser el edge
compartido**: el mismo Caddy sirve los dos sitios (multiplexa por hostname). No montas
un segundo Caddy; añades un bloque y conectas el contenedor de pixelface a su red.

1. **Averigua la red Docker de tu Caddy** y ponla en `.env` como `PROXY_NETWORK`:

   ```bash
   docker inspect <caddy-container> \
     --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}'
   ```

2. **Arranca solo la app**, unida a esa red (sin exponer puertos al host):

   ```bash
   docker rm -f pixelface 2>/dev/null   # por si arrancaste un contenedor de prueba
   docker compose -f docker-compose.shared.yml up -d
   ```

3. **Añade el sitio al `Caddyfile` de padelscores** (Caddy llega a la app por nombre de
   contenedor, en la red compartida):

   ```caddy
   pixelface.ojoalprecio.com {
       reverse_proxy pixelface:80
   }
   ```

4. **Recarga Caddy** (sin parar padelscores):

   ```bash
   docker exec <caddy-container> caddy reload --config /etc/caddy/Caddyfile
   # o, si Caddy va por systemd:  sudo systemctl reload caddy
   ```

### Opción C — nginx (con certbot/Let's Encrypt)

```nginx
server {
    listen 443 ssl;
    server_name pixelface.ojoalprecio.com;

    ssl_certificate     /etc/letsencrypt/live/pixelface.ojoalprecio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pixelface.ojoalprecio.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

### nginx (con certbot/Let's Encrypt)

```nginx
server {
    listen 443 ssl;
    server_name pixelface.ojoalprecio.com;

    ssl_certificate     /etc/letsencrypt/live/pixelface.ojoalprecio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pixelface.ojoalprecio.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name pixelface.ojoalprecio.com;
    return 301 https://$host$request_uri;
}
```

Emite el certificado con: `certbot --nginx -d pixelface.ojoalprecio.com`.

## 4. Comprobar

```bash
curl -I https://pixelface.ojoalprecio.com   # debería responder 200
```

Sube una foto con varias caras y valida detección + estilos. La imagen nunca sale del
navegador: lo puedes verificar viendo que no hay peticiones de subida en las DevTools.
