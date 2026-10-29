# Producción en el droplet de DigitalOcean

Producción de Pagos Scouts en un droplet propio (D-59 a D-63). Todo lo necesario está en esta carpeta. Los pasos
marcados con 🔴 cambian infraestructura real: los lanzas tú, de uno en uno. Claude no toca ni el servidor ni el DNS, y
ningún secreto pasa por el chat ni por el repositorio.

```
 Navegador / PWA
        │ HTTPS
        ▼
 DNS Cloudflare (solo DNS) ──► droplet FRA1 ── cortafuegos DO + ufw: solo 22, 80, 443
                     ┌────────────────────────────────────────────────────────┐
                     │ nginx del sistema + Certbot: TLS, límites de peticiones │
                     └───────────────┬────────────────────────────────────────┘
                                     │ 127.0.0.1:8090
                     ┌───────────────▼──────────────┐
                     │ web (nginx sin root, solo     │  cabeceras de seguridad, CSP estricta
                     │ lectura): web + /api → api    │
                     └───────────────┬──────────────┘
                        red `interna` (sin salida a Internet, sin puertos publicados)
                     ┌───────────────▼──────────────┐      ┌──────────────────────┐
                     │ api (Node sin root, 256 MB)   ├─────►│ db (Postgres 16)     │
                     └──────────────────────────────┘      └──────────────────────┘
```

## 1. Principios de seguridad

| Qué | Cómo |
|---|---|
| Secretos | Solo en `~/pagos-scouts/.env.production` **en el servidor** (modo 600), generados allí y sin mostrarlos. GitHub guarda una clave SSH de despliegue (secreto) y datos no sensibles (variables). |
| Exposición | Solo el puerto 443 (y el 80, que redirige). La base de datos y la API no publican puertos y viven en una red sin Internet; la web solo escucha en `127.0.0.1`. |
| Altas | No hay registro abierto: los grupos se crean con `crear-grupo` en el servidor y las personas entran por invitación (D-11). |
| Fuerza bruta | nginx limita los POST de `/api/auth/`, `/api/invitaciones/` y `/api/restablecer/` a 10 por minuto y por IP, y el resto de `/api/` a 10 por segundo. La API bloquea además un email tras 5 fallos. |
| Formulario de pedidos | Lo único público sin sesión (`/api/publico/`, D-67 y D-69): nginx lo limita a 20 peticiones por minuto y por IP con cuerpos de 32 KB como mucho, y la API pone sus propios límites, un justificante firmado con tiempo mínimo, un campo trampa y un tope de envíos pendientes. Nada de lo enviado cuenta hasta que Tesorería lo acepta. |
| Contenedores | Sin root, sistema de ficheros de solo lectura, sin capabilities, `no-new-privileges` y límite de memoria. |
| Cadena de suministro | Acciones de GitHub fijadas por SHA; se despliega por **digest** y solo si la atestación de procedencia de la imagen se verifica. |
| Clave SSH de la CI | Con `restrict` y un **comando forzado** (de root, `deploy` no lo puede cambiar): solo puede pedir `deploy <digest> <usuario>`. Sin shell, túneles ni scp. El repositorio de imágenes está fijado en el servidor. |
| Aprobación | Cada merge a `master` que cambie algo desplegable construye la imagen y el despliegue **espera tu aprobación** en el entorno `production`, que solo admite `master`. |
| Servidor | SSH solo con clave, `deploy` sin `sudo`, actualizaciones de seguridad automáticas con reinicio de madrugada si lo piden (D-64), swap de 1 GB. |
| Copias | Cifradas con `age` antes de tocar el disco: el servidor solo tiene la clave **pública**. Diarias, antes de cada migración, y bajadas a tu PC con verificación SHA-256. |

## 2. Qué hay dónde

```
/home/deploy/pagos-scouts/        (de deploy, 750)
  .env.production     secretos (600). Nunca se sobrescribe ni sale del servidor
  bin/ssh-entry.sh    comando forzado de la clave de la CI (de root, 555)
  release/            ficheros de despliegue sacados de cada imagen verificada (compose, deploy.sh, copias, web)
  state/              imagen actual y anterior
  backups/            copias cifradas: daily/ (7) y weekly/ (4)
/etc/nginx/sites-available/scouts.conf    vhost (lo instala arranque.sh; Certbot le añade el HTTPS)
```

En tu PC:

```
%USERPROFILE%\.ssh\pagos_scouts_admin      clave de administración (root y deploy)
%USERPROFILE%\.ssh\pagos_scouts_ci         clave de la CI (la privada va a GitHub y después se borra del PC)
%USERPROFILE%\.age\pagos-scouts.txt        clave PRIVADA de las copias: sin ella no se pueden leer
%USERPROFILE%\PagosScoutsBackups\          copias bajadas del servidor
```

## 3. Primera vez

### 3.1 En tu PC: claves

```powershell
ssh-keygen -t ed25519 -C pagos-scouts-admin -f $env:USERPROFILE\.ssh\pagos_scouts_admin
ssh-keygen -t ed25519 -N '""' -C pagos-scouts-ci -f $env:USERPROFILE\.ssh\pagos_scouts_ci
winget install FiloSottile.age
New-Item -ItemType Directory -Force $env:USERPROFILE\.age | Out-Null
age-keygen -o $env:USERPROFILE\.age\pagos-scouts.txt
```

- Son órdenes de PowerShell: en `cmd`, `$env:USERPROFILE` no se expande (usa `%USERPROFILE%`) y la clave de age
  acabaría en otra ruta. Comprueba que existe `%USERPROFILE%\.age\pagos-scouts.txt`.
- Pon contraseña a la clave de administración.
- `age-keygen` imprime la clave **pública** (`age1…`); también está en la primera línea del fichero. La necesitas en 3.6.
- Guarda una copia de `pagos-scouts.txt` en tu gestor de contraseñas: **si se pierde, las copias no sirven**.

### 3.2 🔴 Crear el droplet

En DigitalOcean → *Create → Droplets*:

| Campo | Valor |
|---|---|
| Región | Frankfurt (FRA1) |
| Imagen | Ubuntu 24.04 (LTS) x64 |
| Tamaño | Basic → Regular → 1 GB / 1 CPU / 25 GB |
| Autenticación | SSH Key → sube `pagos_scouts_admin.pub` |
| Opciones | IPv6 activado; *Monitoring* activado; *Backups* no hace falta (D-62) |
| Nombre | `pagos-scouts` |

Después, en *Networking → Firewalls → Create Firewall* (`pagos-scouts`): entrantes solo TCP 22, 80 y 443; salientes por
defecto; aplícalo al droplet.

Apunta la IPv4 y la IPv6 del droplet. Para comprobar su huella SSH sin fiarte de la red, abre la consola web del droplet
(*Access → Launch Droplet Console*) y ejecuta `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`.

### 3.3 🔴 DNS (Cloudflare)

En la zona `josanfersal.dev`, dos registros `scouts`: `A` con la IPv4 y `AAAA` con la IPv6, en modo **solo DNS** (nube
gris), como el resto de subdominios. Comprueba con `nslookup scouts.josanfersal.dev 1.1.1.1`.

### 3.4 🔴 Arranque del servidor

Desde la raíz del repo, en `master` (o en la rama de la release):

```powershell
$IP = "IP-DEL-DROPLET"
ssh -i $env:USERPROFILE\.ssh\pagos_scouts_admin root@$IP "mkdir -p /root/arranque"
scp -i $env:USERPROFILE\.ssh\pagos_scouts_admin -r deploy/prod/servidor deploy/prod/bin root@${IP}:/root/arranque/
ssh -i $env:USERPROFILE\.ssh\pagos_scouts_admin root@$IP "bash /root/arranque/servidor/arranque.sh scouts.josanfersal.dev"
```

La primera conexión te enseña la huella del servidor: debe coincidir con la que viste en la consola (3.2).
El script deja Docker, nginx, Certbot, `age`, el cortafuegos, el usuario `deploy` y la carpeta de la app. Se puede repetir.

### 3.5 🔴 Certificado HTTPS

```powershell
ssh -i $env:USERPROFILE\.ssh\pagos_scouts_admin root@$IP "certbot --nginx -d scouts.josanfersal.dev --redirect -m TU_EMAIL --agree-tos --no-eff-email"
ssh -i $env:USERPROFILE\.ssh\pagos_scouts_admin root@$IP "certbot renew --dry-run"
```

Con `--agree-tos` aceptas las condiciones de Let's Encrypt. Certbot renueva solo. Hasta el primer despliegue la web
responde 502: es lo esperado.

### 3.6 🔴 Secretos en el servidor

Se escriben directamente en el fichero, sin pasar por la pantalla ni por el historial:

```bash
ssh -i ~/.ssh/pagos_scouts_admin deploy@IP-DEL-DROPLET
umask 077
{
  echo "DOMAIN=scouts.josanfersal.dev"
  echo "POSTGRES_USER=scouts"
  echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)"
  echo "POSTGRES_DB=pagos_scouts"
  echo "BACKUP_AGE_RECIPIENT=age1...tu-clave-publica..."
} > ~/pagos-scouts/.env.production
chmod 600 ~/pagos-scouts/.env.production
```

La clave de age de este fichero es la **pública**: no es secreta. La contraseña de Postgres no hace falta guardarla
fuera (las copias la incluyen implícitamente al restaurar en una base nueva); si quieres, léela tú en el servidor y
guárdala en tu gestor, nunca en un chat.

### 3.7 🔴 Clave de la CI con comando forzado

En el servidor, como `deploy`, una sola línea con el contenido de `pagos_scouts_ci.pub`:

```bash
echo 'restrict,command="/home/deploy/pagos-scouts/bin/ssh-entry.sh" ssh-ed25519 AAAA... pagos-scouts-ci' >> ~/.ssh/authorized_keys
```

Comprueba desde tu PC que no da shell: `ssh -i $env:USERPROFILE\.ssh\pagos_scouts_ci deploy@$IP id` debe responder
`ssh-entry: orden no permitida`.

### 3.8 GitHub

*Settings → Environments → New environment → `production`*:

- *Required reviewers*: tú. No marques *Prevent self-review* (eres el único revisor).
- *Deployment branches and tags*: solo `master`.

En ese entorno:

| Tipo | Nombre | Valor |
|---|---|---|
| Secret | `DEPLOY_SSH_KEY` | la clave **privada** `pagos_scouts_ci` (después bórrala del PC o guárdala en tu gestor) |
| Variable | `DEPLOY_HOST` | la IPv4 del droplet |
| Variable | `DEPLOY_USER` | `deploy` |
| Variable | `DEPLOY_KNOWN_HOSTS` | la salida de `ssh-keyscan -t ed25519 IP`, **tras comprobar** que su huella coincide con la de 3.2 |
| Variable | `DOMAIN` | `scouts.josanfersal.dev` |

### 3.9 🔴 Primer despliegue

GitHub solo conoce el flujo cuando está en `master`, así que llega con la release: al mergear `release/0.1.0` a
`master` se construye la imagen y *Actions → Desplegar* queda esperando tu aprobación. Apruébalo y comprueba:

```powershell
curl.exe -fsS https://scouts.josanfersal.dev/api/health
curl.exe -sI https://scouts.josanfersal.dev/login
```

La segunda debe dar 200 con cada cabecera de seguridad una sola vez.

### 3.10 🔴 Tu grupo y tu equipo

```bash
ssh -i ~/.ssh/pagos_scouts_admin deploy@IP-DEL-DROPLET
cd ~/pagos-scouts/release
docker compose -p pagos-scouts-prod --env-file ../.env.production --env-file ../state/image.env -f docker-compose.yml \
  exec api node dist/cli/crear-grupo.js --nombre "Grupo Scout ..." --admin tu@email
```

Imprime un enlace de invitación de un solo uso (7 días): ábrelo, crea tu contraseña, importa el listado real y el
Excel del banco, e invita a tu equipo desde *Ajustes → Personas* con el rol de cada uno (D-63).

### 3.11 🔴 Copias de seguridad

En el servidor, en el cron de `deploy` (`crontab -e`):

```
15 3 * * * $HOME/pagos-scouts/release/backup/backup.sh >> $HOME/pagos-scouts-backup.log 2>&1
```

Pruébalo una vez a mano: `~/pagos-scouts/release/backup/backup.sh`.

En tu PC, un alias SSH en `%USERPROFILE%\.ssh\config`:

```
Host pagos-scouts
  HostName IP-DEL-DROPLET
  User deploy
  IdentityFile ~/.ssh/pagos_scouts_admin
  IdentitiesOnly yes
  StrictHostKeyChecking yes
```

La descarga diaria (la clave de administración tiene contraseña: cárgala en el agente de OpenSSH de Windows, o la tarea
no podrá usarla). Desde `cmd`; las comillas escapadas (`\"`) hacen falta porque la ruta tiene un espacio, y las 09:00
dejan margen tras la copia del servidor (03:15 UTC):

```bat
powershell -NoProfile -ExecutionPolicy Bypass -File "G:\Desktop\Proyectos\Pagos scouts\deploy\prod\backup\pull-backups.ps1" -Server pagos-scouts
schtasks /Create /SC DAILY /ST 09:00 /TN "Pagos Scouts copias" /TR "powershell -NoProfile -ExecutionPolicy Bypass -File \"G:\Desktop\Proyectos\Pagos scouts\deploy\prod\backup\pull-backups.ps1\" -Server pagos-scouts"
```

- Solo añade copias nuevas, verifica cada una con SHA-256 y **nunca** replica los borrados del servidor.
- Falla (la tarea sale en rojo) si la última copia tiene más de 36 h: el servidor ha dejado de hacerlas.
- No hace falta dejar el PC encendido (D-65): si a las 09:00 estaba apagado, la tarea se lanza al encenderlo. Eso lo
  activa esta línea en PowerShell (`schtasks` no tiene la opción); el servidor guarda 7 diarias y 4 semanales, así que
  basta con encender el PC una vez por semana.

```powershell
$t = Get-ScheduledTask "Pagos Scouts copias"; $t.Settings.StartWhenAvailable = $true; Set-ScheduledTask $t
```

Una vez al mes, comprueba que la última copia se restaura entera (descifra en el PC y la carga en un Postgres
desechable en el servidor, sin tocar la base real):

```powershell
powershell -File deploy\prod\backup\prueba-restauracion.ps1 -Server pagos-scouts
```

### 3.12 Vigilancia

En DigitalOcean: *Monitoring → Uptime → New check* con `https://scouts.josanfersal.dev/api/health`, y una alerta de
memoria al 85 % en el droplet.

## 4. Operaciones

```bash
# Estado y registros (sin secretos)
docker ps --filter name=pagos-scouts-prod --format 'table {{.Names}}\t{{.Status}}'
docker logs --tail 50 pagos-scouts-prod-api-1

# Aplicar cambios del .env.production sin cambiar de imagen
cd ~/pagos-scouts/release && ./deploy.sh "$(cat ../state/current)"
```

**Volver a una versión anterior:** *Actions → Desplegar → Run workflow* con `image_tag = sha-xxxxxxx` (también pide
aprobación). Las migraciones solo van hacia delante: se escriben compatibles con la versión anterior de la API.

**Un despliegue hace, en orden:** comprobar la configuración → copia → migraciones → API nueva (si no queda sana, vuelve
sola a la anterior) → web.

### Actualizar el nginx del servidor

Los despliegues no tocan el nginx del servidor. Cuando cambia `servidor/scouts.conf` (por ejemplo, el límite del
formulario de pedidos, D-69), **no** relances `arranque.sh`: sobrescribiría el bloque HTTPS que añadió Certbot. Como
root, añade a mano lo nuevo en `/etc/nginx/sites-available/scouts.conf` (las líneas `limit_req_zone` arriba, junto a
las otras, y los `location` dentro del bloque `server` de HTTPS) y comprueba antes de recargar:

```bash
nginx -t && systemctl reload nginx
```

### Restaurar de verdad (desastre)

Con un droplet nuevo preparado hasta 3.9 (la base vacía), desde tu PC. El volcado se descifra aquí y viaja por la
tubería, sin escribirse en claro en ningún disco:

```powershell
cmd /c "age -d -i %USERPROFILE%\.age\pagos-scouts.txt RUTA\pagos-scouts-AAAAMMDD-HHMMSS.sql.gz.age | ssh pagos-scouts pagos-scouts/release/backup/restaurar.sh --si"
```

El volcado lleva la tabla de migraciones de Prisma, así que no hace falta migrar.

## 5. Riesgos aceptados

- **Un solo droplet**: si cae, cae todo. Las copias en tu PC permiten levantarlo de nuevo en otro.
- **Grupo `docker`**: `deploy` equivale a root en la máquina. Por eso la clave de la CI tiene comando forzado y la de
  administración no sale de tu PC.
- **Sin CDN delante**: los ataques de volumen solo los frena el límite de nginx. Es lo que permite que la web no
  dependa de IPs compartidas que algunos operadores españoles bloquean durante el fútbol.
- La descarga de copias usa la clave de administración (da shell como `deploy`). Vive en tu PC: protege el disco con
  BitLocker.

## 6. Pruebas

```bash
bash deploy/prod/prod.test.sh       # ssh-entry, deploy.sh y backup.sh con docker y age simulados (en Linux)
```
```powershell
Invoke-Pester deploy\prod\backup\pull-backups.Tests.ps1    # descarga de copias con ssh y scp simulados
```

La CI ejecuta además shellcheck, valida el compose y el nginx del servidor, y comprueba que la imagen lleva los
ficheros de despliegue ejecutables.
