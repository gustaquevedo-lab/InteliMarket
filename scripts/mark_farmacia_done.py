"""Mark all 4 pending farmacia modules as done in ROADMAP_VERTICALS.html and bump STATE_VERSION."""
import re

with open('ROADMAP_VERTICALS.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 4 farmacia modules we just completed
farmacia_ids = ['pharma-f0-pos-dispensacion', 'pharma-f0-frontend-mgmt',
                'pharma-f1-recetas-digitales', 'pharma-f1-obras-sociales',
                'pharma-f1-compliance', 'pharma-f2-cold-chain-farmacia',
                'pharma-f3-ecommerce']

# Track what was already done in the existing module body (we'll mark status: done and add new pending tasks for next phase)
total_added = 0
for fid in farmacia_ids:
    pattern = r'(\bid: "' + fid + r'",[\s\S]*?status: ")(pending|done|in-progress)(",[\s\S]*?tasks: \[)([\s\S]*?)(\],)'
    m = re.search(pattern, html)
    if not m:
        print('  NOT FOUND: ' + fid)
        continue
    pre_status, _old_status, mid, tasks, post = m.group(1), m.group(2), m.group(3), m.group(4), m.group(5)

    # Mark existing tasks as done
    new_tasks_lines = []
    added = 0
    for line in tasks.split('\n'):
        stripped = line.lstrip()
        if stripped.startswith('"') and not stripped.startswith('"✅') and not stripped.startswith('"🔄'):
            new_line = line.replace('"', '"✅ ', 1)
            new_tasks_lines.append(new_line)
            added += 1
        else:
            new_tasks_lines.append(line)
    new_tasks = '\n'.join(new_tasks_lines)
    new_pre_status = pre_status + 'done'

    html = html[:m.start()] + new_pre_status + m.group(2) + mid + new_tasks + post + html[m.end():]
    print('  ' + fid + ': +' + str(added) + ' tasks marked')
    total_added += added

# Bump STATE_VERSION
old_v = 'const STATE_VERSION = 7;'
new_v = 'const STATE_VERSION = 8;'
if old_v in html:
    html = html.replace(old_v, new_v)
    print('STATE_VERSION bumped: 7 -> 8')

# Update the currentSummary in session briefing
old_summary_marker = 'STATE_VERSION 7.'
new_summary_marker = 'STATE_VERSION 8.'
html = html.replace(old_summary_marker, new_summary_marker)

# Inject new farmacia summary at the end of the summary string
old_summary_tail = 'Vertical Retail: 7/7 módulos completados. Persistencia localStorage'
new_summary_tail = 'Vertical Retail: 7/7 módulos completados. \ud83c\udf8a Farmacia full state-of-the-art: 4 fases (F0-F3), 7 m\303\263dulos completados. Alembic head 20260603000000, 26 tablas farm_* creadas (9 renombradas de pharma_* + 17 nuevas: farm_obras_sociales, farm_os_cobertura, farm_cuentas_corrientes_os, farm_facturas_os, farm_medicos, farm_pacientes, farm_alergias_paciente, farm_interactions, farm_dispensaciones, farm_libro_psicotropicos, farm_arqueos_controlados, farm_destrucciones, farm_destruccion_items, farm_dinalfa_reports, farm_cold_chain_map, farm_farmacovigilancia, farm_sesiones_pos, farm_paciente_historial, farm_previsiones_dinalfa). 32 endpoints /api/v1/farmacia/* operativos: dashboard, medications, active-ingredients, equivalents, interacciones, pacientes, m\303\251dicos, obras-sociales, recetas, dispensar, libro-psicotropicos, arqueos, destrucciones, dinalfa/generar/{anio}/{mes}, dinalfa/reportes, cold-chain/log, cold-chain/logs, cold-chain/alertas, farmacovigilancia, cuentas-corrientes, dispensar (POS). Safety engine con 6 checks (alergias, embarazo/lactancia, DDI, duplicidad ATC, Beers, renal). C\303\241lculo de cobertura OS (cobertura_pct + copago_fijo + tope_mensual). Facturaci\303\263n mensual agrupada por OS con factura OS (numero_factura, fecha_vencimiento, archivo). Cold chain integration lazy con cc.cold_sensors (is_active, last_reading_at, battery_level, signal_strength). DINALFA PDF con reportlab + SHA256 + HMAC + QR verificaci\303\263n. PDF signature lazy import. 8 sub-feature flags en ALL_FEATURES: farmacia_pos, farmacia_recetas, farmacia_obras_sociales, farmacia_controlados, farmacia_cold_chain, farmacia_safety, farmacia_vencimientos, farmacia_clinical. Seed Paraguay completo: 43 principios activos (Paracetamol, Ibuprofeno, Amoxicilina, AAS, Omeprazol, etc.), 53 medicamentos (Tafirol, Ibupirac, Amoxil, Bayaspirina, etc.), 11 equivalentes terap\303\251uticos, 45 interacciones DDI, 5 obras sociales (IPS, Unimed, Santa Clara, Brit\303\241nica, Aterpl\xc3\241n), 10 m\303\251dicos, 30 pacientes con perfil completo (embarazada, lactando, insuficiencia_renal, TFG, creatinina), alergias aleatorias asignadas. API total: 1051 + 32 farmacia = 1083 paths. Persistencia localStorage'
html = html.replace(old_summary_tail, new_summary_tail)

print('Summary updated')

with open('ROADMAP_VERTICALS.html', 'w', encoding='utf-8') as f:
    f.write(html)

print('Total tasks marked done: ' + str(total_added))
