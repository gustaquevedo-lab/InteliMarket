#!/usr/bin/env bash
#
# Guardia de disco. Corre cada 15 minutos.
#
# POR QUE EXISTE
#   El 08-09-2026 el disco llego a 100% por 16 GB de logs (APP_DEBUG=true hacia
#   que SQLAlchemy registrara cada sentencia). Postgres se cayo a modo
#   recuperacion y el local dejo de vender. Nadie se entero hasta que un usuario
#   reporto "error al buscar producto".
#
#   Este guardia NO se limita a avisar: a partir de cierto punto recorta logs
#   por su cuenta, porque un aviso que nadie lee no evita nada.
#
# QUE NO TOCA NUNCA
#   /home, /var/lib/postgresql, /var/backups y cualquier respaldo. Solo recorta
#   LOGS, que son reemplazables. Si el disco se llena por otra cosa, avisa y no
#   borra nada.
#
set -uo pipefail

LOG=/var/log/guard-disco.log
AVISO=80    # a partir de aca deja constancia
CRITICO=90  # a partir de aca actua

log() { echo "[$(date '+%F %T')] $*" >>"$LOG"; }

uso=$(df --output=pcent / | tail -1 | tr -dc '0-9')
libre=$(df -h --output=avail / | tail -1 | tr -d ' ')

[ -z "$uso" ] && exit 0
[ "$uso" -lt "$AVISO" ] && exit 0

log "disco al ${uso}% (libre: ${libre})"
log "  mayores: $(du -sh /var/log /home/intellihouse /var/www 2>/dev/null | tr '\n' ' ')"

if [ "$uso" -lt "$CRITICO" ]; then
    log "  aviso: por encima del ${AVISO}%. Revisar antes de que sea un problema."
    exit 0
fi

log "CRITICO: recortando logs para que Postgres no se quede sin espacio."

# 1) journal: dejarlo en 200 MB
if command -v journalctl >/dev/null; then
    journalctl --vacuum-size=200M >>"$LOG" 2>&1 && log "  journal recortado a 200M"
fi

# 2) syslog: si paso de 1 GB, vaciarlo. Se trunca en vez de borrar para no
#    dejar a rsyslog escribiendo en un archivo que ya no existe.
for f in /var/log/syslog /var/log/messages; do
    if [ -f "$f" ] && [ "$(stat -c%s "$f")" -gt 1073741824 ]; then
        truncate -s 0 "$f" && log "  $f vaciado (superaba 1 GB)"
    fi
done

# 3) rotados viejos de syslog
find /var/log -maxdepth 1 -name 'syslog.*' -mtime +2 -delete -print 2>/dev/null \
    | while read -r f; do log "  borrado rotado viejo: $f"; done

uso_final=$(df --output=pcent / | tail -1 | tr -dc '0-9')
log "  resultado: ${uso}% -> ${uso_final}%"

if [ "$uso_final" -ge "$CRITICO" ]; then
    log "  ATENCION: sigue en ${uso_final}%. Los logs no eran la causa. Revisar a mano."
fi
