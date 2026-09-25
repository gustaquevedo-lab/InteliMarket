---
name: Field Force High-Utility
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#3e4a3d'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#6e7b6c'
  outline-variant: '#bdcaba'
  surface-tint: '#006e2d'
  primary: '#006b2c'
  on-primary: '#ffffff'
  primary-container: '#00873a'
  on-primary-container: '#f7fff2'
  inverse-primary: '#62df7d'
  secondary: '#505e80'
  on-secondary: '#ffffff'
  secondary-container: '#c8d7fe'
  on-secondary-container: '#4e5d7e'
  tertiary: '#3452c1'
  on-tertiary: '#ffffff'
  tertiary-container: '#506cdb'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#7ffc97'
  primary-fixed-dim: '#62df7d'
  on-primary-fixed: '#002109'
  on-primary-fixed-variant: '#005320'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#b7c6ed'
  on-secondary-fixed: '#0a1b39'
  on-secondary-fixed-variant: '#384667'
  tertiary-fixed: '#dde1ff'
  tertiary-fixed-dim: '#b8c4ff'
  on-tertiary-fixed: '#001453'
  on-tertiary-fixed-variant: '#173bab'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  display:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  headline-h1:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
  headline-h2:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-1:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-2:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
  currency-display:
    fontFamily: JetBrains Mono
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 26px
    letterSpacing: -0.02em
  currency-sm:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system delivers an operational, field-ready mobile environment built specifically for B2B route-to-market sales reps, merchandisers, and field supervisors across Latin American distribution channels. Operating as the boots-on-the-ground operational counterpart to the core corporate platform, the visual language balances high-velocity data entry, rugged field reliability, and sharp corporate authority.

The aesthetic blends **Modern Material Utility** with **High-Contrast Outdoor Readiness**. Field workers frequently transition between dark stockrooms, direct midday sunlight on retail curbs, and busy corner grocers (*despensas*, *bodegas*, and *tiendas de barrio*). Every touch target, visual divider, and numeric ledger prioritizes immediate legibility, zero tap ambiguity, and tactile operational feedback. The emotional response is one of velocity, non-fragility, and financial precision—giving field operators tools that feel reliable even in offline-first scenarios with patchy connectivity.

## Colors

The color palette is engineered for maximum outdoor legibility, battery efficiency, and instantaneous status comprehension under glaring daylight:

- **Primary Action (Vibrant Green 600 - `#16a34a`):** Governs primary workflows, order confirmations, successful barcode check-ins, and target achievement indicators. Paired with Green 500 (`#22c55e`) for active states and Green 100 (`#dcfce7`) for positive surface washes.
- **Brand Anchor & Structure (Deep Navy 900 - `#0f1f3d` & Navy 800 - `#1e3a5f`):** Deployed on fixed app bars, navigation drawers, customer route headers, and splash layers to preserve institutional lineage and visual gravity.
- **Secondary Accent (Blue 600 - `#1e40af`):** Identifies active navigation paths, secondary merchandising prompts, metadata tags, and synchronized data links.
- **Operational & Network Semantics:**
  - **Offline / Queued (`#78716c` Warm Sepia):** Crucial for field tracking; denotes pending synchronization, cached drafts, and non-blocking local commits.
  - **Danger (`#dc2626`):** Out of stock alerts, credit limits exceeded, and order cancellations.
  - **Warning (`#d97706`):** Near-expiry inventory, partial deliveries, and payment discrepancies.
  - **Neutral Surfaces (`#f8fafc` to `#ffffff`):** Pure stark backgrounds bounded by precise `#e2e8f0` borders to avoid washed-out screens outdoors.

## Typography

The typography architecture solves two high-stakes requirements in LATAM B2B sales: crisp legibility at arm's length, and unambiguous financial figures with large integer amounts (such as Paraguayan Guaraní `₲` running in hundreds of thousands or millions, alongside standard regional currencies).

- **Primary Typeface (`Inter`):** Selected for its tall x-height, neutral geometric proportions, and optical clarity on lower-spec mobile displays under outdoor conditions.
- **Monospaced Data & Currency (`JetBrains Mono`):** Dedicated to ledger units, SKU numbers, barcode readouts, and price tags. Fixed tabular numerals prevent horizontal shifting during rapid line-item quantity adjustments in the field.
- **Hierarchy Rules:**
  - Route summaries and daily sales quota progress use `display` and `headline-h1`.
  - Client names and visit checklist titles use `headline-h2`.
  - Catalog listings, order calculations, and monetary aggregates must render in `currency-display` or `currency-sm` with explicit currency glyph alignment.

## Layout & Spacing

Built strictly on an **8dp baseline grid** (with a secondary 4dp sub-unit for tight data chips and badge padding).

- **Handheld Rhythm:** 
  - Standard edge canvas margin is 16dp (`space-md`), keeping key interactive controls inside the natural ergonomic thumb sweep on standard 5.8" to 6.7" field devices.
  - Gaps between route store cards, catalog line items, and audit checkpoints are set to 8dp (`space-sm`) or 12dp to maximize vertical screen density without causing miss-taps.
- **Touch Boundaries:** All field touch targets adhere to a minimum of 48×48dp physical bounds, regardless of visual icon size.
- **Form-Factor Adaptability:**
  - **Phone (Default):** Single-column stacked lists with sticky bottom operational footers containing primary checkout/commit CTAs.
  - **Field Tablet / Rugged Terminal:** Splits into a master-detail 40/60 view (store itinerary list on the left, order entry matrix or planogram survey on the right) using a 24dp gutter.

## Elevation & Depth

Visual depth combines crisp card boundaries with subtle, high-performance ambient shadows to prevent surface bleeding in bright outdoor light:

- **Level 0 (Flat / Canvas):** Surface base `#f8fafc`. Used for application backgrounds and non-interactive container trays.
- **Level 1 (Card & Content Blocks):** Pure white `#ffffff` elevated with a combined `0 1px 3px rgba(15, 31, 61, 0.08)` shadow and an explicit `1px solid #e2e8f0` structural outline. The physical outline guarantees card separation even when the screen is viewed with sunglasses or under direct sunlight.
- **Level 2 (Sticky Headers & Quick Filters):** `0 4px 6px -1px rgba(15, 31, 61, 0.12)`, anchored with high contrast to demarcate floating customer summary bars.
- **Level 3 (Modals, Bottom Sheets & Barcode Scanner Viewfinders):** `0 10px 15px -3px rgba(15, 31, 61, 0.20)` with a 40% Navy 900 scrim overlay.
- **Queued & Offline Tonal Depth:** Offline status banners strip ambient elevation and adopt a flattened warm sepia border (`#d6d3d1`) with a subtle `#f5f5f4` fill to convey local-only caching.

## Shapes

The design system standardizes on a **balanced 12dp radius** for all major cards and modals, balancing modern ergonomics with dense industrial utility:

- **Default Components (Inputs, Buttons, Cards):** 12dp (`rounded-lg`) corner radii create a friendly yet controlled container that prevents visual corner clipping on rounded hardware screens.
- **Small Indicators & Micro-Chips:** 6dp to 8dp (`rounded-sm` / `rounded-md`) for SKU badges, stock status tags, and route sequencing numbers.
- **Pill Geometry (Full Rounded):** Reserved exclusively for persistent floating action counters, synchronization state pills, and quantity stepper increments.

## Components

### Buttons & Action Bars
- **Primary CTA:** Solid Vibrant Green (`#16a34a`), 52dp height, bold label in pure white, 12dp border radius. Emits an immediate tactile haptic feedback on touch.
- **Secondary CTA:** Deep Navy 900 outline (`#0f1f3d`) with 1.5dp stroke or soft green tinted wash (`#dcfce7`) with `#15803d` text for secondary order actions.
- **Sticky Field Footer:** Fixed persistent bottom container housing the active total in `currency-display` alongside the primary submit action.

### Metric & Status Chips
- **Sync & Connectivity Pill:** Displays offline sync status. When queued, displays a Warm Sepia (`#78716c`) outline and icon with text *"3 pedidos pendientes de sincronización"*. When live, shifts to a discrete `#16a34a` micro-dot.
- **Route Status Badges:** Compact labels for store states (*Visitado*, *En Ruta*, *Pendiente*, *No Compra*) with dedicated color pairings and high-contrast text.

### Form Inputs & Quantity Adjusters
- **Steppers:** Rugged increment/decrement stepper controls with oversized 44×44dp plus/minus touch pads and a central monospaced counter to avoid keyboard popups when adjusting bulk cases.
- **Search & Barcode Field:** Inputs feature embedded camera-scanner triggers directly in the trailing icon slot, styled with a distinct Navy 800 stroke to encourage hardware or camera-assisted lookup.

### Cards & Route List Items
- **Client Route Card:** Features a 12dp radius white card with a 4dp vertical accent strip on the left edge indicating client tier or pending delivery status. Houses customer legal name, tax ID (RUC/NIT), last purchase delta, and a one-tap GPS navigation launch icon.
- **SKU Catalog Row:** Three-tier vertical hierarchy: brand/product name (`body-2`), pack configuration/stock alert (`label`), and monospaced unit price with tax breakdown.

### Modals & Verification Sheets
- **Visit Check-in / Checkout Dialog:** Bottom sheet containing GPS accuracy confirmation, photo audit attachment pill, and a clear two-button decision matrix.