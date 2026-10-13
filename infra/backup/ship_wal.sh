#!/usr/bin/env bash
#
# Envia a minisforum-ia los segmentos WAL que Postgres fue archivando localmente.
#
# POR QUE ESTA SEPARADO DEL ARCHIVE_COMMAND DE POSTGRES
# -----------------------------------------------------
# Postgres archiva SOLO a disco local (operacion de milisegundos que practicamente
# nunca falla). Si el archive_command dependiera de la red, un corte hacia
# minisforum haria que Postgres no pueda archivar, acumule WAL en pg_wal y
# termine llenando el disco -- y cuando el disco se llena, Postgres deja de
# aceptar escrituras: las cajas dejan de vender. Con 12 GB libres y ~2 GB de WAL
# por dia, eso pasaria en menos de una semana de red caida.
#
# Por eso el envio corre aparte, reintenta solo, y si la red no esta, Postgres
# ni se entera.
#
set -uo pipefail

ARCHIVE_DIR="/var/backups/intelimarket-wal"
REMOTE_HOST="intellihouse@100.104.93.77"
REMOTE_KEY="/home/intellihouse/.ssh/id_ed25519_backup_supermercado"
LOG="/home/intellihouse/ship_wal.log"
LOCK="/tmp/intelimarket_ship_wal.lock"

# Cuantos dias se guarda el WAL localmente DESPUES de haberse enviado. Es solo
# un colchon: la copia buena vive en minisforum.
RETENCION_LOCAL_DIAS=2

# Si el buffer local supera esto, algo pasa (red caida hace rato) y hay que
# mirarlo antes de que sea un problema de disco.
ALERTA_MB=4000

log() { echo "[$(date '+%F %T')] $*" >>"$LOG"; }

# Una sola instancia a la vez: corre cada minuto y un envio lento no debe
# pisarse con el siguiente.
exec 9>"$LOCK"
flock -n 9 || exit 0

[ -d "$ARCHIVE_DIR" ] || { log "ERROR: no existe $ARCHIVE_DIR"; exit 1; }

pendientes=$(find "$ARCHIVE_DIR" -maxdepth 1 -name '*.gz' | wc -l)
if [ "$pendientes" -gt 0 ]; then
    if rsync -a --timeout=60 \
        -e "ssh -i ${REMOTE_KEY} -o BatchMode=yes -o ConnectTimeout=15" \
        "$ARCHIVE_DIR/" "${REMOTE_HOST}:wal/" 2>>"$LOG"; then
        # Recien despues de un envio exitoso se poda lo viejo. Nunca se borra
        # WAL que no haya viajado.
        borrados=$(find "$ARCHIVE_DIR" -maxdepth 1 -name '*.gz' \
                        -mtime +"$RETENCION_LOCAL_DIAS" -delete -print | wc -l)
        [ "$borrados" -gt 0 ] && log "enviados ok; podados $borrados segmentos locales de mas de ${RETENCION_LOCAL_DIAS}d"
    else
        log "aviso: no se pudo enviar a minisforum (se reintenta en el proximo ciclo, Postgres sigue archivando normal)"
    fi
fi

# Guarda de disco: avisa MUCHO antes de que el buffer sea un riesgo real.
usado_mb=$(du -sm "$ARCHIVE_DIR" 2>/dev/null | cut -f1)
if [ -n "${usado_mb:-}" ] && [ "$usado_mb" -gt "$ALERTA_MB" ]; then
    log "ALERTA: el buffer local de WAL tiene ${usado_mb} MB (umbral ${ALERTA_MB} MB). Revisar la conexion con minisforum-ia."
fi
