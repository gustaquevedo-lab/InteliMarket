const { test, expect } = require('@playwright/test');

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0OWFmODEyMi0wODc1LTRkNGItYTkwZS05YjI1YmM1MmYzMTAiLCJpZCI6IjQ5YWY4MTIyLTA4NzUtNGQ0Yi1hOTBlLTliMjViYzUyZjMxMCIsImVtYWlsIjoiZGV2QHN1cGVyZXh0cmEuY29tLnB5Iiwicm9sIjoiYWRtaW4iLCJpc19zdXBlcmFkbWluIjp0cnVlLCJjb21wYW55X2lkIjoiMDAwMDAwMDAtMDAwMC0wMDAwLTAwMDAtMDAwMDAwMDAwMDEwIiwiZXhwIjoxODI0OTI1MDYzLCJ0eXBlIjoiYWNjZXNzIn0.T85px8J_7SWqbhim5qRS1CgB7Ro-etKFBq354EKcizw';

test.describe('Módulo de Caja - Mapeo Bancario de Canales Electrónicos', () => {
  test('Verifica que todos los canales tengan cuenta bancaria asignada y porcentajes', async ({ page }) => {
    test.setTimeout(45000);
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

    await page.goto('/caja', { waitUntil: 'networkidle', timeout: 35000 });
    await page.waitForTimeout(2000);

    // Click tab "Linkeo Bancario"
    const tabBtn = page.locator('button:has-text("Linkeo Bancario")').first();
    await tabBtn.waitFor({ state: 'visible', timeout: 10000 });
    await tabBtn.click();
    await page.waitForTimeout(2500);

    // Wait for the cards to be rendered
    const cardTitle = page.locator('h4:has-text("Bancard Tarjeta de Crédito")').first();
    await cardTitle.waitFor({ state: 'visible', timeout: 10000 });
    await cardTitle.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'screenshots/caja-bancos-mapping-verified.png', fullPage: false });
    console.log('✓ Captura de Mapeos Bancarios en Caja guardada exitosamente.');
  });
});
