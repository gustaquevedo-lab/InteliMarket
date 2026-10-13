#!/usr/bin/env bash
#
# Copia FISICA de la base (pg_basebackup), semanal.
#
# POR QUE HACE FALTA SI YA HAY UN pg_dump NOCTURNO
# ------------------------------------------------
# El pg_dump es un respaldo LOGICO: reconstruye los datos, pero no el estado
# fisico de la base. El WAL solo se puede reproducir sobre una copia fisica, asi
# que sin esto el archivado de WAL no sirve para recuperar a un punto en el
# tiempo. Los dos se complementan y ninguno reemplaza al otro:
#   - pg_dump: sobrevive a corrupcion y sirve para restaurar cosas puntuales.
#   - basebackup + WAL: permite volver a un minuto exacto ("las 14:31, antes
#     del borrado").
#
# Corre como root (cron del sistema) y usa el usuario postgres por socket local,
# asi no hace falta crear un rol de replicacion ni tocar pg_hba.conf.
#
set -uo pipefail

DEST_DIR="/var/backups/intelimarket-basebackup"
REMOTE_HOST="intellihouse@100.104.93.77"
REMOTE_KEY="/home/intellihouse/.ssh/id_ed25519_backup_supermercado"
LOG="/home/intellihouse/basebackup.log"
# Una sola retencion para los dos lados: el envio usa --delete para espejar, y
# el canal hacia minisforum esta restringido a rsync (no se pueden ejecutar
# comandos alla para podar por separado). Asi que lo que se guarda localmente es
# lo que se guarda alla. Con el disco de la VM al 75% y ~1 GB por copia, dos es
# el equilibrio razonable: si una sale corrupta, queda la anterior.
RETENCION=2

STAMP=$(date +%Y%m%d-%H%M%S)
DESTINO="$DEST_DIR/base_${STAMP}"

log() { echo "[$(date '+%F %T')] $*" >>"$LOG"; }

mkdir -p "$DEST_DIR"
log "==> Iniciando copia fisica..."

if ! sudo -u postgres pg_basebackup -D "$DESTINO" -Ft -z -Xs -cfast -P >>"$LOG" 2>&1; then
    log "ERROR: pg_basebackup fallo. La copia de esta semana NO se hizo."
    rm -rf "$DESTINO"
    exit 1
fi

# pg_basebackup crea el directorio en modo 700 (solo postgres). El envio lo
# hace intellihouse, igual que con el WAL, asi que hay que darle lectura al
# grupo. Sin esto la copia queda encerrada en la VM.
chmod -R g+rX "$DESTINO"

tam=$(du -sh "$DESTINO" | cut -f1)
log "==> Copia fisica lista: $DESTINO ($tam)"

# Se poda ANTES de enviar, para que el --delete propague la poda a minisforum.
ls -1dt "$DEST_DIR"/base_* 2>/dev/null | tail -n +$((RETENCION + 1)) | while read -r viejo; do
    rm -rf "$viejo" && log "podada copia vieja: $viejo"
done

# El envio corre como intellihouse, NO como root: la llave y el known_hosts que
# autentican a minisforum son suyos. Corriendo como root fallaba con
# "Host key verification failed" y la copia nunca salia de la VM.
if sudo -u intellihouse rsync -a --delete --timeout=300 \
    -e "ssh -i ${REMOTE_KEY} -o BatchMode=yes -o ConnectTimeout=15" \
    "$DEST_DIR/" "${REMOTE_HOST}:basebackup/" >>"$LOG" 2>&1; then
    log "==> Enviada a minisforum-ia."
else
    log "aviso: no se pudo enviar a minisforum. La copia local SI quedo en $DESTINO."
fi

# Poda local: el disco de la VM esta al 75%, no se acumulan copias fisicas aca.
log "==> Listo."
