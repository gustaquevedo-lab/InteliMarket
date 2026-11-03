const { test, expect } = require('@playwright/test');

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0OWFmODEyMi0wODc1LTRkNGItYTkwZS05YjI1YmM1MmYzMTAiLCJpZCI6IjQ5YWY4MTIyLTA4NzUtNGQ0Yi1hOTBlLTliMjViYzUyZjMxMCIsImVtYWlsIjoiZGV2QHN1cGVyZXh0cmEuY29tLnB5Iiwicm9sIjoiYWRtaW4iLCJpc19zdXBlcmFkbWluIjp0cnVlLCJjb21wYW55X2lkIjoiMDAwMDAwMDAtMDAwMC0wMDAwLTAwMDAtMDAwMDAwMDAwMDEwIiwiZXhwIjoxODI0OTI1MDYzLCJ0eXBlIjoiYWNjZXNzIn0.T85px8J_7SWqbhim5qRS1CgB7Ro-etKFBq354EKcizw';

test.describe('Módulo de Cuentas Bancarias - Workspace Detalle', () => {
  test('Captura cockpit con nicknames y espacio de trabajo de la cuenta activa', async ({ page }) => {
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

    await page.goto('/bancos', { waitUntil: 'networkidle', timeout: 35000 });
    await page.waitForTimeout(3000);

    // Scrollear hacia abajo hasta el Cockpit y Hero de Cuenta
    const cockpitTitle = page.locator('text=Cuentas Bancarias (').first();
    await cockpitTitle.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/bancos-cockpit-and-hero.png' });
    console.log('✓ Captura Cockpit y Hero de Cuenta guardada');

    // Seleccionar específicamente Interfisa Cta. Corriente
    const selectEl = page.locator('select').first();
    const options = await selectEl.locator('option').allInnerTexts();
    console.log('Opciones de cuenta:', options);
    const interfisaOpt = options.find(o => /interfisa/i.test(o) && /corriente/i.test(o));
    if (interfisaOpt) {
      await selectEl.selectOption({ label: interfisaOpt });
      await page.waitForTimeout(1500);
    }

    // Scrollear a la tabla de movimientos
    const movsTable = page.locator('text=Movimientos Bancarios').first();
    if (await movsTable.isVisible()) {
      await movsTable.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'screenshots/bancos-movimientos-interfisa.png' });
      console.log('✓ Captura Tabla de Movimientos Interfisa guardada');
    }
  });
});
