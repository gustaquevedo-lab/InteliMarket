import asyncio
import json
import os
from decimal import Decimal
from sqlalchemy import text
from api.src.db import async_session_factory

async def main():
    async with async_session_factory() as session:
        print("Obteniendo escalas activas...")
        q_tiers = await session.execute(text("""
            SELECT 
                product_id,
                string_agg(min_qty || 'u: ₲' || CAST(ROUND(precio_unitario) AS integer), ' | ' ORDER BY min_qty) as resumen_escalas,
                json_agg(json_build_object(
                    'id', id, 
                    'min_qty', min_qty, 
                    'precio', ROUND(precio_unitario)
                ) ORDER BY min_qty) as tiers_json
            FROM sp_tiered_prices
            WHERE activo = true
            GROUP BY product_id;
        """))
        tiers_by_prod = {}
        for r in q_tiers.mappings().all():
            tiers_by_prod[str(r['product_id'])] = {
                'resumen': r['resumen_escalas'],
                'tiers': r['tiers_json']
            }

        print("Obteniendo ventas y productos con precios vigentes en el sistema...")
        q_items = await session.execute(text("""
            WITH sales_octubre AS (
                SELECT 
                    si.product_id,
                    SUM(si.cantidad) as cant_oct,
                    SUM(si.total) as vta_oct
                FROM sale_items si
                JOIN sales s ON s.id = si.sale_id
                WHERE s.estado = 'confirmado'
                  AND s.fecha >= '2026-10-01 00:00:00'
                GROUP BY si.product_id
            )
            SELECT 
                p.id as product_id,
                p.sku,
                p.codigo_barra,
                p.nombre,
                COALESCE(s.nombre_fantasia, s.razon_social, 'SIN PROVEEDOR') as proveedor,
                COALESCE(c.nombre, 'SIN CATEGORIA') as categoria,
                COALESCE(NULLIF(p.precio_regular, 0), p.precio_venta) as precio_minorista_actual,
                COALESCE(NULLIF(p.costo_promedio, 0), NULLIF(p.ultimo_costo, 0), 0) as costo_promedio,
                p.ultimo_costo,
                COALESCE(so.cant_oct, 0) as cant_oct,
                COALESCE(so.vta_oct, 0) as vta_oct
            FROM products p
            LEFT JOIN product_categories c ON c.id = p.categoria_id
            LEFT JOIN suppliers s ON s.id = p.supplier_id
            LEFT JOIN sales_octubre so ON so.product_id = p.id
            WHERE p.activo = true
            ORDER BY so.vta_oct DESC NULLS LAST;
        """))
        rows = q_items.mappings().all()

        traffic_keywords_user = [
            'COCA COLA', 'FANTA', 'SPRITE', 'DEL VALLE', 'BENEDICTINO', 'PARESA',
            'ESTRELLA', 'PAELLA',
            'ACEITE', 'COAMO', 'MIRAFLORES', 'PRIMOR',
            'COSTILLA',
            'HUEVO',
            'OMO', 'YPE', 'YPÊ',
            'CONTI', 'BRAHMITA', 'BRAHMA', 'DEL PUERTO', 'SKOL', 'MICHELOB',
            'CANES', 'PRONTO DOG'
        ]

        additional_traffic_skus = {
            '15810', '52458', '120114', '120827', '121073', '124520',
            '120020', '6115', '117251', '124421', '124073', '120415',
            '122559', '120146', '120095', '120594', '120121'
        }

        # Márgenes comerciales objetivos realistas para Retail / Supermercado
        def get_target_margin(cat):
            c = cat.strip().upper()
            if any(k in c for k in ['CARNE', 'COSTILLA', 'POLLO', 'MENUDENCIA', 'CERDO']):
                return 0.18
            if any(k in c for k in ['VERDUR', 'FRUTA', 'LEGUMBR']):
                return 0.22
            if any(k in c for k in ['ALIMENT', 'DESPENSA', 'HARINA', 'FIDEO', 'ARROZ', 'CONSERVA', 'MASA', 'ACEITE', 'ADEREZO', 'CONDIMENTO']):
                return 0.22
            if any(k in c for k in ['LACTEO', 'LECHE', 'DERIVADO', 'QUESO', 'FIAMBRE', 'EMBUTIDO', 'TREBOL']):
                return 0.24
            if any(k in c for k in ['PANADERIA', 'CONFITERIA', 'ROTISERIA', 'PAN']):
                return 0.35
            if any(k in c for k in ['LIMPIEZA', 'LAVANDERIA', 'JABON', 'DETERGENTE']):
                return 0.28
            if any(k in c for k in ['PERFUMERIA', 'HIGIENE', 'COSMETICA', 'BEBE', 'CUIDADO', 'DENTAL', 'CAPILAR', 'DESODORANTE', 'FEMENINO']):
                return 0.30
            if any(k in c for k in ['SIN ALCOHOL', 'GASEOSA', 'JUGO', 'AGUA', 'INFUSION', 'CAFE', 'TE']):
                return 0.22
            if any(k in c for k in ['CON ALCOHOL', 'CERVEZA', 'VINO', 'LICOR', 'WHISKY', 'DESTILADO', 'TRAGO']):
                return 0.25
            if any(k in c for k in ['DULCE', 'GOLOSINA', 'SNACK', 'CHOCOLATE', 'GALLETIT']):
                return 0.30
            if any(k in c for k in ['BAZAR', 'FERRETERIA', 'PLASTICO', 'ACCESORIO', 'JUGUETE', 'LIBRERIA', 'COCINA', 'HOGAR']):
                return 0.35
            if any(k in c for k in ['MASCOTA', 'CANES', 'DOG', 'CAT']):
                return 0.20
            return 0.25

        def round_pyg(val):
            if val is None or val <= 0:
                return 0
            return int(round(val))

        data = []
        for r in rows:
            pid = str(r['product_id'])
            nom_upper = r['nombre'].upper()
            cat_upper = r['categoria'].upper()
            sku = str(r['sku'] or '')
            p_minorista_act = float(r['precio_minorista_actual'] or 0)
            costo = float(r['costo_promedio'] or 0)
            
            cant_oct = float(r['cant_oct'] or 0)
            vta_oct = float(r['vta_oct'] or 0)

            # Precio promedio ponderado histórico real de las ventas de Octubre
            if cant_oct > 0 and vta_oct > 0:
                p_prom_oct = vta_oct / cant_oct
            else:
                p_prom_oct = p_minorista_act

            # Margen Minorista Góndola Vigente (PVP vs Costo)
            if p_minorista_act > 0 and costo > 0:
                m_minorista_act = ((p_minorista_act - costo) / p_minorista_act * 100)
            else:
                m_minorista_act = 0.0

            # Margen Efectivo Real Histórico de Octubre (Precio Promedio Octubre vs Costo)
            if p_prom_oct > 0 and costo > 0:
                m_efectivo_oct = ((p_prom_oct - costo) / p_prom_oct * 100)
            else:
                m_efectivo_oct = m_minorista_act

            is_traffic = (
                any(k in nom_upper for k in traffic_keywords_user) or
                cat_upper == 'PARESA' or
                cat_upper == 'VERDURAS' or
                sku in additional_traffic_skus
            )

            raw_tiers = tiers_by_prod.get(pid, {}).get('tiers', [])
            tier_data = []
            for t in raw_tiers:
                t_price = float(t.get('precio') or 0)
                t_margin = round(((t_price - costo) / t_price * 100), 1) if (t_price > 0 and costo > 0) else 0.0
                tier_data.append({
                    'id': t.get('id'),
                    'min_qty': t.get('min_qty'),
                    'precio': round_pyg(t_price),
                    'margin': t_margin
                })

            if is_traffic:
                estrategia = 'PROTEGIDO'
                p_minorista_sug = p_minorista_act
                m_sug = m_minorista_act
            else:
                estrategia = 'SUGERIDO'
                target_m = get_target_margin(r['categoria'])

                if costo > 0:
                    p_requerido = costo / (1.0 - target_m)
                    # No bajar precio si ya tiene buen margen; topear aumento sugerido a un 20% maximo
                    if p_minorista_act > 0:
                        max_cap = p_minorista_act * 1.20
                        p_sug_val = max(p_minorista_act, min(p_requerido, max_cap))
                    else:
                        p_sug_val = p_requerido
                    p_minorista_sug = round_pyg(p_sug_val)
                    m_sug = ((p_minorista_sug - costo) / p_minorista_sug * 100) if p_minorista_sug > 0 else 0.0
                else:
                    p_minorista_sug = p_minorista_act
                    m_sug = m_minorista_act

            data.append({
                'id': pid,
                'sku': sku,
                'bar': r['codigo_barra'] or '',
                'nom': r['nombre'],
                'prv': r['proveedor'],
                'cat': r['categoria'],
                'est': estrategia,
                'cst': round_pyg(costo),
                'p_act': round_pyg(p_minorista_act),
                'm_min_act': round(m_minorista_act, 1),
                'p_eff_act': round_pyg(p_prom_oct),
                'm_eff_act': round(m_efectivo_oct, 1),
                'p_sug': round_pyg(p_minorista_sug),
                'm_sug': round(m_sug, 1),
                'cant_oct': round(cant_oct, 1),
                'vta_oct': round_pyg(vta_oct),
                'tiers': tier_data
            })

        print(f"Total productos procesados: {len(data)}")
        
        # Guardar en JSON compacto
        json_path = 'docs/auditoria_data.json'
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
        print(f"Guardado exitosamente {json_path}")

        # Guardar como JS para carga directa en el navegador
        js_path = 'docs/auditoria_data.js'
        with open(js_path, 'w', encoding='utf-8') as f:
            f.write("window.AUDITORIA_DATA = ")
            json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
            f.write(";\n")
        print(f"Guardado exitosamente {js_path}")

if __name__ == '__main__':
    asyncio.run(main())
