#!/usr/bin/env bash
# Copia de la base de datos de producción, cifrada (D-62). La lanza el cron del usuario deploy cada noche y
# deploy.sh antes de cada migración. Ver README.md.
#
# El volcado se comprime y se cifra con la clave PÚBLICA de age (BACKUP_AGE_RECIPIENT): en el servidor nunca hay
# una copia legible, y la clave privada solo está en el PC del usuario. 7 diarias y 4 semanales (domingos).
# Sale con código != 0 si algo falla y nunca deja un fichero roto que parezca una copia.
set -euo pipefail
umask 077

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$DEPLOY_DIR/../.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-$DEPLOY_DIR/docker-compose.yml}"
BACKUP_ROOT="${BACKUP_DIR:-$DEPLOY_DIR/../backups}"
DAILY_KEEP="${DAILY_KEEP:-7}"
WEEKLY_KEEP="${WEEKLY_KEEP:-4}"
WEEKDAY="${BACKUP_WEEKDAY:-$(date +%u)}" # 1=lunes ... 7=domingo

RECIPIENT="$(grep -m1 '^BACKUP_AGE_RECIPIENT=' "$ENV_FILE" | cut -d= -f2- || true)"
[[ "$RECIPIENT" =~ ^age1[02-9ac-hj-np-z]{58}$ ]] || { echo "backup: falta BACKUP_AGE_RECIPIENT en $ENV_FILE" >&2; exit 1; }

mkdir -p "$BACKUP_ROOT/daily" "$BACKUP_ROOT/weekly"
NAME="pagos-scouts-$(date +%Y%m%d-%H%M%S).sql.gz.age"
FILE="$BACKUP_ROOT/daily/$NAME"
PARTIAL="$FILE.partial"
trap 'rm -f "$PARTIAL"' EXIT

# El usuario y la base se leen de las variables del propio contenedor. pipefail hace que un fallo de pg_dump no
# quede tapado por gzip o age. Un volcado real de pg_dump siempre empieza con su cabecera: awk deja pasar todo y
# falla al final si no la ha visto (volcado vacío o con un mensaje de error).
docker compose --env-file "$ENV_FILE" -p pagos-scouts-prod -f "$COMPOSE_FILE" exec -T db \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-privileges' \
  | awk 'NR <= 5 && /PostgreSQL database dump/ { ok = 1 } { print } END { exit !ok }' \
  | gzip \
  | age -r "$RECIPIENT" >"$PARTIAL"

[ -s "$PARTIAL" ] || { echo "backup: el fichero cifrado está vacío" >&2; exit 1; }

mv "$PARTIAL" "$FILE"
if [ "$WEEKDAY" = "7" ]; then cp -p "$FILE" "$BACKUP_ROOT/weekly/"; fi

# Retención por número de copias (no por fecha): si el cron deja de funcionar, no se va vaciando la carpeta.
prune() { ls -1t "$1"/pagos-scouts-*.sql.gz.age 2>/dev/null | tail -n +"$(($2 + 1))" | xargs -r rm -f --; }
prune "$BACKUP_ROOT/daily" "$DAILY_KEEP"
prune "$BACKUP_ROOT/weekly" "$WEEKLY_KEEP"

echo "OK: $FILE ($(du -h "$FILE" | cut -f1))"
