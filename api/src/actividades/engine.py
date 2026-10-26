"""Motor puro de evaluación de actividades de proveedor.
Espejado en TypeScript en inteliforce/lib/actividades.ts
"""

from decimal import Decimal
import math
from api.src.common.money import gs


def evaluar(lineas: list[dict], actividades: list[dict]) -> list[dict]:
    """Evalúa las actividades de proveedor sobre un conjunto de líneas de pedido.

    Args:
        lineas: lista de dicts con:
            - product_id: str
            - cantidad: Decimal
            - precio: Decimal
            - costo: Decimal | None
        actividades: lista de dicts con:
            - id: str
            - tipo: "escala" | "bonificacion"
            - producto_ids: list[str]
            - vigente_hasta: str (YYYY-MM-DD)
            - saldo: Decimal
            - valoriza: "lista" | "costo"
            - tramos: list[dict con desde, porcentaje, cada, bonifica, producto_bonificado_id, tope]

    Returns:
        Lista de líneas resultantes:
        - Una por cada línea original con su mejor descuento aplicado
        - Líneas adicionales por productos bonificados (precio ₲0)
    """
    # 1. Candidatos de descuento por cada línea original (índice en lineas -> lista de ofertas)
    # oferta: (descuento_unitario, vigente_hasta, actividad_id, valor)
    ofertas_por_linea: dict[int, list[dict]] = {idx: [] for idx in range(len(lineas))}

    bonificaciones_aplicadas: list[dict] = []

    for act in actividades:
        prod_set = set(act.get("producto_ids", []))
        # Sumar cantidades de productos en el alcance
        base = sum(
            Decimal(str(l["cantidad"]))
            for l in lineas
            if l["product_id"] in prod_set
        )
        if base <= Decimal(0):
            continue

        tipo = act.get("tipo")
        tramos = act.get("tramos", [])

        if tipo == "escala":
            # Filtrar tramos que se cumplen (desde <= base)
            tramos_cumplidos = [
                t for t in tramos
                if t.get("desde") is not None and Decimal(str(t["desde"])) <= base
            ]
            if not tramos_cumplidos:
                continue

            # Quedarse con el tramo mayor (máximo desde)
            tramo = max(tramos_cumplidos, key=lambda t: Decimal(str(t["desde"])))
            pct = Decimal(str(tramo.get("porcentaje") or 0))
            if pct <= Decimal(0):
                continue

            for idx, l in enumerate(lineas):
                if l["product_id"] in prod_set:
                    precio = Decimal(str(l["precio"]))
                    cant = Decimal(str(l["cantidad"]))
                    desc_unit = gs(precio * pct / Decimal(100))
                    valor = gs(desc_unit * cant)
                    ofertas_por_linea[idx].append({
                        "actividad_id": act["id"],
                        "descuento_unitario": desc_unit,
                        "vigente_hasta": act.get("vigente_hasta", "9999-12-31"),
                        "valor": valor,
                    })

        elif tipo == "bonificacion":
            # Tramos cumplidos
            tramos_cumplidos = [
                t for t in tramos
                if t.get("desde") is not None and Decimal(str(t["desde"])) <= base
            ]
            if not tramos_cumplidos:
                continue

            tramo = max(tramos_cumplidos, key=lambda t: Decimal(str(t["desde"])))
            cada = Decimal(str(tramo.get("cada") or 1))
            bonifica = Decimal(str(tramo.get("bonifica") or 0))
            if cada <= Decimal(0) or bonifica <= Decimal(0):
                continue

            veces = Decimal(math.floor(base / cada))
            unidades = veces * bonifica
            if tramo.get("tope") is not None:
                tope = Decimal(str(tramo["tope"]))
                if unidades > tope:
                    unidades = tope

            if unidades > Decimal(0):
                prod_boni = tramo.get("producto_bonificado_id")
                if not prod_boni:
                    # Producto por defecto: primer producto de la orden que esté en el alcance
                    matching = [l for l in lineas if l["product_id"] in prod_set]
                    prod_boni = matching[0]["product_id"] if matching else None

                if prod_boni:
                    # Valorización
                    valoriza_modo = act.get("valoriza", "lista")
                    matching_boni = [l for l in lineas if l["product_id"] == prod_boni]
                    if matching_boni:
                        costo_ref = matching_boni[0].get("costo")
                        precio_ref = matching_boni[0].get("precio")
                    else:
                        costo_ref = None
                        precio_ref = None

                    if valoriza_modo == "costo" and costo_ref is not None:
                        val_unit = Decimal(str(costo_ref))
                    elif precio_ref is not None:
                        val_unit = Decimal(str(precio_ref))
                    else:
                        val_unit = Decimal(0)

                    valor_total = gs(unidades * val_unit)
                    bonificaciones_aplicadas.append({
                        "product_id": prod_boni,
                        "actividad_id": act["id"],
                        "cantidad": unidades,
                        "descuento_unitario": Decimal(0),
                        "bonificada": True,
                        "valor": valor_total,
                    })

    # 2. Construir resultado para líneas originales
    resultado: list[dict] = []
    for idx, l in enumerate(lineas):
        ofertas = ofertas_por_linea[idx]
        if not ofertas:
            resultado.append({
                "product_id": l["product_id"],
                "actividad_id": None,
                "descuento_unitario": Decimal(0),
                "bonificada": False,
                "valor": Decimal(0),
            })
        else:
            # Gana mayor descuento unitario; empate: vence antes (menor fecha string)
            mejor = max(
                ofertas,
                key=lambda o: (o["descuento_unitario"], -int(o["vigente_hasta"].replace("-", "")))
            )
            resultado.append({
                "product_id": l["product_id"],
                "actividad_id": mejor["actividad_id"],
                "descuento_unitario": mejor["descuento_unitario"],
                "bonificada": False,
                "valor": mejor["valor"],
            })

    # 3. Agregar bonificaciones al final
    resultado.extend(bonificaciones_aplicadas)
    return resultado
