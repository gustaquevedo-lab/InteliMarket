import os
from decimal import Decimal
import pytest
from api.src.financial.pdf_parser import parse_bank_statement_pdf

def test_parse_continental_pdf():
    pdf_path = "Datos/CONTINENTAL CTA CTE SEPTIEMBRE 2026.pdf"
    if not os.path.exists(pdf_path):
        pytest.skip("Archivo de prueba no encontrado")
        
    with open(pdf_path, "rb") as f:
        data = parse_bank_statement_pdf(f.read())
        
    assert data["banco"] == "BANCO CONTINENTAL"
    assert "382364779308" in data["numero_cuenta"]
    assert len(data["transacciones"]) > 0
    
    # Verificar que extraiga cheques
    cheques = [t for t in data["transacciones"] if t["nro_cheque"]]
    assert len(cheques) > 0
    print(f"Total transacciones Continental: {len(data['transacciones'])}, con cheque: {len(cheques)}")

def test_parse_interfisa_pdf():
    pdf_path = "Datos/INTERFISA CTE MES DE AGOSTO 2026.pdf"
    if not os.path.exists(pdf_path):
        pytest.skip("Archivo de prueba no encontrado")
        
    with open(pdf_path, "rb") as f:
        data = parse_bank_statement_pdf(f.read())
        
    assert data["banco"] == "BANCO INTERFISA"
    assert "259058910" in data["numero_cuenta"]
    assert len(data["transacciones"]) > 0
    print(f"Total transacciones Interfisa: {len(data['transacciones'])}")
