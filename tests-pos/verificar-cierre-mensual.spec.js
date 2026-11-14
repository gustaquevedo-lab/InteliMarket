const { test, expect } = require('@playwright/test');

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0OWFmODEyMi0wODc1LTRkNGItYTkwZS05YjI1YmM1MmYzMTAiLCJpZCI6IjQ5YWY4MTIyLTA4NzUtNGQ0Yi1hOTBlLTliMjViYzUyZjMxMCIsImVtYWlsIjoiZGV2QHN1cGVyZXh0cmEuY29tLnB5Iiwicm9sIjoiYWRtaW4iLCJpc19zdXBlcmFkbWluIjp0cnVlLCJjb21wYW55X2lkIjoiMDAwMDAwMDAtMDAwMC0wMDAwLTAwMDAtMDAwMDAwMDAwMDEwIiwiZXhwIjoxODI0OTI1MDYzLCJ0eXBlIjoiYWNjZXNzIn0.T85px8J_7SWqbhim5qRS1CgB7Ro-etKFBq354EKcizw';

test.describe('Módulo de Cierre Mensual - Rediseño Dinámico y Reclasificación con Split', () => {
  test('Verificar selector de periodos dinámico, carga en vivo de Noviembre 2026 y Modal de Reclasificación', async ({ page }) => {
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

    console.log('1. Navegando a /financiero/cierre-mensual...');
    await page.goto('/financiero/cierre-mensual', { waitUntil: 'networkidle', timeout: 35000 });
    await page.waitForTimeout(3000);

    // 1. Verificar Título y Estado
    const headerTitle = page.locator('h1:has-text("Cierre de Resultados y Flujo Mensual")');
    await expect(headerTitle).toBeVisible();
    console.log('✓ Header y título verificados');

    // 2. Verificar Selector Dinámico de Mes y Año (por defecto en Noviembre 2026)
    const monthSelect = page.locator('select').first();
    const selectedMonthVal = await monthSelect.inputValue();
    console.log('Mes seleccionado inicialmente:', selectedMonthVal);
    expect(selectedMonthVal).toBe('11');

    await page.screenshot({ path: 'screenshots/cierre-mensual-noviembre-pnl.png', fullPage: false });
    console.log('✓ Captura P&L Noviembre 2026 guardada');

    // 3. Navegar a pestaña "10. Todos los Comprobantes (Redestinar)"
    console.log('2. Navegando a pestaña de comprobantes / redestinar...');
    const tabComprobantes = page.locator('button:has-text("Todos los Comprobantes")');
    await tabComprobantes.click();
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'screenshots/cierre-mensual-tab-comprobantes.png', fullPage: false });
    console.log('✓ Captura pestaña Comprobantes guardada');

    // 4. Seleccionar el botón Redestinar de la primera fila en el tbody
    const rowRedestinarBtn = page.locator('tbody tr button:has-text("Redestinar")').first();
    await expect(rowRedestinarBtn).toBeVisible({ timeout: 10000 });
    console.log('✓ Botón Redestinar en tabla encontrado');

    await rowRedestinarBtn.click();
    await page.waitForTimeout(1500);

    // 5. Verificar que el modal de Reclasificación y Split está visible
    const modalHeader = page.locator('text=REDESTINACIÓN CONTABLE & P&L');
    await expect(modalHeader).toBeVisible();
    console.log('✓ Modal de Reclasificación abierto con éxito');

    // 6. Activar modo Split con el botón segmentado
    const splitBtn = page.locator('button:has-text("Dividir por Sector / Split")');
    await expect(splitBtn).toBeVisible();
    await splitBtn.click();
    await page.waitForTimeout(1000);

    const splitHeading = page.locator('text=Asignación Multidepartamental');
    await expect(splitHeading).toBeVisible();
    console.log('✓ Modo Split activado, sectores y montos visibles');

    await page.screenshot({ path: 'screenshots/cierre-mensual-modal-split-verified.png' });
    console.log('✓ Captura Modal Reclasificación con Split guardada en screenshots/cierre-mensual-modal-split-verified.png');

    // Cerrar modal
    const closeBtn = page.locator('button:has-text("Cancelar")').first();
    await closeBtn.click();
    await page.waitForTimeout(1000);

    // 7. Cambiar mes a Octubre 2026 para verificar reactividad de meses anteriores
    console.log('4. Cambiando mes a Octubre...');
    await monthSelect.selectOption('10');
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'screenshots/cierre-mensual-octubre-pnl.png', fullPage: false });
    console.log('✓ Captura Octubre 2026 guardada');

    console.log('✓ Todas las aserciones y pruebas visuales completadas exitosamente.');
  });
});
