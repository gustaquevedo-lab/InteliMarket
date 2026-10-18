import openpyxl, glob, os
from api.src.financial import statement_import

for f in sorted(glob.glob("Datos/*.xlsx")):
    if "CHEQUES" in f:
        continue
    print(f"*** {f} ***")
    with open(f, "rb") as fp:
        bs = fp.read()
    wb = openpyxl.load_workbook(f, data_only=True)
    mes = 8 if "AGOSTO" in f else 9
    banco = "INTERFISA" if "INTERFISA" in f else "CONTINENTAL"
    for s in wb.sheetnames:
        tipo = statement_import._classify_sheet(s, s)
        if not tipo:
            continue
        try:
            parsed = statement_import.parse_statement(bs, mes, 2026, banco, tipo)
            print(f"  Hoja [{s}] ({tipo}): Saldo Anterior={parsed.get('saldo_anterior')}, Closing Totals={parsed.get('closing_from_totals')}, Cantidad txs={len(parsed.get('transacciones'))}")
        except Exception as e:
            print(f"  Hoja [{s}]: {e}")
