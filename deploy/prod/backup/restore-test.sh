#!/usr/bin/env bash
# Prueba de restauración (D-62). Las copias solo se pueden descifrar en el PC (allí está la clave privada), así que
# el PC descifra y manda el volcado por stdin; este script lo carga en un Postgres desechable SIN red y compara las
# filas de cada tabla con la base real. No toca la base real ni deja nada en disco. Lo lanza
# prueba-restauracion.ps1 desde el PC (ver README.md).
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$DEPLOY_DIR/../.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-$DEPLOY_DIR/docker-compose.yml}"

die() { echo "restore-test: $*" >&2; exit 1; }

# Filas de cada tabla del esquema public, exactas (no estimadas), como "tabla|filas".
CONTAR="SELECT table_name || '|' || (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I', table_name), false, true, '')))[1]::text
FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 1;"

CID="$(docker run -d --rm --network none -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_USER=prueba \
  -e POSTGRES_DB=prueba --memory 256m postgres:16-alpine)"
trap 'docker stop "$CID" >/dev/null 2>&1 || true' EXIT

for _ in $(seq 1 30); do
  docker exec "$CID" pg_isready -U prueba -d prueba >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$CID" pg_isready -U prueba -d prueba >/dev/null 2>&1 || die "el Postgres desechable no arrancó"

gunzip -c | docker exec -i "$CID" psql -q -U prueba -d prueba -v ON_ERROR_STOP=1 >/dev/null \
  || die "el volcado no se pudo cargar"

RESTAURADA="$(docker exec "$CID" psql -At -U prueba -d prueba -c "$CONTAR")"
REAL="$(docker compose --env-file "$ENV_FILE" -p pagos-scouts-prod -f "$COMPOSE_FILE" exec -T db \
  sh -c 'psql -At -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "$1"' sh "$CONTAR")"

grep -q '^_prisma_migrations|' <<<"$RESTAURADA" || die "la copia no tiene la tabla de migraciones"

printf '%-28s %10s %10s\n' "Tabla" "Copia" "Ahora"
join -t'|' -a1 -a2 -e '-' -o 0,1.2,2.2 <(sort <<<"$RESTAURADA") <(sort <<<"$REAL") \
  | while IFS='|' read -r tabla copia ahora; do printf '%-28s %10s %10s\n' "$tabla" "$copia" "$ahora"; done

# Las cifras pueden diferir (la base ha cambiado desde la copia); lo que no puede faltar es ninguna tabla.
[ "$(cut -d'|' -f1 <<<"$RESTAURADA")" = "$(cut -d'|' -f1 <<<"$REAL")" ] || die "la copia no tiene las mismas tablas que la base real"
echo "OK: la copia se restaura entera"
