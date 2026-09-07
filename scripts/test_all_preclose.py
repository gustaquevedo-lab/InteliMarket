import requests
import json

login_res = requests.post('http://100.83.91.76:8000/api/v1/auth/login', json={'email': 'tomasa@intelimarket.com.py', 'password': 'Extra8055*'})
token = login_res.json().get('access_token')
headers = {'Authorization': f'Bearer {token}'}

sessions = [
    ('ZUNILDA RODRIGUEZ (Caja 5 - Punto 015)', 'c64d4688-9c20-45a6-8d45-97a4b6fcca7e'),
    ('TOMASA (Caja 4 - Punto 014)', '81225f58-1c20-43b6-9e28-4c5bc0ce6be1'),
    ('EVELIN HERRERO (Caja 3 - Punto 013)', '914e7eaf-23c2-49e6-9ed0-6fa838b9d891')
]

for name, sid in sessions:
    res = requests.get(f'http://100.83.91.76:8000/api/v1/cash-sessions/{sid}/pre-close-summary', headers=headers)
    d = res.json()
    print("="*60)
    print(f"RESUMEN DE CIERRE: {name}")
    print("="*60)
    print(f"• Total Tickets: {d.get('ventas_count')}")
    print(f"• Total Facturado: {d.get('total_cobrado_pyg', 0):,.0f} Gs")
    print(f"• Fondo Inicial de Apertura: {d.get('monto_apertura_pyg', 0):,.0f} Gs")
    print(f"• Efectivo de Ventas: {d.get('efectivo_pyg_esperado', 0):,.0f} Gs")
    print(f"• 💰 EFECTIVO TOTAL ESPERADO EN GAVETA (PYG): {d.get('efectivo_en_gaveta_esperado_pyg', 0):,.0f} Gs")
    print(f"• 💰 EFECTIVO ESPERADO EN REALES (BRL): R$ {d.get('efectivo_en_gaveta_esperado_brl', 0):.2f}")
    print("• Medios Electrónicos y Crédito:")
    for m in d.get('medios_no_efectivo', []):
        fp = m.get('forma_pago')
        mon = m.get('moneda')
        cnt = m.get('cantidad')
        mnt = m.get('monto')
        print(f"   - {fp} ({mon}): {cnt} operaciones = {mnt:,.0f} Gs")
    print()
