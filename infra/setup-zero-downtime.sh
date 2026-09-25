#!/bin/bash
# Setup Zero-Downtime para InteliMarket Distribuidora (minisforum-ia)
# REQUIERE: sudo bash setup-zero-downtime.sh
# TIEMPO: ~2 minutos. Corta el acceso al UI solo durante el cutover final.
set -euo pipefail

REPO=/home/intellihouse/intelimarket
RELEASES=/var/www/intelimarket-ui/releases
CURRENT=/var/www/intelimarket-ui/current

echo "==> [1/6] Instalando nginx si no esta..."
apt-get install -y nginx

echo "==> [2/6] Copiando unit files de systemd..."
cp /tmp/intelimarket-api.service    /etc/systemd/system/intelimarket-api.service
cp /tmp/intelimarket-api-2.service  /etc/systemd/system/intelimarket-api-2.service
systemctl daemon-reload

echo "==> [3/6] Configurando nginx upstream + server block..."
cp /tmp/intelimarket-api-upstream.conf /etc/nginx/conf.d/intelimarket-api-upstream.conf
cp /tmp/intelimarket-distribuidora.conf /etc/nginx/sites-available/intelimarket-distribuidora.conf
ln -sf /etc/nginx/sites-available/intelimarket-distribuidora.conf \
       /etc/nginx/sites-enabled/intelimarket-distribuidora.conf
# Deshabilitar el default de nginx (no interfiere, pero queda mas limpio)
rm -f /etc/nginx/sites-enabled/default

echo "==> [4/6] Configurando sudoers para intellihouse..."
cp /tmp/intellihouse-sudoers /etc/sudoers.d/intellihouse
chmod 440 /etc/sudoers.d/intellihouse
visudo -c  # valida antes de aplicar

echo "==> [5/6] Preparando directorio de releases del UI..."
mkdir -p "$RELEASES"
REL="$RELEASES/$(date +%Y%m%d-%H%M%S)-initial"
# Copia el build actual (ya existente) como primer release
cp -r "$REPO/ui-web-dist" "$REL"
chmod -R a+rX "$REL"
ln -sfn "$REL" "$CURRENT"

echo "==> [6/6] Matando uvicorn suelto y activando servicios systemd..."
# Primero levantar ambas instancias ANTES de conectar nginx, para evitar
# cualquier 502 transitorio durante el cutover.
systemctl enable --now intelimarket-api.service
sleep 3
systemctl enable --now intelimarket-api-2.service
sleep 3

# Verificar que ambas instancias responden antes de recargar nginx
for port in 8000 8010; do
  tries=0
  until curl -s -f "http://127.0.0.1:${port}/api/health" > /dev/null; do
    tries=$((tries+1))
    [ "$tries" -ge 20 ] && { echo "✗ Puerto $port no respondio. Revisar logs."; exit 1; }
    sleep 1
  done
  echo "✓ API en :${port} OK"
done

# Ahora conectar nginx
nginx -t
systemctl enable --now nginx
nginx -s reload

# Matar el uvicorn suelto que todavia escucha en :8000 (desde outside del systemd)
# systemd ya tiene sus propios workers, este es el legado.
pkill -f 'uvicorn api.src.main' 2>/dev/null && echo "uvicorn suelto detenido" || echo "(no habia uvicorn suelto)"
sleep 2

echo "==> Verificando a traves de nginx..."
if curl -s -f http://127.0.0.1:5173/api/health > /dev/null; then
  echo "✓ Pool OK a traves de nginx :5173"
else
  echo "⚠  nginx no pasa al pool — revisar: nginx -t && journalctl -u intelimarket-api -n 20"
fi

echo ""
echo "Setup completo. Proximos deploys:"
echo "  API:  bash $REPO/deploy-api.sh"
echo "  UI:   bash $REPO/deploy-ui.sh"
