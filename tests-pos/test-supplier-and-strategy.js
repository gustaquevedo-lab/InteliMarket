const { chromium } = require('playwright');

(async () => {
  console.log('🔍 Probando combinaciones de filtros (Proveedor + Aumento)...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });

  try {
    await page.goto('https://intelimarket.superextra.com.py/auditoria/index.html', { waitUntil: 'networkidle' });

    // 1. Probar dropdown de estrategia
    console.log('Probando selección por dropdown: filter-strategy-dropdown = WILL_CHANGE');
    await page.selectOption('#filter-strategy-dropdown', 'WILL_CHANGE');
    await page.waitForTimeout(500);

    let rows = await page.$$eval('#table-body tr', rs => rs.map(r => ({
      sku: r.querySelector('td:nth-child(2) div:first-child')?.textContent.trim(),
      nom: r.querySelector('td:nth-child(3) div:first-child')?.textContent.trim()
    })));

    console.log('Primeras 3 filas con dropdown en Con Aumento:', rows.slice(0, 3));
    if (rows.some(r => r.sku === '120121' || r.sku === '118971')) {
      throw new Error('Brahmita o Coca PET aparecieron en Con Aumento vía dropdown!');
    }
    console.log('✅ Dropdown de estrategia excluye correctamente Brahmita y Coca PET.');

    // 2. Probar Proveedor SUR COMERCIAL (proveedor de Brahmita) + Con Aumento
    console.log('Probando SUR COMERCIAL con filtro Con Aumento...');
    await page.fill('#supplier-search-input', 'SUR COMERCIAL');
    await page.waitForTimeout(400);

    // Clic en la opción coincidente (hijo 2, ya que hijo 1 es 'Todos los proveedores')
    await page.click('#supplier-dropdown-menu > div:nth-child(2)');
    await page.waitForTimeout(600);

    rows = await page.$$eval('#table-body tr', rs => rs.map(r => ({
      sku: r.querySelector('td:nth-child(2) div:first-child')?.textContent.trim(),
      nom: r.querySelector('td:nth-child(3) div:first-child')?.textContent.trim(),
      prv: r.querySelector('td:nth-child(3) span:first-child')?.textContent.trim()
    })));

    console.log('Total artículos SUR COMERCIAL con Aumento:', rows.length);
    console.log('Primeros artículos de SUR COMERCIAL con Aumento:', rows.slice(0, 5));
    if (rows.some(r => r.sku === '120121' || r.nom?.includes('BRAHMITA'))) {
      throw new Error('ERROR: Brahmita apareció en SUR COMERCIAL cuando está activo Con Aumento!');
    }
    console.log('✅ Brahmita NO aparece en SUR COMERCIAL con Aumento.');

    // 3. Probar Proveedor CASA GONZALITO (proveedor de Coca Cola) + Con Aumento
    console.log('Probando CASA GONZALITO con filtro Con Aumento...');
    await page.fill('#supplier-search-input', 'CASA GONZALITO');
    await page.waitForTimeout(400);
    await page.click('#supplier-dropdown-menu > div:nth-child(2)');
    await page.waitForTimeout(600);

    rows = await page.$$eval('#table-body tr', rs => rs.map(r => ({
      sku: r.querySelector('td:nth-child(2) div:first-child')?.textContent.trim(),
      nom: r.querySelector('td:nth-child(3) div:first-child')?.textContent.trim(),
      prv: r.querySelector('td:nth-child(3) span:first-child')?.textContent.trim()
    })));

    console.log('Total artículos CASA GONZALITO con Aumento:', rows.length);
    console.log('Primeros artículos de CASA GONZALITO con Aumento:', rows.slice(0, 5));
    if (rows.some(r => r.sku === '118971' || (r.nom?.includes('COCA') && r.nom?.includes('PET')))) {
      throw new Error('ERROR: Coca Cola PET apareció en CASA GONZALITO cuando está activo Con Aumento!');
    }
    console.log('✅ Coca Cola PET NO aparece en CASA GONZALITO con Aumento.');

    // 4. Cambiar a Tráfico Blindado manteniendo CASA GONZALITO
    console.log('Cambiando a Tráfico Blindado con CASA GONZALITO...');
    await page.click('#tab-TRAFFIC');
    await page.waitForTimeout(600);

    rows = await page.$$eval('#table-body tr', rs => rs.map(r => ({
      sku: r.querySelector('td:nth-child(2) div:first-child')?.textContent.trim(),
      nom: r.querySelector('td:nth-child(3) div:first-child')?.textContent.trim()
    })));

    console.log('Total artículos CASA GONZALITO en Tráfico:', rows.length);
    console.log('Primeros artículos de CASA GONZALITO en Tráfico:', rows.slice(0, 5));
    if (!rows.some(r => r.sku === '118971')) {
      throw new Error('Coca Cola PET DEBE aparecer en Tráfico Blindado!');
    }
    console.log('✅ Coca Cola PET aparece correctamente en Tráfico Blindado.');

    console.log('🎉 TODOS LOS TESTS DE FILTROS CRUZADOS PASARON AL 100%.');
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
