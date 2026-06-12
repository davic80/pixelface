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

## 1. Configurar y arrancar en el servidor

```bash
git clone https://github.com/davic80/pixelface.git   # solo para el script + .env
cd pixelface
cp .env.example .env        # ajusta host/puerto si hace falta
./deploy.sh
```

`deploy.sh` deja el contenedor escuchando en **`127.0.0.1:8080`** (no expuesto a
internet). Para actualizar tras un nuevo release: vuelve a ejecutar `./deploy.sh`.

> Si solo quieres el script, basta con copiar `deploy.sh` y `.env` al servidor.

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

El contenedor sirve HTTP plano en `127.0.0.1:8080`. El reverse proxy le pone el
dominio y el TLS. Dos ejemplos:

### Caddy (TLS automático con Let's Encrypt)

```caddy
pixelface.ojoalprecio.com {
    reverse_proxy 127.0.0.1:8080
}
```

Caddy obtiene y renueva el certificado solo (requiere DNS apuntando ya y los puertos
80/443 abiertos). Ideal con Cloudflare en modo **DNS only**.

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
