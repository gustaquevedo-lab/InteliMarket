#!/bin/bash
# Deploy de una nueva version de ui-web sin afectar cajas conectadas.
# Requiere que el cutover a nginx ya se haya hecho (ver cutover-ui-to-nginx.sh).
set -euo pipefail

SRC=/home/intellihouse/intelimarket/ui-web
RELEASES=/var/www/intelimarket-ui/releases
CURRENT=/var/www/intelimarket-ui/current
REL="$RELEASES/$(date +%Y%m%d-%H%M%S)"

echo "==> Compilando build de produccion..."
cd "$SRC"
VITE_API_PROXY_TARGET=http://127.0.0.1:8000 npm run build

echo "==> Copiando a $REL"
cp -r "$SRC/../ui-web-dist" "$REL"
# nginx (usuario www-data) necesita poder leer estos archivos. No hace
# falta chown a www-data para eso -- intellihouse NO pertenece a ese
# grupo (verificado), asi que ese chown fallaria y con "set -e" tumbaria
# el deploy. chmod a+rX ya le da lectura a "otros", que es lo que nginx
# necesita de verdad.
chmod -R a+rX "$REL"

echo "==> Cambiando symlink current -> $REL"
ln -sfn "$REL" "$CURRENT"

# nginx resuelve el symlink "current" en cada request -- no hace falta
# recargarlo para que sirva el release nuevo (y ademas "nginx -s reload"
# no esta en el sudoers sin password de este usuario, asi que forzarlo
# aca solo colgaria el deploy pidiendo una contrasena que no va a llegar).
# Si alguna vez se toca la CONFIG de nginx (no un release), correr a mano:
#   sudo nginx -t && sudo systemctl reload nginx

echo "==> Listo. Release activo: $REL"
echo "    Las cajas ya abiertas siguen con la version anterior en memoria."
echo "    Toman la nueva recien cuando cierren sesion / reinicien la app."

# Limpieza: dejar solo los ultimos 5 releases
cd "$RELEASES"
ls -1t | tail -n +6 | xargs -r rm -rf 2>/dev/null || true
