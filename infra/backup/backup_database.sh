#!/bin/bash
# Backup diario de la base de datos de InteliMarket (Supermercado) -- dump
# completo (todos los schemas: public + sandbox), verificado antes de darse
# por bueno, con copia remota aislada en minisforum-ia via una key SSH
# restringida (solo puede escribir en /home/intellihouse/backups-supermercado/,
# no puede tocar nada mas en esa maquina, ni abrir una shell). Retencion de
# 30 dias, sincronizada entre local y remoto con rsync --delete: la poda es
# una sola logica, no dos que se puedan desincronizar.
set -euo pipefail

ENV_FILE="/home/intellihouse/intelimarket/.env"
DEST_DIR="/home/intellihouse/backups/database"
STAMP=$(date +%Y%m%d-%H%M%S)
DUMP_FILE="$DEST_DIR/intelimarket_${STAMP}.dump"
RETENTION_DAYS=30
REMOTE_HOST="intellihouse@100.104.93.77"
REMOTE_KEY="$HOME/.ssh/id_ed25519_backup_supermercado"
REMOTE_DIR=""  # rrsync del lado remoto ya fija el directorio destino, no se repite aca
MAX_RETRIES=3

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# DATABASE_URL en .env viene como postgresql+asyncpg://user:pass@host:port/db
# -- pg_dump necesita el esquema postgresql:// plano, sin el sufijo +asyncpg.
RAW_URL=$(grep '^DATABASE_URL=' "$ENV_FILE" | cut -d= -f2-)
PG_URL=$(echo "$RAW_URL" | sed 's#^postgresql+asyncpg://#postgresql://#')

mkdir -p "$DEST_DIR"

log "==> Iniciando dump de la base de datos (todos los schemas)..."
if ! pg_dump -Fc "$PG_URL" -f "$DUMP_FILE"; then
    log "ERROR: pg_dump fallo. Abortando sin subir nada."
    rm -f "$DUMP_FILE"
    exit 1
fi

log "==> Verificando integridad del dump..."
if ! pg_restore --list "$DUMP_FILE" > /dev/null 2>&1; then
    log "ERROR: el dump generado parece corrupto (pg_restore --list fallo). Borrando y abortando."
    rm -f "$DUMP_FILE"
    exit 1
fi
DUMP_SIZE=$(stat -c%s "$DUMP_FILE" 2>/dev/null || echo 0)
if [ "$DUMP_SIZE" -lt 1000000 ]; then
    log "ERROR: el dump es sospechosamente chico (${DUMP_SIZE} bytes, se esperaba >1MB). Borrando y abortando."
    rm -f "$DUMP_FILE"
    exit 1
fi
log "==> Dump verificado OK: $DUMP_FILE ($(numfmt --to=iec "$DUMP_SIZE" 2>/dev/null || echo "$DUMP_SIZE bytes"))"

log "==> Podando dumps locales de mas de ${RETENTION_DAYS} dias..."
find "$DEST_DIR" -name 'intelimarket_*.dump' -mtime "+${RETENTION_DAYS}" -delete

log "==> Sincronizando con minisforum-ia (aislado, key restringida)..."
attempt=1
# --exclude protege las carpetas de WAL y copias fisicas: este rsync usa
# --delete contra la RAIZ del destino, asi que sin esto borraria wal/ y
# basebackup/ todas las noches (verificado con --dry-run antes de activarlo).
until rsync -az --delete --exclude='wal/' --exclude='basebackup/' \
    -e "ssh -i ${REMOTE_KEY} -o BatchMode=yes -o ConnectTimeout=15" \
    "$DEST_DIR/" "${REMOTE_HOST}:${REMOTE_DIR}"; do
    if [ "$attempt" -ge "$MAX_RETRIES" ]; then
        log "ERROR: rsync hacia minisforum-ia fallo tras ${MAX_RETRIES} intentos. El dump local SI quedo guardado en ${DEST_DIR}, pero la copia remota de hoy no se pudo hacer."
        exit 1
    fi
    log "aviso: intento ${attempt} de rsync fallo, reintentando en 20s..."
    attempt=$((attempt + 1))
    sleep 20
done

log "==> Backup completo: dump local + copia remota en minisforum-ia sincronizados."
