#!/usr/bin/env bash
# Restauración de verdad (desastre), D-62. Carga en la base de PRODUCCIÓN el volcado que llega por stdin, ya descifrado
# en el PC (ver README.md, «Restaurar de verdad»). Sustituye lo que haya: por eso exige --si.
set -euo pipefail

[ "${1:-}" = "--si" ] || { echo "restaurar: esto reemplaza la base de producción; repite con --si" >&2; exit 1; }

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE="$(cd "$DEPLOY_DIR/.." && pwd)"

gunzip -c | docker compose -p pagos-scouts-prod --env-file "$BASE/.env.production" --env-file "$BASE/state/image.env" \
  -f "$DEPLOY_DIR/docker-compose.yml" exec -T db \
  sh -c 'psql -q -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1' >/dev/null
echo "OK: base restaurada. Reinicia la API: cd $DEPLOY_DIR && ./deploy.sh \"\$(cat ../state/current)\""
