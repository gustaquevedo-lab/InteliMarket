#!/usr/bin/env bash
#
# Arregla dos defectos detectados despues de activar el archivado:
#
# 1. PERMISOS (grave). Postgres crea los .gz con modo 600, asi que el usuario
#    intellihouse -- que es quien los envia a minisforum -- no podia abrirlos.
#    El WAL se archivaba bien pero NUNCA salia de la VM: se acumulaba local
#    para siempre. Se agrega un chmod 640 al archive_command.
#
# 2. HORARIO. La VM corre en UTC, no en hora de Paraguay. El cron de la copia
#    fisica quedo a las 01:00 UTC = 22:00 del sabado local, con el local
#    abierto. Se corrige a 04:00 UTC = 01:00 del domingo local.
#
# NO reinicia Postgres: archive_command se aplica con un reload (sin corte).
#
set -euo pipefail

ARCHIVE_DIR="/var/backups/intelimarket-wal"
CONF_FILE="/etc/postgresql/18/main/conf.d/90-intelimarket-wal.conf"

if [ "$(id -u)" -ne 0 ]; then
    echo "ERROR: correr con sudo." >&2
    exit 1
fi

echo "==> 1/4 Reescribiendo archive_command con chmod..."
cat > "$CONF_FILE" <<'CONF'
# Archivado continuo de WAL -- InteliMarket
#
# El archive_command escribe SOLO a disco local, comprimido. Nunca toca la red:
# si dependiera de minisforum, un corte de red haria que Postgres no pueda
# archivar, acumule WAL y termine llenando el disco -- y con el disco lleno
# Postgres deja de aceptar escrituras, o sea que las cajas dejan de vender.
# El envio a minisforum lo hace un proceso aparte que reintenta solo.
#
# El "test ! -f" es obligatorio: Postgres exige que archivar NO pise un archivo
# ya existente. El .tmp + mv hace que el archivo aparezca completo o no aparezca,
# nunca a medias.
#
# El "chmod 640" NO es cosmetico: sin el, Postgres crea los .gz con modo 600 y
# el usuario que los envia a minisforum no puede leerlos. El WAL se archiva
# igual, pero nunca sale de la VM -- una falla silenciosa que deja el respaldo
# remoto vacio sin que nada avise.

archive_mode = on
archive_command = 'test ! -f /var/backups/intelimarket-wal/%f.gz && gzip -1 -c %p > /var/backups/intelimarket-wal/%f.gz.tmp && chmod 640 /var/backups/intelimarket-wal/%f.gz.tmp && mv /var/backups/intelimarket-wal/%f.gz.tmp /var/backups/intelimarket-wal/%f.gz'

# Fuerza cerrar el segmento cada 5 minutos aunque no se haya llenado: es lo que
# acota la perdida maxima a 5 minutos en horarios de poco movimiento.
archive_timeout = 300
CONF
chown postgres:postgres "$CONF_FILE"
chmod 644 "$CONF_FILE"

echo "==> 2/4 Corrigiendo permisos de lo ya archivado..."
n=$(find "$ARCHIVE_DIR" -name '*.gz' -exec chmod 640 {} + -print | wc -l)
echo "    $n segmentos corregidos."

echo "==> 3/4 Corrigiendo el horario del cron (la VM esta en UTC)..."
cat > /etc/cron.d/intelimarket-basebackup <<'CRON'
# Copia fisica semanal de la base. Sin esto el WAL archivado no sirve para
# restaurar: el WAL se reproduce sobre una copia FISICA, y el pg_dump nocturno
# es logico (no sirve como base).
#
# OJO: la VM corre en UTC. 04:00 UTC = 01:00 del domingo hora de Paraguay.
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
0 4 * * 0 root /home/intellihouse/basebackup.sh
CRON
chmod 644 /etc/cron.d/intelimarket-basebackup

echo "==> 4/4 Recargando Postgres (sin corte, no es un reinicio)..."
systemctl reload postgresql@18-main
sleep 2
echo
echo "============================================================"
echo " LISTO. Verificacion:"
echo "============================================================"
ls -l "$ARCHIVE_DIR" | head
echo
echo "Ahora corre como intellihouse:  bash /home/intellihouse/ship_wal.sh"
