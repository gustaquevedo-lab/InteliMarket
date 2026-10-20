import { test, expect } from '@playwright/test';

test.describe('Operaciones de Salón y Kioscos', () => {
  test('Pizarra TV Digital Carnicería 1080p en vivo', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('http://100.83.91.76:5173/kiosk/carniceria-tv', { waitUntil: 'domcontentloaded' });
    
    // Esperar carga de cortes
    await page.waitForTimeout(2000);
    
    // Validar título y cortes
    await expect(page.locator('text=CARNICERÍA')).toBeVisible();
    await page.screenshot({ path: 'tests-pos/screenshots/carniceria-tv-1080p.png', fullPage: true });
  });

  test('Verificador de Precios con balanza Balmak Edge prefijo 20', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('http://100.83.91.76:5173/kiosk/verificador-precios', { waitUntil: 'networkidle' });
    
    // Esperar a que esté listo para escanear
    await page.waitForTimeout(1000);
    
    // Simular tipeo de código de barras Balmak Edge como pistola de código de barras
    // 20 + 00100 (PLU 100) + 00750 (750g) + 0 = 2000100007500
    await page.keyboard.type('2000100007500', { delay: 10 });
    await page.keyboard.press('Enter');
    
    // Esperar respuesta de producto
    await page.waitForTimeout(2000);
    
    // Tomar captura
    await page.screenshot({ path: 'tests-pos/screenshots/verificador-precios-balanza.png' });
  });
});
