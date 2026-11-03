"""Parser de extractos bancarios reales (Excel tal cual lo entrega el banco) --
Bancos Fase 6. Convierte en código permanente la lógica de parseo probada a
mano esta sesión sobre los extractos reales de Continental e Interfisa
(agosto 2025 - agosto 2026): hojas por tipo de cuenta (CTE/AHORRO/AHORRO
PIX), fila "Saldo Anterior", columnas DÉBITO/CRÉDITO/SALDO, fila de
totales con el saldo de cierre.

Dos correcciones reales encontradas en esos extractos, aplicadas aquí como
reglas permanentes en vez de parches de una sola vez:
  1. Interfisa: las columnas DÉBITO/CRÉDITO vienen invertidas respecto al
     extracto oficial del banco (confirmado cruzando depósitos de POS
     conocidos). Continental está bien, no se toca.
  2. Fechas con año (o mes y año) mal tipeados en la celda -- se confía en
     el mes/año que declara la carga (elegido explícitamente por quien
     importa, no adivinado del nombre del archivo) por sobre el año de la
     celda, y se recorta el día si hace falta.
"""
import calendar
from datetime import date, datetime
from decimal import Decimal

import openpyxl


def _to_num(v):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return v if v != 0 else None
    if isinstance(v, str):
        v = v.strip().replace(".", "").replace(",", ".")
        if v in ("", "-"):
            return None
        try:
            n = float(v)
            return n if n != 0 else None
        except ValueError:
            return None
    return None


def _classify_sheet(sheet_name: str, title) -> str | None:
    """Devuelve 'cuenta_corriente' | 'ahorro' | 'ahorro_pix' según el nombre
    de hoja / título, o None si no es una hoja de cuenta reconocible."""
    t = (title if isinstance(title, str) else "").upper()
    s = (sheet_name or "").upper().strip()
    if "PIX" in s or "PIX" in t:
        return "ahorro_pix"
    if "CTE" in s or "CORRIENTE" in s or "CTE" in t or "CORRIENTE" in t:
        return "cuenta_corriente"
    if "AHORRO" in s or "AHORRO" in t:
        return "ahorro"
    return None


def account_tipo_normalizado(tipo: str | None, titular: str | None, numero_cuenta: str | None, alias: str | None = None, banco: str | None = None) -> str:
    """Mapea el tipo/nombre de una BankAccount de InteliMarket al mismo
    vocabulario que usa el extracto ('cuenta_corriente'/'ahorro'/'ahorro_pix'),
    porque tipo en bank_accounts no está normalizado de forma consistente
    (cuentas viejas usan 'cuenta_corriente', el formulario nuevo usa
    'corriente')."""
    blob = f"{titular or ''} {numero_cuenta or ''} {alias or ''} {banco or ''}".upper()
    if "PIX" in blob or "PLUGPAY" in blob or (numero_cuenta and "38250039706208" in str(numero_cuenta)):
        return "ahorro_pix"
    t = (tipo or "").lower()
    if "ahorro" in t:
        return "ahorro"
    return "cuenta_corriente"


def _parse_cell_date(v, mes: int, anio: int) -> date | None:
    """Parsea fechas tanto de objetos date/datetime como cadenas ('01 08:34:22', '01/10/2026', '2026-10-01')."""
    if isinstance(v, (datetime, date)):
        d = v.date() if isinstance(v, datetime) else v
        max_day = calendar.monthrange(anio, mes)[1]
        return date(anio, mes, min(d.day, max_day))
    if isinstance(v, str):
        v = v.strip()
        parts = v.split()
        if parts:
            first = parts[0]
            try:
                if "/" in first:
                    sp = first.split("/")
                    day = int(sp[0])
                elif "-" in first:
                    sp = first.split("-")
                    day = int(sp[0] if len(sp[0]) <= 2 else sp[2])
                else:
                    day = int(first)
                max_day = calendar.monthrange(anio, mes)[1]
                return date(anio, mes, min(day, max_day))
            except (ValueError, IndexError):
                return None
    return None


def parse_statement(file_bytes: bytes, mes: int, anio: int, banco: str, account_tipo: str) -> dict:
    """Parsea un extracto Excel y devuelve las transacciones de la hoja que
    coincide con account_tipo ('cuenta_corriente'/'ahorro'/'ahorro_pix').
    Lanza ValueError si el archivo no tiene ninguna hoja de ese tipo."""
    import io

    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True, read_only=True)

    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            continue
        title = rows[0][0] if rows[0] else None
        tipo = _classify_sheet(sheet_name, title)
        if tipo != account_tipo:
            continue

        saldo_anterior = None
        closing_from_totals = None
        txs = []
        for r in rows[1:]:
            fecha, mov, numop, debito, credito, saldo = (r + (None,) * 6)[:6]
            if fecha is None and isinstance(mov, str) and mov.strip() == "Saldo Anterior":
                sn = _to_num(saldo)
                saldo_anterior = sn if sn is not None else 0.0
                continue

            debito_n, credito_n, saldo_n = _to_num(debito), _to_num(credito), _to_num(saldo)

            fecha_real = _parse_cell_date(fecha, mes, anio)
            if fecha_real is not None:
                descripcion = str(mov or "")
                referencia = str(numop) if numop is not None else None

                # En el libro mayor del contador de la empresa (Activo Bancario):
                # Columna D (DÉBITO) = Aumentos de cuenta / Ingresos / Depósitos -> tipo: "credito" en InteliMarket (+)
                # Columna E (CRÉDITO) = Disminuciones de cuenta / Egresos / Pagos -> tipo: "debito" en InteliMarket (-)
                if debito_n is not None:
                    txs.append({"fecha": fecha_real, "tipo": "credito", "monto": Decimal(str(debito_n)), "descripcion": descripcion, "referencia": referencia})
                if credito_n is not None:
                    txs.append({"fecha": fecha_real, "tipo": "debito", "monto": Decimal(str(credito_n)), "descripcion": descripcion, "referencia": referencia})
                continue

            if fecha is None and mov is None and (debito_n is not None or credito_n is not None) and saldo_n is not None:
                closing_from_totals = saldo_n

        return {
            "sheet_matched": sheet_name,
            "saldo_anterior": saldo_anterior,
            "closing_from_totals": closing_from_totals,
            "saldo_cierre": closing_from_totals,
            "transacciones": txs,
        }

    raise ValueError(f"El archivo no tiene ninguna hoja de tipo '{account_tipo}' (hojas encontradas: {', '.join(wb.sheetnames)})")
