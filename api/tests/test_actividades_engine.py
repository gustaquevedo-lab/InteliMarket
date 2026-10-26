import json
import pathlib
from decimal import Decimal
import pytest

from api.src.actividades.engine import evaluar

FIXTURE_PATH = pathlib.Path(__file__).parent / "fixtures" / "actividades_casos.json"
CASOS = json.loads(FIXTURE_PATH.read_text())


@pytest.mark.parametrize("caso", CASOS, ids=[c["nombre"] for c in CASOS])
def test_caso(caso):
    lineas = []
    for l in caso["lineas"]:
        lineas.append({
            "product_id": str(l["product_id"]),
            "cantidad": Decimal(str(l["cantidad"])),
            "precio": Decimal(str(l["precio"])),
            "costo": Decimal(str(l["costo"])) if l.get("costo") is not None else None,
        })

    actividades = []
    for a in caso["actividades"]:
        actividades.append({
            "id": str(a["id"]),
            "tipo": a["tipo"],
            "producto_ids": [str(pid) for pid in a["producto_ids"]],
            "vigente_hasta": a["vigente_hasta"],
            "saldo": Decimal(str(a["saldo"])),
            "valoriza": a.get("valoriza", "lista"),
            "tramos": [
                {
                    "desde": Decimal(str(t["desde"])) if t.get("desde") is not None else Decimal(0),
                    "porcentaje": Decimal(str(t["porcentaje"])) if t.get("porcentaje") is not None else None,
                    "cada": Decimal(str(t["cada"])) if t.get("cada") is not None else None,
                    "bonifica": Decimal(str(t["bonifica"])) if t.get("bonifica") is not None else None,
                    "producto_bonificado_id": str(t["producto_bonificado_id"]) if t.get("producto_bonificado_id") else None,
                    "tope": Decimal(str(t["tope"])) if t.get("tope") is not None else None,
                }
                for t in a["tramos"]
            ]
        })

    resultado = evaluar(lineas, actividades)

    # Convertimos resultado a JSON serializable con strings para comparar exactamente con caso["esperado"]
    resultado_dict = []
    for r in resultado:
        item = {
            "product_id": r["product_id"],
            "actividad_id": r["actividad_id"],
            "descuento_unitario": str(r["descuento_unitario"]),
            "bonificada": r["bonificada"],
            "valor": str(r["valor"]),
        }
        if "cantidad" in r:
            item["cantidad"] = str(r["cantidad"])
        resultado_dict.append(item)

    assert resultado_dict == caso["esperado"]
