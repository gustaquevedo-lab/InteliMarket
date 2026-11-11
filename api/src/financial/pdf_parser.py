import io, re
from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List, Dict, Any
import pdfplumber

def _parse_monto_pyg(val_str: Any) -> Optional[Decimal]:
    if val_str is None:
        return None
    s = str(val_str).strip()
    if not s or s in ("—", "-", "--"):
        return None
    s = s.replace("Gs.", "").replace("Gs", "").replace("₲", "").replace(" ", "").strip()
    if not s:
        return None
    # En Guaraníes los montos son enteros; si viene con decimales triviales (,00 o .00) se eliminan
    if s.endswith(",00") or s.endswith(".00"):
        s = s[:-3]
    # En Paraguay tanto el punto como la coma se usan como separador de miles según el banco
    s_clean = s.replace(".", "").replace(",", "")
    try:
        return Decimal(s_clean)
    except Exception:
        return None

def _extract_nro_cheque(desc: str, ref: str = "") -> Optional[str]:
    desc_upper = (desc or "").upper()
    ref_upper = (ref or "").upper()
    combined = f"{desc_upper} {ref_upper}"
    
    # Solo considerar cheque si la descripción o referencia menciona explícitamente cheque o compensación/clearing
    is_cheque_operation = any(k in desc_upper for k in ["CHEQUE", "CHQ", "CLEARING"]) or "CHQ" in ref_upper
    if not is_cheque_operation:
        return None

    # Si es depósito de cheque 48hs o 24hs, el '48' no es el número de cheque
    combined_cleaned = re.sub(r'CHQ\.?\s*(?:48|24)\s*HS\.?', '', combined)
    
    # Formato Continental: 'CHEQUE DEP.N/B98 353588' o 'CLEARING REC.BCO.44' con ref '98 353588 73-PJC-GAX'
    m_chq = re.search(r'(?:CHEQUE|CHQ)[^\d]*(\d{5,7})', combined_cleaned)
    if m_chq:
        return m_chq.group(1).lstrip('0')
    
    # En ref como '98 353588 73-PJC-GAX' cuando la descripción es CLEARING o CHEQUE
    m_pref = re.search(r'\b\d{1,2}\s+(\d{5,7})\b', ref_upper)
    if m_pref:
        return m_pref.group(1).lstrip('0')
        
    m_gen = re.search(r'(?:CHEQUE|CHQ)[^\d]*(\d{5,7})', combined_cleaned)
    if m_gen:
        return m_gen.group(1).lstrip('0')
    return None

def parse_bank_statement_pdf(pdf_bytes: bytes) -> Dict[str, Any]:
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        if len(pdf.pages) == 0:
            raise ValueError("El archivo PDF está vacío")
        
        p1_text = pdf.pages[0].extract_text() or ""
        
        if "Banco Continental" in p1_text or "bancontinental.com.py" in p1_text:
            return _parse_continental_pdf(pdf)
        elif "Extracto de Cuenta" in p1_text and ("GRUPO SANTA TERESA" in p1_text or "PJC-PREDIO" in p1_text or "Interfisa" in p1_text or "2590" in p1_text):
            return _parse_interfisa_pdf(pdf)
        else:
            raise ValueError("Formato de banco no reconocido. Solo se admiten extractos oficiales de Banco Continental o Banco Interfisa.")

def _group_words_by_row(words: List[Dict[str, Any]], tolerance: float = 3.0) -> List[List[Dict[str, Any]]]:
    """Agrupa palabras extraídas por pdfplumber en filas visuales ordenadas izquierda->derecha."""
    rows: List[List[Dict[str, Any]]] = []
    for w in sorted(words, key=lambda x: (x["top"], x["x0"])):
        if rows and abs(w["top"] - rows[-1][0]["top"]) <= tolerance:
            rows[-1].append(w)
        else:
            rows.append([w])
    return [sorted(r, key=lambda x: x["x0"]) for r in rows]


def _parse_continental_pdf(pdf: pdfplumber.PDF) -> Dict[str, Any]:
    p1_text = pdf.pages[0].extract_text() or ""

    m_cta = (
        re.search(r'(?:Cuenta|CTA):\s*(\d+)', p1_text, re.IGNORECASE)
        or re.search(r'GRUPO SANTA TERESA E\.A\.S\.?\s*(\d+)', p1_text)
    )
    numero_cuenta = m_cta.group(1) if m_cta else ""
    tipo_cuenta = "ahorro" if re.search(r'AHORROS?\s+LIBRES|PYG/AHO', p1_text, re.IGNORECASE) else "corriente"

    m_fechas = re.findall(r'(\d{2}/\d{2}/\d{4})', p1_text)
    periodo_desde = None
    periodo_hasta = None
    if len(m_fechas) >= 2:
        try:
            f1 = datetime.strptime(m_fechas[0], "%d/%m/%Y").date()
            f2 = datetime.strptime(m_fechas[1], "%d/%m/%Y").date()
            periodo_desde = min(f1, f2)
            periodo_hasta = max(f1, f2)
        except Exception:
            pass

    # Extraer Saldo Anterior y Disponible de la tabla superior derecha (evitando "0,0" de Saldos Retenidos)
    saldo_anterior = Decimal("0")
    saldo_disponible: Optional[Decimal] = None
    p1_rows = _group_words_by_row(pdf.pages[0].extract_words())
    for r in p1_rows:
        right_words = [w for w in r if w["x0"] >= 360]
        if not right_words:
            continue
        row_text = " ".join(w["text"] for w in right_words)
        if "Saldo Anterior" in row_text:
            num_toks = [w["text"] for w in right_words if re.match(r'^[\d\.]+$', w["text"])]
            if num_toks:
                val = _parse_monto_pyg(num_toks[-1])
                if val is not None:
                    saldo_anterior = val
        elif "Disponible" in row_text:
            num_toks = [w["text"] for w in right_words if re.match(r'^[\d\.]+$', w["text"])]
            if num_toks:
                val = _parse_monto_pyg(num_toks[-1])
                if val is not None:
                    saldo_disponible = val

    transacciones: List[Dict[str, Any]] = []
    # Límites horizontales por defecto para Continental (actualizados dinámicamente con los encabezados de cada página)
    cut_hora_mov = 104.0
    cut_mov_desc = 212.0
    cut_desc_debe = 388.0
    cut_debe_haber = 452.0
    cut_haber_saldo = 515.0

    for page in pdf.pages:
        rows = _group_words_by_row(page.extract_words())
        for r in rows:
            texts = [w["text"] for w in r]
            if "Debe" in texts and "Haber" in texts and "Saldo" in texts:
                w_mov = next((w for w in r if "Movimiento" in w["text"]), None)
                w_desc = next((w for w in r if "Descrip" in w["text"]), None)
                w_debe = next((w for w in r if w["text"] == "Debe"), None)
                w_haber = next((w for w in r if w["text"] == "Haber"), None)
                w_saldo = next((w for w in r if w["text"] == "Saldo"), None)
                if w_mov:
                    cut_hora_mov = w_mov["x0"] - 6.0
                if w_desc:
                    cut_mov_desc = w_desc["x0"] - 6.0
                if w_debe:
                    cut_desc_debe = w_debe["x0"] - 28.0
                if w_debe and w_haber:
                    cut_debe_haber = (w_debe["x1"] + w_haber["x0"]) / 2.0
                if w_haber and w_saldo:
                    cut_haber_saldo = (w_haber["x1"] + w_saldo["x0"]) / 2.0
                continue

            if not r or r[0]["text"] == "Totales":
                continue

            # Fila válida de movimiento Continental: Dia (01-31) + Hora (HH:MM:SS)
            if (
                len(r) < 4
                or not r[0]["text"].isdigit()
                or len(r[0]["text"]) > 2
                or not re.match(r'^\d{2}:\d{2}:\d{2}$', r[1]["text"])
            ):
                continue

            dia = int(r[0]["text"])
            hora_str = r[1]["text"]
            mov_parts: List[str] = []
            desc_parts: List[str] = []
            debe_parts: List[str] = []
            haber_parts: List[str] = []
            saldo_parts: List[str] = []

            for w in r[2:]:
                xc = (w["x0"] + w["x1"]) / 2.0
                if w["x0"] >= cut_haber_saldo or xc >= cut_haber_saldo:
                    saldo_parts.append(w["text"])
                elif cut_debe_haber <= xc < cut_haber_saldo:
                    haber_parts.append(w["text"])
                elif cut_desc_debe <= xc < cut_debe_haber and re.match(r'^[\d\.,]+$', w["text"]):
                    debe_parts.append(w["text"])
                elif cut_hora_mov <= w["x0"] < cut_mov_desc:
                    mov_parts.append(w["text"])
                else:
                    desc_parts.append(w["text"])

            monto_debe = _parse_monto_pyg("".join(debe_parts))
            monto_haber = _parse_monto_pyg("".join(haber_parts))
            saldo_prog = _parse_monto_pyg("".join(saldo_parts))

            if (monto_debe is None or monto_debe <= 0) and (monto_haber is None or monto_haber <= 0):
                continue

            # Usar estrictamente la columna Debe vs Haber (jamás reescribir con deltas entre filas)
            if monto_debe and monto_debe > 0 and (not monto_haber or monto_haber <= 0):
                tipo = "debito"
                monto = monto_debe
            elif monto_haber and monto_haber > 0 and (not monto_debe or monto_debe <= 0):
                tipo = "credito"
                monto = monto_haber
            else:
                # Resguardo extremo si ambas columnas tuvieran valores
                tipo = "debito" if (monto_debe or Decimal("0")) >= (monto_haber or Decimal("0")) else "credito"
                monto = monto_debe if tipo == "debito" else monto_haber

            fecha_txn = date.today()
            if periodo_desde and periodo_hasta:
                try:
                    if periodo_desde.month == periodo_hasta.month:
                        fecha_txn = date(periodo_desde.year, periodo_desde.month, dia)
                    elif dia >= periodo_desde.day:
                        fecha_txn = date(periodo_desde.year, periodo_desde.month, dia)
                    else:
                        fecha_txn = date(periodo_hasta.year, periodo_hasta.month, dia)
                except ValueError:
                    fecha_txn = periodo_hasta
            elif periodo_desde:
                try:
                    fecha_txn = date(periodo_desde.year, periodo_desde.month, dia)
                except ValueError:
                    fecha_txn = periodo_desde

            desc_str = " ".join(desc_parts).strip() or "MOVIMIENTO BANCARIO"
            mov_codigo = " ".join(mov_parts).strip()
            nro_cheque = _extract_nro_cheque(desc_str, mov_codigo)

            transacciones.append({
                "fecha": fecha_txn,
                "hora": hora_str or None,
                "descripcion": desc_str,
                "referencia": mov_codigo or None,
                "tipo": tipo,
                "monto": monto,
                "saldo_progresivo": saldo_prog,
                "nro_cheque": nro_cheque,
            })

    saldo_cierre = (
        saldo_disponible
        if saldo_disponible is not None
        else (transacciones[-1]["saldo_progresivo"] if transacciones else saldo_anterior)
    )

    return {
        "banco": "BANCO CONTINENTAL",
        "tipo_cuenta": tipo_cuenta,
        "numero_cuenta": numero_cuenta,
        "periodo_desde": periodo_desde,
        "periodo_hasta": periodo_hasta,
        "saldo_anterior": saldo_anterior,
        "saldo_cierre": saldo_cierre,
        "transacciones": transacciones,
    }


def _parse_interfisa_pdf(pdf: pdfplumber.PDF) -> Dict[str, Any]:
    p1_text = pdf.pages[0].extract_text() or ""

    m_cta = (
        re.search(r'(?:Número de Cta|Cta\.?\s*C\.?AHORRO\s*Nº?|Cta)[:\s]*([0-9]+)', p1_text, re.IGNORECASE)
        or re.search(r'\b(2590\d+)\b', p1_text)
    )
    numero_cuenta = m_cta.group(1) if m_cta else ""
    is_ahorro = bool(re.search(r'Ahorros\s+a\s+la\s+Vista|C\.AHORRO|DEBITOS\s+CREDITOS', p1_text, re.IGNORECASE))
    tipo_cuenta = "ahorro" if is_ahorro else "corriente"

    m_fechas = re.findall(r'(\d{2}/\d{2}/\d{4})', p1_text)
    periodo_desde = None
    periodo_hasta = None
    if len(m_fechas) >= 2:
        try:
            f1 = datetime.strptime(m_fechas[0], "%d/%m/%Y").date()
            f2 = datetime.strptime(m_fechas[1], "%d/%m/%Y").date()
            periodo_desde = min(f1, f2)
            periodo_hasta = max(f1, f2)
        except Exception:
            pass

    transacciones: List[Dict[str, Any]] = []
    date_re = re.compile(r'^\d{2}-\d{2}-\d{4}$')
    time_re = re.compile(r'^\d{2}:\d{2}:\d{2}$')

    cut_desc_deb = 300.0
    cut_deb_cred = 395.0
    cut_cred_saldo = 490.0

    for page in pdf.pages:
        rows = _group_words_by_row(page.extract_words())
        header_idx = -1
        for i, r in enumerate(rows):
            joined = " ".join(w["text"].upper() for w in r)
            if ("DEBIT" in joined or "DÉBIT" in joined) and "SALDO" in joined:
                header_idx = i
                w_deb = next((w for w in r if "DEBIT" in w["text"].upper() or "DÉBIT" in w["text"].upper()), None)
                w_cred = next((w for w in r if "CREDIT" in w["text"].upper() or "CRÉDIT" in w["text"].upper()), None)
                w_saldo = next((w for w in r if w["text"].upper() == "SALDO"), None)
                if w_deb and w_cred:
                    cut_deb_cred = (w_deb["x1"] + w_cred["x0"]) / 2.0 + 10.0
                if w_cred and w_saldo:
                    cut_cred_saldo = (w_cred["x1"] + w_saldo["x0"]) / 2.0 + 10.0
                if w_deb:
                    cut_desc_deb = w_deb["x0"] - 25.0
                break

        body_rows = rows[header_idx + 1:] if header_idx >= 0 else rows
        date_row_indices = [
            i for i, r in enumerate(body_rows)
            if len(r) >= 4 and date_re.match(r[0]["text"]) and time_re.match(r[1]["text"])
        ]

        for pos, ri in enumerate(date_row_indices):
            r = body_rows[ri]
            f_str = r[0]["text"]
            h_str = r[1]["text"]
            y_center = r[0]["top"]

            prev_bound = body_rows[date_row_indices[pos - 1]][0]["top"] if pos > 0 else -1.0
            next_bound = body_rows[date_row_indices[pos + 1]][0]["top"] if pos + 1 < len(date_row_indices) else 9999.0

            deb_toks: List[str] = []
            cred_toks: List[str] = []
            saldo_toks: List[str] = []
            comp_toks: List[str] = []
            desc_toks: List[str] = []

            if ri - 1 >= 0 and (ri - 1) not in date_row_indices:
                pr = body_rows[ri - 1]
                py = pr[0]["top"]
                ptxt = " ".join(w["text"] for w in pr).upper()
                if (
                    0 < (y_center - py) <= 7.0
                    and (py - prev_bound) >= (y_center - py)
                    and not any(k in ptxt for k in ("FCH/OPER", "TOTAL", "CANT. MOV", "FONDO DE GARANT", "SALDO"))
                ):
                    desc_toks.extend(w["text"] for w in pr if 120.0 <= w["x0"] < cut_desc_deb)

            start_idx = 3 if is_ahorro else 2
            for w in r[start_idx:]:
                xc = (w["x0"] + w["x1"]) / 2.0
                if w["x0"] >= cut_cred_saldo or xc >= cut_cred_saldo:
                    saldo_toks.append(w["text"])
                elif cut_deb_cred <= xc < cut_cred_saldo:
                    cred_toks.append(w["text"])
                elif cut_desc_deb <= xc < cut_deb_cred:
                    deb_toks.append(w["text"])
                elif is_ahorro and 265.0 <= w["x0"] <= 325.0 and w["text"].isdigit() and len(w["text"]) >= 6:
                    comp_toks.append(w["text"])
                elif not is_ahorro and w["x0"] < 186.0 and not comp_toks and w["text"].isdigit():
                    comp_toks.append(w["text"])
                else:
                    desc_toks.append(w["text"])

            if ri + 1 < len(body_rows) and (ri + 1) not in date_row_indices:
                nr = body_rows[ri + 1]
                ny = nr[0]["top"]
                ntxt = " ".join(w["text"] for w in nr).upper()
                if (
                    0 < (ny - y_center) <= 7.0
                    and (next_bound - ny) > (ny - y_center)
                    and not any(k in ntxt for k in ("TOTAL", "NÚMERO DE MOV", "NUMERO DE MOV", "FONDO DE GARANT", "CANT. MOV", "PÁGINA"))
                ):
                    desc_toks.extend(w["text"] for w in nr if 120.0 <= w["x0"] < cut_desc_deb)

            monto_deb = _parse_monto_pyg("".join(deb_toks))
            monto_cred = _parse_monto_pyg("".join(cred_toks))
            saldo_prog = _parse_monto_pyg("".join(saldo_toks))

            if (monto_deb is None or monto_deb <= 0) and (monto_cred is None or monto_cred <= 0):
                continue

            if monto_deb and monto_deb > 0 and (not monto_cred or monto_cred <= 0):
                tipo = "debito"
                monto = monto_deb
            else:
                tipo = "credito"
                monto = monto_cred

            try:
                fecha_txn = datetime.strptime(f_str, "%d-%m-%Y").date()
            except Exception:
                fecha_txn = date.today()

            full_desc = " ".join(desc_toks).strip() or "MOVIMIENTO BANCARIO"
            comp_str = "".join(comp_toks).strip()
            nro_cheque = _extract_nro_cheque(full_desc, comp_str)

            transacciones.append({
                "fecha": fecha_txn,
                "hora": h_str,
                "descripcion": full_desc,
                "referencia": comp_str or None,
                "tipo": tipo,
                "monto": monto,
                "saldo_progresivo": saldo_prog,
                "nro_cheque": nro_cheque,
            })

    saldo_cierre = transacciones[-1]["saldo_progresivo"] if transacciones else Decimal("0")
    if transacciones and transacciones[0]["saldo_progresivo"] is not None:
        first_tx = transacciones[0]
        saldo_ant = (
            (first_tx["saldo_progresivo"] - first_tx["monto"])
            if first_tx["tipo"] == "credito"
            else (first_tx["saldo_progresivo"] + first_tx["monto"])
        )
    else:
        saldo_ant = Decimal("0")

    return {
        "banco": "BANCO INTERFISA",
        "tipo_cuenta": tipo_cuenta,
        "numero_cuenta": numero_cuenta,
        "periodo_desde": periodo_desde,
        "periodo_hasta": periodo_hasta,
        "saldo_anterior": saldo_ant,
        "saldo_cierre": saldo_cierre,
        "transacciones": transacciones,
    }
