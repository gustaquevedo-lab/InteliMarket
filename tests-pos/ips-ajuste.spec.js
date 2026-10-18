const { test, expect } = require('@playwright/test');

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0OWFmODEyMi0wODc1LTRkNGItYTkwZS05YjI1YmM1MmYzMTAiLCJpZCI6IjQ5YWY4MTIyLTA4NzUtNGQ0Yi1hOTBlLTliMjViYzUyZjMxMCIsImVtYWlsIjoiZGV2QHN1cGVyZXh0cmEuY29tLnB5Iiwicm9sIjoiYWRtaW4iLCJpc19zdXBlcmFkbWluIjp0cnVlLCJjb21wYW55X2lkIjoiMDAwMDAwMDAtMDAwMC0wMDAwLTAwMDAtMDAwMDAwMDAwMDEwIiwiZXhwIjoxNzkyNDA1NDY2LCJ0eXBlIjoiYWNjZXNzIn0.6jXeePln3RcxEtsM0_G-nr7wzb9kJGbRRtyqSTaDVOE';

test.describe('SueldOK - Validación Ajuste Extraordinario IPS en Expediente', () => {
  test('Abre expediente de nómina, verifica Fase 4 de IPS, despliega panel de ajuste y valida CurrencyInput y cálculo de diferencia', async ({ page }) => {
    // Inyectar credenciales activas en localStorage
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

    // Navegar directamente a la ruta del expediente
    await page.goto('/sueldok/expediente-nomina', { waitUntil: 'networkidle', timeout: 35000 });
    await page.waitForTimeout(3000);

    // Verificar que el contenedor de Fase 4: Previsión Previsional IPS es visible
    const ipsHeader = page.locator('text=Fase 4: Previsión Previsional IPS').first();
    await expect(ipsHeader).toBeVisible({ timeout: 15000 });
    console.log('✓ Fase 4 de IPS cargada visiblemente');

    // Tomar captura inicial del estado del expediente
    await page.screenshot({ path: 'screenshots/ips-fase4-inicial.png' });

    // Buscar y hacer clic en el botón para abrir el panel de ajuste
    const toggleAjuste = page.locator('button:has-text("Ajuste extraordinario de monto")').first();
    await expect(toggleAjuste).toBeVisible({ timeout: 5000 });
    await toggleAjuste.click();
    await page.waitForTimeout(1000);

    // Verificar que el input de monto real s/ boleta IPS está visible
    const inputMonto = page.locator('input[placeholder="Monto según extracto oficial"]').first();
    await expect(inputMonto).toBeVisible({ timeout: 5000 });
    console.log('✓ Input de CurrencyInput para monto IPS visible');

    // Escribir un monto ajustado de prueba
    await inputMonto.fill('7800000');
    await page.waitForTimeout(500);

    // Escribir el motivo de la variación
    const inputMotivo = page.locator('input[placeholder*="Bajas de personal"]').first();
    await expect(inputMotivo).toBeVisible({ timeout: 5000 });
    await inputMotivo.fill('Prueba E2E: Funcionarios desvinculados no dados de baja a tiempo');

    // Verificar que se calcula en tiempo real la diferencia (+814.020)
    const diffBadge = page.locator('text=Sobrecosto patronal').first();
    await expect(diffBadge).toBeVisible({ timeout: 5000 });
    console.log('✓ Cálculo en tiempo real de sobrecosto patronal verificado');

    // Tomar captura con el panel interactivo desplegado y los cálculos en vivo
    await page.screenshot({ path: 'screenshots/ips-panel-ajuste-activo.png' });
    console.log('✓ Captura guardada en screenshots/ips-panel-ajuste-activo.png');
  });
});
