"""XML e-Kuatia generation for SIFEN"""

from lxml import etree
from datetime import datetime

from api.src.sifen.cdc import parse_numero_comprobante, generate_cdc


def _elem(tag: str, text: str) -> etree._Element:
    el = etree.Element(tag)
    el.text = str(text)
    return el


def generate_ekuatia_xml(
    ruc_emisor: str,
    ruc_receptor: str | None,
    nombre_receptor: str | None,
    tipo_de: int,
    timbrado: str,
    numero: str,
    fecha_emision: datetime,
    condicion: str,
    items: list[dict],
    moneda: str = "PYG",
    tipo_cambio: float = 1.0,
) -> tuple[str, str]:
    num_parts = parse_numero_comprobante(numero)

    total_grav10 = 0.0
    total_grav5 = 0.0
    total_exento = 0.0
    total_iva = 0.0
    total_general = 0.0

    g_det = etree.Element("gDtipProServ")
    for item in items:
        cantidad = float(item["cantidad"])
        precio = float(item["precio_unitario"])
        iva_tasa = float(item.get("iva_tasa", 10))
        descuento = float(item.get("descuento_monto", 0))

        subtotal_item = (cantidad * precio) - descuento

        if iva_tasa == 10:
            base = subtotal_item / 1.10
            iva = subtotal_item - base
        elif iva_tasa == 5:
            base = subtotal_item / 1.05
            iva = subtotal_item - base
        else:
            base = subtotal_item
            iva = 0.0

        total_item = base + iva

        if iva_tasa == 10:
            total_grav10 += base
        elif iva_tasa == 5:
            total_grav5 += base
        else:
            total_exento += base
        total_iva += iva
        total_general += total_item

        g_item = etree.SubElement(g_det, "gItem")
        g_item.append(_elem("dCodInt", str(item.get("product_id", ""))))
        g_item.append(_elem("dDesProServ", item.get("descripcion", "Item")))
        g_item.append(_elem("dCantPro", f"{cantidad:.3f}"))
        g_item.append(_elem("dPUniPro", f"{precio:.0f}"))
        g_item.append(_elem("dTotPro", f"{subtotal_item:.0f}"))
        g_item.append(_elem("dTasaIVA", str(int(iva_tasa))))
        g_item.append(_elem("dIVAItem", f"{iva:.0f}"))

    condicion_val = "1" if condicion == "contado" else "2"

    root = etree.Element("DE")

    g_timb = etree.SubElement(root, "gTimb")
    g_timb.append(_elem("dTiDE", str(tipo_de).zfill(2)))
    g_timb.append(_elem("dNumTim", str(timbrado).zfill(8)))
    g_timb.append(_elem("dEst", num_parts["establecimiento"]))
    g_timb.append(_elem("dPunExp", num_parts["punto_expedicion"]))
    g_timb.append(_elem("dNumDoc", num_parts["secuencial"]))
    g_timb.append(_elem("dFeIniT", fecha_emision.strftime("%Y-%m-%d")))
    g_timb.append(_elem("dFeFinT", fecha_emision.strftime("%Y-12-31")))

    g_dat_gral = etree.SubElement(root, "gDatGralOpe")
    g_dat_gral.append(_elem("dFeEmiDE", fecha_emision.isoformat()))
    g_dat_gral.append(_elem("dCond", condicion_val))
    g_dat_gral.append(_elem("dMonTri", moneda))
    if moneda != "PYG":
        g_dat_gral.append(_elem("dTipCam", f"{tipo_cambio:.2f}"))

    g_dat_rec = etree.SubElement(g_dat_gral, "gDatRec")
    if ruc_receptor:
        g_dat_rec.append(_elem("dRucRec", ruc_receptor))
    g_dat_rec.append(_elem("dNomRec", nombre_receptor or "CONSUMIDOR FINAL"))

    root.append(g_det)

    g_tot = etree.SubElement(root, "gTotSub")
    g_tot.append(_elem("dTotGravOp10", f"{total_grav10:.0f}"))
    g_tot.append(_elem("dTotGravOp5", f"{total_grav5:.0f}"))
    g_tot.append(_elem("dTotExe", f"{total_exento:.0f}"))
    g_tot.append(_elem("dTotIVA", f"{total_iva:.0f}"))
    g_tot.append(_elem("dTotGe", f"{total_general:.0f}"))

    cdc = generate_cdc(
        ruc_emisor=ruc_emisor,
        tipo_de=str(tipo_de),
        timbrado=str(timbrado),
        numero=numero,
        fecha_emision=fecha_emision.strftime("%Y-%m-%d"),
        total=str(int(total_general)),
    )
    root.append(_elem("Id", cdc))

    xml_str = etree.tostring(root, encoding="unicode", xml_declaration=False, pretty_print=True)
    return xml_str, cdc
