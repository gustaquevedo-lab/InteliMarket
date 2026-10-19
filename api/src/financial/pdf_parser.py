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

def _parse_continental_pdf(pdf: pdfplumber.PDF) -> Dict[str, Any]:
    p1_text = pdf.pages[0].extract_text() or ""
    
    m_cta = re.search(r'(?:Cuenta|CTA):\s*(\d+)', p1_text, re.IGNORECASE) or re.search(r'GRUPO SANTA TERESA E\.A\.S\.\s*(\d+)', p1_text)
    numero_cuenta = m_cta.group(1) if m_cta else ""
    
    tipo_cuenta = "ahorro" if "AHORRO" in p1_text.upper() else "corriente"
    
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
            
    m_saldo_ant = re.search(r'Saldo Anterior\s*([0-9\.,]+)', p1_text)
    saldo_anterior = _parse_monto_pyg(m_saldo_ant.group(1)) if m_saldo_ant else Decimal("0")
    
    transacciones: List[Dict[str, Any]] = []
    prev_saldo = saldo_anterior

    for page in pdf.pages:
        tables = page.extract_tables()
        for table in tables:
            for row in table:
                if not row:
                    continue
                if any("Día" in str(c) or "Dia" in str(c) or "Descripción" in str(c) or "Saldo" in str(c) for c in row if c):
                    continue

                if len(row) == 6:
                    dia_hora = str(row[0] or "").strip()
                    parts = dia_hora.split(" ")
                    dia_str = parts[0] if parts else ""
                    hora_str = parts[1] if len(parts) > 1 else ""
                    mov_codigo = str(row[1] or "").strip()
                    desc_str = str(row[2] or "").strip()
                    debe_str = row[3]
                    haber_str = row[4]
                    saldo_str = row[5]
                elif len(row) >= 7:
                    dia_str = str(row[0] or "").strip()
                    hora_str = str(row[1] or "").strip()
                    mov_codigo = str(row[2] or "").strip()
                    desc_str = str(row[3] or "").strip()
                    debe_str = row[4]
                    haber_str = row[5]
                    saldo_str = row[6]
                else:
                    continue

                if not dia_str.isdigit() or len(dia_str) > 2:
                    continue

                dia = int(dia_str)
                monto_debe = _parse_monto_pyg(debe_str)
                monto_haber = _parse_monto_pyg(haber_str)
                saldo_prog = _parse_monto_pyg(saldo_str)

                if monto_debe is None and monto_haber is None:
                    continue

                tipo = "debito" if monto_debe and monto_debe > 0 else "credito"
                monto = monto_debe if tipo == "debito" else monto_haber

                # Validación matemática infalible por Saldo Progresivo
                if prev_saldo is not None and saldo_prog is not None:
                    delta = saldo_prog - prev_saldo
                    if delta > 0:
                        tipo = "credito"
                        monto = delta
                    elif delta < 0:
                        tipo = "debito"
                        monto = abs(delta)
                prev_saldo = saldo_prog
                
                fecha_txn = date.today()
                if periodo_desde:
                    try:
                        mes = periodo_desde.month
                        anio = periodo_desde.year
                        fecha_txn = date(anio, mes, dia)
                    except ValueError:
                        fecha_txn = periodo_desde
                        
                nro_cheque = _extract_nro_cheque(desc_str, mov_codigo)
                
                transacciones.append({
                    "fecha": fecha_txn,
                    "hora": hora_str or None,
                    "descripcion": desc_str,
                    "referencia": mov_codigo or None,
                    "tipo": tipo,
                    "monto": monto,
                    "saldo_progresivo": saldo_prog,
                    "nro_cheque": nro_cheque
                })
                
    saldo_cierre = transacciones[-1]["saldo_progresivo"] if transacciones else saldo_anterior
    
    return {
        "banco": "BANCO CONTINENTAL",
        "tipo_cuenta": tipo_cuenta,
        "numero_cuenta": numero_cuenta,
        "periodo_desde": periodo_desde,
        "periodo_hasta": periodo_hasta,
        "saldo_anterior": saldo_anterior,
        "saldo_cierre": saldo_cierre,
        "transacciones": transacciones
    }

def _parse_interfisa_pdf(pdf: pdfplumber.PDF) -> Dict[str, Any]:
    p1_text = pdf.pages[0].extract_text() or ""
    
    # Extraer N° Cuenta (ej: 259058910 o 259026699)
    m_cta = re.search(r'(?:Número de Cta|Cta\.?\s*C\.?AHORRO\s*Nº?|Cta)[:\s]*([0-9]+)', p1_text, re.IGNORECASE)
    if not m_cta:
        m_cta = re.search(r'\b(2590\d+)\b', p1_text)
    numero_cuenta = m_cta.group(1) if m_cta else ""
    
    tipo_cuenta = "ahorro" if "AHORRO" in p1_text.upper() else "corriente"
    
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
    
    # Regex para capturar líneas de movimiento de Interfisa (con fecha y hora)
    # Ejemplo: 01-08-2026 10:46:33 260803252704 - 4.700 138.328.853
    # O:       12-08-2026 11:15:28 5613539565 IPS APORTES 4.400 - 86.639.145
    date_line_re = re.compile(r'^(\d{2}-\d{2}-\d{4})\s+(\d{2}:\d{2}:\d{2})\s+(\d+)\s+(.+)$')
    
    for page in pdf.pages:
        text = page.extract_text() or ""
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        
        idx = 0
        while idx < len(lines):
            line = lines[idx]
            m = date_line_re.match(line)
            if not m:
                idx += 1
                continue
                
            f_str, h_str, comp_str, remainder = m.groups()
            
            # Contexto de descripción: puede venir en la línea anterior o siguiente
            desc_parts = []
            if idx > 0 and not date_line_re.match(lines[idx-1]) and "Fch/Oper/Valor" not in lines[idx-1]:
                desc_parts.append(lines[idx-1])
                
            tokens = remainder.split()
            # Los últimos 3 tokens típicamente corresponden a [Débito, Crédito, Saldo]
            # o [Descripción..., Débito, Crédito, Saldo]
            if len(tokens) >= 3:
                saldo_str = tokens[-1]
                cred_str = tokens[-2]
                deb_str = tokens[-3]
                inner_desc = " ".join(tokens[:-3]) if len(tokens) > 3 else ""
            else:
                idx += 1
                continue
                
            if inner_desc:
                desc_parts.append(inner_desc)
                
            if idx + 1 < len(lines) and not date_line_re.match(lines[idx+1]) and "Fch/Oper/Valor" not in lines[idx+1] and "Página" not in lines[idx+1]:
                desc_parts.append(lines[idx+1])
                
            full_desc = " ".join(desc_parts).strip() or "MOVIMIENTO BANCARIO"
            
            try:
                fecha_txn = datetime.strptime(f_str, "%d-%m-%Y").date()
            except Exception:
                fecha_txn = date.today()
                
            monto_deb = _parse_monto_pyg(deb_str) if deb_str != "-" else None
            monto_cred = _parse_monto_pyg(cred_str) if cred_str != "-" else None
            saldo_prog = _parse_monto_pyg(saldo_str)
            
            if monto_deb is None and monto_cred is None:
                idx += 1
                continue
                
            tipo = "debito" if monto_deb is not None and monto_deb > 0 else "credito"
            monto = monto_deb if tipo == "debito" else monto_cred

            # Validación matemática infalible por Saldo Progresivo
            if prev_saldo is not None and saldo_prog is not None:
                delta = saldo_prog - prev_saldo
                if delta > 0:
                    tipo = "credito"
                    monto = delta
                elif delta < 0:
                    tipo = "debito"
                    monto = abs(delta)
            else:
                # Si es el primer movimiento o saldo estático, desambiguar por palabras clave
                desc_upper = full_desc.upper()
                if any(k in desc_upper for k in ["RECIBID", "ACREDIT", "DEPOSITO", "CREDITO"]) and tipo == "debito":
                    tipo = "credito"
                elif any(k in desc_upper for k in ["ENVIAD", "PAGO", "DEB", "OTORGAD"]) and tipo == "credito":
                    tipo = "debito"

            prev_saldo = saldo_prog
            nro_cheque = _extract_nro_cheque(full_desc, comp_str)

            transacciones.append({
                "fecha": fecha_txn,
                "hora": h_str,
                "descripcion": full_desc,
                "referencia": comp_str,
                "tipo": tipo,
                "monto": monto,
                "saldo_progresivo": saldo_prog,
                "nro_cheque": nro_cheque
            })
            idx += 1

    saldo_cierre = transacciones[-1]["saldo_progresivo"] if transacciones else Decimal("0")
    if transacciones:
        first_tx = transacciones[0]
        saldo_ant = (first_tx["saldo_progresivo"] - first_tx["monto"]) if first_tx["tipo"] == "credito" else (first_tx["saldo_progresivo"] + first_tx["monto"])
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
        "transacciones": transacciones
    }
