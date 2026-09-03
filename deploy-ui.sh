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
sudo chown -R intellihouse:www-data "$REL"
sudo chmod -R a+rX "$REL"

echo "==> Cambiando symlink current -> $REL"
ln -sfn "$REL" "$CURRENT"

echo "==> Recargando nginx (no corta conexiones activas)"
sudo nginx -t
sudo nginx -s reload

echo "==> Listo. Release activo: $REL"
echo "    Las cajas ya abiertas siguen con la version anterior en memoria."
echo "    Toman la nueva recien cuando cierren sesion / reinicien la app."

# Limpieza: dejar solo los ultimos 5 releases
cd "$RELEASES"
ls -1t | tail -n +6 | xargs -r rm -rf
