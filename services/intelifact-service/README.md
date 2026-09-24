# InteliFact Engine — microservicio de facturación electrónica

**Estado: listo, no activado.** Este servicio queda scaffoldeado para el día
que un tenant (Extra Supermercado u otro) necesite migrar de autoimpresor a
facturación electrónica real — no está corriendo ni instalado por defecto en
ninguna VM, y `sales/service.py` no lo llama todavía.

Portado del mismo motor ya usado en la vertical Distribuidora (Casa
Gonzalito), generalizado: acá no hay ningún dato de emisor hardcodeado — cada
request real trae el emisor completo (RUC, timbrado, dirección, etc.) armado
por el backend desde la tabla `intelifact_configs` (una fila por empresa).

## Bloqueante conocido: falta la librería `intellifact`

`package.json` apunta a `"intellifact": "file:../intelifact-library"` — un
paquete privado (firma de certificados `.p12`, generación de XML de CDC,
cliente SOAP a e-Kuatia de SET) que **no está publicado en ningún registro
npm**. Para poder instalar este servicio hace falta:

1. Conseguir el código fuente de `intelifact-library` (el mismo que usa hoy
   la instancia de Casa Gonzalito).
2. Copiarlo a `services/intelifact-library/` (al lado de este directorio,
   mismo nivel que `intelifact-service/`) — la ruta relativa en
   `package.json` ya está pensada para eso, para que funcione igual en
   cualquier VM del monorepo, no solo en la máquina original de Casa
   Gonzalito.
3. Recién ahí correr `npm install` acá adentro.

Hasta que eso pase, el código está completo y revisado pero **no se puede
buildear ni correr** — no es un bug, es el estado esperado mientras no se
consiga la librería.

## Instalación (una vez esté la librería vendorizada)

```bash
cd services/intelifact-service
npm install
npm run build   # o `npm run dev` para levantar con recarga en caliente
```

## Variables de entorno

Todas opcionales — son solo el emisor de *desarrollo* que usa el servicio si
alguien le pega directo sin pasar por el backend (health-check, pruebas
manuales). En uso real, el backend (`api/src/intelifact/service.py`) siempre
manda el emisor completo del tenant en cada request, así que estas variables
no afectan facturas reales:

| Variable | Default |
|---|---|
| `PORT` | `3000` |
| `EMITTER_RUC` / `EMITTER_DV` / `EMITTER_NAME` / `EMITTER_TRADE_NAME` | `00000000` / `0` / `EMISOR DE DESARROLLO` / `DEV` |
| `EMITTER_TIMBRADO` / `EMITTER_TIMBRADO_START` | `00000000` / `2026-01-01` |
| `EMITTER_ESTABLECIMIENTO` / `EMITTER_PUNTO_EXP` | `001` / `001` |
| `SIFEN_ENVIRONMENT` | `test` |
| `TELEMETRY_ENDPOINT` | `http://dev-server/api/v1/telemetry/ingest` |

## Cómo lo llama el backend

`api/src/intelifact/service.py` — `InteliFactClient`, `base_url` viene de
`intelifact_configs.service_base_url` por tenant (default
`http://localhost:3000` si no se configuró otro). Cada tenant real puede
correr su propia instancia en su propia VM/puerto si hace falta, o compartir
una si están en la misma máquina.

## Despliegue (cuando se active)

Ver `deploy/intelimarket-intelifact.service.example` — plantilla de systemd,
no instalada. Copiarla a `/etc/systemd/system/` y `enable --now` manualmente
el día que corresponda; este repo no lo hace por vos.
