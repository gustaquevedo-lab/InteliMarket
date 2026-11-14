const { test, expect } = require('@playwright/test');
const path = require('path');

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0OWFmODEyMi0wODc1LTRkNGItYTkwZS05YjI1YmM1MmYzMTAiLCJpZCI6IjQ5YWY4MTIyLTA4NzUtNGQ0Yi1hOTBlLTliMjViYzUyZjMxMCIsImVtYWlsIjoiZGV2QHN1cGVyZXh0cmEuY29tLnB5Iiwicm9sIjoiYWRtaW4iLCJpc19zdXBlcmFkbWluIjp0cnVlLCJjb21wYW55X2lkIjoiMDAwMDAwMDAtMDAwMC0wMDAwLTAwMDAtMDAwMDAwMDAwMDEwIiwiZXhwIjoxODI0OTI1MDYzLCJ0eXBlIjoiYWNjZXNzIn0.T85px8J_7SWqbhim5qRS1CgB7Ro-etKFBq354EKcizw';

test.describe('E2E: Punteo Previo de Extractos Bancarios & Bóveda', () => {
  test('Punteo interactivo de extracto PDF de Banco Continental en UI', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.addInitScript((token) => {
      localStorage.setItem('access_token', token);
      localStorage.setItem('cached_user_profile', JSON.stringify({
        id: '49af8122-0875-4d4b-a90e-9b25bc52f310',
        email: 'dev@superextra.com.py',
        nombre: 'Admin Dev',
        rol: 'admin',
        is_superadmin: true
      }));
    }, TOKEN);

    console.log('1. Navegando a http://100.83.91.76:5173/bancos...');
    await page.goto('http://100.83.91.76:5173/bancos', { waitUntil: 'networkidle', timeout: 35000 });
    await page.waitForTimeout(2000);

    // Abrir modal de Importar Extracto
    const btnImportar = page.locator('button:has-text("Importar Extracto")').first();
    await expect(btnImportar).toBeVisible();
    await btnImportar.click();
    await page.waitForTimeout(1000);

    // Seleccionar cuenta Continental Cta. Corriente (382364779308)
    const selectAccount = page.locator('select.input-field').first();
    const options = await selectAccount.locator('option').allInnerTexts();
    console.log('Opciones de cuenta disponibles:', options);
    const contiOption = options.find(o => o.includes('382364779308') || /continental/i.test(o));
    expect(contiOption).toBeTruthy();
    await selectAccount.selectOption({ label: contiOption });
    await page.waitForTimeout(500);

    // Cargar archivo PDF
    const pdfPath = path.resolve(__dirname, '../Datos/Extractos/CONTI CTE.pdf');
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(pdfPath);
    await page.waitForTimeout(1000);

    // Hacer clic en "Analizar y Puntear Extracto"
    const btnAnalizar = page.locator('button:has-text("Analizar y Puntear Extracto")').first();
    await expect(btnAnalizar).toBeVisible();
    await btnAnalizar.click();

    console.log('2. Esperando resultado del punteo previo...');
    // Esperar a que el modal cambie a "Punteo Previo de Conciliación Bancaria"
    const titlePunteo = page.locator('text=Punteo Previo de Conciliación Bancaria').first();
    await expect(titlePunteo).toBeVisible({ timeout: 15000 });

    // Verificar que muestre el Saldo Oficial del Extracto
    const saldoOficial = page.locator('text=Saldo Oficial Extracto').first();
    await expect(saldoOficial).toBeVisible();

    // Verificar las KPI cards del análisis
    await expect(page.locator('text=Total Detectadas').first()).toBeVisible();
    await expect(page.locator('text=Conciliables con ERP').first()).toBeVisible();
    await expect(page.locator('text=Solo en Extracto').first()).toBeVisible();
    await expect(page.locator('text=Ya en Sistema').first()).toBeVisible();

    // Verificar la tabla de movimientos y sus columnas
    await expect(page.locator('th:has-text("Concepto / Descripción")').first()).toBeVisible();
    await expect(page.locator('th:has-text("Punteo / Diagnóstico")').first()).toBeVisible();

    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/punteo-extracto-modal-expandido.png' });
    console.log('✓ Captura guardada: screenshots/punteo-extracto-modal-expandido.png');

    // Probar el filtro de "Ya Registrados"
    const tabYaRegistrados = page.locator('button:has-text("Ya Registrados")').first();
    if (await tabYaRegistrados.isVisible()) {
      await tabYaRegistrados.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'screenshots/punteo-extracto-filtro-registrados.png' });
      console.log('✓ Captura guardada: screenshots/punteo-extracto-filtro-registrados.png');
    }

    // Probar el filtro de "Conciliables"
    const tabConciliables = page.locator('button:has-text("Conciliables")').first();
    if (await tabConciliables.isVisible()) {
      await tabConciliables.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'screenshots/punteo-extracto-filtro-conciliables.png' });
      console.log('✓ Captura guardada: screenshots/punteo-extracto-filtro-conciliables.png');
    }

    // Cerrar modal
    const btnCancelar = page.locator('button:has-text("Cancelar")').last();
    await btnCancelar.click();
    await page.waitForTimeout(1000);

    // 3. Navegar a /boveda y verificar la salud de Bóveda Central
    console.log('3. Navegando a http://100.83.91.76:5173/boveda para verificar Bóveda Central...');
    await page.goto('http://100.83.91.76:5173/boveda', { waitUntil: 'networkidle', timeout: 35000 });
    await page.waitForTimeout(2000);

    const titleBoveda = page.locator('text=Bóveda Central').first();
    await expect(titleBoveda).toBeVisible();

    await page.screenshot({ path: 'screenshots/boveda-central-verificada.png' });
    console.log('✓ Captura guardada: screenshots/boveda-central-verificada.png');
    console.log('✓ PRUEBA E2E COMPLETADA CON ÉXITO');
  });
});
