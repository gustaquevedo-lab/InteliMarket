---
name: Field Force Tactical Dark
colors:
  surface: '#0d141d'
  surface-dim: '#0d141d'
  surface-bright: '#333a44'
  surface-container-lowest: '#080f17'
  surface-container-low: '#151c25'
  surface-container: '#192029'
  surface-container-high: '#232a34'
  surface-container-highest: '#2e353f'
  on-surface: '#dce3f0'
  on-surface-variant: '#bccbb9'
  inverse-surface: '#dce3f0'
  inverse-on-surface: '#2a313b'
  outline: '#869585'
  outline-variant: '#3d4a3d'
  surface-tint: '#4ae176'
  primary: '#4be277'
  on-primary: '#003915'
  primary-container: '#22c55e'
  on-primary-container: '#004b1e'
  inverse-primary: '#006e2f'
  secondary: '#b8c4ff'
  on-secondary: '#002584'
  secondary-container: '#173bab'
  on-secondary-container: '#a0b1ff'
  tertiary: '#aec8f5'
  on-tertiary: '#133155'
  tertiary-container: '#93add9'
  on-tertiary-container: '#254166'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#6bff8f'
  primary-fixed-dim: '#4ae176'
  on-primary-fixed: '#002109'
  on-primary-fixed-variant: '#005321'
  secondary-fixed: '#dde1ff'
  secondary-fixed-dim: '#b8c4ff'
  on-secondary-fixed: '#001453'
  on-secondary-fixed-variant: '#173bab'
  tertiary-fixed: '#d5e3ff'
  tertiary-fixed-dim: '#adc8f5'
  on-tertiary-fixed: '#001c3b'
  on-tertiary-fixed-variant: '#2d486d'
  background: '#0d141d'
  on-background: '#dce3f0'
  surface-variant: '#2e353f'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  title-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  title-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 22px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
  currency-display:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-tablet: 1.25rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-tablet: 1.5rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system is engineered specifically for high-velocity B2B field sales and logistics operations across Latin America, functioning reliably under challenging real-world conditions—from glaring equatorial sunlight to dimly lit rural depots and late-night fulfillment centers. 

The aesthetic is functional, tactical, and robust: a purposeful fusion of **Modern Utilitarian** and **High-Contrast Digital HUD** elements. It prioritizes legibility, touch accuracy under pressure, and rapid cognitive parsing above decorative excess. 

The emotional tone balances institutional reliability with operational vigor. Field representatives need to feel empowered, fast, and secure when logging high-volume Guaraní (₲) inventory orders, capturing physical signatures, and verifying route inventory under constrained connectivity and harsh ambient light.

## Colors

The palette relies on deep abyssal blues and slate tones rather than pure carbon blacks to preserve situational depth while minimizing eye strain and glare outdoors.

- **Primary (`#22c55e`)**: Tactical vivid emerald. Serves as the primary beacon for focal actions (Order Submission, Barcode Scan, Sync Status, Key Confirmations). Yields an AAA-compliant contrast ratio against deep dark canvases.
- **Primary Dim / Hover (`#16a34a`)**: Anchors active pressed states, selected list items, and interactive highlights.
- **Secondary (`#1e40af`)**: Deep operational cobalt. Governs structural navigational tabs, order status tags, and secondary workflows.
- **Tertiary (`#1e3a5f`)**: Deep navy shadow. Utilized for passive containers, table headers, and contextual metadata surfaces.
- **Surfaces & Tiers**:
  - `canvas`: `#0a0f1a` (Deepest backdrop)
  - `surface-base`: `#111827` (Panel backplates, navigation bars, modal scaffolding)
  - `surface-card`: `#1f2937` (Floating transaction cards, client manifests, interactive targets)
- **Borders & Separation (`#374151`)**: Defined, structural borders ensuring clear spatial demarcation under glare.
- **Text & Data Hierarchy**:
  - Primary: `#f9fafb` (Headlines, dense SKU labels, Guaraní pricing figures)
  - Secondary/Muted: `#9ca3af` (Metadata, units of measure, tax labels, timestamps)

## Typography

This design system uses **Inter** across all typographic applications for its exceptional tabular figures, neutral legibility, and tall x-height.

### Financial and Numeric Rules
Field sales in Paraguay handle millions of Guaraníes routinely (e.g., `₲ 14.850.000`).
- Always enforce **tabular figures** (`font-feature-settings: "tnum" on, "cv05" on`) for inventory counts, prices, discounts, and order subtotals to avoid horizontal jumping during rapid entry.
- The currency symbol (`₲`) must sit adjacent to the figure with a non-breaking half-space.
- Micro metadata (batch numbers, SKU codes, geo-coordinates) uses `label-sm` in full uppercase with positive letter spacing (`0.04em`) to ensure legibility when reading ruggedized handheld tablets.

## Layout & Spacing

Field operations require an input architecture tolerant of physical motion, vibration, and one-handed thumb interaction.

- **Layout Model**: Fluid grid with dynamic touch target clamping.
  - Mobile (Handheld terminals/smartphones): Single column or 2-column KPI split; 16px outer margin; gutters fixed at 16px.
  - Tablet (Mounted in delivery trucks): 6-column fluid structure; 20px margins; allows side-by-side catalog browsing and persistent cart panels.
  - Desktop / Depot Station: 12-column structured view with fixed navigation sidebar (260px) and multi-pane inventory tables.
- **Ergonomic Safe Zone**: Primary transactional controls (e.g., "Confirm Delivery", "Scan Next SKU") are anchored to a sticky bottom container on mobile form factors, elevated with a 48px minimum hit target (recommended 56px for gloved interactions).
- **Rhythm**: Spacing follows a 4px baseline, relying mainly on `space-sm` (8px) for tightly coupled form elements and `space-md` (16px) between independent data cards.

## Elevation & Depth

To maximize outdoor visibility and avoid murky grey cast on low-brightness screens, visual depth is achieved via **structural surface layering and crisp borders**, not heavy drop shadows.

- **Surface Layering**:
  - `Level 0 (Canvas)`: `#0a0f1a` (Base environment).
  - `Level 1 (Structural panels)`: `#111827` (Sidebars, app bars, bottom navigation).
  - `Level 2 (Cards & Active targets)`: `#1f2937` with a persistent 1px solid `#374151` border.
  - `Level 3 (Modals, Overlays, Floating Menus)`: `#1f2937` with a 1px solid `#22c55e` border (or `#1e40af` for informational alerts) plus an ambient dark drop shadow: `0 12px 32px -4px rgba(0, 0, 0, 0.75)`.
- **Focus & Selection**:
  Active cards and selected line items discard drop shadows in favor of a 2px inner or outer accent border in `#22c55e`, coupled with an ultra-subtle primary tint overlay (`rgba(34, 197, 94, 0.08)`).

## Shapes

This design system uses a **Soft (Level 1)** geometric standard. Sharp technical edges are lightly radiused to withstand dense data packing without looking decorative or delicate.

- **Inputs, Buttons, Cards**: 4px (`0.25rem`) standard corner radius.
- **Containers, Modals, Bulk Sections**: 8px (`0.5rem`).
- **Status Chips, Badges**: 4px (`0.25rem`) or completely pill-shaped (`9999px`) strictly for offline/online synchronization status tags.

## Components

### Buttons
- **Primary Action (Confirm, Sync, Finalize Sale)**: Background `#22c55e`, text `#0a0f1a` (bold weight for maximum punch), minimum height 48px. Hover: `#16a34a`. Active: Scale to 98% with an inset 1px black stroke.
- **Secondary Action (Add Line Item, Route Plan)**: Background `#1e3a5f`, border 1px solid `#1e40af`, text `#f9fafb`.
- **Ghost / Destructive**: Background transparent, border 1px solid `#374151`, text `#9ca3af`. Destructive uses text `#ef4444` with border `#dc2626`.

### Inputs & Quantity Pickers
- **Text & Search Fields**: Background `#111827`, border 1px solid `#374151`, text `#f9fafb`, placeholder `#9ca3af`. On focus: 1.5px border `#22c55e`.
- **Numeric Stepper (SKU Quantities)**: Heavy touch targets. Decrement/Increment buttons are a minimum of 44x44px with a centered tabular figure displaying large text (`18px bold`). Guaraní input fields automatically format thousand separators (`.`).

### Cards & Manifest Rows
- **Container**: Surface `#1f2937`, border 1px solid `#374151`, padding `space-md` (16px).
- **Client Route Card**: Left border strip (4px solid) denoting status: `#22c55e` (Visited/Paid), `#1e40af` (Next Stop), `#9ca3af` (Pending), `#ef4444` (Rejected/Issue).

### Chips & Badges
- **Status Badges**: Subdued tinted backgrounds with high-contrast text. Example: `background: rgba(34, 197, 94, 0.15); border: 1px solid #22c55e; color: #22c55e;` for "ENTREGADO" (Delivered).

### Offline Sync Status Banner
- Top-anchored operational indicator:
  - Online: Discrete `#22c55e` dot + "En Línea".
  - Offline / Local Storage: Background `#1e3a5f` with `#f9fafb` text and an amber/cobalt pulsing glyph indicating pending Guaraní transactions queued for back-office synchronization.