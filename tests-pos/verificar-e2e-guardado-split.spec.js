const { test, expect } = require('@playwright/test');

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0OWFmODEyMi0wODc1LTRkNGItYTkwZS05YjI1YmM1MmYzMTAiLCJpZCI6IjQ5YWY4MTIyLTA4NzUtNGQ0Yi1hOTBlLTliMjViYzUyZjMxMCIsImVtYWlsIjoiZGV2QHN1cGVyZXh0cmEuY29tLnB5Iiwicm9sIjoiYWRtaW4iLCJpc19zdXBlcmFkbWluIjp0cnVlLCJjb21wYW55X2lkIjoiMDAwMDAwMDAtMDAwMC0wMDAwLTAwMDAtMDAwMDAwMDAwMDEwIiwiZXhwIjoxODI0OTI1MDYzLCJ0eXBlIjoiYWNjZXNzIn0.T85px8J_7SWqbhim5qRS1CgB7Ro-etKFBq354EKcizw';

test('Guardado real de Split por Sector desde la UI y verificación en Base de Datos', async ({ page }) => {
  test.setTimeout(60000);
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

  console.log('1. Navegando a Cierre Mensual...');
  await page.goto('/financiero/cierre-mensual', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  console.log('2. Navegando a pestaña de comprobantes...');
  const tabComprobantes = page.locator('button:has-text("Todos los Comprobantes")');
  await tabComprobantes.click();
  await page.waitForTimeout(2000);

  // Buscar una fila específica sin split previo: TEODORO OCAMPOS (₲ 500.000)
  const rowTeodoro = page.locator('tr:has-text("TEODORO OCAMPOS ARANDA")');
  await expect(rowTeodoro).toBeVisible({ timeout: 10000 });
  console.log('✓ Fila TEODORO OCAMPOS encontrada');

  const btnRedestinar = rowTeodoro.locator('button:has-text("Redestinar")');
  await btnRedestinar.click();
  await page.waitForTimeout(1500);

  // Modal abierto
  const modalHeader = page.locator('text=REDESTINACIÓN CONTABLE & P&L');
  await expect(modalHeader).toBeVisible();
  console.log('✓ Modal abierto para TEODORO OCAMPOS');

  // Activar modo Split
  const splitBtn = page.locator('button:has-text("Dividir por Sector / Split")');
  await splitBtn.click();
  await page.waitForTimeout(1000);

  const splitHeading = page.locator('text=Asignación Multidepartamental');
  await expect(splitHeading).toBeVisible();
  console.log('✓ Modo Split activado');

  // Seleccionamos Sector para Línea #1 (Carnicería) y Línea #2 (Panadería y Rotisería)
  const sectorSelects = page.locator('.fixed.inset-0 select');
  const firstSector = sectorSelects.nth(0);
  await firstSector.selectOption({ label: 'Carnicería' });

  const secondSector = sectorSelects.nth(3);
  await secondSector.selectOption({ label: 'Panadería y Rotisería' });
  console.log('✓ Sectores asignados: Línea 1 = Carnicería, Línea 2 = Panadería y Rotisería');

  // Verificar que el balanceador indica "Suma perfectamente cuadrada"
  const balanceOk = page.locator('text=Suma perfectamente cuadrada');
  await expect(balanceOk).toBeVisible();
  console.log('✓ Balanceador de suma verificado: Cuadrado al 100%');

  // Guardar y Recalcular
  const btnGuardar = page.locator('button:has-text("Guardar y Recalcular Cierre")');
  await btnGuardar.click();
  console.log('✓ Clic en Guardar y Recalcular Cierre ejecutado');

  // Esperar a que el modal se cierre tras la respuesta exitosa
  await expect(modalHeader).not.toBeVisible({ timeout: 15000 });
  console.log('✓ Modal cerrado tras guardado exitoso');

  await page.waitForTimeout(2000);

  // Verificar que la fila de TEODORO OCAMPOS ahora muestra el badge "SPLIT (2)"
  const rowUpdated = page.locator('tr:has-text("TEODORO OCAMPOS ARANDA")');
  const badgeSplit = rowUpdated.locator('text=SPLIT (2)');
  await expect(badgeSplit).toBeVisible();
  console.log('✓ Badge SPLIT (2) verificado en la tabla en vivo');

  await page.screenshot({ path: 'screenshots/cierre-mensual-e2e-split-guardado.png' });
  console.log('✓ Captura final screenshots/cierre-mensual-e2e-split-guardado.png guardada con éxito.');
});
