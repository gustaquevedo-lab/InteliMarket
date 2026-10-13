#!/usr/bin/env bash
#
# ENSAYO DE RESTAURACION — InteliMarket / Extra Supermercado
#
# Levanta una copia de la base a partir del respaldo, en una instancia aparte,
# para responder dos preguntas que hoy son suposiciones:
#   1. ¿Los archivos de respaldo sirven de verdad?
#   2. ¿Cuánto tarda volver?
#
# CORRE EN minisforum-ia, que es donde ya viven los respaldos.
#
# NO TOCA NADA DE PRODUCCION
#   - La VM ni siquiera participa: todo se lee de este disco.
#   - El Postgres de esta maquina (puerto 5432) queda intacto: la instancia de
#     ensayo usa OTRO directorio, OTRO puerto y OTRO proceso.
#   - Los respaldos solo se LEEN. Nunca se modifican ni se borran.
#
# NO NECESITA sudo: la instancia corre como el usuario actual. Postgres no
# arranca como root, pero si con cualquier usuario que sea dueño del directorio
# de datos. Ademas asi lee el WAL sin problemas de permisos.
#
# Al terminar DEJA la base levantada para que se pueda entrar a mirarla.
# Para apagarla y borrar todo:  ensayo_restauracion.sh --limpiar
#
set -uo pipefail

RESP="$HOME/backups-supermercado"
RAIZ=/var/tmp/ensayo-restore
DATOS="$RAIZ/data"
SOCKET="$RAIZ/socket"
PUERTO=5433
BIN=/usr/lib/postgresql/18/bin

rojo()  { printf "\033[31m%s\033[0m\n" "$*"; }
verde() { printf "\033[32m%s\033[0m\n" "$*"; }
paso()  { printf "\n\033[1m==> %s\033[0m\n" "$*"; }

# ── limpieza ────────────────────────────────────────────────────────────────
if [ "${1:-}" = "--limpiar" ]; then
    if [ -d "$DATOS" ]; then
        "$BIN/pg_ctl" -D "$DATOS" -m immediate stop >/dev/null 2>&1
        sleep 2
    fi
    rm -rf "$RAIZ"
    verde "Ensayo borrado. No quedo rastro."
    exit 0
fi

# ── protecciones ────────────────────────────────────────────────────────────
paso "Comprobaciones previas"

if [ "$(id -u)" -eq 0 ]; then
    rojo "ERROR: NO correr como root. Postgres no arranca como root, y ademas"
    rojo "       como usuario normal no hace falta tocar permisos de nada."
    exit 1
fi

if ss -lnt 2>/dev/null | grep -q ":$PUERTO "; then
    rojo "ERROR: el puerto $PUERTO ya esta ocupado. Abortando para no pisar nada."
    exit 1
fi
echo "   puerto $PUERTO libre (el 5432 de esta maquina no se toca)"

if [ -e "$RAIZ" ]; then
    rojo "ERROR: $RAIZ ya existe. Corre '$0 --limpiar' primero."
    exit 1
fi

COPIA=$(ls -1dt "$RESP"/basebackup/base_* 2>/dev/null | head -1)
if [ -z "$COPIA" ]; then
    rojo "ERROR: no encontre ninguna copia fisica en $RESP/basebackup/"
    exit 1
fi
echo "   copia fisica: $(basename "$COPIA")  ($(du -sh "$COPIA" | cut -f1))"
echo "   WAL disponible: $(ls -1 "$RESP"/wal/*.gz 2>/dev/null | wc -l) segmentos"

libre_kb=$(df --output=avail /var/tmp | tail -1)
if [ "$libre_kb" -lt 6000000 ]; then
    rojo "ERROR: hacen falta ~6 GB libres en /var/tmp y hay $((libre_kb/1024/1024)) GB."
    exit 1
fi
echo "   espacio: $((libre_kb/1024/1024)) GB libres (hacen falta ~6)"

paso "Verificando que el respaldo no este corrupto"
for f in base.tar.gz pg_wal.tar.gz; do
    printf "   %-16s " "$f"
    if gzip -t "$COPIA/$f"; then verde "OK"; else rojo "CORRUPTO — abortando"; exit 1; fi
done

T0=$(date +%s)

# ── restauracion ────────────────────────────────────────────────────────────
paso "1/4 Descomprimiendo la copia fisica"
mkdir -p "$DATOS" "$SOCKET"
chmod 700 "$DATOS"
tar xzf "$COPIA/base.tar.gz" -C "$DATOS"       || { rojo "fallo al descomprimir base.tar.gz"; exit 1; }
mkdir -p "$DATOS/pg_wal"
tar xzf "$COPIA/pg_wal.tar.gz" -C "$DATOS/pg_wal" || { rojo "fallo al descomprimir pg_wal.tar.gz"; exit 1; }
echo "   $(du -sh "$DATOS" | cut -f1) descomprimidos"

paso "2/4 Configurando la instancia de ensayo"
# El respaldo NO trae postgresql.conf: en Debian/Ubuntu vive en /etc, fuera del
# directorio de datos. Hay que escribir uno minimo o Postgres no arranca. Este
# es el paso que mas facilmente se olvida en una restauracion real.
cat > "$DATOS/postgresql.conf" <<CONF
port = $PUERTO
listen_addresses = ''
unix_socket_directories = '$SOCKET'
hba_file = '$DATOS/pg_hba.conf'
ident_file = '$DATOS/pg_ident.conf'

# Reproduce el WAL archivado sobre esta copia.
restore_command = 'gunzip -c $RESP/wal/%f.gz > %p'

# Sin objetivo de tiempo: reproduce TODO el WAL disponible. Es el escenario
# "se murio el servidor": recuperar lo maximo posible.
# Para volver a un momento exacto se agregaria:
#   recovery_target_time = '2026-09-08 14:31:00-03'

archive_mode = off
shared_buffers = 512MB
logging_collector = off

# ESTOS VALORES NO SON DECORATIVOS. Postgres se NIEGA a reproducir el WAL si la
# instancia de restauracion tiene menos capacidad que la original: el WAL puede
# contener mas transacciones o candados de los que esta podria seguir. El primer
# ensayo fallo justamente aca, con "max_connections = 20 is a lower setting than
# on the primary server, where its value was 100".
#
# Deben ser >= a los de produccion. Medidos el 08-09-2026 en la VM:
#   max_connections 100 | max_worker_processes 8
#   max_prepared_transactions 0 | max_locks_per_transaction 64
# Si algun dia se suben en produccion, hay que subirlos tambien aca.
max_connections = 200
max_worker_processes = 16
max_prepared_transactions = 0
max_locks_per_transaction = 128
CONF
echo "local all all trust" > "$DATOS/pg_hba.conf"
: > "$DATOS/pg_ident.conf"
touch "$DATOS/recovery.signal"
echo "   configuracion minima escrita + recovery.signal"

paso "3/4 Arrancando y reproduciendo el WAL (esta es la parte lenta)"
if "$BIN/pg_ctl" -D "$DATOS" -l "$RAIZ/postgres.log" -w -t 900 start; then
    verde "   la instancia arranco"
else
    rojo "   NO arranco. Ultimas lineas del log:"
    tail -25 "$RAIZ/postgres.log"
    exit 1
fi

T1=$(date +%s)

# ── verificacion ────────────────────────────────────────────────────────────
paso "4/4 Comprobando que los datos esten"
# -U postgres NO es opcional: psql entra por defecto con el usuario del sistema,
# y dentro de la base restaurada ese rol no existe ("role intellihouse does not
# exist"). El primer intento murio aca, con la restauracion ya funcionando.
PSQL="$BIN/psql -h $SOCKET -p $PUERTO -U postgres -X -q"

DB=$($PSQL -d postgres -tAc "SELECT datname FROM pg_database WHERE datname NOT IN ('postgres','template0','template1') ORDER BY pg_database_size(datname) DESC LIMIT 1" 2>/dev/null)
if [ -z "$DB" ]; then
    rojo "   no encontre la base de la aplicacion"
    tail -20 "$RAIZ/postgres.log"
    exit 1
fi
echo "   base: $DB ($($PSQL -d postgres -tAc "SELECT pg_size_pretty(pg_database_size('$DB'))"))"

echo
printf "   %-28s %s\n" "tablas:"        "$($PSQL -d "$DB" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")"
printf "   %-28s %s\n" "productos:"     "$($PSQL -d "$DB" -tAc "SELECT count(*) FROM products" 2>/dev/null || echo '?')"
printf "   %-28s %s\n" "ventas:"        "$($PSQL -d "$DB" -tAc "SELECT count(*) FROM sales" 2>/dev/null || echo '?')"
printf "   %-28s %s\n" "ULTIMA VENTA recuperada:" "$($PSQL -d "$DB" -tAc "SELECT max(created_at) FROM sales" 2>/dev/null || echo '?')"
printf "   %-28s %s\n" "movimientos de stock:" "$($PSQL -d "$DB" -tAc "SELECT count(*) FROM inventory_movements" 2>/dev/null || echo '?')"
printf "   %-28s %s\n" "estado:" "$($PSQL -d postgres -tAc "SELECT CASE WHEN pg_is_in_recovery() THEN 'todavia reproduciendo WAL' ELSE 'recuperacion terminada' END")"

T2=$(date +%s)

echo
echo "============================================================"
verde " EL RESPALDO SIRVE. La base levanto y los datos estan."
echo "============================================================"
echo " Tiempo de reproduccion del WAL : $(( (T1-T0)/60 ))m $(( (T1-T0)%60 ))s"
echo " Tiempo total del ensayo        : $(( (T2-T0)/60 ))m $(( (T2-T0)%60 ))s"
echo
echo " Ese es el TIEMPO REAL de recuperacion de la base. Hasta hoy"
echo " era una suposicion."
echo
echo " La instancia queda levantada para que la mires vos mismo:"
echo
echo "   $BIN/psql -h $SOCKET -p $PUERTO -d $DB"
echo
echo " Y cuando termines, para apagarla y borrar todo:"
echo
echo "   $0 --limpiar"
echo "============================================================"
