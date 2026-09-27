# Inteliforce Copiloto Táctico B2B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Inteliforce mobile application into a cutting-edge "Copiloto Táctico B2B" sales engine with UI/UX Pro Max standards, attendance-based commercial lock, interactive route mapping, Marco AI 1-click reorder, themed catalog with category filters, and daily pacing/commission visualizations.

**Architecture:** The client-side mobile app (React Native / Expo SDK 57) consumes the high-speed FastAPI endpoints on `minisforum-ia`. A centralized `useAttendanceGuard` enforces the commercial gatekeeper rule across screens. Navigation offers a dual [Lista / Mapa] toggle using `react-native-maps`, the Customer 360 screen activates Marco AI with one-tap cart hydration, the catalog adopts full dynamic theme tokens with category chips, and the Metas dashboard computes real-time daily run-rate and commission projections.

**Architecture Diagram:**

```mermaid
graph TD
    subgraph "Inteliforce Mobile Frontend (Expo SDK 57)"
        A[Asistencia /attendance] -->|estado_jornada| B[useAttendanceGuard]
        B -->|Gatekeeper Lock| C[Mi Ruta /index.tsx]
        B -->|Gatekeeper Lock| D[Clientes 360 /clientes]
        
        C -->|Toggle View| C1[Lista Secuencial #1..#N]
        C -->|Toggle View| C2[Mapa Satelital con Pines]
        
        D -->|1-Click Sugerido| E[Toma de Pedidos /pedido/index]
        E -->|Categorías & Stepper Háptico| F[Confirmar Pedido /confirmar]
        F -->|Online/Offline SQLite| G[Sync Queue]
        
        H[Metas /metas.tsx] -->|Pacing & Run-rate| I[Estimador de Comisiones]
    end

    subgraph "Backend API (FastAPI @ minisforum-ia)"
        J[/api/v1/inteliforce/me/routes/today]
        K[/api/v1/inteliforce/customers/:id/360]
        L[/api/v1/inteliforce/products]
        M[/api/v1/inteliforce/attendance/today]
    end

    C1 --> J
    C2 --> J
    D --> K
    E --> L
    A --> M
```

**Tech Stack:** React Native, Expo SDK 57, Expo Router, TypeScript, Zustand, TanStack Query, Expo SQLite, Expo Haptics, react-native-maps, FlashList, FastAPI, PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-09-27-inteliforce-copiloto-tactico-design.md`

## Global Constraints
- **Strictly on branch `vertical/distribuidora`**. Prohibited from branch switching or stash without explicit commit.
- **Untouchable files:** `ui-web/src/pages/Dashboard.tsx` and `ui-web/src/components/Layout.tsx` MUST NOT be touched under any circumstance.
- **Currency formatting:** Strictly Guaraníes formatted with `formatGS(amount)` (thousands separated by dot, zero decimals).
- **TypeScript verification:** Every task must pass `npx tsc --noEmit` in `inteliforce/` with 0 errors before marking complete.

---

### Task 1: UI/UX Pro Max Color Tokens & Theme Refinement

**Files:**
- Modify: `inteliforce/constants/colors.ts`
- Modify: `inteliforce/hooks/useTheme.ts`

- [ ] **Step 1:** Verify existing theme tokens in `colors.ts` and add missing elevated tokens (`cardNavy: '#1E293B'`, `midnightBackground: '#0F172A'`, `satelliteCyan: '#38BDF8'`, `emeraldActive: '#10B981'`).
- [ ] **Step 2:** Ensure contrast ratios conform to WCAG AAA for both Light and Dark modes.
- [ ] **Step 3:** Run `npx tsc --noEmit` in `inteliforce/` to verify zero type regressions.
- [ ] **Step 4:** Commit changes: `git commit -m "feat(theme): refine UI/UX Pro Max color tokens and elevation states"`.

---

### Task 2: Attendance Commercial Gatekeeper Hook & Banner Component

**Files:**
- Create: `inteliforce/hooks/useAttendanceGuard.ts`
- Create: `inteliforce/components/ui/JornadaGateBanner.tsx`

- [ ] **Step 1:** Implement `useAttendanceGuard.ts` subscribing to `['attendance-today']` query. Expose `isJornadaActiva` (boolean), `loadingAttendance`, and helper `guardAction(callback, alertMessage)`.
- [ ] **Step 2:** Implement `JornadaGateBanner.tsx` displaying a high-contrast tactical banner when `isJornadaActiva` is false, with an icon, explanatory copy, and a button navigating to `/(vendedor)/asistencia`.
- [ ] **Step 3:** Run `npx tsc --noEmit` in `inteliforce/` to verify zero compiler errors.
- [ ] **Step 4:** Commit changes: `git commit -m "feat(attendance): add useAttendanceGuard hook and JornadaGateBanner component"`.

---

### Task 3: Mi Ruta Dual [Lista / Mapa] & Navigation Overhaul

**Files:**
- Create: `inteliforce/components/visita/RouteMapView.tsx`
- Modify: `inteliforce/app/(vendedor)/index.tsx`
- Modify: `inteliforce/components/visita/VisitCard.tsx`

- [ ] **Step 1:** In `VisitCard.tsx`, ensure pills wrap cleanly, touch targets are at least 48dp, and display distance to current location when user location is available.
- [ ] **Step 2:** Build `RouteMapView.tsx` using `react-native-maps` with custom circular markers numbered by `orden_visita` (#1, #2, #3...), colored by state (blue/cyan for pending, green for completed, amber/red for debts/alerts), and a bottom swipeable client preview card.
- [ ] **Step 3:** In `app/(vendedor)/index.tsx`, insert animated segmented control `[ Lista ]` / `[ Mapa ]`, mount `JornadaGateBanner` when attendance is inactive, and wire conditional rendering between list and map.
- [ ] **Step 4:** Run `npx tsc --noEmit` in `inteliforce/` to verify zero errors.
- [ ] **Step 5:** Commit changes: `git commit -m "feat(routes): implement dual List/Map view and integrate attendance gatekeeper in Mi Ruta"`.

---

### Task 4: Ficha 360 & Copiloto Marco IA 1-Click Hydration

**Files:**
- Modify: `inteliforce/app/(vendedor)/clientes/[id].tsx`
- Modify: `inteliforce/hooks/useVisit.ts`

- [ ] **Step 1:** In `useVisit.ts`, add helper function `hydrateCartFromSuggestions(items: Array<{ productId: string, cantidad: number, precio: number, nombre: string }>)`.
- [ ] **Step 2:** In `clientes/[id].tsx`, redesign the Marco IA Hero card with Tactical Dark gradient, risk level badge, days without purchase alert, and prominent action button: *"⚡ Cargar Pedido Sugerido por Marco"*.
- [ ] **Step 3:** Hook button to hydrate the cart and navigate to `/(vendedor)/pedido/confirmar` with haptic feedback `haptic.success()`.
- [ ] **Step 4:** Elevate the financial health section (credit limit bar, checks in wallet, rejected checks, pending bills with days past due).
- [ ] **Step 5:** Run `npx tsc --noEmit` in `inteliforce/` to verify zero errors.
- [ ] **Step 6:** Commit changes: `git commit -m "feat(customer360): add Marco AI 1-click cart suggestion and financial health widget"`.

---

### Task 5: B2B Product Catalog, Category Chips & Haptic Stepper

**Files:**
- Modify: `inteliforce/app/(vendedor)/pedido/index.tsx`
- Modify: `inteliforce/components/pedido/ProductCard.tsx`
- Modify: `inteliforce/components/pedido/CartSummary.tsx`

- [ ] **Step 1:** Replace static color imports in `pedido/index.tsx` and `ProductCard.tsx` with dynamic `useTheme()`.
- [ ] **Step 2:** Add a horizontal scrolling Category Filter Bar (`Todos`, `Lácteos`, `Embutidos`, `Bebidas`, `Secos`, `Limpieza`, etc.) with active pill styling.
- [ ] **Step 3:** Add stock availability badge in `ProductCard.tsx` (`En Stock`, `Últimas X un.`, `Agotado`). Disable add button when stock is 0.
- [ ] **Step 4:** Enhance `CartSummary.tsx` with live total in Gs. using `formatGS`, item count badge, and visual credit limit comparison.
- [ ] **Step 5:** Run `npx tsc --noEmit` in `inteliforce/` to verify zero errors.
- [ ] **Step 6:** Commit changes: `git commit -m "feat(catalog): add category filter chips, dynamic theming, stock badges and haptic stepper"`.

---

### Task 6: Order Confirmation & Safe Area Layout Optimization

**Files:**
- Modify: `inteliforce/app/(vendedor)/pedido/confirmar.tsx`

- [ ] **Step 1:** Refactor `confirmar.tsx` to adopt `useTheme()` tokens and full safe area padding for gesture bars.
- [ ] **Step 2:** Add payment condition radio group (Contado / Crédito with approved days plazo).
- [ ] **Step 3:** Hook submission button to `expo-haptics` and offline queue fallback if network is interrupted.
- [ ] **Step 4:** Run `npx tsc --noEmit` in `inteliforce/` to verify zero errors.
- [ ] **Step 5:** Commit changes: `git commit -m "feat(order): refine checkout screen with payment condition selector and theme tokens"`.

---

### Task 7: Metas Dashboard, Pacing Analytics & Commissions Estimator

**Files:**
- Modify: `inteliforce/app/(vendedor)/metas.tsx`

- [ ] **Step 1:** Add Daily Pacing comparison bar: Expected pace vs Actual pace with status badge (`+X% Adelantado` / `-Y% Retrasado`).
- [ ] **Step 2:** Add Commission Projection Card calculating estimated earnings in Guaraníes (`formatGS`) based on current monthly sales volume and goal tier.
- [ ] **Step 3:** Refactor layout to UI/UX Pro Max tokens and clean typography.
- [ ] **Step 4:** Run `npx tsc --noEmit` in `inteliforce/` to verify zero compiler errors.
- [ ] **Step 5:** Commit changes: `git commit -m "feat(metas): implement pacing analysis and monthly commission earnings estimator"`.

---

### Task 8: End-to-End Verification & Mobile Build Validation

**Files:**
- Run: `inteliforce/` validation suite

- [ ] **Step 1:** Run full TypeScript compilation `npx tsc --noEmit` across `inteliforce/`.
- [ ] **Step 2:** Validate Expo router routes with `npx expo config --json`.
- [ ] **Step 3:** Verify git cleanliness on `vertical/distribuidora` and ensure Dashboard/Sidebar in `ui-web` remain completely untouched.
- [ ] **Step 4:** Deploy updated backend service if needed and verify live HTTP 200 responses on `minisforum-ia`.
