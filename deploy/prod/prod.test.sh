#!/usr/bin/env bash
# Pruebas de los scripts de producción con docker y age simulados (no tocan nada real). Las lanza la CI:
#   bash deploy/prod/prod.test.sh
set -uo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FALLOS=0
ok() { echo "  ok - $1"; }
mal() { echo "  MAL - $1"; FALLOS=$((FALLOS + 1)); }
espera() { if eval "$2"; then ok "$1"; else mal "$1"; fi; }

DIGEST="sha256:$(printf 'a%.0s' {1..64})"
OTRO="sha256:$(printf 'b%.0s' {1..64})"
RECIPIENT="age1$(printf 'q%.0s' {1..58})"

# Entorno aislado: un docker y un age falsos en el PATH que apuntan lo que se les pide.
preparar() {
  T="$(mktemp -d)"
  mkdir -p "$T/bin" "$T/base/release" "$T/base/state"
  export LLAMADAS="$T/llamadas" PAGOS_SCOUTS_BASE="$T/base" PATH="$T/bin:$PATH"
  : >"$LLAMADAS"
  cat >"$T/bin/docker" <<'EOF'
#!/usr/bin/env bash
echo "docker $*" >>"$LLAMADAS"
case "$*" in
  create*) echo cid123 ;;
  "cp cid123:/opt/deploy/. "*)
    destino="${*: -1}"
    printf '#!/usr/bin/env bash\necho "DEPLOY $1"\n' >"$destino/deploy.sh"
    chmod +x "$destino/deploy.sh" ;;
  *" ps -q db"*) [ -n "${DB_EN_MARCHA:-}" ] && echo dbid ;;
  *"exec -T db"*) [ -n "${DUMP_ROTO:-}" ] && echo "error: sin conexion" || printf -- '--\n-- PostgreSQL database dump\n--\nSELECT 1;\n' ;;
  *" up "*" api") [ -z "${API_ROTA:-}" ] || { grep -q "$OTRO_DIGEST" "$PAGOS_SCOUTS_BASE/state/image.env" && exit 0; exit 1; } ;;
esac
exit 0
EOF
  printf '#!/usr/bin/env bash\necho "age $*" >>"$LLAMADAS"\necho CIFRADO\ncat >/dev/null\n' >"$T/bin/age"
  chmod +x "$T/bin/docker" "$T/bin/age"
}
limpiar() { rm -rf "$T"; }

env_bueno() {
  {
    echo "DOMAIN=scouts.ejemplo.test"
    echo "POSTGRES_USER=scouts"
    echo "POSTGRES_PASSWORD=$(printf 'x%.0s' {1..32})"
    echo "POSTGRES_DB=scouts"
    echo "BACKUP_AGE_RECIPIENT=$RECIPIENT"
  } >"$PAGOS_SCOUTS_BASE/.env.production"
  chmod 600 "$PAGOS_SCOUTS_BASE/.env.production"
}

# Una release como la que sale de la imagen: deploy.sh, compose, copias y la web.
release() {
  R="$PAGOS_SCOUTS_BASE/release"
  cp "$AQUI/deploy.sh" "$AQUI/docker-compose.yml" "$R/"
  mkdir -p "$R/backup" "$R/web" "$R/web-nginx"
  cp "$AQUI/backup/backup.sh" "$R/backup/"
  echo "<html>" >"$R/web/index.html"
  echo "events {}" >"$R/web-nginx/nginx.conf"
  chmod +x "$R/deploy.sh" "$R/backup/backup.sh"
}

echo "ssh-entry.sh"
preparar
SSH_ORIGINAL_COMMAND="id" bash "$AQUI/bin/ssh-entry.sh" </dev/null >"$T/salida" 2>&1
espera "rechaza una orden cualquiera" "grep -q 'orden no permitida' '$T/salida'"
SSH_ORIGINAL_COMMAND="deploy $DIGEST Jump0ts; id" bash "$AQUI/bin/ssh-entry.sh" </dev/null >"$T/salida" 2>&1
espera "rechaza órdenes encadenadas" "grep -q 'orden no permitida' '$T/salida'"
SSH_ORIGINAL_COMMAND="deploy $DIGEST Jump0ts
id" bash "$AQUI/bin/ssh-entry.sh" </dev/null >"$T/salida" 2>&1
espera "rechaza un salto de línea" "grep -q 'orden no permitida' '$T/salida'"
SSH_ORIGINAL_COMMAND="deploy $DIGEST Jump0ts" bash "$AQUI/bin/ssh-entry.sh" </dev/null >"$T/salida" 2>&1
espera "sin token por stdin no hace nada" "grep -q 'falta el token' '$T/salida' && ! grep -q pull '$LLAMADAS'"
echo "token-de-prueba" | SSH_ORIGINAL_COMMAND="deploy $DIGEST Jump0ts" bash "$AQUI/bin/ssh-entry.sh" >"$T/salida" 2>&1
espera "descarga por digest del repo fijado y lanza el deploy.sh de la imagen" \
  "grep -q 'pull --quiet ghcr.io/jump0ts/pagos-scouts@$DIGEST' '$LLAMADAS' && grep -q 'DEPLOY ghcr.io/jump0ts/pagos-scouts@$DIGEST' '$T/salida'"
espera "cierra la sesión del registro" "grep -q 'logout ghcr.io' '$LLAMADAS'"
espera "el token no aparece en la salida ni en las órdenes" "! grep -q token-de-prueba '$T/salida' '$LLAMADAS'"
limpiar

echo "deploy.sh"
preparar; release
bash "$R/deploy.sh" "ghcr.io/jump0ts/pagos-scouts@$DIGEST" >"$T/salida" 2>&1
espera "sin .env.production no despliega" "grep -q 'falta .*\.env\.production' '$T/salida'"
env_bueno; chmod 644 "$PAGOS_SCOUTS_BASE/.env.production"
bash "$R/deploy.sh" "ghcr.io/jump0ts/pagos-scouts@$DIGEST" >"$T/salida" 2>&1
espera "exige permisos 600 en el .env" "grep -q 'permisos 600' '$T/salida'"
env_bueno; sed -i 's/^BACKUP_AGE_RECIPIENT=.*/BACKUP_AGE_RECIPIENT=no-es-una-clave/' "$PAGOS_SCOUTS_BASE/.env.production"
bash "$R/deploy.sh" "ghcr.io/jump0ts/pagos-scouts@$DIGEST" >"$T/salida" 2>&1
espera "exige la clave pública de age" "grep -q 'BACKUP_AGE_RECIPIENT' '$T/salida'"
env_bueno
bash "$R/deploy.sh" "ghcr.io/jump0ts/pagos-scouts@x" >"$T/salida" 2>&1
espera "rechaza una imagen sin digest" "grep -q 'referencia de imagen no válida' '$T/salida'"
: >"$LLAMADAS"
bash "$R/deploy.sh" "ghcr.io/jump0ts/pagos-scouts@$DIGEST" >"$T/salida" 2>&1
espera "primer despliegue: migra, arranca API y web y lo apunta" \
  "grep -q 'migrate deploy' '$LLAMADAS' && grep -q 'up -d --no-deps --force-recreate --wait --wait-timeout 60 web' '$LLAMADAS' && grep -q '$DIGEST' '$PAGOS_SCOUTS_BASE/state/current'"
espera "sin base previa no intenta copia" "! grep -q 'exec -T db' '$LLAMADAS'"
: >"$LLAMADAS"
DB_EN_MARCHA=1 bash "$R/deploy.sh" "ghcr.io/jump0ts/pagos-scouts@$OTRO" >"$T/salida" 2>&1
espera "con base existente hace copia cifrada antes de migrar" \
  "[ \"\$(grep -n -m1 'exec -T db' '$LLAMADAS' | cut -d: -f1)\" -lt \"\$(grep -n -m1 'migrate deploy' '$LLAMADAS' | cut -d: -f1)\" ] && grep -q 'age -r $RECIPIENT' '$LLAMADAS'"
espera "guarda la versión anterior" "grep -q '$DIGEST' '$PAGOS_SCOUTS_BASE/state/previous' && grep -q '$OTRO' '$PAGOS_SCOUTS_BASE/state/current'"
DB_EN_MARCHA=1 DUMP_ROTO=1 bash "$R/deploy.sh" "ghcr.io/jump0ts/pagos-scouts@$DIGEST" >"$T/salida" 2>&1
espera "si la copia falla no despliega" "grep -q 'no se despliega sin copia' '$T/salida' && grep -q '$OTRO' '$PAGOS_SCOUTS_BASE/state/current'"
NUEVO="sha256:$(printf 'c%.0s' {1..64})"
DB_EN_MARCHA=1 API_ROTA=1 OTRO_DIGEST="$OTRO" bash "$R/deploy.sh" "ghcr.io/jump0ts/pagos-scouts@$NUEVO" >"$T/salida" 2>&1
codigo=$?
espera "si la API nueva no queda sana vuelve a la anterior y falla" \
  "[ $codigo -ne 0 ] && grep -q 'Volviendo a la imagen anterior' '$T/salida' && grep -q '$OTRO' '$PAGOS_SCOUTS_BASE/state/image.env' && grep -q '$OTRO' '$PAGOS_SCOUTS_BASE/state/current'"
limpiar

echo "backup.sh"
preparar; env_bueno
B="$T/copias"
run_backup() { ENV_FILE="$PAGOS_SCOUTS_BASE/.env.production" COMPOSE_FILE="$AQUI/docker-compose.yml" BACKUP_DIR="$B" bash "$AQUI/backup/backup.sh"; }
BACKUP_WEEKDAY=3 run_backup >"$T/salida" 2>&1
espera "deja una copia cifrada con la clave pública" "ls '$B'/daily/pagos-scouts-*.sql.gz.age >/dev/null 2>&1 && grep -q 'age -r $RECIPIENT' '$LLAMADAS'"
espera "solo legible por su dueño" "[ \"\$(stat -c %a \"\$(ls '$B'/daily/*.age | head -1)\")\" = 600 ]"
for i in $(seq 1 9); do touch -d "-$i day" "$B/daily/pagos-scouts-2026010$i-031500.sql.gz.age"; done
BACKUP_WEEKDAY=7 run_backup >"$T/salida" 2>&1
espera "guarda 7 diarias y copia la del domingo a semanales" "[ \$(ls '$B'/daily | wc -l) -eq 7 ] && [ \$(ls '$B'/weekly | wc -l) -eq 1 ]"
antes=$(ls "$B"/daily | wc -l)
DUMP_ROTO=1 run_backup >"$T/salida" 2>&1
codigo=$?
espera "un volcado sin cabecera falla y no deja fichero" "[ $codigo -ne 0 ] && [ \$(ls '$B'/daily | wc -l) -eq $antes ] && ! ls '$B'/daily/*.partial >/dev/null 2>&1"
limpiar

echo
if [ "$FALLOS" -eq 0 ]; then echo "Todas las pruebas pasan"; else echo "$FALLOS pruebas fallan"; exit 1; fi
