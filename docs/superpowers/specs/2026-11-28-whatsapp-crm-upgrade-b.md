# Spec: CRM+WhatsApp Upgrade — Fase B (Polling + Customer Panel + Quick Replies)

**Fecha:** 2026-11-28  
**Proyecto:** Intelimarket / Extra Supermercado  
**Rama:** `vertical/supermercado`  
**Fase C (SSE):** se aborda en spec separado una vez que Fase B esté estable en producción.

---

## Objetivo

Mejorar el módulo WhatsApp/IntelliZapp de Intelimarket en dos dimensiones:

1. **Usabilidad**: el operador debe ver conversaciones actualizarse automáticamente, saber cuántos chats están sin leer y encontrar plantillas con un clic.
2. **Integración con la realidad del supermercado**: desde el chat se debe acceder al perfil completo del cliente (ExtraClub, crédito, últimas ventas, deuda), ejecutar opt-in automático y segmentar campañas con filtros reales de comportamiento de compra.

---

## Subsistemas

### S1 — Polling de bandeja (15 s) + Badge global de no-leídos

**Problema actual:** `pollingRef` solo corre cuando `status.state === "connecting"` (escaneo de QR). La bandeja de conversaciones se recarga manualmente o al enviar un mensaje. El badge de no-leídos no existe fuera de la página WhatsApp.

**Solución:**

- **Frontend** (`WhatsAppPage.tsx`): agregar un segundo `useEffect` independiente que ejecute `fetchConversations()` cada 15 000 ms mientras el tab activo sea `"chat"`. El intervalo se limpia al desmontar o cambiar de tab.
- El badge global (ícono de menú lateral de la app) lee `conversations.reduce((s, c) => s + (c.unread_agent_count || 0), 0)`. Se guarda en un `useState<number>` que se actualiza en cada ciclo de polling. Se pasa al componente de navegación lateral mediante un Context ya existente (o prop si no hay Context).
- El indicador `is_ai_typing` (ya existe en el response de `GET /conversations/{id}`) se muestra como animación de 3 puntos (`…`) en el área de chat cuando el bot está procesando. Se refresca con el polling de mensajes (cada 10 s cuando hay una conversación activa).
- **Backend:** ningún cambio requerido — `unread_agent_count` e `is_ai_typing` ya se exponen en los endpoints existentes.

**Endpoints usados (existentes):**
- `GET /api/v1/whatsapp/conversations` → lista con `unread_agent_count`
- `GET /api/v1/whatsapp/conversations/{id}` → `is_ai_typing`
- `GET /api/v1/whatsapp/conversations/{id}/messages` → mensajes nuevos

---

### S2 — Customer Profile Panel

**Problema actual:** No hay forma de ver desde el chat quién es el cliente, cuántos puntos tiene, qué compró o cuánto debe.

**Solución:**

**Backend — nuevo endpoint:**
```
GET /api/v1/whatsapp/conversations/{conv_id}/customer-profile
Auth: bearer token (mismo middleware que el resto)
Response: CustomerProfileResponse (ver schema más abajo)
```

Lógica de resolución:
1. Cargar `WhatsAppConversation` → `contact_phone`.
2. Normalizar teléfono: strip `+595`, `595`, `0` del prefijo para comparar.
3. `SELECT * FROM customers WHERE telefono ILIKE %{phone_normalized}% LIMIT 1` (dentro del `tenant_id/company_id`).
4. Si no hay match → `{ linked: false }`.
5. Si hay match:
   - Llamar `loyalty.service.get_balance(db, customer.id, company_id)` → puntos ExtraClub.
   - `SELECT SUM(saldo) FROM sales WHERE customer_id = ? AND saldo > 0` → deuda pendiente en cuenta corriente.
   - `SELECT fecha, numero, tipo_comprobante, total, saldo FROM sales WHERE customer_id = ? ORDER BY fecha DESC LIMIT 5`.

**Schema de response:**
```python
class CustomerProfileResponse(BaseModel):
    linked: bool
    customer_id: Optional[str] = None
    razon_social: Optional[str] = None
    ci: Optional[str] = None
    ruc: Optional[str] = None
    ciudad: Optional[str] = None
    telefono: Optional[str] = None
    limite_credito: Optional[int] = None
    # ExtraClub
    extra_club_numero: Optional[str] = None
    extra_club_puntos: Optional[int] = None
    extra_club_puntos_por_vencer: Optional[int] = None
    extra_club_is_member: Optional[bool] = None
    # Cuenta corriente
    deuda_total: Optional[int] = None   # suma de saldos pendientes en PYG
    # Últimas ventas
    ultimas_ventas: Optional[list[UltimaVentaItem]] = None

class UltimaVentaItem(BaseModel):
    fecha: str          # ISO con timezone America/Asuncion
    numero: str
    tipo_comprobante: str
    total: int
    saldo: int
```

**Frontend — panel lateral:**
- Botón `👤 Ficha` en la barra superior del chat activo (junto a los otros botones existentes).
- Al hacer clic: `GET /conversations/{conv_id}/customer-profile` → muestra panel deslizable a la derecha (`w-72 shrink-0 border-l`).
- Arquitectura canónica del panel (no es modal): `flex flex-col h-full overflow-hidden`.
  - Header: nombre + badge `🌟 ExtraClub` si es socio.
  - Sección datos: ciudad, CI/RUC, límite de crédito.
  - Sección ExtraClub: puntos disponibles con barra de progreso, puntos por vencer (badge naranja si > 0).
  - Sección crédito/deuda: badge rojo si `deuda_total > 0` con monto formateado con `formatPYG()`.
  - Tabla de últimas 5 ventas: fecha, número, tipo, total, saldo pendiente.
  - Botón `📣 Enviar campaña` → abre el modal de nueva campaña pre-cargado con `contact_phone`.
- Si `linked: false` → mensaje "Cliente no vinculado. El número no está registrado en la base de clientes."
- Montos: **todos** con `formatPYG()` de `src/utils/format.ts`. Sin `Gs.` en columnas.

---

### S3 — Respuestas Rápidas (Quick Replies)

**Problema actual:** `WhatsAppTemplate` existe en BD con múltiples tipos, pero en el input del chat en vivo no hay acceso a plantillas.

**Solución:**

- **Sin cambio de backend:** reusar `GET /api/v1/whatsapp/templates` (ya existe, devuelve todas las plantillas del tenant).
- **Frontend:** botón `⚡` a la izquierda del campo de texto del chat → `useState<boolean>` para `showQuickReplies`.
- Al abrir: popover con `max-h-64 overflow-y-auto` que lista las plantillas con nombre + preview (primeros 80 chars del body). Campo de búsqueda con debounce 300ms que filtra por nombre/body.
- Al seleccionar: `setReplyText(template.body)` → el texto queda editable antes de enviar (el operador puede personalizar el nombre del cliente, etc.).
- Las templates de tipo `extraclub.*` se muestran con ⭐, las de tipo `sorteo.*` con 🎰, el resto con 💬.

---

### S4 — Opt-in Automático

**Problema actual:** cuando un cliente responde "SÍ" a una campaña de sorteo/opt-in, nada sucede automáticamente.

**Solución:**

En `handle_inbound_webhook` (`router.py`), después de guardar el mensaje entrante, agregar:

```python
# Detectar respuesta de opt-in
_OPTIN_PATTERN = re.compile(r"^\s*(s[íi]|sim|yes|ok|dale|confirmo)\s*$", re.IGNORECASE)

if _OPTIN_PATTERN.match(message_body):
    # Buscar última campaña enviada a este teléfono en las últimas 72h con tipo optin
    last_optin_campaign = await db.execute(
        select(WhatsAppCampaignRecipient)
        .join(WhatsAppCampaign)
        .where(
            WhatsAppCampaignRecipient.contact_phone == contact_phone,
            WhatsAppCampaign.company_id == company_id,
            WhatsAppCampaign.tipo.in_(["sorteo.optin", "optin"]),
            WhatsAppCampaignRecipient.sent_at >= datetime.utcnow() - timedelta(hours=72),
        )
        .order_by(WhatsAppCampaignRecipient.sent_at.desc())
        .limit(1)
    )
    if last_optin_campaign.scalars().first():
        await trigger_automation(
            db=db,
            company_id=company_id,
            tenant_id=tenant_id,
            event="optin.confirmado",
            phone=contact_phone,
        )
        # Registrar en conversación
        conv.last_message_at = datetime.utcnow()
```

Importaciones necesarias en `router.py`: `re`, `timedelta` (ya presentes tras la auditoría).

---

### S5 — Segmentación Real de Campañas

**Problema actual:** `_resolve_segment` en `campaign_service.py` filtra por `ciudad` (ya corregido) pero ignora `dias_inactivo` y `monto_min` aunque esos campos están en el schema de campañas.

**Solución** — en `campaign_service._resolve_segment`, agregar los filtros SQL reales:

```python
# dias_inactivo: clientes que no compraron en los últimos N días
if segment.get("dias_inactivo"):
    cutoff = datetime.utcnow() - timedelta(days=int(segment["dias_inactivo"]))
    query = query.where(
        Customer.id.in_(
            select(Sale.customer_id)
            .where(Sale.company_id == company_id)
            .group_by(Sale.customer_id)
            .having(sa_func.max(Sale.fecha) <= cutoff)
        )
    )

# monto_min: clientes con compras acumuladas >= N en últimos 90 días
if segment.get("monto_min"):
    cutoff90 = datetime.utcnow() - timedelta(days=90)
    query = query.where(
        Customer.id.in_(
            select(Sale.customer_id)
            .where(
                Sale.company_id == company_id,
                Sale.fecha >= cutoff90,
            )
            .group_by(Sale.customer_id)
            .having(sa_func.sum(Sale.total) >= int(segment["monto_min"]))
        )
    )
```

Importación: `from sqlalchemy import func as sa_func` (ya presente), `timedelta` (ya presente).

---

### S6 — Dashboard de Conversión Bot vs Humano

**Problema actual:** `GET /api/v1/whatsapp/stats` devuelve métricas básicas pero sin breakdown de quién resolvió las conversaciones.

**Solución — extender el endpoint de stats:**

Agregar al dict de respuesta:
```python
"bot_handled": int,       # conversaciones sin ningún mensaje outbound de tipo 'agent'
"human_handled": int,     # conversaciones con al menos un mensaje de 'agent'  
"avg_response_time_s": float,  # promedio de segundos entre entrante → saliente más próximo
"total_conversations_30d": int,
```

Query de `bot_handled`:
```sql
SELECT COUNT(DISTINCT conversation_id) FROM whatsapp_messages
WHERE direction = 'outbound' AND author_type != 'agent'
  AND tenant_id = ? AND created_at >= NOW() - INTERVAL '30 days'
-- y NO existe ningún mensaje de 'agent' en esa conversación en los últimos 30d
```

**Frontend — nuevo tab "📊 Estadísticas" en IntelliZapp:**
- 4 cards: Total conversaciones, Bot resuelto, Humano resuelto, Tiempo promedio de respuesta.
- PieChart (`recharts`) bot vs humano.
- Reusar el patrón visual de las otras stats cards ya presentes en el componente.

---

## Restricciones del proyecto

- Zona horaria: `America/Asuncion` en todas las fechas mostradas al usuario.
- Montos: `formatPYG()` siempre. Sin prefijo `Gs.` en columnas.
- Modales/paneles: arquitectura canónica `max-h-[90vh] flex flex-col`, header `shrink-0`, body `flex-1 overflow-y-auto`, footer `shrink-0`.
- No tocar POS (`ui-web/src/pages/pos/`) ni Electron.
- Rama activa: `vertical/supermercado`. No `git checkout` sin confirmación.
- Despliegue: solo `bash deploy-api.sh` / `bash deploy-ui.sh`.
- `<CurrencyInput />` para todo campo monetario en formularios.
- No `setInterval` ciego — limpiar en `useEffect` cleanup.

---

## Fase C (futura — SSE)

Reemplazar los `setInterval` de S1 por un `EventSource` conectado a un endpoint FastAPI `StreamingResponse`. Requiere:
- `proxy_buffering off` + `proxy_read_timeout 3600` en NGINX para el location del endpoint SSE.
- `asyncio.Queue` por tenant como fan-out bus.
- El webhook escribe en la cola; el SSE la consume.
- Se migra de forma incremental: añadir el endpoint SSE, el frontend intenta `EventSource` primero y cae a polling si falla (graceful degradation).
