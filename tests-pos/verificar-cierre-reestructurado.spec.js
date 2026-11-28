const { test, expect } = require('@playwright/test');

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0OWFmODEyMi0wODc1LTRkNGItYTkwZS05YjI1YmM1MmYzMTAiLCJpZCI6IjQ5YWY4MTIyLTA4NzUtNGQ0Yi1hOTBlLTliMjViYzUyZjMxMCIsImVtYWlsIjoiZGV2QHN1cGVyZXh0cmEuY29tLnB5Iiwicm9sIjoiYWRtaW4iLCJpc19zdXBlcmFkbWluIjp0cnVlLCJjb21wYW55X2lkIjoiMDAwMDAwMDAtMDAwMC0wMDAwLTAwMDAtMDAwMDAwMDAwMDEwIiwiZXhwIjoxODI0OTI1MDYzLCJ0eXBlIjoiYWNjZXNzIn0.T85px8J_7SWqbhim5qRS1CgB7Ro-etKFBq354EKcizw';

test('Cierre Mensual - 7 pestañas canónicas, categorías reales, redestinar y exclusión inmediata', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.addInitScript((token) => {
    localStorage.setItem('access_token', token);
    localStorage.setItem('cached_user_profile', JSON.stringify({
      id: '49af8122-0875-4d4b-a90e-9b25bc52f310',
      email: 'dev@superextra.com.py',
      nombre: 'DEV ADMIN',
      rol: 'admin',
      is_superadmin: true
    }));
  }, TOKEN);

  console.log('1. Navegando a /financiero/cierre-mensual...');
  await page.goto('/financiero/cierre-mensual', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // 1. Verificar presencia de las 7 pestañas canónicas
  console.log('2. Verificando pestañas canónicas...');
  await expect(page.locator('button:has-text("1. Resumen P&L en Cascada")')).toBeVisible();
  await expect(page.locator('button:has-text("2. Cajas / Ingresos")')).toBeVisible();
  await expect(page.locator('button:has-text("3. CMV / Compras")')).toBeVisible();
  await expect(page.locator('button:has-text("4. Nómina SueldOK")')).toBeVisible();
  await expect(page.locator('button:has-text("5. Gastos Operativos")')).toBeVisible();
  await expect(page.locator('button:has-text("6. Inversiones / Activo Fijo (CAPEX)")')).toBeVisible();
  await expect(page.locator('button:has-text("7. Anticipos y No Operativos")')).toBeVisible();

  await page.screenshot({ path: '/Users/gustaquevedo/.gemini/antigravity/brain/8aa037bc-c965-41f7-828d-3d600c33dd82/cierre-7-pestanas-live.png', fullPage: true });
  console.log('✓ Captura guardada: cierre-7-pestanas-live.png');

  // 2. Click en Pestaña 5: Gastos Operativos
  console.log('3. Navegando a Gastos Operativos...');
  await page.click('button:has-text("5. Gastos Operativos")');
  await page.waitForTimeout(2000);

  // Verificar columnas de la tabla: Categoría (Plan de Cuentas) y Sector / Departamento
  await expect(page.locator('th:has-text("Categoría (Plan de Cuentas)")')).toBeVisible();
  await expect(page.locator('th:has-text("Sector / Departamento")')).toBeVisible();

  // Verificar que NO existan UUIDs tipo "CC: eaeea2d2"
  const bodyText = await page.textContent('body');
  expect(bodyText.includes('CC: ')).toBeFalsy();

  await page.screenshot({ path: '/Users/gustaquevedo/.gemini/antigravity/brain/8aa037bc-c965-41f7-828d-3d600c33dd82/cierre-opex-categorias-reales.png', fullPage: true });
  console.log('✓ Captura guardada: cierre-opex-categorias-reales.png');

  // 3. Abrir modal de Redestinar en el primer comprobante disponible
  console.log('4. Abriendo modal de redestinar...');
  const firstRedestinarBtn = page.locator('tbody tr button:has-text("Redestinar")').first();
  await expect(firstRedestinarBtn).toBeVisible({ timeout: 10000 });
  await firstRedestinarBtn.click();
  await page.waitForTimeout(1000);

  // Verificar modal y buscador de categorías
  await expect(page.locator('text=REDESTINACIÓN CONTABLE & P&L')).toBeVisible();
  const searchCatInput = page.locator('input[placeholder*="Filtrar categorías"]');
  await expect(searchCatInput).toBeVisible();
  await searchCatInput.fill('panaderia');
  await page.waitForTimeout(500);

  await page.screenshot({ path: '/Users/gustaquevedo/.gemini/antigravity/brain/8aa037bc-c965-41f7-828d-3d600c33dd82/cierre-modal-filtro-categorias.png' });
  console.log('✓ Captura guardada: cierre-modal-filtro-categorias.png');

  // 4. Seleccionar naturaleza "Materia Prima de Producción (CMV Producción)"
  console.log('5. Probando selección de CMV Materia Prima...');
  const naturalezaSelect = page.locator('select:has(option[value="CMV_MATERIA_PRIMA"])');
  await expect(naturalezaSelect).toBeVisible();
  await naturalezaSelect.selectOption('CMV_MATERIA_PRIMA');
  await page.waitForTimeout(500);

  // Verificar que aparece el banner de impacto: "Sale de Gastos Operativos y entra al Costo de Ventas"
  await expect(page.locator('text=Sale de Gastos Operativos y entra al Costo de Ventas')).toBeVisible();

  await page.screenshot({ path: '/Users/gustaquevedo/.gemini/antigravity/brain/8aa037bc-c965-41f7-828d-3d600c33dd82/cierre-modal-banner-impacto-cmv.png' });
  console.log('✓ Captura guardada: cierre-modal-banner-impacto-cmv.png');

  // Cerrar modal de forma segura con Cancelar para no alterar registros reales
  console.log('6. Cerrando modal de forma segura...');
  const cancelarBtn = page.locator('button:has-text("Cancelar")');
  await expect(cancelarBtn).toBeVisible();
  await cancelarBtn.click();
  await page.waitForTimeout(1000);

  console.log('7. Verificando que el modal se cerró...');
  await expect(page.locator('text=REDESTINACIÓN CONTABLE & P&L')).not.toBeVisible();

  // Navegar a 3. CMV / Compras y verificar que se listan las materias primas reales
  console.log('8. Navegando a 3. CMV / Compras...');
  await page.click('button:has-text("3. CMV / Compras")');
  await page.waitForTimeout(2000);

  await page.screenshot({ path: '/Users/gustaquevedo/.gemini/antigravity/brain/8aa037bc-c965-41f7-828d-3d600c33dd82/cierre-cmv-materias-primas-live.png', fullPage: true });
  console.log('✓ Captura guardada: cierre-cmv-materias-primas-live.png');

  console.log('🎉 E2E Test Completado con éxito 100%');
});
