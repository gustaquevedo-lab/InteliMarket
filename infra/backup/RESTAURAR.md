# Restauración de la base — InteliMarket / Extra Supermercado

Tres caminos, según lo que haya pasado. Elegí el que corresponda **antes** de tocar nada.

---

## Caso A — "Alguien borró/rompió datos hace un rato"

El más común, y el único que resuelve el archivado de WAL. Permite volver a un
minuto exacto: *las 14:31, justo antes del borrado*.

Se restaura la última **copia física** y se le aplica el WAL hasta el momento
elegido. **No se hace sobre la base en producción**: se levanta una instancia
aparte, se saca lo que hace falta, y recién ahí se decide.

**Se hace EN minisforum-ia**, que es donde ya viven los archivos: tiene el mismo
Postgres 18.6, es x86_64 y tiene espacio. Además el canal de respaldo es de solo
escritura a propósito — desde la VM no se puede bajar nada.

```bash
# Rutas reales (verificadas 08-09-2026):
#   copia física:  ~/backups-supermercado/basebackup/base_AAAAMMDD-HHMMSS/
#   WAL:           ~/backups-supermercado/wal/*.gz
#   dumps lógicos: ~/backups-supermercado/intelimarket_*.dump
D=$HOME/backups-supermercado
COPIA=$(ls -1dt $D/basebackup/base_* | head -1)

# 1. Antes que nada: confirmar que la copia está sana
gzip -t $COPIA/base.tar.gz && echo "copia integra"

# 2. Descomprimir en un directorio NUEVO (nunca sobre algo existente)
mkdir -p /var/tmp/restore/pg_wal
tar xzf $COPIA/base.tar.gz    -C /var/tmp/restore
tar xzf $COPIA/pg_wal.tar.gz  -C /var/tmp/restore/pg_wal

# 3. Indicarle hasta dónde reproducir
cat > /var/tmp/restore/postgresql.auto.conf <<EOF
restore_command = 'gunzip -c $D/wal/%f.gz > %p'
recovery_target_time = '2026-09-06 14:31:00-03'
recovery_target_action = 'promote'
EOF
touch /var/tmp/restore/recovery.signal
chmod 700 /var/tmp/restore

# 4. Arrancar esa instancia en OTRO puerto, nunca sobre la de producción
sudo chown -R postgres:postgres /var/tmp/restore
sudo -u postgres /usr/lib/postgresql/18/bin/pg_ctl -D /var/tmp/restore -o "-p 5433" start
```

La copia física **solo sirve junto con el WAL del período**: arranca en un
segmento concreto (lo dice el archivo `*.backup` que está en `wal/`) y necesita
todos los segmentos desde ahí. Si falta uno del medio, la reproducción se corta
en ese punto.

Después, con `psql -p 5433` se revisa que los datos estén como se esperaba y se
copia lo necesario a producción.

---

## Caso B — "Se murió el servidor entero"

Hay que levantar una máquina nueva, instalar Postgres 18 y la aplicación, y
después seguir el **Caso A** con la última copia física + WAL.

**Este es el escenario con peor tiempo de recuperación y hoy no está medido.**
Vale la pena cronometrarlo una vez, en frío, para saber el número real en vez de
suponerlo.

---

## Caso C — "Necesito una tabla puntual" o "la base está corrupta"

Usar el **dump lógico nocturno** (`/home/intellihouse/backups/database/*.dump`),
que es independiente del camino físico. Sobrevive a corrupción física y permite
restaurar objetos sueltos.

```bash
# tabla puntual, a una base de prueba
createdb revision
pg_restore -d revision -t nombre_tabla intelimarket_AAAAMMDD-HHMMSS.dump
```

---

## Qué cubre cada cosa (no se reemplazan entre sí)

| | pg_dump nocturno | Copia física + WAL |
|---|---|---|
| Pérdida máxima | 24 h | **5 min** |
| Volver a un minuto exacto | no | **sí** |
| Sirve si la base se corrompe | **sí** | no necesariamente |
| Restaurar una tabla suelta | **sí** | engorroso |

Una réplica en vivo *no* reemplaza a ninguno de los dos: replica fielmente
también los borrados y la corrupción, en milisegundos.

---

## Chequeo de salud (correr de vez en cuando)

```bash
# ¿Postgres está archivando bien? failed_count debe ser 0 y last_archived_time reciente
sudo -u postgres psql -xc "SELECT archived_count, failed_count, last_archived_time, last_failed_time FROM pg_stat_archiver"

# ¿El buffer local se está vaciando? (debería tener pocos archivos)
ls /var/backups/intelimarket-wal | wc -l
tail -5 /home/intellihouse/ship_wal.log

# ¿Hay espacio en disco? Con el disco lleno Postgres deja de aceptar escrituras
# y el local deja de vender. Ya pasó el 08-09-2026, por 16 GB de logs.
df -h /
tail -5 /var/log/guard-disco.log

# ¿La cadena de WAL está completa del lado de minisforum? (sin huecos)
ssh intellihouse@100.104.93.77 'ls -1 ~/backups-supermercado/wal/*.gz | wc -l'

# ¿La copia física semanal corrió?
tail -5 /home/intellihouse/basebackup.log
```

**Señal de alarma:** si `failed_count` sube o `last_failed_time` es reciente,
Postgres no está pudiendo archivar. Se acumula WAL en `pg_wal` y, si nadie lo
mira, termina llenando el disco — y con el disco lleno Postgres deja de aceptar
escrituras: las cajas dejan de vender. Revisar permisos de
`/var/backups/intelimarket-wal` y espacio en disco.

---

## Para revertir todo el archivado

```bash
sudo rm /etc/postgresql/18/main/conf.d/90-intelimarket-wal.conf
sudo systemctl restart postgresql@18-main
sudo rm /etc/cron.d/intelimarket-basebackup
crontab -e   # quitar la línea de ship_wal.sh
```
