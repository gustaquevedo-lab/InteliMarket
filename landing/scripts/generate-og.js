import sharp from 'sharp';

async function generateOG() {
  const width = 1200;
  const height = 630;

  // Isotipo oficial en tamaño generoso y nítido
  const isotypeBuffer = await sharp('public/images/intelimarket-isotype.png')
    .resize(135, 135, { fit: 'contain' })
    .toBuffer();
  const isotypeBase64 = `data:image/png;base64,${isotypeBuffer.toString('base64')}`;

  const svg = `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#070d18" />
        <stop offset="45%" stop-color="#0c1626" />
        <stop offset="100%" stop-color="#060b14" />
      </linearGradient>

      <linearGradient id="headlineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#4edea3" />
        <stop offset="60%" stop-color="#5eead4" />
        <stop offset="100%" stop-color="#93c5fd" />
      </linearGradient>

      <radialGradient id="mintGlow" cx="20%" cy="30%" r="55%">
        <stop offset="0%" stop-color="#4edea3" stop-opacity="0.22" />
        <stop offset="100%" stop-color="#4edea3" stop-opacity="0" />
      </radialGradient>

      <radialGradient id="blueGlow" cx="85%" cy="30%" r="50%">
        <stop offset="0%" stop-color="#2563eb" stop-opacity="0.2" />
        <stop offset="100%" stop-color="#2563eb" stop-opacity="0" />
      </radialGradient>

      <linearGradient id="cardBorder" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#4edea3" stop-opacity="0.5" />
        <stop offset="50%" stop-color="#334155" stop-opacity="0.9" />
        <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.4" />
      </linearGradient>
    </defs>

    <!-- Background -->
    <rect width="${width}" height="${height}" fill="url(#bgGrad)" />

    <!-- Ambient Glows -->
    <circle cx="260" cy="210" r="380" fill="url(#mintGlow)" />
    <circle cx="940" cy="220" r="340" fill="url(#blueGlow)" />

    <!-- Outer Frame Card with Glow Border -->
    <rect x="36" y="36" width="1128" height="558" rx="32" fill="#0c141e" fill-opacity="0.65" stroke="url(#cardBorder)" stroke-width="2" />

    <!-- Brand Header -->
    <g transform="translate(75, 70)">
      <!-- Embedded Isotype -->
      <image href="${isotypeBase64}" x="0" y="0" width="125" height="125" />

      <!-- Brand Typography (Much Bigger) -->
      <text x="145" y="68" font-family="-apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', 'Inter', sans-serif" font-size="52" font-weight="900" fill="#ffffff" letter-spacing="-1">
        Inteli<tspan font-weight="400" fill="#ffffff">Market</tspan>
      </text>

      <text x="148" y="105" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="16" font-weight="800" fill="#4edea3" letter-spacing="4">
        HECHO PARA CRECER
      </text>

      <!-- Right Top Status Pill (Bigger text for mobile) -->
      <g transform="translate(670, 24)">
        <rect x="0" y="0" width="305" height="52" rx="26" fill="#151f2e" stroke="#334155" stroke-width="1.5" />
        <circle cx="28" cy="26" r="6" fill="#4edea3" />
        <text x="44" y="32" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="15" font-weight="800" fill="#4edea3" letter-spacing="1">SIFEN e-Kuatia</text>
        <text x="180" y="32" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="15" font-weight="600" fill="#e2e8f0">| Offline-Ready</text>
      </g>
    </g>

    <!-- Main Value Proposition Headline (Very Large & Clear on WhatsApp) -->
    <g transform="translate(75, 255)">
      <text font-family="-apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', sans-serif" font-size="54" font-weight="900" fill="#ffffff" letter-spacing="-1.5">
        El sistema que <tspan fill="url(#headlineGrad)">no se cae</tspan> cuando tu
      </text>
      <text y="68" font-family="-apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', sans-serif" font-size="54" font-weight="900" fill="#ffffff" letter-spacing="-1.5">
        negocio más lo necesita.
      </text>

      <!-- Subtitle (Larger 25px font) -->
      <text y="132" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="25" font-weight="500" fill="#cbd5e1" letter-spacing="-0.2">
        ERP &amp; POS para supermercados, mayoristas y retail en Paraguay.
      </text>
      <text y="168" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="23" font-weight="400" fill="#94a3b8" letter-spacing="-0.2">
        Balanzas dinámicas, cobro multimoneda (PYG, BRL, USD) y arqueos sin fugas.
      </text>
    </g>

    <!-- Bottom Feature Badges Bar (3 Large, Punchy Cards with 17px text) -->
    <g transform="translate(75, 480)">
      <!-- Badge 1 -->
      <g transform="translate(0, 0)">
        <rect x="0" y="0" width="300" height="54" rx="16" fill="#151f2e" stroke="#334155" stroke-width="1.5" />
        <circle cx="28" cy="27" r="6" fill="#4edea3" />
        <text x="44" y="34" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="17" font-weight="700" fill="#ffffff">100% Offline-Ready</text>
      </g>

      <!-- Badge 2 -->
      <g transform="translate(330, 0)">
        <rect x="0" y="0" width="310" height="54" rx="16" fill="#151f2e" stroke="#334155" stroke-width="1.5" />
        <circle cx="28" cy="27" r="6" fill="#4fdbc8" />
        <text x="44" y="34" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="17" font-weight="700" fill="#ffffff">SIFEN DNIT Directo</text>
      </g>

      <!-- Badge 3 -->
      <g transform="translate(670, 0)">
        <rect x="0" y="0" width="305" height="54" rx="16" fill="#151f2e" stroke="#334155" stroke-width="1.5" />
        <circle cx="28" cy="27" r="6" fill="#abc7fc" />
        <text x="44" y="34" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="17" font-weight="700" fill="#ffffff">PYG • BRL • USD</text>
      </g>
    </g>

    <!-- Footer URL & Attribution (Clear 15px) -->
    <g transform="translate(75, 562)">
      <text x="0" y="0" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="16" font-weight="800" fill="#4edea3" letter-spacing="1">
        intelimarket.intellihouse.lat
      </text>
      <text x="975" y="0" text-anchor="end" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="15" font-weight="600" fill="#94a3b8">
        Desarrollado por IntelliHouse
      </text>
    </g>
  </svg>
  `;

  await sharp(Buffer.from(svg))
    .png({ quality: 95 })
    .toFile('public/images/og-image.png');

  console.log('OG image updated with large readable typography for WhatsApp');
}

generateOG().catch(console.error);
