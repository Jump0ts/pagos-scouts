#!/usr/bin/env bash
# Comando forzado de la clave SSH de la CI (D-60). El script de arranque lo instala UNA vez como
# /home/deploy/pagos-scouts/bin/ssh-entry.sh (de root, permisos 555) y se enlaza desde authorized_keys:
#
#   restrict,command="/home/deploy/pagos-scouts/bin/ssh-entry.sh" ssh-ed25519 AAAA... pagos-scouts-ci
#
# Con `restrict` y este comando, esa clave NO da shell, ni túneles, ni scp: lo único que puede hacer es pedir
# "deploy <digest> <usuario-github>" con un token de GHCR por stdin. El repositorio de imágenes está fijado aquí,
# así que aunque la clave se filtrase solo permitiría desplegar imágenes que la CI de este repo haya publicado.
#
# Variables de pruebas: PAGOS_SCOUTS_BASE (por defecto /home/deploy/pagos-scouts).
set -euo pipefail

IMAGE_REPO="ghcr.io/jump0ts/pagos-scouts"
BASE="${PAGOS_SCOUTS_BASE:-/home/deploy/pagos-scouts}"

die() { echo "ssh-entry: $*" >&2; exit 1; }

# Validación estricta de TODA la orden (con `=~` un salto de línea no cuela nada tras el final).
CMD="${SSH_ORIGINAL_COMMAND:-}"
if ! [[ "$CMD" =~ ^deploy\ (sha256:[0-9a-f]{64})\ ([A-Za-z0-9-]{1,39})$ ]]; then
  die "orden no permitida"
fi
DIGEST="${BASH_REMATCH[1]}"
GH_USER="${BASH_REMATCH[2]}"
IMAGE_REF="$IMAGE_REPO@$DIGEST"

# El token de GHCR (de vida corta, lo da GitHub Actions) llega por stdin: nunca en argumentos ni en disco.
TOKEN=""
IFS= read -r -t 10 TOKEN || [[ -n "$TOKEN" ]] || die "falta el token en stdin"
[[ -n "$TOKEN" ]] || die "falta el token en stdin"

trap 'docker logout ghcr.io >/dev/null 2>&1 || true' EXIT
printf '%s' "$TOKEN" | docker login ghcr.io -u "$GH_USER" --password-stdin >/dev/null
unset TOKEN

docker pull --quiet "$IMAGE_REF" >/dev/null
# Ya no hace falta la sesión en el registro: se cierra antes de seguir.
docker logout ghcr.io >/dev/null 2>&1 || true
trap - EXIT

# Los ficheros de despliegue (compose, deploy.sh, copias, web) salen de la propia imagen verificada.
NEW="$BASE/release.new"
rm -rf "$NEW"
mkdir -p "$NEW"
CID="$(docker create "$IMAGE_REF")"
trap 'docker rm "$CID" >/dev/null 2>&1 || true' EXIT
docker cp "$CID:/opt/deploy/." "$NEW/"
docker rm "$CID" >/dev/null
trap - EXIT

rm -rf "$BASE/release.old"
if [ -d "$BASE/release" ]; then mv "$BASE/release" "$BASE/release.old"; fi
mv "$NEW" "$BASE/release"
chmod -R go-w "$BASE/release"

exec "$BASE/release/deploy.sh" "$IMAGE_REF"
