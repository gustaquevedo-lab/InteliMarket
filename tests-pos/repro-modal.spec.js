const { test, expect } = require('@playwright/test');

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0OWFmODEyMi0wODc1LTRkNGItYTkwZS05YjI1YmM1MmYzMTAiLCJpZCI6IjQ5YWY4MTIyLTA4NzUtNGQ0Yi1hOTBlLTliMjViYzUyZjMxMCIsImVtYWlsIjoiZGV2QHN1cGVyZXh0cmEuY29tLnB5Iiwicm9sIjoiYWRtaW4iLCJpc19zdXBlcmFkbWluIjp0cnVlLCJjb21wYW55X2lkIjoiMDAwMDAwMDAtMDAwMC0wMDAwLTAwMDAtMDAwMDAwMDAwMDEwIiwiZXhwIjoxODI0OTI1MDYzLCJ0eXBlIjoiYWNjZXNzIn0.T85px8J_7SWqbhim5qRS1CgB7Ro-etKFBq354EKcizw';

test('Reproduce: al editar producto, ir a precios, desbloquear costo y seleccionar campo se cierra modal', async ({ page }) => {
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  await page.addInitScript((token) => {
    localStorage.setItem('access_token', token);
    localStorage.setItem('cached_user_profile', JSON.stringify({
      id: '49af8122-0875-4d4b-a90e-9b25bc52f310',
      email: 'dev@superextra.com.py',
      nombre: 'Admin',
      rol: 'admin',
      is_superadmin: true
    }));
  }, TOKEN);

  await page.goto('/products', { waitUntil: 'networkidle', timeout: 35000 });
  await page.waitForTimeout(2500);

  // Click edit button on first product row
  const editBtn = page.locator('button[title*="Editar"], button:has-text("Editar")').first();
  await expect(editBtn).toBeVisible({ timeout: 10000 });
  await editBtn.click();
  await page.waitForTimeout(1000);

  const modalHeader = page.locator('text=Editar Producto:').first();
  await expect(modalHeader).toBeVisible({ timeout: 5000 });
  console.log('✓ Modal de edición de producto abierto');

  // Click tab "Precios, Costo & SIFEN"
  const preciosTab = page.locator('button:has-text("Precios, Costo & SIFEN")').first();
  await expect(preciosTab).toBeVisible({ timeout: 5000 });
  await preciosTab.click();
  await page.waitForTimeout(1000);
  console.log('✓ Clic en pestaña Precios, Costo & SIFEN');

  // Check if "Desbloquear Costo" is visible
  const unlockBtn = page.locator('button:has-text("Desbloquear Costo")').first();
  const isUnlockVisible = await unlockBtn.isVisible();
  console.log('¿Botón Desbloquear Costo visible?:', isUnlockVisible);

  if (isUnlockVisible) {
    await unlockBtn.click();
    await page.waitForTimeout(500);
    console.log('✓ Clic en Desbloquear Costo');
  }

  // Verificar si el modal sigue abierto
  const stillOpen1 = await modalHeader.isVisible();
  console.log('¿Modal sigue abierto tras desbloquear?:', stillOpen1);

  // Ahora hacer clic en el campo Costo Promedio
  const costoLabel = page.locator('label:has-text("Costo Promedio")').first();
  const costoContainer = costoLabel.locator('..').locator('..');
  const costoInput = costoContainer.locator('input').first();
  
  console.log('Haciendo clic / focus en Costo Promedio...');
  await costoInput.click();
  await page.waitForTimeout(500);

  // Probar doble clic (seleccionar todo)
  console.log('Doble clic para seleccionar todo en Costo Promedio...');
  await costoInput.dblclick();
  await page.waitForTimeout(500);
  console.log('¿Modal sigue abierto tras dblclick en Costo?:', await modalHeader.isVisible());

  // Probar seleccionar texto arrastrando con el mouse (drag)
  console.log('Arrastrando mouse para seleccionar texto en Costo Promedio...');
  const box = await costoInput.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width - 5, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 5, box.y + box.height / 2);
    await page.mouse.up();
  }
  await page.waitForTimeout(500);
  console.log('¿Modal sigue abierto tras drag en Costo?:', await modalHeader.isVisible());

  // Probar drag que se pasa del borde del input hacia el fondo
  console.log('Arrastrando mouse desde el input hacia afuera (overshoot al backdrop)...');
  if (box) {
    await page.mouse.move(box.x + 10, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(10, 10); // mover al overlay fuera del modal
    await page.mouse.up();
  }
  await page.waitForTimeout(500);
  console.log('¿Modal sigue abierto tras drag hacia overlay?:', await modalHeader.isVisible());

  // Probar seleccionar texto o escribir en Costo
  await costoInput.fill('15000');
  await page.waitForTimeout(1000);
  console.log('¿Modal sigue abierto tras escribir en Costo?:', await modalHeader.isVisible());

  // Ahora hacer clic en Precio Venta Unitario
  const precioLabel = page.locator('label:has-text("Precio Venta")').first();
  const precioContainer = precioLabel.locator('..').locator('..');
  const precioInput = precioContainer.locator('input').first();

  console.log('Haciendo clic / focus en Precio Venta...');
  await precioInput.click();
  await page.waitForTimeout(1000);
  console.log('¿Modal sigue abierto tras click en Precio Venta?:', await modalHeader.isVisible());

  // Probar seleccionar o escribir en Precio Venta
  await precioInput.fill('22000');
  await page.waitForTimeout(1000);
  console.log('¿Modal sigue abierto tras escribir en Precio Venta?:', await modalHeader.isVisible());

  expect(await modalHeader.isVisible()).toBe(true);
});
