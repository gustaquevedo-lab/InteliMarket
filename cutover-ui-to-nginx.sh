#!/bin/bash
# CUTOVER: reemplaza el vite dev server (puerto 5173) por nginx sirviendo el build de produccion.
# EJECUTAR SOLO EN UN MOMENTO SIN VENTAS EN CURSO.
# Esto SI corta el websocket de HMR de cualquier Electron abierto en ese instante
# (van a ver un breve loading al reconectar contra el nuevo server), pero es la
# UNICA vez que pasa: de aca en adelante los deploys (deploy-ui.sh) no tocan mas
# a las cajas conectadas.
set -euo pipefail

echo "==> Deteniendo y deshabilitando intelimarket-ui.service (vite dev server)"
sudo systemctl stop intelimarket-ui
sudo systemctl disable intelimarket-ui

echo "==> Quitando config de prueba (puerto 8088) y activando la de produccion (puerto 5173)"
sudo rm -f /etc/nginx/sites-enabled/intelimarket-ui-test.conf
sudo cp /tmp/intelimarket-ui-prod.conf /etc/nginx/sites-available/intelimarket-ui.conf
sudo ln -sf /etc/nginx/sites-available/intelimarket-ui.conf /etc/nginx/sites-enabled/intelimarket-ui.conf

echo "==> Validando y recargando nginx"
sudo nginx -t
sudo nginx -s reload

echo "==> Verificando..."
sleep 1
curl -sS -o /dev/null -w 'pos HTTP %{http_code}\n' http://127.0.0.1:5173/pos
curl -sS -o /dev/null -w 'api proxy HTTP %{http_code}\n' http://127.0.0.1:5173/api/health

echo "==> Cutover completo. intelimarket-ui ahora es nginx + build estatico."
echo "    Las cajas van a hacer un unico reload al reconectar. Deploys futuros: bash deploy-ui.sh"
