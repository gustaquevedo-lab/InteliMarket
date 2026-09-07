# Respaldo y recuperación de la base

Copia versionada de los scripts que corren en la VM. **Los que se ejecutan de
verdad viven en `/home/intellihouse/`** — esto es el original al que volver si
alguno se pierde o se rompe. Si se edita acá, hay que copiarlo allá (y al revés).

## Las tres piezas

| archivo | qué hace | cuándo corre |
|---|---|---|
| `backup_database.sh` | `pg_dump` completo → minisforum-ia | todas las noches |
| `setup_wal_archiving.sh` | activa el archivado continuo de WAL (**reinicia Postgres**) | una sola vez, a mano |
| `ship_wal.sh` | manda a minisforum el WAL que Postgres archivó local | cada minuto (cron del usuario) |
| `basebackup.sh` | copia física de la base (`pg_basebackup`) | domingos 01:00 (cron del sistema) |

## Por qué hacen falta las dos clases de respaldo

El `pg_dump` es **lógico**: reconstruye los datos, sirve para restaurar una tabla
suelta y sobrevive a corrupción física — pero se pierde hasta 24 h y no puede
volver a un minuto exacto.

La copia física + WAL sí puede volver a un minuto exacto ("las 14:31, justo antes
del borrado") y acota la pérdida a 5 minutos, pero el WAL **solo se reproduce
sobre una copia física**, nunca sobre un `pg_dump`. Por eso `basebackup.sh` no es
opcional: sin él, el WAL archivado no sirve para nada.

Ninguno de los dos reemplaza al otro, y una réplica en vivo no reemplaza a
ninguno: replica también los borrados y la corrupción, en milisegundos.

## La trampa que evita este diseño

Postgres archiva **solo a disco local**, nunca a la red. Si el `archive_command`
dependiera de minisforum, un corte de red haría que Postgres no pueda archivar,
acumule WAL en `pg_wal` y **termine llenando el disco** — y con el disco lleno
Postgres deja de aceptar escrituras: las cajas dejan de vender. Con ~2 GB de WAL
por día y 12 GB libres, eso pasaría en menos de una semana de red caída.

El envío corre aparte (`ship_wal.sh`), reintenta solo, y si la red no está,
Postgres ni se entera.

## Para restaurar

Ver `RESTAURAR.md`. Incluye también el chequeo de salud periódico: si
`pg_stat_archiver.failed_count` sube, el archivado está fallando en silencio y
hay que mirarlo antes de que sea un problema de disco.
