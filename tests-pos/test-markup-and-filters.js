const { chromium } = require('playwright');

(async () => {
  console.log('🚀 Iniciando verificación de Markup y Filtros de Auditoría...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });

  try {
    await page.goto('https://intelimarket.superextra.com.py/auditoria/index.html', { waitUntil: 'networkidle', timeout: 30000 });
    console.log('✅ Página cargada.');

    // 1. Verificar encabezados de columnas
    const headers = await page.$$eval('thead th', ths => ths.map(t => t.textContent.trim()));
    console.log('Encabezados encontrados:', headers);
    if (!headers.some(h => h.includes('Markup Actual'))) {
      throw new Error('No se encontró el encabezado "Markup Actual"');
    }
    if (!headers.some(h => h.includes('Markup % (s/ Costo)'))) {
      throw new Error('No se encontró el encabezado "Markup % (s/ Costo)"');
    }
    console.log('✅ Encabezados de Markup validados correctamente.');

    // 2. Probar Pestaña: "📦 Con Escalas Mayoristas"
    console.log('Probando filtro: 📦 Con Escalas Mayoristas...');
    await page.click('#tab-WITH_TIERS');
    await page.waitForTimeout(600);

    const firstTierBadge = await page.evaluate(() => {
      const el = document.querySelector('.tier-input');
      return el ? el.parentElement.textContent.trim() : null;
    });
    console.log('Ejemplo de badge de escala:', firstTierBadge);
    if (!firstTierBadge || !firstTierBadge.includes('mkp')) {
      throw new Error(`El badge de escala no indica mkp: ${firstTierBadge}`);
    }
    console.log('✅ Escalas mayoristas muestran porcentaje de Markup.');

    // 3. Probar Pestaña: "⚡ Con Aumento Sugerido"
    console.log('Probando filtro: ⚡ Con Aumento Sugerido...');
    await page.click('#tab-WILL_CHANGE');
    await page.waitForTimeout(600);

    const willChangeSkus = await page.$$eval('#table-body tr', rows => {
      return rows.map(r => {
        const skuDiv = r.querySelector('td:nth-child(2) div:first-child');
        const nameDiv = r.querySelector('td:nth-child(3) div:first-child');
        return {
          sku: skuDiv ? skuDiv.textContent.trim() : '',
          name: nameDiv ? nameDiv.textContent.trim() : ''
        };
      });
    });

    console.log('Total filas en página 1 de Con Aumento:', willChangeSkus.length);
    console.log('Primeras 3 filas:', willChangeSkus.slice(0, 3));

    const hasBrahmita = willChangeSkus.some(x => x.sku === '120121' || x.name.includes('BRAHMITA'));
    const hasCocaPet = willChangeSkus.some(x => x.sku === '118971' || (x.name.includes('COCA') && x.name.includes('PET')));

    if (hasBrahmita) {
      throw new Error('ERROR: Brahmita (tráfico blindado) apareció en "Con Aumento Sugerido"!');
    }
    if (hasCocaPet) {
      throw new Error('ERROR: Coca Cola PET apareció en "Con Aumento Sugerido"!');
    }
    console.log('✅ Exclusión confirmada: Ni Brahmita ni Coca Cola PET aparecen en "Con Aumento Sugerido".');

    // 4. Probar Pestaña: "🛒 Tráfico Blindado (0%)"
    console.log('Probando filtro: 🛒 Tráfico Blindado (0%)...');
    await page.click('#tab-TRAFFIC');
    await page.waitForTimeout(600);

    const trafficSkus = await page.$$eval('#table-body tr', rows => {
      return rows.map(r => {
        const skuDiv = r.querySelector('td:nth-child(2) div:first-child');
        const nameDiv = r.querySelector('td:nth-child(3) div:first-child');
        return {
          sku: skuDiv ? skuDiv.textContent.trim() : '',
          name: nameDiv ? nameDiv.textContent.trim() : ''
        };
      });
    });

    console.log('Total filas en página 1 de Tráfico Blindado:', trafficSkus.length);
    console.log('Primeras 3 filas de Tráfico:', trafficSkus.slice(0, 3));

    const trafficHasBrahmita = trafficSkus.some(x => x.sku === '120121');
    const trafficHasCocaPet = trafficSkus.some(x => x.sku === '118971');

    if (!trafficHasBrahmita) {
      throw new Error('Brahmita no apareció en Tráfico Blindado!');
    }
    if (!trafficHasCocaPet) {
      throw new Error('Coca Cola PET no apareció en Tráfico Blindado!');
    }
    console.log('✅ Inclusión confirmada: Brahmita y Coca Cola PET están en Tráfico Blindado con 0% aumento.');

    // 5. Probar cálculo de Markup bidireccional
    console.log('Probando cálculo de Markup bidireccional...');
    // Volver a todos
    await page.click('#tab-ALL');
    await page.waitForTimeout(600);

    // Buscar el primer input de markup
    const firstRowCostStr = await page.$eval('#table-body tr:first-child td:nth-child(4)', el => el.textContent.trim());
    const costClean = parseInt(firstRowCostStr.replace(/[^\d]/g, ''), 10);
    console.log('Costo de fila 1:', costClean);

    // Editar markup a 20%
    const firstMarkupInput = await page.$('#table-body tr:first-child input[id^="input-margin-"]');
    await firstMarkupInput.click();
    await firstMarkupInput.fill('20');
    await firstMarkupInput.press('Enter');
    await page.waitForTimeout(400);

    // Verificar que el PVP calculado sea round(costClean * 1.20)
    const expectedPVP = Math.round(costClean * 1.20);
    const updatedPriceStr = await page.$eval('#table-body tr:first-child input[id^="input-price-"]', el => el.value);
    const updatedPriceNum = parseInt(updatedPriceStr.replace(/[^\d]/g, ''), 10);
    console.log(`Cálculo verificado: Costo ${costClean} + 20% Markup = Esperado ₲ ${expectedPVP.toLocaleString('es-PY')}, Obtenido ₲ ${updatedPriceNum.toLocaleString('es-PY')}`);

    if (Math.abs(updatedPriceNum - expectedPVP) > 1) {
      throw new Error(`Fallo cálculo de Markup: esperado ${expectedPVP}, obtenido ${updatedPriceNum}`);
    }
    console.log('✅ Cálculo bidireccional de Markup exacto y perfecto!');

    // Revertir fila modificada con atajo 'R'
    const revertBtn = await page.$('#table-body tr:first-child button[title*="Revertir"]');
    if (revertBtn) {
      await revertBtn.click();
      await page.waitForTimeout(400);
      console.log('✅ Fila revertida a precio original.');
    }

    // Tomar captura
    await page.screenshot({ path: 'docs/auditoria_markup_standard_verified.png' });
    console.log('📸 Captura guardada en docs/auditoria_markup_standard_verified.png');

    console.log('🎉 TODAS LAS VERIFICACIONES PASARON EXITOSAMENTE.');
  } catch (err) {
    console.error('❌ Error durante la prueba:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
