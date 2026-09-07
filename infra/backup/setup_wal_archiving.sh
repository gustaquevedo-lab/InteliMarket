#!/usr/bin/env bash
#
# Activa el archivado continuo de WAL en Postgres 18.
#
# QUE CAMBIA
#   RPO (cuanto se puede perder): de 24 horas a 5 minutos.
#   Y habilita recuperar a un momento exacto ("las 14:31, antes del borrado"),
#   que hoy no se puede de ninguna manera.
#
# OJO: activar archive_mode REQUIERE REINICIAR POSTGRES. Es un corte de
# segundos, pero durante ese lapso las cajas no pueden vender. Correr con el
# local cerrado.
#
# Es idempotente: se puede correr de nuevo sin romper nada.
# Para revertir: borrar /etc/postgresql/18/main/conf.d/90-intelimarket-wal.conf
# y reiniciar Postgres.
#
set -euo pipefail

ARCHIVE_DIR="/var/backups/intelimarket-wal"
BASE_DIR="/var/backups/intelimarket-basebackup"
CONF_D="/etc/postgresql/18/main/conf.d"
CONF_FILE="$CONF_D/90-intelimarket-wal.conf"
USUARIO="intellihouse"

if [ "$(id -u)" -ne 0 ]; then
    echo "ERROR: correr con sudo." >&2
    exit 1
fi

echo "==> 1/5 Creando directorios de archivado..."
# Postgres escribe (es el dueno) y el usuario intellihouse lee y poda para
# enviarlos: por eso el grupo compartido y el setgid, que hace que todo lo que
# se cree adentro herede el grupo.
mkdir -p "$ARCHIVE_DIR" "$BASE_DIR"
chown postgres:"$USUARIO" "$ARCHIVE_DIR"
chmod 2770 "$ARCHIVE_DIR"
chown root:"$USUARIO" "$BASE_DIR"
chmod 2770 "$BASE_DIR"
echo "    $ARCHIVE_DIR y $BASE_DIR listos."

echo "==> 2/5 Escribiendo configuracion de Postgres..."
mkdir -p "$CONF_D"
cat > "$CONF_FILE" <<'EOF'
# Archivado continuo de WAL -- InteliMarket
#
# El archive_command escribe SOLO a disco local, comprimido. Nunca toca la red:
# si dependiera de minisforum, un corte de red haria que Postgres no pueda
# archivar, acumule WAL y termine llenando el disco -- y con el disco lleno
# Postgres deja de aceptar escrituras, o sea que las cajas dejan de vender.
# El envio a minisforum lo hace un proceso aparte que reintenta solo.
#
# El "chmod 640" NO es cosmetico: sin el, Postgres crea los .gz con modo 600 y
# el usuario que los envia a minisforum no puede leerlos. El WAL se archiva
# igual, pero nunca sale de la VM -- falla silenciosa, respaldo remoto vacio.
#
# El "test ! -f" es obligatorio: Postgres exige que archivar NO pise un archivo
# ya existente. El .tmp + mv hace que el archivo aparezca completo o no aparezca,
# nunca a medias.

archive_mode = on
archive_command = 'test ! -f /var/backups/intelimarket-wal/%f.gz && gzip -1 -c %p > /var/backups/intelimarket-wal/%f.gz.tmp && chmod 640 /var/backups/intelimarket-wal/%f.gz.tmp && mv /var/backups/intelimarket-wal/%f.gz.tmp /var/backups/intelimarket-wal/%f.gz'

# Fuerza cerrar el segmento cada 5 minutos aunque no se haya llenado: es lo que
# acota la perdida maxima a 5 minutos en horarios de poco movimiento.
archive_timeout = 300
EOF
chown postgres:postgres "$CONF_FILE"
chmod 644 "$CONF_FILE"
echo "    $CONF_FILE escrito."

echo "==> 3/5 Verificando la configuracion antes de reiniciar..."
if ! su - postgres -c "/usr/lib/postgresql/18/bin/postgres --config-file=/etc/postgresql/18/main/postgresql.conf -C archive_mode" >/dev/null 2>&1; then
    echo "    aviso: no se pudo pre-verificar; se continua igual (el reinicio dira si algo esta mal)."
fi

echo "==> 4/5 Instalando la copia fisica semanal (domingos 01:00 hora local = 04:00 UTC)..."
cat > /etc/cron.d/intelimarket-basebackup <<'EOF'
# Copia fisica semanal de la base. Sin esto el WAL archivado no sirve para
# restaurar: el WAL se reproduce sobre una copia FISICA, y el pg_dump nocturno
# es logico (no sirve como base).
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
0 4 * * 0 root /home/intellihouse/basebackup.sh
EOF
chmod 644 /etc/cron.d/intelimarket-basebackup
echo "    cron instalado."

echo "==> 5/5 Reiniciando Postgres (ACA ES EL CORTE)..."
# Sin el "|| true", set -e abortaria el script justo cuando el reinicio falla,
# que es exactamente el caso para el que existe el revert de mas abajo.
systemctl restart postgresql@18-main || true
sleep 3

if systemctl is-active --quiet postgresql@18-main; then
    echo
    echo "============================================================"
    echo " LISTO. Postgres arranco con archivado activo."
    echo "============================================================"
    sudo -u postgres psql -tAc "SELECT name||' = '||setting FROM pg_settings WHERE name IN ('archive_mode','archive_timeout')" || true
else
    echo
    echo "ERROR: Postgres NO arranco. Revirtiendo la configuracion..." >&2
    rm -f "$CONF_FILE"
    systemctl restart postgresql@18-main
    echo "Configuracion revertida y Postgres reiniciado. Revisar: journalctl -u postgresql@18-main -n 50" >&2
    exit 1
fi
