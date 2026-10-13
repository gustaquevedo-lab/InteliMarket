import asyncio
import httpx

COMPANY_ID = '00000000-0000-0000-0000-000000000010'

endpoints = [
    # Dashboard & Reports
    ('Dashboard All KPIs', f'/api/reports/companies/{COMPANY_ID}/dashboard-all-kpis'),
    ('Dashboard Quick KPIs', f'/api/reports/companies/{COMPANY_ID}/dashboard-quick-kpis'),
    ('Pacing MTD', f'/api/reports/companies/{COMPANY_ID}/dashboard-all-kpis'),
    
    # Ventas & POS
    ('Ventas Mayoristas', f'/api/v1/companies/{COMPANY_ID}/sales?limit=5'),
    ('Cotizaciones', f'/api/v1/companies/{COMPANY_ID}/quotes?limit=5'),
    ('Pedidos Preventa', f'/api/v1/companies/{COMPANY_ID}/sales-orders?limit=5'),
    ('Devoluciones Clientes', f'/api/v1/companies/{COMPANY_ID}/returns?limit=5'),
    ('Listas de Precios', f'/api/v1/price-lists'),
    
    # Clientes & Cuentas Corrientes
    ('Clientes Mayoristas', f'/api/v1/companies/{COMPANY_ID}/customers?limit=5'),
    ('Líneas de Crédito', f'/api/v1/credit-accounts?limit=5'),
    ('Cuentas por Cobrar', f'/api/v1/companies/{COMPANY_ID}/accounts-receivable?limit=5'),
    ('Aging Cobranzas', f'/api/v1/companies/{COMPANY_ID}/accounts-receivable/aging'),
    ('Resumen Cobranzas', f'/api/v1/companies/{COMPANY_ID}/accounts-receivable/summary'),
    
    # Productos & Inventario
    ('Catálogo Productos', f'/api/v1/companies/{COMPANY_ID}/products?limit=5'),
    ('Categorías', f'/api/v1/companies/{COMPANY_ID}/categories'),
    ('Depósitos & Almacenes', f'/api/v1/companies/{COMPANY_ID}/warehouses'),
    ('Stock por Almacén', f'/api/v1/companies/{COMPANY_ID}/stock?limit=5'),
    ('Productos Bajo Stock', f'/api/v1/companies/{COMPANY_ID}/low-stock?limit=5'),
    ('Variantes', f'/api/v1/variants?limit=5'),
    
    # Compras & Proveedores
    ('Proveedores', f'/api/v1/companies/{COMPANY_ID}/suppliers?limit=5'),
    ('Órdenes de Compra', f'/api/v1/companies/{COMPANY_ID}/purchase-orders?limit=5'),
    ('Recepciones de Compra', f'/api/v1/companies/{COMPANY_ID}/purchase-receipts?limit=5'),
    ('Contratos Proveedores', f'/api/v1/companies/{COMPANY_ID}/supplier-contracts?limit=5'),
    ('KPIs PARESA / Rebates', f'/api/v1/supplier-kpis/dashboard?company_id={COMPANY_ID}'),
    ('Periodos KPIs Proveedor', f'/api/v1/supplier-kpis/periods'),
    ('Devoluciones a Proveedor', f'/api/v1/companies/{COMPANY_ID}/supplier-returns'),
    
    # Finanzas & Tesorería
    ('Facturas de Compras', f'/api/v1/financial/invoices?company_id={COMPANY_ID}&limit=5'),
    ('Aging Cuentas a Pagar', f'/api/v1/financial/aging?company_id={COMPANY_ID}'),
    ('Dashboard Cuentas a Pagar', f'/api/v1/financial/dashboard?company_id={COMPANY_ID}'),
    ('Cuentas Bancarias', f'/api/v1/financial/banks?company_id={COMPANY_ID}'),
    ('Dashboard Bancos', f'/api/v1/financial/banks/dashboard?company_id={COMPANY_ID}'),
    ('Gestión de Cheques', f'/api/v1/checks?company_id={COMPANY_ID}&limit=5'),
    ('Resumen de Cheques', f'/api/v1/checks/summary?company_id={COMPANY_ID}'),
    ('Sesiones de Caja', f'/api/v1/cash-sessions?limit=5'),
    
    # Preventa, Logística y Distribución
    ('Metas de Venta (Baseline)', f'/api/v1/companies/{COMPANY_ID}/sales-targets/baseline'),
    ('Vendedores Preventa', f'/api/v1/companies/{COMPANY_ID}/sales-reps'),
    ('Rutas Distribuidora', f'/api/v1/distribuidora/routes/{COMPANY_ID}'),
    ('Acuerdos Clientes Dist.', f'/api/v1/distribuidora/customer-agreements/{COMPANY_ID}'),
    ('Contenedores Importación', f'/api/v1/distribuidora/containers/{COMPANY_ID}'),
    
    # Asistente Virtual Marco & SIFEN
    ('Marco IA - Estado Cerebro', f'/api/v1/asistente-virtual/brain/status?company_id={COMPANY_ID}'),
    ('SIFEN Timbrados', f'/api/v1/sifen/timbrados'),
    ('SIFEN Respuestas', f'/api/v1/sifen/responses?company_id={COMPANY_ID}&limit=5'),
]

async def main():
    from api.src.main import app
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url='http://testserver', timeout=30.0) as client:
        r = await client.post('/api/v1/auth/login', json={'email': 'admin@casagonzalito.py', 'password': 'admin123'})
        token = r.json().get('access_token')
        headers = {'Authorization': f'Bearer {token}'}
        
        col_mod = "MODULO / FUNCIONALIDAD"
        col_stat = "STATUS"
        col_size = "SIZE"
        print(f'{col_mod:<32} | {col_stat:<8} | {col_size:<8} | ENDPOINT', flush=True)
        print('='*90, flush=True)
        
        ok_count = 0
        for name, url in endpoints:
            try:
                res = await client.get(url, headers=headers)
                status = res.status_code
                size = len(res.text)
                if status == 200:
                    ok_count += 1
                    print(f'{name:<32} | 200 OK   | {size:<8} | {url}', flush=True)
                else:
                    print(f'{name:<32} | {status:<8} | {size:<8} | {url}', flush=True)
                    print(f'   --> DETAIL: {res.text[:100]}', flush=True)
            except Exception as e:
                print(f'{name:<32} | ERROR    | {str(e)[:30]}', flush=True)
        
        print('='*90, flush=True)
        pct = (ok_count / len(endpoints)) * 100
        print(f'TOTAL MODULOS CONECTADOS: {ok_count} / {len(endpoints)} ({pct:.1f}%)', flush=True)

if __name__ == '__main__':
    asyncio.run(main())

