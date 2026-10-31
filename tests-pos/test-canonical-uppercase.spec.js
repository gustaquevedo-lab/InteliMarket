const { test, expect } = require('@playwright/test');

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0OWFmODEyMi0wODc1LTRkNGItYTkwZS05YjI1YmM1MmYzMTAiLCJpZCI6IjQ5YWY4MTIyLTA4NzUtNGQ0Yi1hOTBlLTliMjViYzUyZjMxMCIsImVtYWlsIjoiZGV2QHN1cGVyZXh0cmEuY29tLnB5Iiwicm9sIjoiYWRtaW4iLCJpc19zdXBlcmFkbWluIjp0cnVlLCJjb21wYW55X2lkIjoiMDAwMDAwMDAtMDAwMC0wMDAwLTAwMDAtMDAwMDAwMDAwMDEwIiwiZXhwIjoxODI0OTI1MDYzLCJ0eXBlIjoiYWNjZXNzIn0.T85px8J_7SWqbhim5qRS1CgB7Ro-etKFBq354EKcizw';

test.describe('Política Canónica Universal: Textos en MAYÚSCULAS', () => {
  test('Inputs de contraseña y correo conservan su casing original en Login', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle', timeout: 35000 });

    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email"]').first();
    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await emailInput.fill('usuario.test@superextra.com.py');
    const emailVal = await emailInput.inputValue();
    expect(emailVal).toBe('usuario.test@superextra.com.py');

    const passInput = page.locator('input[type="password"]').first();
    await expect(passInput).toBeVisible({ timeout: 10000 });
    await passInput.fill('MiClaveSecreta123!');
    const passVal = await passInput.inputValue();
    expect(passVal).toBe('MiClaveSecreta123!');
  });

  test('Inputs de texto y búsqueda en el ERP administrativo se convierten automáticamente a MAYÚSCULAS', async ({ page }) => {
    await page.addInitScript((token) => {
      localStorage.setItem('access_token', token);
      localStorage.setItem('cached_user_profile', JSON.stringify({
        id: '49af8122-0875-4d4b-a90e-9b25bc52f310',
        email: 'dev@superextra.com.py',
        nombre: 'Juan Gabriel Ruiz',
        rol: 'admin',
        is_superadmin: true
      }));
    }, TOKEN);

    await page.goto('/compras', { waitUntil: 'networkidle', timeout: 35000 });
    await page.waitForTimeout(2000);

    // Buscar cualquier input de búsqueda o filtro de texto
    const textInput = page.locator('input[type="text"], input:not([type])').first();
    await expect(textInput).toBeVisible({ timeout: 10000 });

    // Tipear texto en minúsculas
    await textInput.fill('lacteos trebol descremada');
    await page.waitForTimeout(500);

    const val = await textInput.inputValue();
    console.log('✓ Valor ingresado en input:', val);
    expect(val).toBe('LACTEOS TREBOL DESCREMADA');
  });
});
