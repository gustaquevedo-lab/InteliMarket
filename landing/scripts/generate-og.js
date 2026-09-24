import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function generateOG() {
  const width = 1200;
  const height = 630;

  // Base64 encode the isotype so it can be cleanly embedded or composited
  const isotypeBuffer = await sharp('public/images/intelimarket-isotype.png')
    .resize(130, 130, { fit: 'contain' })
    .toBuffer();
  const isotypeBase64 = `data:image/png;base64,${isotypeBuffer.toString('base64')}`;

  const svg = `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#080e18" />
        <stop offset="50%" stop-color="#0c1524" />
        <stop offset="100%" stop-color="#070f1a" />
      </linearGradient>

      <linearGradient id="headlineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#4edea3" />
        <stop offset="50%" stop-color="#4fdbc8" />
        <stop offset="100%" stop-color="#abc7fc" />
      </linearGradient>

      <radialGradient id="mintGlow" cx="20%" cy="30%" r="50%">
        <stop offset="0%" stop-color="#4edea3" stop-opacity="0.18" />
        <stop offset="100%" stop-color="#4edea3" stop-opacity="0" />
      </radialGradient>

      <radialGradient id="blueGlow" cx="85%" cy="25%" r="50%">
        <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.15" />
        <stop offset="100%" stop-color="#3b82f6" stop-opacity="0" />
      </radialGradient>

      <linearGradient id="cardBorder" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#4edea3" stop-opacity="0.4" />
        <stop offset="50%" stop-color="#232a35" stop-opacity="0.8" />
        <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.3" />
      </linearGradient>
    </defs>

    <!-- Background -->
    <rect width="${width}" height="${height}" fill="url(#bgGrad)" />

    <!-- Ambient Glows -->
    <circle cx="250" cy="200" r="350" fill="url(#mintGlow)" />
    <circle cx="950" cy="180" r="300" fill="url(#blueGlow)" />

    <!-- Subtle Tech Grid Lines -->
    <g opacity="0.04" stroke="#ffffff" stroke-width="1">
      <line x1="0" y1="100" x2="1200" y2="100" />
      <line x1="0" y1="200" x2="1200" y2="200" />
      <line x1="0" y1="300" x2="1200" y2="300" />
      <line x1="0" y1="400" x2="1200" y2="400" />
      <line x1="0" y1="500" x2="1200" y2="500" />
      <line x1="200" y1="0" x2="200" y2="630" />
      <line x1="400" y1="0" x2="400" y2="630" />
      <line x1="600" y1="0" x2="600" y2="630" />
      <line x1="800" y1="0" x2="800" y2="630" />
      <line x1="1000" y1="0" x2="1000" y2="630" />
    </g>

    <!-- Outer Frame Card with Glow Border -->
    <rect x="40" y="40" width="1120" height="550" rx="28" fill="#0c141e" fill-opacity="0.6" stroke="url(#cardBorder)" stroke-width="1.5" />

    <!-- Brand Header -->
    <g transform="translate(80, 80)">
      <!-- Embedded Isotype -->
      <image href="${isotypeBase64}" x="0" y="0" width="100" height="100" />

      <!-- Brand Typography -->
      <text x="120" y="58" font-family="-apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', 'Inter', sans-serif" font-size="44" font-weight="800" fill="#ffffff" letter-spacing="-1">
        Inteli<tspan font-weight="300" fill="#ffffff">Market</tspan>
      </text>

      <text x="122" y="86" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="14" font-weight="700" fill="#4edea3" letter-spacing="3">
        HECHO PARA CRECER
      </text>

      <!-- Right Top Status Pill -->
      <g transform="translate(680, 20)">
        <rect x="0" y="0" width="280" height="42" rx="21" fill="#19202b" stroke="#323a45" stroke-width="1" />
        <circle cx="24" cy="21" r="5" fill="#4edea3" />
        <text x="38" y="26" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="12" font-weight="700" fill="#4edea3" letter-spacing="1">SIFEN e-Kuatia</text>
        <text x="160" y="26" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="12" font-weight="500" fill="#c4c6d0">| Offline-Ready</text>
      </g>
    </g>

    <!-- Main Value Proposition Headline -->
    <g transform="translate(80, 245)">
      <text font-family="-apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', sans-serif" font-size="46" font-weight="800" fill="#ffffff" letter-spacing="-1">
        El sistema que <tspan fill="url(#headlineGrad)">no se cae</tspan> cuando tu
      </text>
      <text y="58" font-family="-apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', sans-serif" font-size="46" font-weight="800" fill="#ffffff" letter-spacing="-1">
        negocio más lo necesita.
      </text>

      <!-- Subtitle -->
      <text y="115" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="19" font-weight="400" fill="#94a3b8" letter-spacing="0">
        ERP &amp; POS vertical para supermercados, mayoristas y retail en Paraguay.
      </text>
      <text y="142" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="19" font-weight="400" fill="#94a3b8" letter-spacing="0">
        Balanzas dinámicas, bimonetario nativo (PYG, BRL, USD) y arqueos sin fugas.
      </text>
    </g>

    <!-- Bottom Feature Badges Bar -->
    <g transform="translate(80, 485)">
      <!-- Badge 1 -->
      <g transform="translate(0, 0)">
        <rect x="0" y="0" width="220" height="42" rx="12" fill="#151c26" stroke="#2e3541" stroke-width="1" />
        <circle cx="20" cy="21" r="4" fill="#4edea3" />
        <text x="32" y="26" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="13" font-weight="600" fill="#e2e8f0">100% Offline-Ready</text>
      </g>

      <!-- Badge 2 -->
      <g transform="translate(235, 0)">
        <rect x="0" y="0" width="220" height="42" rx="12" fill="#151c26" stroke="#2e3541" stroke-width="1" />
        <circle cx="20" cy="21" r="4" fill="#4fdbc8" />
        <text x="32" y="26" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="13" font-weight="600" fill="#e2e8f0">SIFEN DNIT Directo</text>
      </g>

      <!-- Badge 3 -->
      <g transform="translate(470, 0)">
        <rect x="0" y="0" width="220" height="42" rx="12" fill="#151c26" stroke="#2e3541" stroke-width="1" />
        <circle cx="20" cy="21" r="4" fill="#abc7fc" />
        <text x="32" y="26" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="13" font-weight="600" fill="#e2e8f0">PYG • BRL • USD</text>
      </g>

      <!-- Badge 4 -->
      <g transform="translate(705, 0)">
        <rect x="0" y="0" width="255" height="42" rx="12" fill="#151c26" stroke="#2e3541" stroke-width="1" />
        <circle cx="20" cy="21" r="4" fill="#fbbf24" />
        <text x="32" y="26" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="13" font-weight="600" fill="#e2e8f0">Toledo • Systel • Balanzas</text>
      </g>
    </g>

    <!-- Footer URL & Attribution -->
    <g transform="translate(80, 560)">
      <text x="0" y="0" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="12" font-weight="600" fill="#64748b" letter-spacing="1">
        intelimarket.intellihouse.lat
      </text>
      <text x="960" y="0" text-anchor="end" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="12" font-weight="500" fill="#64748b">
        Desarrollado por IntelliHouse
      </text>
    </g>
  </svg>
  `;

  await sharp(Buffer.from(svg))
    .png({ quality: 95 })
    .toFile('public/images/og-image.png');

  console.log('og-image.png created successfully at public/images/og-image.png');
}

generateOG().catch(console.error);
