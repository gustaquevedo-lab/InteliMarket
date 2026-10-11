# Especificación Arquitectónica: Gerente de Marketing IA (CMO Virtual) e Interconexión Tripartita

- **Fecha:** 2026-10-11
- **Módulo:** `api/src/marketing_agent/` y `ui-web/src/pages/marketing-agent/`
- **Estado:** Propuesta de Diseño para Aprobación
- **Autor:** Antigravity + Equipo de Negocios Extra Supermercado

---

## 1. Visión y Objetivos

El **Gerente de Marketing IA (CMO Virtual)** pasa de ser un módulo con pantallas decorativas y respuestas hardcodeadas a convertirse en el **motor ejecutor de demanda comercial y fidelización de Extra Supermercado**, operando sobre **datos 100% reales** y en **sintonía viva con el CFO Virtual y el Copiloto Comercial (CSO)**.

### Objetivos Clave:
1. **Inteligencia Híbrida Real:** Adoptar la arquitectura probada de `sales_agent` basada en **Qwen 2.5 7B Local (Ollama en `100.72.38.119:11434`)** con fallback a **Google Gemini** y fallback determinístico SQL.
2. **Explotación de Datos Reales de Fidelización:** Integrar los **7.856 clientes**, **26.195 tickets** y **278.020 ítems de compra** registrados en `cupones_clientes` y `cupon_ticket_items`, cruzados con la base de `customers` y `sales`.
3. **Impacto Directo en Salón y POS:** Toda campaña diseñada por el CMO genera automáticamente reglas en la tabla `promotions` para que **las cajas registradoras físicas apliquen el descuento**, se publiquen los banners en los **Kioscos verificadores de precios** y se despachen mensajes segmentados por **WhatsApp (Evolution API)**.
4. **Sincronización Tripartita Viva (CFO - CMO - CSO):** El CFO dicta el sobre-stock a monetizar y el piso de margen; el CMO diseña y ejecuta la campaña; el CSO instruye al salón de ventas y monitorea el ticket promedio.

---

## 2. Arquitectura de Datos y Fuentes Reales

```
┌────────────────────────────────────────────────────────────────────────┐
│                   FUENTES DE DATOS REALES DE EXTRA                     │
├──────────────────────────┬─────────────────────────────────────────────┤
│ Tabla                    │ Volumen Real & Utilidad                     │
├──────────────────────────┼─────────────────────────────────────────────┤
│ cupones_clientes         │ 7.856 clientes con Cédula/RUC, teléfono,   │
│                          │ barrio (PJC), total gastado y ticket prom.  │
├──────────────────────────┼─────────────────────────────────────────────┤
│ cupon_tickets            │ 26.195 tickets capturados con fecha y monto │
├──────────────────────────┼─────────────────────────────────────────────┤
│ cupon_ticket_items       │ 278.020 productos comprados detallados      │
│                          │ (permite saber el producto favorito real)   │
├──────────────────────────┼─────────────────────────────────────────────┤
│ sales & sale_items       │ Ventas en vivo de las cajas físicas (POS)   │
├──────────────────────────┼─────────────────────────────────────────────┤
│ promotions               │ 1.839 promociones configuradas en el sistema│
├──────────────────────────┼─────────────────────────────────────────────┤
│ stock                    │ Stock actual por góndola y depósito         │
└──────────────────────────┴─────────────────────────────────────────────┘
```

---

## 3. Bus de Directivas Inter-Agente (`inter_agent_directives`)

Para que la interconexión no sea meramente conceptual, se formaliza un protocolo de mensajería y directivas entre agentes:

### Estructura de la Directiva:
- **`codigo`**: Identificador único (`DIR-CFO-01`, `DIR-CMO-05`, `DIR-CSO-02`).
- **`emisor`**: `cfo` | `cmo` | `cso`
- **`receptor`**: `cfo` | `cmo` | `cso` | `todos`
- **`tipo`**: 
  - `liquidity_alert`: El CFO exige monetizar stock inmovilizado.
  - `margin_floor`: El CFO establece el margen bruto mínimo permitido (ej. 22%).
  - `campaign_launched`: El CMO avisa que una promoción ya está activa en POS y Kioscos.
  - `floor_push`: El CSO notifica a cajas para impulsar venta sugerida del producto.
- **`prioridad`**: `critica` | `alta` | `media`
- **`datos_payload`**: JSON con `product_ids`, `monto_inmovilizado_gs`, `descuento_max_pct`, `segmento_target`.
- **`estado`**: `propuesta` | `activa` | `cumplida` | `descartada`

---

## 4. Orquestador de Inteligencia Híbrida (`marketing_agent/agent_orchestrator.py`)

Siguiendo el patrón ReAct de `sales_agent`, el CMO cuenta con herramientas ejecutables (Tool Calling):

```python
TOOL_DEFINITIONS_MARKETING = [
    {
        "name": "get_cfo_directives",
        "description": "Obtiene las directivas activas de liquidez, sobre-stock y piso de margen emitidas por el CFO Virtual."
    },
    {
        "name": "get_rfm_segments",
        "description": "Calcula y retorna la segmentación RFM viva de clientes basada en cupones_clientes y sales (Champions, Dormidos, En Riesgo, Afines a Carnicería/Bebidas/Lácteos)."
    },
    {
        "name": "create_pos_promotion",
        "description": "Crea y activa una regla real de descuento en la tabla promotions para que se aplique automáticamente en el POS físico.",
        "parameters": {
            "nombre": "str",
            "tipo": "combo | porcentaje | bulto | cupon",
            "producto_ids": "list[str]",
            "descuento_pct": "float",
            "dias_vigencia": "int"
        }
    },
    {
        "name": "publish_kiosk_banner",
        "description": "Publica o actualiza un banner publicitario en los verificadores de precios del salón.",
        "parameters": {
            "titulo": "str",
            "subtitulo": "str",
            "descuento_texto": "str",
            "color": "str"
        }
    },
    {
        "name": "send_whatsapp_blast",
        "description": "Dispara una campaña segmentada vía Evolution API a los clientes del segmento target."
    },
    {
        "name": "get_campaign_roi_audit",
        "description": "Audita en tiempo real las ventas generadas por promociones activas y el margen resultante protegido."
    }
]
```

---

## 5. Diseño de la Experiencia de Usuario (UI: Sala de Comando Ejecutivo)

La interfaz en `MarketingAgentPage.tsx` se rediseña como una **Sala de Comando de Alta Densidad**:

1. **Header / Barra Tripartita Superior (Live Sync Status):**
   - **CFO:** Margen del mes (ej: 24.1%) vs Piso exigido (22.0%) | Liquidez en custodia.
   - **CMO:** Promociones activas en POS (X) | Clientes impactados hoy vía WhatsApp (Y).
   - **CSO:** Cumplimiento de meta de facturación diaria | Ticket promedio actual.
   - **Semáforo Tripartito:** Indicador visual de si los 3 agentes están alineados o si hay conflicto (ej: descuento excesivo que viola el piso del CFO).

2. **Pestañas de la Sala de Comando:**
   - 🎯 **Comando & Directivas (Acciones 1-Clic):** Tarjetas ejecutivas con acuerdos listos para aprobar (ej: "Monetizar ₲ 45M en Cervezas y Bebidas -> Activar Combo 2x1 en POS + Kiosco + WhatsApp").
   - 👥 **Audiencias & RFM Real:** Visualización de los 7.856 clientes categorizados (con barrios de PJC, consumo histórico y producto preferido derivado de `cupon_ticket_items`).
   - 🏷️ **Promociones en Caja (POS):** Lista interactiva de promociones vivas en la base de datos con interruptor de encendido/apagado instantáneo.
   - 🖥️ **Banners de Salón (Kioscos):** Gestión de banners que rotan en las terminales del salón de ventas.
   - 💬 **Sesión Estratégica con el CMO:** Chat autónomo ReAct con Qwen 2.5 + Gemini y ejecución de herramientas en vivo.

---

## 6. Criterios de Aceptación y Blindaje

1. **Cero Datos Hardcodeados:** Se eliminan todos los nombres ficticios (`Rodrigo Resquín`, `Yanina Eisenhut`, `42 VIPs`). Todo se calcula contra la base de datos de PostgreSQL.
2. **Blindaje de POS (Regla 1):** Las promociones se gestionan a través de la API y la tabla `promotions`, sin tocar archivos protegidos de `POS` ni Electron.
3. **Respeto a la Moneda y Números Enteros:** Todos los montos en Guaraníes se muestran sin decimales con `formatPYG()`.
4. **Tolerancia a Fallos:** Si el dev-server de Ollama o Gemini sufren interrupciones, el módulo recurre de inmediato a cálculos determinísticos SQL para no dejar la pantalla vacía.
