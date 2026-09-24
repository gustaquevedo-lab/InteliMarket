# InteliMarket Landing Page (Cloudflare Pages)

Landing page oficial de alta conversión para **InteliMarket**, desarrollada por **IntelliHouse** (`intellihouse.lat`).

---

## 🚀 Características
- **Framework:** Astro 5 + Tailwind CSS v3.4.
- **Rendimiento:** 100/100 Google Lighthouse, HTML estático ultra-liviano (< 400ms de carga en el Edge).
- **Tema Bimodal:** Selector nativo de Modo Claro / Modo Oscuro con persistencia en `localStorage`.
- **Diseño Oficial:** Basado en el sistema de diseño *Neo-Terminal Corporate* de `stitch_intelimarket_design_system_landing/`.
- **Estrategia Comercial:** Sin mención de precios, enfocada en resolver dolores operativos de supermercados, mayoristas y retail en Paraguay.
- **Canales Integrados:**
  - WhatsApp VIP: `+595 994 516360` (`https://wa.me/595994516360`)
  - Correo: `intelimarket@intellihouse.lat`

---

## 💻 Desarrollo Local

```bash
cd landing
npm install
npm run dev
```

La página estará disponible en `http://localhost:4321`.

---

## 📦 Compilación

```bash
npm run build
```

Los archivos estáticos listos para producción se generan en `landing/dist/`.

---

## 🌐 Despliegue en Cloudflare Pages (`intelimarket.intellihouse.lat`)

Para desplegar en Cloudflare Pages conectado a este repositorio:

1. Ve al panel de **Cloudflare Dashboard** > **Compute (Workers & Pages)** > **Create application** > **Pages** > **Connect to Git**.
2. Selecciona el repositorio de **Intelimarket**.
3. Configura los parámetros de build:
   - **Framework preset:** `Astro`
   - **Root directory:** `landing`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Haz clic en **Save and Deploy**.
5. Una vez finalizado el build, ve a la pestaña **Custom domains** del proyecto en Cloudflare Pages y agrega:
   `intelimarket.intellihouse.lat`
6. Como la zona `intellihouse.lat` ya está en Cloudflare, el registro CNAME y el certificado SSL se configurarán automáticamente.
