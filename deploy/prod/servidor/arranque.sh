#!/usr/bin/env bash
# Arranque del droplet de producción (D-59, D-61). Se lanza UNA vez como root en un Ubuntu 24.04 recién creado,
# después de copiar esta carpeta (ver ../README.md):
#
#   bash arranque.sh scouts.josanfersal.dev
#
# Deja: usuario `deploy` sin sudo (en el grupo docker) con la clave SSH de root, SSH solo con clave, cortafuegos
# 22/80/443, actualizaciones de seguridad automáticas, swap de 1 GB, Docker, nginx con el vhost, Certbot, age y la
# carpeta ~deploy/pagos-scouts con el comando forzado de la CI. Es idempotente: se puede repetir sin romper nada.
# No crea secretos ni pide el certificado (eso va después, con el DNS ya apuntando aquí).
set -euo pipefail

DOMINIO="${1:?Uso: arranque.sh <dominio>}"
[[ "$DOMINIO" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$ ]] || { echo "Dominio no válido" >&2; exit 1; }
[ "$(id -u)" = 0 ] || { echo "Lánzalo como root" >&2; exit 1; }
grep -q 'VERSION_ID="24.04"' /etc/os-release || { echo "Pensado para Ubuntu 24.04" >&2; exit 1; }
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
for f in scouts.conf scouts-proxy.conf ../bin/ssh-entry.sh; do [ -f "$AQUI/$f" ] || { echo "Falta $f junto al script" >&2; exit 1; }; done

log() { echo "==> $*"; }
export DEBIAN_FRONTEND=noninteractive

log "Paquetes del sistema"
apt-get update -q
apt-get upgrade -yq
apt-get install -yq ca-certificates curl gnupg ufw nginx certbot python3-certbot-nginx unattended-upgrades age

log "Actualizaciones de seguridad automáticas"
cat >/etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF

log "Docker (repositorio oficial)"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu noble stable" \
    >/etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get install -yq docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi
systemctl enable --now docker

log "Swap de 1 GB (el droplet tiene 1 GB de memoria)"
if ! swapon --show | grep -q /swapfile; then
  [ -f /swapfile ] || { fallocate -l 1G /swapfile; chmod 600 /swapfile; mkswap /swapfile; }
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
fi
echo 'vm.swappiness=10' >/etc/sysctl.d/90-pagos-scouts.conf
sysctl -q --system

log "Usuario deploy (sin sudo; en el grupo docker para desplegar)"
id deploy >/dev/null 2>&1 || adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy
chmod 750 /home/deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
# La clave de administración de root sirve también para entrar como deploy (copias, operaciones).
if [ -f /root/.ssh/authorized_keys ] && ! grep -qxFf /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys 2>/dev/null; then
  grep -v 'pagos-scouts-ci' /root/.ssh/authorized_keys >>/home/deploy/.ssh/authorized_keys
fi
touch /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys

log "Carpeta de la app y comando forzado de la CI"
install -d -m 750 -o deploy -g deploy /home/deploy/pagos-scouts
install -d -m 700 -o deploy -g deploy /home/deploy/pagos-scouts/state /home/deploy/pagos-scouts/backups
# bin/ es de root: deploy no puede cambiar el comando forzado de la clave de la CI.
install -d -m 755 -o root -g root /home/deploy/pagos-scouts/bin
install -m 555 -o root -g root "$AQUI/../bin/ssh-entry.sh" /home/deploy/pagos-scouts/bin/ssh-entry.sh

log "SSH solo con clave"
cat >/etc/ssh/sshd_config.d/10-pagos-scouts.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
AllowUsers root deploy
EOF
sshd -t
systemctl reload ssh

log "Cortafuegos: solo 22, 80 y 443"
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

log "nginx"
install -m 644 "$AQUI/scouts-proxy.conf" /etc/nginx/snippets/scouts-proxy.conf
# Sin versión de nginx en ninguna respuesta, también en el bloque de redirección que añade Certbot.
echo 'server_tokens off;' >/etc/nginx/conf.d/pagos-scouts.conf
sed "s/DOMINIO/$DOMINIO/" "$AQUI/scouts.conf" >/etc/nginx/sites-available/scouts.conf
ln -sf /etc/nginx/sites-available/scouts.conf /etc/nginx/sites-enabled/scouts.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

log "Listo. Siguiente paso: el fichero .env.production (ver README.md, apartado 4)."
