#!/usr/bin/env bash
#
# La copia fisica de hoy se hizo bien (951 MB, completa) pero no salio de la VM:
#
#   1. pg_basebackup crea el directorio en modo 700 -> intellihouse no lo lee.
#   2. El rsync corria como root, y la llave y el known_hosts que autentican a
#      minisforum son de intellihouse -> "Host key verification failed".
#
# Esto NO rehace la copia (ya es valida) ni toca Postgres. Solo abre lectura al
# grupo y la envia con la identidad correcta.
#
set -euo pipefail

DEST_DIR="/var/backups/intelimarket-basebackup"
REMOTE_HOST="intellihouse@100.104.93.77"
REMOTE_KEY="/home/intellihouse/.ssh/id_ed25519_backup_supermercado"

if [ "$(id -u)" -ne 0 ]; then
    echo "ERROR: correr con sudo." >&2
    exit 1
fi

echo "==> 1/3 Dando lectura al grupo sobre la copia existente..."
chmod -R g+rX "$DEST_DIR"
ls -ld "$DEST_DIR"/base_*

echo
echo "==> 2/3 Enviando a minisforum como intellihouse (tarda: ~950 MB)..."
sudo -u intellihouse rsync -a --delete --timeout=300 --info=progress2 \
    -e "ssh -i ${REMOTE_KEY} -o BatchMode=yes -o ConnectTimeout=15" \
    "$DEST_DIR/" "${REMOTE_HOST}:basebackup/"

echo
echo "==> 3/3 Verificando que no quede nada pendiente..."
pendiente=$(sudo -u intellihouse rsync -n -a -i --timeout=60 \
    -e "ssh -i ${REMOTE_KEY} -o BatchMode=yes" \
    "$DEST_DIR/" "${REMOTE_HOST}:basebackup/" | grep -c '^' || true)

if [ "$pendiente" -eq 0 ]; then
    echo
    echo "============================================================"
    echo " LISTO. La copia fisica esta en minisforum."
    echo " Recien ahora el WAL archivado sirve para restaurar."
    echo "============================================================"
else
    echo "ERROR: quedaron $pendiente archivos sin enviar." >&2
    exit 1
fi
