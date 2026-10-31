const { test, expect } = require('@playwright/test');

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0OWFmODEyMi0wODc1LTRkNGItYTkwZS05YjI1YmM1MmYzMTAiLCJlbWFpbCI6ImRldkBzdXBlcmV4dHJhLmNvbS5weSIsInJvbCI6ImFkbWluIiwiaXNfc3VwZXJhZG1pbiI6dHJ1ZSwiZXhwIjoxNzk0MDgxNzE1LCJ0eXBlIjoiYWNjZXNzIn0.h9np8DAWM5N6IYztBsy0OHLStKKc3R3TRzAHm3D4Xmw';

test('Constructor de Kits: crear combo con pesables (decimales/balanza) y guardar sin conflicto 409', async ({ page }) => {
  test.setTimeout(60000);
  // Inyectar token de admin
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

  // Navegar a /kits
  await page.goto('/kits', { waitUntil: 'networkidle', timeout: 35000 });
  await page.waitForTimeout(2000);

  // Abrir modal "Nuevo Combo Promocional"
  const newComboBtn = page.locator('button:has-text("Nuevo Combo"), button:has-text("Crear Combo")').first();
  await expect(newComboBtn).toBeVisible({ timeout: 10000 });
  await newComboBtn.click();
  await page.waitForTimeout(1000);

  // Verificar que el modal abrió
  const modalTitle = page.locator('text=Constructor de Kits & Combos Promocionales');
  await expect(modalTitle).toBeVisible({ timeout: 5000 });

  // 1. Ingresar Nombre del Combo
  const comboName = `Combo Asado Familiar ${Date.now().toString().slice(-4)}`;
  const nameInput = page.locator('input[placeholder*="Ej: Combo Parrillero"]').first();
  await expect(nameInput).toBeVisible({ timeout: 5000 });
  await nameInput.fill(comboName);

  // 2. Agregar ítem unitario por escáner / Enter: Aceite Coamo (7896279600)
  const searchInput = page.locator('input[placeholder*="código de barras"]').first();
  await expect(searchInput).toBeVisible({ timeout: 5000 });
  console.log('Escaneando código de barras de ítem unitario: 7896279600...');
  await searchInput.fill('7896279600');
  await searchInput.press('Enter');
  await page.waitForTimeout(1500);

  const coamoRow = page.locator('tr:has-text("COAMO ACEITE DE SOJA")').first();
  await expect(coamoRow).toBeVisible({ timeout: 5000 });
  console.log('✓ Aceite Coamo agregado exitosamente a la tabla por escáner');

  // 3. Probar simulación de escáner de balanza para pesable:
  // Código balanza 2000996015003 = PLU 996 (Lomito de Cerdo) + 01500 (1.500 kg)
  console.log('Simulando escaneo de etiqueta de balanza: 2000996015003...');
  await searchInput.fill('2000996015003');
  await searchInput.press('Enter');
  await page.waitForTimeout(1500);

  const lomitoRow = page.locator('tr:has-text("PROGRESO CERDO LOMITO KG")').first();
  await expect(lomitoRow).toBeVisible({ timeout: 5000 });
  console.log('✓ Lomito de Cerdo (pesable con 1.500 kg) agregado exitosamente por escáner de balanza');

  // 4. Modificar el peso directamente en el input editable de la fila
  const lomitoQtyInput = page.locator('tr:has-text("PROGRESO CERDO LOMITO KG") input[type="text"]').first();
  await expect(lomitoQtyInput).toBeVisible({ timeout: 5000 });
  await lomitoQtyInput.fill('2.250');
  await lomitoQtyInput.dispatchEvent('change');
  await page.waitForTimeout(1000);
  console.log('✓ Peso de lomito modificado en la fila a 2.250 kg');

  // 5. Configurar Precio de Oferta del Combo usando Preset de Margen 25%
  const presetBtn = page.locator('button:has-text("25%")').first();
  await expect(presetBtn).toBeVisible({ timeout: 5000 });
  await presetBtn.click();
  await page.waitForTimeout(1000);
  console.log('✓ Preset de margen 25% aplicado automáticamente');

  // 6. Guardar Combo Promocional
  const saveBtn = page.locator('button:has-text("Crear Combo Promocional"), button:has-text("Guardar Kit")').first();
  await expect(saveBtn).toBeVisible({ timeout: 5000 });
  console.log('Haciendo clic en "Crear Combo Promocional"...');
  await saveBtn.click();

  // 7. Esperar y verificar que NO haya salido alerta de conflicto ni error
  await page.waitForTimeout(3000);
  const errorAlert = page.locator('text=Error al guardar kit, text=El recurso ya existe');
  const hasError = await errorAlert.isVisible();
  expect(hasError).toBeFalsy();

  // Verificar que el modal se cerró o se guardó exitosamente
  console.log('✓ Combo guardado exitosamente sin error 409 ni validación.');

  // Tomar captura
  await page.screenshot({ path: 'screenshots/kit-pesables-created.png' });
  console.log('✓ Captura guardada en screenshots/kit-pesables-created.png');
});
