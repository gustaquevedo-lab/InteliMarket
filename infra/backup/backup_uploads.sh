#!/bin/bash
# Backup diario de uploads/ (fotos de productos, banners, logos) -- esta
# carpeta nunca tuvo respaldo y el 2026-08-27 se perdio por completo por
# una causa que no se pudo determinar con certeza (probablemente una
# limpieza destructiva de otra sesion concurrente sobre el mismo checkout).
# Los productos se pudieron recuperar desde Nemuha; banners/logo NO tienen
# fuente alternativa y se perdieron para siempre. Esto no puede volver a
# pasar sin tener al menos una copia de las ultimas 14 noches.
set -euo pipefail
SRC="/home/intellihouse/intelimarket/uploads"
DEST="/home/intellihouse/backups/uploads"
STAMP=$(date +%Y%m%d)
mkdir -p "$DEST"
tar -czf "$DEST/uploads_$STAMP.tar.gz" -C "$(dirname "$SRC")" "$(basename "$SRC")"
# Retener solo los ultimos 14 dias
find "$DEST" -name 'uploads_*.tar.gz' -mtime +14 -delete

# ── Copia fuera de la maquina ───────────────────────────────────────────────
# Hasta el 08-09-2026 esta copia vivia SOLO aca. O sea que protegia contra un
# borrado accidental de uploads/, pero no contra perder el servidor: se perdian
# las imagenes junto con todo lo demas. Ahora viaja a minisforum-ia, igual que
# los respaldos de la base.
REMOTE_HOST="intellihouse@100.104.93.77"
REMOTE_KEY="$HOME/.ssh/id_ed25519_backup_supermercado"
LOG="/home/intellihouse/backup_uploads.log"
MAX_RETRIES=3

log() { echo "[$(date '+%F %T')] $*" >>"$LOG"; }

copias=$(find "$DEST" -name 'uploads_*.tar.gz' | wc -l)

# GUARDA CONTRA PROPAGAR UN BORRADO.
# El 27-08-2026 la carpeta uploads/ se perdio entera por una causa que nunca se
# determino. Si eso se repite, el tar de esa noche saldria casi vacio y un
# "rsync --delete" replicaria la perdida al respaldo remoto, que es lo unico que
# quedaria. Por eso el --delete solo se usa cuando hay una semana entera de
# copias locales; si hay menos, se envia SIN borrar nada del otro lado.
if [ "$copias" -ge 7 ]; then
    MODO_BORRADO="--delete"
else
    MODO_BORRADO=""
    log "aviso: solo hay $copias copias locales; se envia sin --delete para no propagar una posible perdida."
fi

attempt=1
until rsync -az $MODO_BORRADO --timeout=300 \
    -e "ssh -i ${REMOTE_KEY} -o BatchMode=yes -o ConnectTimeout=15" \
    "$DEST/" "${REMOTE_HOST}:uploads/"; do
    if [ "$attempt" -ge "$MAX_RETRIES" ]; then
        log "ERROR: no se pudo enviar los uploads a minisforum tras ${MAX_RETRIES} intentos. La copia local SI quedo en ${DEST}."
        exit 0   # que falle el envio no invalida la copia local
    fi
    log "aviso: intento ${attempt} de rsync fallo, reintentando en 20s..."
    attempt=$((attempt + 1))
    sleep 20
done

log "uploads enviados a minisforum ($copias copias, $(du -sh "$DEST" | cut -f1))"
