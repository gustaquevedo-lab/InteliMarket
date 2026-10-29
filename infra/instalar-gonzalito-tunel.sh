#!/bin/bash
# Publica intelimarket/inteliforce.gonzalito.com.py por el tunel de Cloudflare -> nginx :80.
# Uso: sudo bash infra/instalar-gonzalito-tunel.sh   (desde ~/intelimarket)
set -e
cd "$(dirname "$0")/.."
TS=$(date +%Y%m%d%H%M); B=/root/respaldo-tunel-$TS; mkdir -p $B
cp /etc/cloudflared/config.yml /etc/nginx/conf.d/gonzalito-cloudflare.conf /etc/nginx/sites-available/intelimarket-gonzalito-internet.conf $B/
cp infra/gonzalito-cloudflare.conf /etc/nginx/conf.d/
cp infra/intelimarket-gonzalito-internet.conf /etc/nginx/sites-available/
# Los dos nombres de gonzalito pasan por nginx (antes: dev server :5173 y API :8000 directo)
sed -i '/hostname: inteliforce.gonzalito.com.py/{n;s#service: .*#service: http://localhost:80#}' /etc/cloudflared/config.yml
sed -i '/hostname: intelimarket.gonzalito.com.py/{n;s#service: .*#service: http://localhost:80#}' /etc/cloudflared/config.yml
if nginx -t; then systemctl reload nginx; else cp $B/gonzalito-cloudflare.conf /etc/nginx/conf.d/; cp $B/intelimarket-gonzalito-internet.conf /etc/nginx/sites-available/; echo "nginx -t fallo: restaurado"; exit 1; fi
systemctl restart cloudflared
grep -A1 "gonzalito" /etc/cloudflared/config.yml
echo "Listo. Respaldo en $B"
