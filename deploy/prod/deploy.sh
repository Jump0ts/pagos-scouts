#!/usr/bin/env bash
# Despliega una imagen ya descargada de Pagos Scouts (D-60). Lo lanza bin/ssh-entry.sh; a mano solo para aplicar
# cambios del .env o volver atrás (ver README.md).  Uso: deploy.sh ghcr.io/<repo>@sha256:<digest>
#
# Orden: comprobar configuración -> copia -> migrar -> API nueva (vuelta atrás si no queda sana) -> web.
# Nunca se imprimen secretos.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"
RELEASE_DIR="$PWD"
BASE="${PAGOS_SCOUTS_BASE:-$(cd .. && pwd)}"
ENV_FILE="$BASE/.env.production"
STATE="$BASE/state"

die() { echo "deploy: $*" >&2; exit 1; }
log() { echo "==> $*"; }

IMAGE_REF="${1:?Uso: deploy.sh <imagen@sha256:digest>}"
[[ "$IMAGE_REF" =~ ^ghcr\.io/[a-z0-9._/-]+@sha256:[0-9a-f]{64}$ ]] || die "referencia de imagen no válida"

# ---- 1. Configuración: debe existir, ser privada y estar completa (solo se comprueba, no se muestra) ----
[ -f "$ENV_FILE" ] || die "falta $ENV_FILE (ver README.md)"
[ "$(stat -c %a "$ENV_FILE")" = "600" ] || die "$ENV_FILE debe tener permisos 600"

env_value() { grep -m1 "^$1=" "$ENV_FILE" | cut -d= -f2- || true; }

for var in DOMAIN POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB BACKUP_AGE_RECIPIENT; do
  [ -n "$(env_value "$var")" ] || die "falta $var en $ENV_FILE"
done
[[ "$(env_value POSTGRES_PASSWORD)" =~ ^[A-Za-z0-9]{24,}$ ]] \
  || die "POSTGRES_PASSWORD debe ser alfanumérica de 24+ caracteres (va dentro de una URL)"
[[ "$(env_value DOMAIN)" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$ ]] \
  || die "DOMAIN no es un dominio válido"
[[ "$(env_value BACKUP_AGE_RECIPIENT)" =~ ^age1[02-9ac-hj-np-z]{58}$ ]] \
  || die "BACKUP_AGE_RECIPIENT debe ser una clave pública de age (age1...)"
{ [ -f "$RELEASE_DIR/web/index.html" ] && [ -f "$RELEASE_DIR/web-nginx/nginx.conf" ]; } \
  || die "la imagen no lleva la web (faltan web/index.html o web-nginx/nginx.conf)"

mkdir -p "$STATE" "$BASE/backups"
chmod 700 "$STATE" "$BASE/backups"

dc() {
  docker compose -p pagos-scouts-prod --env-file "$ENV_FILE" --env-file "$STATE/image.env" \
    -f "$RELEASE_DIR/docker-compose.yml" "$@"
}
set_image() { printf 'API_IMAGE=%s\n' "$1" >"$STATE/image.env.tmp" && mv "$STATE/image.env.tmp" "$STATE/image.env"; }

PREVIOUS="$(cat "$STATE/current" 2>/dev/null || true)"
[ -f "$STATE/image.env" ] || set_image "${PREVIOUS:-pagos-scouts-sin-desplegar}"

# ---- 2. Copia antes de tocar nada (si la base ya existe) ----
if [ -n "$(dc ps -q db 2>/dev/null)" ]; then
  log "Copia previa a la migración"
  ENV_FILE="$ENV_FILE" COMPOSE_FILE="$RELEASE_DIR/docker-compose.yml" BACKUP_DIR="$BASE/backups" \
    "$RELEASE_DIR/backup/backup.sh" || die "la copia falló: no se despliega sin copia"
fi

# ---- 3. Base de datos y migraciones (solo hacia delante: deben ser compatibles con la API anterior) ----
set_image "$IMAGE_REF"
log "Levantando la base de datos"
dc up -d --wait --wait-timeout 90 db
log "Aplicando migraciones"
dc run --rm -T --no-deps api npx --no-install prisma migrate deploy

# ---- 4. API nueva, con vuelta atrás si no queda sana ----
log "Arrancando la API nueva"
if ! dc up -d --no-deps --wait --wait-timeout 90 api; then
  echo "deploy: la API nueva no quedó sana" >&2
  dc logs --tail 40 api >&2 || true
  if [ -n "$PREVIOUS" ]; then
    log "Volviendo a la imagen anterior"
    set_image "$PREVIOUS"
    dc up -d --no-deps --wait --wait-timeout 90 api || true
  fi
  exit 1
fi
printf '%s\n' "$IMAGE_REF" >"$STATE/current"
if [ -n "$PREVIOUS" ] && [ "$PREVIOUS" != "$IMAGE_REF" ]; then printf '%s\n' "$PREVIOUS" >"$STATE/previous"; fi

# ---- 5. La web: se recrea siempre para que sirva los ficheros de la imagen nueva ----
log "Arrancando la web"
if ! dc up -d --no-deps --force-recreate --wait --wait-timeout 60 web; then
  echo "deploy: la web no quedó sana" >&2
  dc logs --tail 40 web >&2 || true
  exit 1
fi

docker image prune -f >/dev/null
log "Desplegado: $IMAGE_REF"
