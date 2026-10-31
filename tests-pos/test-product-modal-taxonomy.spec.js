// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.describe('Ficha de Producto - Taxonomía, Marcas y Representantes', () => {
  test('Código fuente contiene los métodos y tipos de taxonomía requeridos en api/index.ts', async () => {
    const apiPath = path.resolve(__dirname, '../ui-web/src/api/index.ts');
    const apiContent = fs.readFileSync(apiPath, 'utf8');

    // Verificar interfaces requeridas
    expect(apiContent).toContain('export interface Representative');
    expect(apiContent).toContain('export interface ProductSection');
    expect(apiContent).toContain('export interface ProductBrand');
    expect(apiContent).toContain('representative_id?: string');
    expect(apiContent).toContain('brand_id?: string');
    expect(apiContent).toContain('tipo_variante?: string');
    expect(apiContent).toContain('section_id?: string');

    // Verificar métodos exportados
    expect(apiContent).toContain('export async function getRepresentatives');
    expect(apiContent).toContain('export async function createRepresentative');
    expect(apiContent).toContain('export async function getSupplierRepresentatives');
    expect(apiContent).toContain('export async function assignSupplierRepresentatives');
    expect(apiContent).toContain('export async function getProductSections');
    expect(apiContent).toContain('export async function createProductSection');
    expect(apiContent).toContain('export async function getProductBrands');
    expect(apiContent).toContain('export async function createProductBrand');
    expect(apiContent).toContain('export async function getCategoryProductCount');
    expect(apiContent).toContain('export async function safeDeleteCategory');

    // Verificar namespaces en objeto api
    expect(apiContent).toContain('representatives: {');
    expect(apiContent).toContain('sections: {');
    expect(apiContent).toContain('brands: {');
  });

  test('ProductsPage implementa taxonomía, marcas, representantes y creación al vuelo', async () => {
    const pagePath = path.resolve(__dirname, '../ui-web/src/pages/products/ProductsPage.tsx');
    const pageContent = fs.readFileSync(pagePath, 'utf8');

    // Verificar estados de taxonomía
    expect(pageContent).toContain('const [representatives, setRepresentatives]');
    expect(pageContent).toContain('const [sections, setSections]');
    expect(pageContent).toContain('const [brands, setBrands]');
    expect(pageContent).toContain('const [quickAddType, setQuickAddType]');

    // Verificar campos en form
    expect(pageContent).toContain('representative_id:');
    expect(pageContent).toContain('brand_id:');
    expect(pageContent).toContain('tipo_variante:');
    expect(pageContent).toContain('section_id:');

    // Verificar botones de creación al vuelo inline
    expect(pageContent).toContain('handleInlineQuickCreate');
    expect(pageContent).toContain('Crear sección rápida');
    expect(pageContent).toContain('Crear categoría rápida');
    expect(pageContent).toContain('Crear representante rápido');
    expect(pageContent).toContain('Crear marca rápida');

    // Verificar payload al guardar producto
    expect(pageContent).toContain('representative_id: form.representative_id');
    expect(pageContent).toContain('brand_id: form.brand_id');
    expect(pageContent).toContain('tipo_variante: form.tipo_variante');
    expect(pageContent).toContain('section_id: form.section_id');
  });
});
