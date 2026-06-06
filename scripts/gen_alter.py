"""
Find all missing columns in DB compared to models and generate ALTER statements.
"""
import re
import subprocess

def get_db_cols():
    r = subprocess.run(['docker', 'exec', '-e', 'PGPASSWORD=intelimarket_dev', 'intelimarket-db',
                        'psql', '-U', 'intelimarket', '-d', 'intelimarket', '-t', '-A', '-F', '|',
                        '-c', "SELECT table_name, column_name FROM information_schema.columns WHERE table_name LIKE 'sv_%' ORDER BY table_name, ordinal_position"],
                       capture_output=True, text=True)
    db = {}
    for line in r.stdout.strip().split('\n'):
        if '|' in line:
            t, c = line.split('|', 1)
            db.setdefault(t.strip(), set()).add(c.strip())
    return db

def get_model_cols():
    with open(r'C:\Users\Gustavo\OneDrive\Dev\Intelimarket\api\src\servicios\models.py') as f:
        m = f.read()
    pattern = re.compile(r'class (\w+)\(Base\):\s*\n\s*__tablename__\s*=\s*"([^"]+)"\s*\n(.*?)(?=\nclass |\Z)', re.DOTALL)
    out = {}
    for cls, table, body in pattern.findall(m):
        cols = re.findall(r'(\w+)\s*=\s*Column\(', body)
        if cols:
            out[table] = set(cols)
    return out

db = get_db_cols()
models = get_model_cols()

# Find missing in db (in model, not in db)
missing = []
for table, model_cols in models.items():
    if table in db:
        for c in model_cols:
            if c not in db[table]:
                missing.append((table, c))

print(f"-- Missing in DB: {len(missing)} columns")
for t, c in missing:
    print(f"-- {t}.{c}")

# Generate ALTERs with safe types
def get_type(t, c):
    if 'json' in c.lower(): return 'JSONB'
    if c in ('description','notas','condiciones','terminos_condiciones','notas_internas','detalle','acceso_notas','descripcion_tecnica','problema_reportado','diagnostico','solucion_aplicada','recomendaciones','nombre_firmante','ci_firmante','satisfaccion_comentario','biografia','motivo','notas_seguimiento','fotos_urls','checklist','firma_cliente_url','coordenadas_visita','sifen_xml_url','pdf_url','archivo_url','thumbnail_url'):
        return 'TEXT'
    if c in ('titulo','numero','estado','codigo','nombre','categoria','unidad','metodo_pago','metodo_pago_propuesto','institucion','numero','tipo','descripcion','nombre_contacto','telefono','email','direccion','ciudad','departamento','codigo_postal','icono','color','pais','slug'):
        return 'VARCHAR(255)'
    if c in ('vertical_codigo','modalidad'):
        return 'VARCHAR(50)'
    if c.endswith('_id'):
        return 'UUID'
    if c.endswith('_at'):
        return 'TIMESTAMPTZ'
    if c.endswith('_date') or 'fecha_' in c:
        return 'DATE'
    if c in ('rating_promedio','primera_visita_pct','nps_promedio','satisfaccion_promedio','calificacion_promedio','primera_visita_exitosa_pct','tasa_retrabajo_pct','descuento_pct','iva_pct','comision_pct','tiempo_promedio_servicio_minutos','tarifa_aplicada','tarifa_hora','tarifa_hora_pyg','tarifa_visita_pyg','lat_base','lng_base','lat','lng','lat_checkin','lng_checkin'):
        return 'NUMERIC'
    if c in ('total','subtotal','iva','descuento','descuento_monto','subtmano_obra','subt_mano_obra','subt_materiales','subt_productos','subtotal_materiales','subtotal_equipos','subtotal_subcontratos','iva_monto','costo_estimado','costo','margen','monto_pagado','saldo','monto','monto_mensual_pyg','monto_total_pyg','precio_unitario','costo_unitario','costo_total','ingresos_generados','comision_ganada','km_recorridos','combustible_pyg','distancia_recorrida_km','total_facturado','total_cobrado'):
        return 'NUMERIC(15,0)'
    if c in ('cantidad','cantidad_actual','cantidad_minima','cantidad_maxima','stock_anterior','stock_actual','duracion_minutos','duracion_min','duracion_real_minutos','tiempo_viaje_minutos','horas','horas_trabajadas','dias_mora','plazo_pago_dias','dias_para_vencer','alerta_dias','dias_aviso_renovacion','duracion_meses','visitas_incluidas_anio','visitas_realizadas','visitas_restantes','tiempo_respuesta_horas','tiempo_resolucion_horas','orden','nivel','numero_serie','capacidad','frecuencia_mantenimiento_dias','frecuencia_visitas','frecuencia','visitas_totales','recordatorio_horas_antes','duracion_estimada_horas','duracion_estimada_min','duracion_estimada_minutos','total_trabajos','total_servicios','total_clientes','clientes_unicos','wo_completadas','wo_canceladas','metros_cuadrados','pisos','habitaciones','banos','radio_km','recargo_km_pyg','tiempo_promedio_minutos','completado_pct','satisfaccion_nps','rating','puntualidad','profesionalismo','calidad','limpieza'):
        return 'INTEGER'
    if c in ('activo','disponible','certificado','es_receso','es_lider_equipo','renovacion_auto','incluye_emergencias','incluye_materiales','incluye_repuestos','requiere_mantenimiento','requiere_garantia','requiere_factura','requiere_permiso','requiere_seguimiento','requiere_sifen','requiere_confirmacion','confirmada','recordatorio_enviado','alerta_enviada','verificado','sifen_enviada','necesita_reposicion','es_urgente','iva_incluido','es_extra','recomendaria','facturable','truck_stock','certificacion_requerida','created_by'):
        return 'BOOLEAN DEFAULT false'
    if c in ('fecha_emision','fecha_vencimiento','fecha_pago_total','fecha','fecha_nacimiento','fecha_programada','fecha_realizada','fecha_inicio','fecha_fin','fecha_ultimo_cobro','fecha_proximo_cobro','fecha_seguimiento','fecha_garantia_fin','fecha_checkin','fecha_inicio','fecha_fin','fecha_instalacion','fecha_ingreso','fecha_emision','fecha_vencimiento','fecha_adquisicion','fecha_alta','fecha_cotizacion','fecha_validez','fecha_aprobacion','fecha_inicio_estimada','fecha_contacto','fecha_preferida','fecha_firma','fecha_creacion','fecha_inicio_real','fecha_fin_real','fecha_servicio','ultimo_mantenimiento','proximo_mantenimiento','ultima_carga','ultimo_conteo','ultima_reposicion','ultimo_abastecimiento'):
        return 'DATE'
    if c.endswith('en') or c.endswith('_ts'):
        return 'TIMESTAMPTZ'
    if c in ('nombre_servicio','numero_serie','numero_visita','periodo','prioridad','ventana_tiempo','franja_horaria','fuente','slug','observaciones_tecnico','aspectos','calificacion','slug','color_calendario','es_urgente','notas_previas','motivo_cancelacion','notas_tecnico','lat_llegada','lng_llegada','hora_desde','hora_hasta','hora_programada','checklist_completado','reporte_url','comprobante_url','tipo_permiso','banco','referencia','sla_texto'):
        return 'TEXT'
    return 'TEXT'

# Group by table
from collections import defaultdict
by_table = defaultdict(list)
for t, c in missing:
    by_table[t].append(c)

# Generate ALTER TABLE statements
stmts = []
for table, cols in by_table.items():
    parts = [f'ADD COLUMN IF NOT EXISTS {c} {get_type(table, c)}' for c in cols]
    stmts.append(f'ALTER TABLE {table} {", ".join(parts)};')

# Write to file
with open(r'C:\Users\Gustavo\OneDrive\Dev\Intelimarket\scripts\fix_sv_columns.sql', 'w') as f:
    f.write('-- Auto-generated ALTER statements to add missing columns\n')
    f.write('-- Add also as JSONB for array types\n\n')
    for s in stmts:
        f.write(s + '\n')

print(f"-- Generated {len(stmts)} ALTER statements")
print(f"-- Written to scripts/fix_sv_columns.sql")
