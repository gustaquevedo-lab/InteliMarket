# 👗 Boutique / Indumentaria — Diseño del Módulo

## 🎯 Visión
Un módulo que transforma la experiencia de compra de moda en Paraguay, combinando **tecnología de vanguardia** (AI, AR, clienteling) con la **calidez del servicio personalizado** que caracteriza a las boutiques paraguayas. Inspirado en Nordstrom, Saks Fifth Avenue, y Zara, pero con sabor 100% Paraguay.

---

## 🔍 Investigación: Lo que Hace la Industria

### Dolores del Dueño de Boutique (Lo que Nosotros Resolvemos)

| Dolor | Impacto | Solución InteliMarket |
|-------|---------|----------------------|
| **Inventario por talla/color es un caos** | SKUs se multiplican exponencialmente. Un vestido en 5 talles × 4 colores = 20 variantes | Matriz de variantes inteligente con visual matrix |
| **Devoluciones masivas (30-45% online)** | Por mala talla, no por producto | AI Size Recommender + Virtual Try-On |
| **Markdowns tardíos = stock muerto** | 25-40% del inventario no se vende a precio completo | Smart Markdown Engine con IA |
| **Sin datos de cliente** | No sabe qué talla compra, qué colores prefiere | Clienteling 360° + Purchase DNA |
| **Temporadas caóticas** | Colecciones se superponen, no hay calendario | Seasonal Calendar automatizado |
| **WhatsApp como canal principal** | Pedidos por chat sin control | WhatsApp CRM integrado + Catálogo público |
| **Sin fidelización** | Clientes van y vienen | Loyalty Program con tiers de moda |
| **Competencia con Zara/H&M** | No pueden competir en precio | Competir en **experiencia y servicio personal** |

### Lo que Hacen los Mejores (Benchmarking)

| Solución | Quién lo Hace | Nosotros |
|----------|---------------|----------|
| **AI Size Recommendation** | True Fit, Faslet, Fit Analytics | ✅ Size Advisor con ML local |
| **Virtual Try-On (AR)** | Zara, Saks Fifth, Geenee | ✅ Probador Virtual Web AR |
| **Clienteling App** | Nordstrom, Saks | ✅ Clienteling 360° con WhatsApp |
| **Smart Markdowns** | Stitch Fix, The RealReal | ✅ Markdown Engine con demanda |
| **Loyalty Program** | Sephora, Nike | ✅ Loyalty con tiers de moda |
| **Personal Stylist AI** | Stitch Fix, Stitch Fix AI | ✅ Asistente de Estilo IA |
| **Visual Search** | ASOS, Pinterest | ✅ Búsqueda Visual por Foto |
| **Gift Registry** | Nordstrom, Dillard's | ✅ Registro de Regalos |
| **Sustainability Score** | Eileen Fisher, Patagonia | ✅ Score de Sostenibilidad |
| **Social Proof** | Fashion Nova, Shein | ✅ Reviews + Fotos de Clientes |

---

## 🏗️ Arquitectura del Módulo

### Modelos de Base de Datos (bt_* prefix)

```
1.  bt_collections          — Colecciones por temporada
2.  bt_product_variants     — Variantes talla/color/material (matriz)
3.  bt_seasons              — Temporadas (verano/invierno/primavera/otoño)
4.  bt_size_charts          — Tablas de talles por categoría
5.  bt_customer_profiles    — Perfiles de estilo del cliente
6.  bt_customer_measurements— Medidas corporales del cliente
7.  bt_style_preferences    — Preferencias de estilo (colores, marcas, estilos)
8.  bt_fitting_room         — Sesiones de probador (reserva prendas)
9.  bt_fitting_items        — Prendas en el probador
10. bt_try_on_sessions      — Sesiones de try-on virtual
11. bt_markdown_rules       — Reglas de markdown automático
12. bt_markdown_history     — Historial de markdowns
13. bt_gift_registries      — Regalos (bodas, quinceañeros, cumpleaños)
14. bt_gift_items           — Items en el registro
15. bt_loyalty_tiers        — Niveles de fidelización (Bronce/Plata/Oro/Diamante)
16. bt_loyalty_points       — Puntos acumulados/canjeados
17. bt_outfit_recommendations— Outfits sugeridos por IA
18. bt_outfit_items         — Items que componen un outfit
19. bt_style_consultations  — Consultas con estilista personal
20. bt_visual_searches      — Búsquedas visuales (foto → productos similares)
21. bt_sustainability_scores— Scores de sostenibilidad por producto
22. bt_social_proof         — Reviews con fotos estilo Instagram
23. bt_trend_alerts         — Alertas de tendencia por región/ciudad
24. bt_inventory_matrix     — Vista matricial de stock (talla×color)
25. bt_pos_sessions         — Sesiones POS con probador
```

### Total: 25 modelos, ~120 columnas

---

## 🚀 Funcionalidades Clave (Las que Deslumbran)

### 1. 🧬 Purchase DNA (ADN de Compra)
```python
# Cada cliente tiene un "ADN" que analiza:
purchase_dna = {
    "colores_favoritos": ["negro", "blanco", "dorado"],
    "talles_comunes": {"remera": "M", "pantalon": "38", "vestido": "S"},
    "estilos": ["casual_elegante", "minimalista"],
    "rangos_precio": {"min": 150000, "max": 800000, "promedio": 350000},
    "frecuencia_compra": "cada_3_semanas",
    "ultima_temporada": "primavera_2026",
    "items_favoritos": 12,
    "monto_total_gastado": 4200000,
    "score_fidelidad": 87,  # 0-100
}
```
**Innovación**: El sistema aprende automáticamente qué busca el cliente y le sugiere prendas *antes* de que las pida.

### 2. 👗 Probador Virtual (AR Try-On)
```
Funcionalidad:
- El cliente sube una foto o usa la cámara
- El sistema superpone la prenda virtualmente
- Sugiere talles basado en sus medidas conocidas
- Muestra la prenda en diferentes colores
- Reduce devoluciones hasta 40%

Tecnología:
- WebAR (sin app, funciona en navegador)
- 3D body mapping desde foto
- Physics simulation (cómo cae la tela)
```

### 3. 🎯 Size Advisor Inteligente
```python
def recommend_size(customer_id, product_id):
    """
    Combina:
    1. Medidas conocidas del cliente
    2. Tabla de talles del producto
    3. Historial de devoluciones por talla
    4. Feedback de otros clientes similares
    5. ML model entrenado con datos de la boutique
    """
    measurements = get_measurements(customer_id)
    size_chart = get_size_chart(product_id)
    returns_history = get_returns_by_size(customer_id, product_category)
    
    score = calculate_fit_score(measurements, size_chart, returns_history)
    
    return {
        "talla_recomendada": "M",
        "confianza": 92,  # porcentaje
        "alternativa": "S (si prefieres ajustado)",
        "razon": "Basado en tus medidas y preferencias anteriores"
    }
```

### 4. 📅 Seasonal Calendar Automatizado
```
Ciclo de vida de una colección:
1. CREAR colección → Asociar temporada
2. LANZAR → Notificar a clientes VIP
3. MONITOREAR → Venta por variante, velocidad de rotación
4. SUGERIR markdown → Cuando velocidad < umbral
5. REPLENISH → Si hay demanda insatisfecha
6. CERRAR → Liquidar restos, analizar ROI

Automatización:
- Alertas automáticas cuando una talla se agota
- Sugerencia de reorden basada en demanda
- Markdown automático cuando >30 días sin venta
- Notificación WhatsApp a clientes interesados
```

### 5. 💎 Loyalty Program de Moda
```
Tiers:
┌─────────────────────────────────────────────────────┐
│  BRONCE      PLATA       ORO         DIAMANTE      │
│  0-999 pts   1000-4999   5000-14999  15000+        │
│                                                      │
│  • 5% dto   • 10% dto   • 15% dto  • 20% dto     │
│  • Birthday  • Early     • Personal • Private      │
│    10% dto    access      stylist     shopping     │
│  • Free      • Free      • VIP       • Exclusive   │
│    wrapping    alterations events      collections  │
│  • Points    • 2x pts   • 3x pts   • 5x pts     │
│    x1         weekends    siempre    siempre       │
└─────────────────────────────────────────────────────┘
```

### 6. 🤖 Asistente de Estilo IA (WhatsApp)
```
Flujo:
1. Cliente envía foto por WhatsApp: "¿Con qué combino esto?"
2. IA analiza la foto (color, estilo, ocasión)
3. Sugiere 3 outfits completos de la tienda
4. Incluye precios y disponibilidad
5. Reserva prendas en probador
6. Agenda cita con estilista si quiere

Integración:
- WhatsApp Business API (ya tenemos IntelliZapp)
- Computer Vision para análisis de fotos
- Recommendation engine para outfits
```

### 7. 🎁 Registro de Regalos
```
Casos de uso:
- Quinceañera: Lista de regalos con tallas específicas
- Boda: Registro de pareja con preferencias
- Cumpleaños: Wishlist compartida con amigos
- Baby Shower: Lista de ropa para bebé

Funciones:
- Link público para compartir
- Código QR en tarjeta física
- Notificación cuando se compra un item
- Reserva temporal de items (48hs)
- Sugerencias alternativas si no hay talla
```

### 8. 📊 Dashboard Ejecutivo de Moda
```
KPIs Específicos:
- Sell-through rate por colección
- Average days to sell
- Return rate por talla/color
- Customer lifetime value (CLV)
- Markdown absorption rate
- Inventory turnover por categoría
- Trend alignment score
- Personal stylist revenue attribution
- Loyalty program ROI
- WhatsApp conversion rate
```

### 9. 🔄 Markdown Engine Inteligente
```python
def calculate_optimal_markdown(product_id):
    """
    Algoritmo que balancea:
    - Velocidad de venta vs. objetivo
    - Días desde lanzamiento
    - Stock restante vs. demanda estimada
    - Competencia de precio
    - Margen mínimo aceptable
    """
    sell_through = get_sell_through_rate(product_id)
    days_since_launch = get_days_since_launch(product_id)
    stock_remaining = get_stock(product_id)
    demand_forecast = forecast_demand(product_id)
    min_margin = get_min_margin(product_id)
    
    if sell_through < 0.3 and days_since_launch > 30:
        # Markdown agresivo
        discount = calculate_aggressive_markdown(stock_remaining, demand_forecast, min_margin)
    elif sell_through < 0.5 and days_since_launch > 21:
        # Markdown moderado
        discount = calculate_moderate_markdown(stock_remaining, demand_forecast, min_margin)
    else:
        # Mantener precio
        discount = 0
    
    return {
        "descuento_sugerido": discount,
        "nuevo_precio": current_price * (1 - discount),
        "razon": f"Sell-through {sell_through*100:.0f}% en {days_since_launch} días",
        "impacto_margen": calculate_margin_impact(discount)
    }
```

### 10. 🌿 Sustainability Score
```
Score por producto (0-100):
- Materiales (0-30): Orgánico, reciclado, convencional
- Producción (0-25): Local vs importado, condiciones laborales
- Transporte (0-20): km recorridos, emisiones CO2
- Empaque (0-15): Reciclable, biodegradable
- Durabilidad (0-10): Calidad del material, garantía

Display:
🌿 85/100 — "Algodón orgánico, producido en Paraguay"
```

### 11. 📱 Social Proof & UGC (User Generated Content)
```
Funciones:
- Reviews con fotos (estilo Instagram)
- "Looks de clientes" (galería estilo Pinterest)
- Before/After de transformaciones
- Badges: "Top Reviewer", "Style Icon"
- Feed de tendencias de la comunidad
- Hashtag tracking: #MiBoutiqueLook
```

### 12. 🎨 Visual Search (Búsqueda por Foto)
```
Flujo:
1. Cliente toma foto de una prenda que le gusta (en la calle, en Instagram)
2. Sube la foto a la app/web
3. IA encuentra prendas similares en la tienda
4. Ordena por: precio, disponibilidad, similitud
5. Muestra opciones con talla disponible
```

---

## 🗺️ Roadmap de Implementación

### Fase 1 — Core Boutique (Semanas 1-4) 🏗️
```
Backend:
- Modelos: bt_collections, bt_product_variants, bt_seasons, bt_size_charts
- CRUD completo de variantes talla/color
- Matriz de inventario visual
- Integración con products existentes
- Temporadas y colecciones

Frontend:
- Gestión de variantes con visual matrix
- Calendar de temporadas
- Vista de colecciones
```

### Fase 2 — Cliente Inteligente (Semanas 5-8) 🧠
```
Backend:
- Modelos: bt_customer_profiles, bt_customer_measurements, bt_style_preferences
- Purchase DNA engine
- Size Advisor algorithm
- Perfiles de estilo

Frontend:
- Clienteling dashboard
- Perfil de cliente con ADN
- Size recommendation widget
```

### Fase 3 — Experiencia Premium (Semanas 9-12) ✨
```
Backend:
- Modelos: bt_fitting_room, bt_loyalty_*, bt_gift_registries
- Probador virtual (integración WebAR)
- Loyalty program completo
- Registro de regalos

Frontend:
- POS con probador
- Dashboard loyalty
- Gift registry page
```

### Fase 4 — IA & Analytics (Semanas 13-16) 🤖
```
Backend:
- Modelos: bt_outfit_*, bt_visual_searches, bt_markdown_*
- Asistente de estilo IA
- Smart Markdown Engine
- Visual Search
- Sustainability Score

Frontend:
- Chat de estilo IA
- Dashboard de markdowns
- Búsqueda por foto
- Social proof gallery
```

---

## 🇵🇾 Adaptaciones Paraguay

### Integraciones Locales
- **WhatsApp Business API**: Ya tenemos IntelliZapp → Clienteling por WhatsApp
- **Pagopar/Kuapay**: Pagos en cuotas sin interés para compras >₲500.000
- **DINAVISA**: Gift cards digitales
- **JIFE**: Reportes fiscales para boutiques
- **Cédula/RUC**: Auto-detect para facturación
- **PYG**: Precios en guaraníes con formato local

### Cultura Local
- **Quinceañera**: Registro de regalos específico
- **San Lorenzo/Asunción**: Zonas de delivery diferenciadas
- **Temporadas locales**: Verano (Oct-Mar), Invierno (Abr-Sep)
- **Eventos**: Encuentro de Moda, Feria del Sol, Festival de la Playa
- **Idioma**: Guaraní para el chatbot de estilo

### Pagos
- **Cuotas**: 3/6/12 cuotas sin interés con tarjetas habilitadas
- **QR Pagopar**: Pago instantáneo
- **Transferencia**: CTA bancaria + confirmación automática
- **Efectivo**: Descuento 10% por pago al contado
- **Crypto**: Opcional (USDT/PyUS)

---

## 📊 Métricas de Éxito

| Métrica | Objetivo | Impacto |
|---------|----------|---------|
| Return rate | <15% (vs 30-45% industria) | -15% costos |
| Sell-through rate | >70% a precio completo | +25% margen |
| Customer retention | >60% recompra en 90 días | +40% CLV |
| Markdown absorption | <20% del inventario | +15% margen |
| WhatsApp conversion | >15% de consultas a venta | +20% revenue |
| Loyalty enrollment | >40% de clientes activos | +30% frecuencia |
| Size recommendation accuracy | >90% satisfacción | -25% devoluciones |

---

## 🎨 Identidad Visual

### Paleta de Colores (Boutique)
```
Primary:    #ec4899 (Pink 500) — Elegancia, feminidad
Secondary:  #8b5cf6 (Violet 500) — Creatividad, lujo
Accent:     #f59e0b (Amber 500) — Exclusividad, premium
Background: #fdf2f8 (Pink 50) — Calidez, suavidad
Text:       #1e1b4b (Indigo 950) — Profesionalismo
```

### Iconografía
```
👗 Vestido — Colecciones
👜 Bolso — Accesorios
👟 Zapatillas — Calzado
💄 Maquillaje — Belleza
🎁 Regalo — Gift Registry
✨ Estrella — Tendencias
🌿 Hoja — Sostenibilidad
💬 Chat — Asistente IA
📱 Foto — Visual Search
💎 Diamante — Loyalty Diamante
```

---

## 🔗 Integración con Módulos Existentes

| Módulo | Integración |
|--------|-------------|
| **Products** | Variantes talla/color se extienden de products existentes |
| **Inventory** | Stock por variante, movimientos por talla/color |
| **Customers** | Purchase DNA se enriquece con historial de compras |
| **Sales** | POS con probador, cuotas, gift wrapping |
| **Marketing** | Campañas por estilo, segmentación por preferencias |
| **WhatsApp/IntelliZapp** | Clienteling, asistente de estilo, alertas stock |
| **SIFEN** | Facturación electrónica para boutiques |
| **Delivery** | Envío de prendas con seguro de moda |
| **Financial** | Cuotas, crédito interno, loyalty points |

---

*Última actualización: 2026-06-06*
*Estado: Diseño completo, listo para implementación*
