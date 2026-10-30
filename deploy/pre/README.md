# Pre en el servidor doméstico

> **Pospuesto (D-77):** hasta que haya más grupos, las pruebas que necesitan HTTPS (como instalar la PWA en el móvil)
> se hacen con un túnel puntual desde el PC; ver «Probar en el móvil con HTTPS» al final. Cuando se monte este `pre`,
> la idea es publicarlo con Cloudflare Tunnel en vez de abrir puertos del router.

Entorno de pruebas en `https://pre-scouts.josanfersal.dev`, en el mismo servidor de casa que el pre de My Money
(Docker, nginx, Certbot y `ddclient` ya instalados). **Solo datos inventados**: nunca se cargan aquí Excels del
banco ni listados reales de educandos.

```
Internet ─► nginx del servidor (TLS, Certbot) ─► 127.0.0.1:WEB_PORT
              └─► contenedor web (nginx sin root): /  → web
                                                   /api → contenedor api ─► contenedor db (sin puertos)
```

## Primera vez

### 1. DNS (Cloudflare)

Crea un registro **CNAME** `pre-scouts` que apunte al nombre que ya actualiza `ddclient` para el pre de
My Money, en modo **solo DNS** (nube gris). Así sigue la IP de casa sin tocar `ddclient`.

### 2. Código y variables

```bash
git clone https://github.com/Jump0ts/pagos-scouts.git ~/pagos-scouts
cd ~/pagos-scouts
git switch pre
cp deploy/pre/.env.pre.example deploy/pre/.env.pre
openssl rand -hex 24          # pega el resultado como POSTGRES_PASSWORD en deploy/pre/.env.pre
nano deploy/pre/.env.pre      # revisa también WEB_PORT: tiene que ser un puerto libre
chmod 600 deploy/pre/.env.pre
```

### 3. Levantar los contenedores

```bash
docker compose -f deploy/pre/docker-compose.yml --env-file deploy/pre/.env.pre up -d --build
docker compose -f deploy/pre/docker-compose.yml --env-file deploy/pre/.env.pre ps
```

`api` y `web` deben quedar en `running` (la API, además, `healthy`), y `web-files` en `exited (0)`.
Comprobación local:

```bash
curl -s http://127.0.0.1:8090/api/health    # {"status":"ok","env":"production","db":"ok"}
```

(cambia `8090` si usas otro `WEB_PORT`).

### 4. nginx del servidor y HTTPS

```bash
sudo cp deploy/pre/nginx/pre-scouts.conf /etc/nginx/sites-available/pre-scouts.conf
sudo nano /etc/nginx/sites-available/pre-scouts.conf     # el puerto de proxy_pass = WEB_PORT
sudo ln -s /etc/nginx/sites-available/pre-scouts.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d pre-scouts.josanfersal.dev
```

Abre `https://pre-scouts.josanfersal.dev`: la pantalla "Estado del sistema" debe mostrar la API y la base de
datos en verde.

### 5. Primer grupo de pruebas (a partir de la parte 1)

Aplica las migraciones y crea un grupo **inventado** con tu email como administrador. El comando imprime el
enlace de invitación: ábrelo, elige tu contraseña y ya estás dentro.

```bash
C="docker compose -f deploy/pre/docker-compose.yml --env-file deploy/pre/.env.pre"
$C exec api npx prisma migrate deploy
$C exec api node dist/cli/crear-grupo.js --nombre "Grupo de pruebas" --admin tu@email
```

Si alguna vez pierdes la contraseña del único administrador:

```bash
$C exec api node dist/cli/restablecer.js --email tu@email
```

## Actualizar pre

Cada vez que se mergea un PR a `pre`:

```bash
cd ~/pagos-scouts
git pull
docker compose -f deploy/pre/docker-compose.yml --env-file deploy/pre/.env.pre up -d --build
```

Cuando haya migraciones de base de datos (a partir de la parte 1), después del `up`:

```bash
docker compose -f deploy/pre/docker-compose.yml --env-file deploy/pre/.env.pre exec api npx prisma migrate deploy
```

## Si algo falla

```bash
docker compose -f deploy/pre/docker-compose.yml --env-file deploy/pre/.env.pre logs --tail=50 api web
```

- `502` en `/api/...`: la API no está arriba (mira sus logs).
- La web carga pero "Base de datos" sale en rojo: revisa `POSTGRES_*` en `.env.pre`.
- Para empezar de cero (borra los datos de pre):
  `docker compose -f deploy/pre/docker-compose.yml --env-file deploy/pre/.env.pre down -v`

## Probar en el móvil con HTTPS (túnel puntual, D-77)

Para probar lo que exige HTTPS (instalar la PWA, el service worker) sin montar nada. **Solo con datos inventados.**

1. Una vez, instala `cloudflared` (en PowerShell): `winget install Cloudflare.cloudflared`
2. Arranca la API (`npm run backend:dev`) y la web compilada: `npm run build --workspace=apps/web` y luego
   `npx --prefix apps/web vite preview apps/web --port 4174`.
3. Abre el túnel: `cloudflared tunnel --url http://localhost:4174`. Imprime una dirección `https://…trycloudflare.com`.
4. Ábrela en el móvil, entra con un usuario de pruebas e instala la app.
5. Al terminar, cierra el túnel con `Ctrl+C`: mientras está abierto, cualquiera con esa dirección llega a tu web de
   desarrollo (con usuario y contraseña, y datos inventados).

Si el móvil ya tenía instalada una versión de otro túnel, desinstálala: cada túnel tiene una dirección distinta.

