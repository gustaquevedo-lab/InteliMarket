# Plan de implementación — SIFEN: e-Kuatia, CDC, timbrados y envío de XML a SET

> Estado: **planificado** (no iniciado). Fecha del plan: 2026-09-11.
> Proyecto: InteliMarket (FastAPI + React). Documento de referencia para la implementación.
> Marco normativo: Ley 6380/19, RG DNIT 69/2020 (SIFEN), RG 80/2021, RG 90/2021.
> Oráculo fiscal interno: `docs/FISCAL_PY_RULES.md` (mantenerlo sincronizado).

---

## 1. Objetivo

Llevar la facturación electrónica de InteliMarket de "mock funcional" a **emisión real y
homologada** ante el SIFEN de la DNIT (Paraguay):

1. Generar el Documento Electrónico (DE) en XML conforme al schema SIFEN (`siRecepDE_v150.xsd`),
   raíz `rDE`, namespace `http://ekuatia.set.gov.py/sifen/xsd`.
2. Firmarlo digitalmente con XMLDSig usando el **Certificado de Firma Electrónica (.p12)** de
   cada empresa contribuyente.
3. Calcular el **CDC** correcto (44 caracteres, algoritmo con dígito verificador módulo 11).
4. Numerar con secuencia fiscal **ESTABLECIMIENTO-PUNTO DE EXPEDICIÓN-NÚMERO** dentro del rango
   y vigencia del **timbrado** autorizado por SET.
5. Enviar a SET por el servicio web oficial (`recibe` para DE individuales y lotes, `consulta`
   para estados), manejar eventos (cancelación, inutilización) y conservar evidencia.
6. Emitir la representación gráfica **KuDE** (PDF con QR de verificación en
   `https://ekuatia.set.gov.py/verificacion/{CDC}`).

**Resultado de negocio:** cada factura/ticket emitido en InteliMarket es un DE legal válido,
consultable en e-Kuatia por CDC, con Libro IVA consistente.

---

## 2. Estado actual (baseline del repositorio)

El proyecto ya tiene ~70% de la infraestructura SIFEN. Lo que existe y lo que falta:

### Existe — módulo básico `api/src/sifen/`

| Pieza | Ubicación | Notas |
|---|---|---|
| Generación CDC | `sifen/cdc.py:7-33` | SHA256 truncado a 44 hex. **Incorrecto**: el CDC SIFEN no es hash, es estructura de campos con dígito verificador mod 11 (`validate_ruc` sí tiene mod 11 real, `cdc.py:47-65`). |
| Parser número fiscal | `sifen/cdc.py:36-44` | Espera formato EST-PUNEXP-SEQ (correcto). |
| Generador XML | `sifen/xml_generator.py:15-120` | Construye `DE` con lxml: `gTimb`, `gDatGralOpe`, `gDatRec`, items, totales. IVA incluido → base por tasa (RG 69/2020). **No firma**, falta `dRucEmi`, dirección, `dTipOpe`; `dFeFinT` hardcodeado a `YYYY-12-31` (bug si el timbrado vence antes). |
| Cliente | `sifen/client.py:24-41` | httpx. `send_invoice` → POST `{base}/enviar` con JSON; `query_cdc` → GET `/consultar`. **No es el protocolo real de SET** (es SOAP 1.2 con sobre cifrado `rqdata`, no REST/JSON). |
| Servicio de envío | `sifen/service.py:49-147` | Flujo completo venta→timbrado→XML→CDC→envío→persistencia `SifenResponse` + update `sale.cdc/sifen_*`. Errores silenciados en el auto-envío del router de ventas (`sales/router.py:84-89`). |
| Router | `sifen/router.py` | 11 endpoints: timbrados, `POST /send`, consulta por CDC, respuestas, QR (`/qr/{cdc}` ya apunta a la URL pública correcta de e-Kuatia). |
| Modelos | `sifen/models.py`, migración `e7a9c1b2d3f4_add_sales_module_tables.py` | `SifenTimbrado` (número, vigencia, rango, tipo), `SifenResponse`. |
| Campos en Sale | `sales/models.py:38-42` | `cdc` (44), `sifen_estado`, `sifen_fecha_respuesta`, `sifen_xml_sent`, `sifen_xml_response` — **no requiere migración para el plan básico**. |
| Config | `api/src/config.py` | `sifen_api_url`, `sifen_env=pruebas`, `sifen_cert_path/password` ya existen. |

### Existe — módulo avanzado `api/src/sifen_avanzado/` (feature flag)

- Migración `20260601100000_add_sifen_avanzado_tables.py`: `dgr_vehicles`,
  `ekuatia_documents`, `cdc_validation_logs`, `iva_book_configs`, `dgr_report_generated`.
- `sifen_avanzado/service.py` (654 líneas): Libro IVA ventas y compras con export CSV
  (`:125-255`), retenciones (`:260-307`), dashboard de compliance (`:576-654`),
  facturación one-shot distribuidora (`:34-120`).
- **Bugs remanentes conocidos**: import roto `api.src.salen.cdc` (typo, `service.py:511`),
  llamada a `send_to_sifen(cdc_str)` con firma incorrecta (debería ser consulta de CDC,
  `service.py:~494-533`), expectativa de estado `"vigente"`.

### Existe — módulo fiscal `api/src/fiscal/`

- `FiscalConfig`, `TimbradoUsage`, `NotaCreditoDebito` (`fiscal/models.py`).
- `reserve_next_number` (`fiscal/service.py:94-124`): reserva numeración de timbrado
  **preimpreso** con control de agotado — base reutilizable para la secuencia electrónica.
- `modo_emision`: sifen / preimpreso / autoimpresor.
- `emitir_nota_sifen` (`fiscal/service.py:202-214`) es **placeholder**: solo cambia estado,
  no envía a SIFEN.

### Existe — empresa y timbrado

- `companies/models.py:10-35`: `ruc`, `razon_social`, `condicion_iva`, `timbrado_numero`,
  `timbrado_vigencia_desde/hasta`, **`sifen_enabled`**, `sifen_cert_path` (sin uso real aún).
- No hay modelo de **Punto de Expedición** (solo `Sale.emission_point_id` suelto).
- El `numero` de `Sale` (`sales/service.py:40-51`) genera `YYYYMMDD-XXX-NNNNNN` — **no es
  formato fiscal**; solo el flujo distribuidora usa `DIST-001-NNNNNN` válido.

### Falta (el núcleo del plan)

1. Firma digital **XMLDSig** del DE con certificado .p12.
2. Cliente real **SET** (SOAP `recibe`/`consulta`, sobre `rqdata`, header `x-ambiente`).
3. **CDC correcto** (estructura + mod 11), no hash truncado.
4. Numeración fiscal **EST-PUNEXP-SEC** desde el timbrado electrónico.
5. **Eventos**: cancelación, inutilización de rangos, nota de remisión electrónica (tipo 9),
   NC/ND electrónicas reales (hoy placeholder).
6. **KuDE** (PDF con QR) — hay weasyprint/reportlab pero sin generador KuDE.
7. Corrección de bugs remanentes y **tests** (no existe `test_sifen*.py`).

---

## 3. Riesgos y supuestos

1. **Homologación ante SET es un proceso con la DNIT**, no solo código: requiere certificado
   de firma electrónica por empresa, alta como emisor electrónico, y pruebas en ambiente
   `x-ambiente: 2` antes de producción (`1`). Fase 0 es administrativa y bloqueante.
2. **Los schemas y WSDL se actualizan** (v150 vigente a la fecha del plan). Verificar la
   versión vigente en `https://sifen.set.gov.py` antes de implementar y fijarla en config.
3. **Drift ORM vs migraciones** en este repo es recurrente — verificar cada modelo contra su
   migración antes de modificarlo.
4. El auto-envío SIFEN al crear venta (`sales/router.py:84-89`) silencia errores: al pasar a
   producción hay que decidir política de reintento sin bloquear la venta al cajero.
5. Multi-empresa: certificado, timbrado y puntos de expedición son **por empresa**; el envío
   a SET debe resolverse desde el contexto del tenant, no de settings globales.

---

## 4. Fases de implementación

### Fase 0 — Habilitación ante SET/DNIT (prerequisito administrativo)

- [ ] Cada empresa usuaria: certificado de firma electrónica (.p12) expedido por un proveedor
  acreditado ante la DNIT; documentar el `sifen_cert_password` seguro.
- [ ] Alta del contribuyente como emisor electrónico en e-Kuatia; timbrado electrónico
  autorizado (número, vigencia, establecimiento, punto de expedición, rango inicial).
- [ ] Ambiente de pruebas: credenciales/URLs de test del SIFEN.
- [ ] Validar versión vigente de schemas (`siRecepDE_v150.xsd`) y WSDL
  (`.../de/ws/sync/recibe.wsdl`, `.../de/ws/sync/consulta.wsdl`); registrar URLs en config.

### Fase 1 — Numeración fiscal y puntos de expedición

- [ ] Nuevo modelo `EmissionPoint` (o tablas `establecimientos` / `puntos_expedicion`):
  código 3 dígitos, sucursal asociada (`branches/`), timbrado vigente, secuencia actual,
  contador dentro del rango autorizado. Migración Alembic nueva.
- [ ] Secuenciador transaccional: `reserve_next_de_number(company, punto)` con
  `SELECT ... FOR UPDATE` (o advisory lock por empresa+punto) para no duplicar números bajo
  concurrencia de cajas. Reutilizar el patrón de `fiscal/service.py:94-124`.
- [ ] Cambiar `Sale.numero` para facturas/tickets electrónicos a `EST-PUNEXP-SEC`
  (solo cuando `modo_emision == sifen`); mantener el formato comercial actual para tickets
  internos.
- [ ] Validaciones: número dentro de rango y vigencia del timbrado; bloqueo si agotado.

### Fase 2 — Generador XML completo (RG 69/2020)

Rehacer `sifen/xml_generator.py` sobre el schema real:

- [ ] Envolvente `rDE` con `xmlns="http://ekuatia.set.gov.py/sifen/xsd"`,
  `xsi:schemaLocation` y `dVerFor=150` (parametrizar versión).
- [ ] `DE` con `Id` = valor del CDC (se calcula antes de firmar).
- [ ] Completar grupos: `gOpeDE` (tipo DE 1–11, fecha, `dTipOpe`), `gTimb` (timbrado, EST,
  PUNEXP, número, vigencia), `gDatGralOpe` (fecha, `gEmis` con RUC, nombre, dirección —
  hoy falta `dRucEmi` y dirección), `gDatRec` (receptor o CONSUMIDOR FINAL),
  `gDtipProServ` / `gCamItem` (items con IVA por tasa), `gTotSub` (bases 10/5/exentas —
  ya se persisten por venta, `sales/models.py`).
- [ ] Corregir `dFeFinT`: vigencia real del timbrado, no `YYYY-12-31` fijo.
- [ ] Validar el XML generado contra el XSD oficial en CI (test con lxml etree.XMLSchema).

### Fase 3 — Firma digital XMLDSig

- [ ] Agregar dependencia `signxml` (firma) + `cryptography` (ya implícita vía p12).
- [ ] Implementar `sifen/signer.py`: cargar .p12 (`Company.sifen_cert_path` +
  `sifen_cert_password`), firmar el nodo `DE` con XMLDSig enveloped, RSA-SHA256, referencia
  URI al `Id` del DE, inclusión del certificado X509 y cadena en `KeyInfo`.
- [ ] Verificación previa al envío: parsear la firma y validar contra el certificado.
- [ ] Gestionar expiración del certificado: alerta en el dashboard de compliance
  (`sifen_avanzado`) 30/15/1 días antes.

### Fase 4 — CDC correcto

- [ ] Reescribir `sifen/cdc.py:7-27`: CDC = concatenación de campos del DE (RUC emisor,
  tipo DE, timbrado, EST, PUNEXP, número, tipo emisión, fecha, RUC contingencia) con
  **dígito verificador módulo 11** — 44 caracteres, no SHA256.
- [ ] Mantener `validate_cdc` y `validate_ruc` (mod 11 ya correcto).
- [ ] Tests de vectores conocidos (CDCs de pruebas de SET o generados por un software
  homologado de referencia).

### Fase 5 — Cliente SET real (reemplaza `sifen/client.py`)

- [ ] SOAP 1.2 sobre los WSDL oficiales de SIFEN (sync `recibe` / `consulta`; evaluar async
  para lotes grandes): envelope con `rqdata` (XML del DE firmado, base64),
  `rqver`/`rpver`, `ruid` único por request; header HTTP `x-ambiente: 1|2`.
- [ ] Cliente TLS con el certificado de la empresa (mTLS si SET lo exige en el ambiente).
- [ ] Operaciones:
  - `recibe` individual (1 DE) y **lote** (hasta el máximo permitido).
  - `consulta` por CDC y por `ruid` de lote.
  - Procesar respuesta `rProtDe` / `rResEnviDe` (código de resultado, `dMsgRes`).
  - **Eventos**: cancelación (`gCamNCDE`... evento 1), inutilización de rangos
    (evento 2), conformidad, con su propio XML firmado.
- [ ] Persistencia: extender `SifenResponse` con código/resultado SET, `ruid`, XML de
  respuesta completo; actualizar `sale.sifen_estado` con estados finales
  (aprobado/rechazado) y fecha.
- [ ] Reintentos con backoff para errores de red/5xx; nunca reintentar un rechazo fiscal
  (corrige el documento, no reenvíes igual).
- [ ] Auto-envío al crear venta: mantener fuera del request del cajero — encolar y enviar
  en background con reintento; mostrar estado en el POS (pendiente/aprobado/rechazado).

### Fase 6 — Eventos y documentos adicionales

- [ ] **Cancelación** de DE dentro del plazo legal, con motivo (evento firmado).
- [ ] **Inutilización** de rangos de numeración no utilizados (cierre de timbrado/punto).
- [ ] **Nota de remisión electrónica** (tipo 9) si aplica a la vertical distribuidora
  (hoy hay `dgr_vehicles` pero sin DE tipo 9).
- [ ] **NC/ND electrónicas reales**: reemplazar el placeholder `emitir_nota_sifen`
  (`fiscal/service.py:202-214`) por generación de DE tipo 5/6 firmado y enviado,
  vinculado al DE original por CDC.

### Fase 7 — KuDE (representación gráfica)

- [ ] Generador PDF con weasyprint (ya en deps): encabezado emisor, receptor, CDC, QR
  (url `https://ekuatia.set.gov.py/verificacion/{CDC}`), detalle, totales, leyendas
  según RG 69/2020 (incl. "Documento electrónico generado por computadora, consulte por
  el CDC en e-Kuatia").
- [ ] Adjuntar a la impresión de factura del POS y a la vista de venta en la web.

### Fase 8 — Libro IVA y compliance (afianzar lo existente)

- [ ] Verificar `get_iva_book` (`sifen_avanzado/service.py:125-222`) contra los DE
  **realmente aprobados** por SET (filtrar por `sifen_estado` final aprobado).
- [ ] Corregir la validación de CDC rota (`service.py:494-571`): typo de import
  (`api.src.salen.cdc`), llamada `send_to_sifen(cdc_str)` con firma incorrecta, estado
  esperado; debe usar la consulta real de CDC de la Fase 5.
- [ ] Reportes DGR ya tienen tablas; alinear con DE tipo 9 cuando exista.

### Fase 9 — Configuración multi-empresa y secrets

- [ ] Mover `sifen_cert_path/password` al ámbito de empresa (cifrado en reposo o gestor de
  secretos), no settings globales: cada tenant firma con su propio certificado.
- [ ] `.env.example`: documentar URLs de ambientes SET, `sifen_env`, y flags.
- [ ] Flag `sifen_enabled` por empresa (`companies/models.py` ya lo tiene): con el flag
  off, el POS sigue emitiendo tickets internos/preimpresos sin intentar SIFEN.

### Fase 10 — Tests y CI

- [ ] `api/tests/test_sifen_cdc.py`: vectores CDC conocidos, validación RUC.
- [ ] `api/tests/test_sifen_xml.py`: XML contra XSD oficial (archivo `.xsd` versionado en
  `api/tests/fixtures/sifen/`), grupos completos, casos consumidor final / RUC / IVA 5 /
  exento / moneda extranjera.
- [ ] `api/tests/test_sifen_signer.py`: firma + verificación con cert .p12 de prueba.
- [ ] `api/tests/test_sifen_client.py`: con `respx` o mock del transport SOAP — recibe OK,
  recibe rechazo con código, consulta por CDC, reintento de red, idempotencia por `ruid`.
- [ ] `api/tests/test_sifen_flow.py`: venta → DE → CDC → firma → envío (mockeado) → Sale
  actualizada → KuDE generado.

### Fase 11 — Homologación y salida a producción

- [ ] Suite de pruebas del ambiente SET de pruebas (`x-ambiente: 2`): todos los tipos de DE
  que emite InteliMarket, con los casos límite (anulación, inutilización, contingencia).
- [ ] Prueba de volumen: lote de N DEs, tiempo de respuesta, reintentos.
- [ ] Procedimiento de contingencia documentado (emisión posterior / DE de contingencia).
- [ ] Switch a `x-ambiente: 1` por empresa, monitoreo de rechazos, alerta de agotamiento de
  timbrado y vencimiento de certificado.
- [ ] Actualizar `docs/FISCAL_PY_RULES.md` y `docs/INTEGRATIONS.md` con el estado real.

---

## 5. Criterios de aceptación

1. Una venta factura genera un DE XML que **valida contra el XSD oficial** de SIFEN.
2. El DE está firmado con XMLDSig y el certificado de la empresa; la firma se verifica.
3. El CDC cumple el algoritmo oficial (44 caracteres, mod 11) y se consulta con éxito en
   `https://ekuatia.set.gov.py/verificacion/{CDC}` en ambiente de pruebas.
4. La numeración es EST-PUNEXP-SEC dentro del rango y vigencia del timbrado, sin huecos ni
   duplicados bajo concurrencia (test de N cajas simultáneas).
5. El envío a SET devuelve aprobado y persiste `ruid`, respuesta cruda y estado final en
   `Sale.sifen_*` / `SifenResponse`.
6. Cancelación e inutilización generan eventos firmados aceptados por SET.
7. KuDE imprime con QR válido.
8. `make test` verde con la suite nueva; ruff/mypy sin nuevas advertencias en `sifen*`.

---

## 6. Estimación orientativa

| Fase | Esfuerzo relativo |
|---|---|
| 0 — Habilitación DNIT | Bloqueante, administrativo |
| 1 — Numeración + puntos | M |
| 2 — XML schema completo | M-L |
| 3 — Firma XMLDSig | M |
| 4 — CDC | S |
| 5 — Cliente SET SOAP | L (núcleo) |
| 6 — Eventos, NC/ND, remisión | M-L |
| 7 — KuDE | S-M |
| 8 — Libro IVA / fixes | S-M |
| 9–10 — Config, tests | M |
| 11 — Homologación | M + proceso DNIT |

---

## 7. Anexo — Referencias técnicas

- Namespace/schema: `http://ekuatia.set.gov.py/sifen/xsd` (`siRecepDE_v150.xsd`).
- Servicios web: `https://sifen.set.gov.py/de/ws/sync/recibe.wsdl`,
  `https://sifen.set.gov.py/de/ws/sync/consulta.wsdl` (verificar vigencia en Fase 0).
- Header de ambiente: `x-ambiente: 1` producción, `2` pruebas.
- Verificación pública: `https://ekuatia.set.gov.py/verificacion/{CDC}`.
- CDC: 44 caracteres, dígito verificador módulo 11; campo-orden y padding exactos — un
  error produce rechazo `0160` ("CDC incorrecto"); emitir fuera de vigencia de timbrado
  produce `0142`.
- Tipos de DE 1–11 ya mapeados en `sifen/client.py:9-21` (`TIPO_DE_MAP`).
- Normas: Ley 6380/19; RG DNIT 69/2020 (SIFEN), RG 80/2021, RG 90/2021.
- Oráculo interno: `docs/FISCAL_PY_RULES.md`.
