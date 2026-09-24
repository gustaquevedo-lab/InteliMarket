#!/usr/bin/env bash
#
# Arregla el dueño del directorio de copias fisicas y hace la primera copia.
#
# EL DEFECTO
#   El directorio quedo como root:intellihouse, pero quien escribe la copia es
#   postgres (pg_basebackup corre como ese usuario), y postgres no esta en el
#   grupo intellihouse. Resultado: "Permission denied", la copia nunca se hizo.
#   Mismo criterio que el directorio de WAL: escribe postgres, lee y envia
#   intellihouse.
#
# Esto NO toca Postgres: no reinicia ni recarga nada. La copia fisica se hace
# en caliente, sin bloquear la base; solo agrega algo de I/O por unos minutos.
#
set -euo pipefail

BASE_DIR="/var/backups/intelimarket-basebackup"

if [ "$(id -u)" -ne 0 ]; then
    echo "ERROR: correr con sudo." >&2
    exit 1
fi

echo "==> 1/3 Corrigiendo el dueño del directorio..."
mkdir -p "$BASE_DIR"
chown postgres:intellihouse "$BASE_DIR"
chmod 2770 "$BASE_DIR"
ls -ld "$BASE_DIR"

echo
echo "==> 2/3 Haciendo la PRIMERA copia fisica (tarda unos minutos)..."
echo "    Sin esto, el WAL archivado no sirve para restaurar."
if /home/intellihouse/basebackup.sh; then :; fi
tail -6 /home/intellihouse/basebackup.log

echo
echo "==> 3/3 Verificacion:"
if ls -d "$BASE_DIR"/base_* >/dev/null 2>&1; then
    du -sh "$BASE_DIR"/base_*
    ls -lh "$BASE_DIR"/base_*/
    echo
    echo "============================================================"
    echo " LISTO. Ya existe una copia fisica sobre la cual reproducir"
    echo " el WAL. Recien ahora el archivado sirve para restaurar."
    echo "============================================================"
else
    echo "ERROR: sigue sin haber copia fisica. Revisar el log de arriba." >&2
    exit 1
fi
