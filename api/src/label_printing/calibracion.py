"""Reglas de calibracion para las impresoras de etiquetas.

Sirven para MEDIR contra el papel real en vez de asumir la resolucion. La
Pantum enseno la leccion: su eje horizontal responde a 8 dots/mm pero el
vertical a 8.889, y darlo por sentado deformaba la etiqueta y recortaba el
contenido sin que se entendiera por que.

Se imprime una regla con marcas rotuladas cada 5mm y un marco del tamano
declarado de la etiqueta. Con dos datos medidos con una regla comun --donde
cae la ultima marca y si el marco coincide con el troquel-- se despeja la
escala real de cada eje.
"""

from decimal import Decimal


def _num(v, default=0.0) -> float:
    if v is None:
        return default
    return float(v) if not isinstance(v, Decimal) else float(v)


def regla_tspl(cfg) -> str:
    """Regla para la Pantum (TSPL). Coordenadas en dots."""
    ancho_mm = _num(getattr(cfg, "ancho_mm", None), 33.0)
    alto_mm = _num(getattr(cfg, "alto_mm", None), 22.0)
    columnas = int(getattr(cfg, "columnas", None) or 1)
    gap_h = _num(getattr(cfg, "gap_horizontal_mm", None), 0.0)
    gap_v = _num(getattr(cfg, "gap_vertical_mm", None), 0.0)
    dx = _num(getattr(cfg, "dpmm_x", None), 8.0) or 8.0
    dy = _num(getattr(cfg, "dpmm_y", None), 8.889) or 8.889

    def X(mm): return int(round(mm * dx))
    def Y(mm): return int(round(mm * dy))

    ancho_total = ancho_mm * columnas + gap_h * (columnas - 1)
    L = [
        f"SIZE {ancho_total:g} mm,{alto_mm:g} mm",
        f"GAP {gap_v:g} mm,0",
        "DIRECTION 1", "REFERENCE 0,0", "DENSITY 8", "SPEED 4", "CLS",
        # marco: deberia coincidir EXACTO con el troquel de la 1er etiqueta
        f"BOX 0,0,{X(ancho_mm)-1},{Y(alto_mm)-1},2",
    ]
    # marcas verticales rotuladas (miden la escala del alto)
    mm = 5.0
    while mm < alto_mm:
        L.append(f"BAR 0,{Y(mm)},44,3")
        L.append(f'TEXT 50,{Y(mm)-8},"1",0,1,1,"{mm:g}mm"')
        mm += 5.0
    # marcas horizontales (miden la escala del ancho)
    mm = 10.0
    while mm < ancho_mm:
        L.append(f"BAR {X(mm)},0,3,26")
        mm += 10.0
    L.append("PRINT 1,1")
    return "\r\n".join(L) + "\r\n"


def regla_zpl(cfg) -> str:
    """Regla para la Zebra (ZPL). Coordenadas en dots, origen arriba-izquierda."""
    ancho_mm = _num(getattr(cfg, "ancho_mm", None), 105.0)
    alto_mm = _num(getattr(cfg, "alto_mm", None), 30.0)
    dx = _num(getattr(cfg, "dpmm_x", None), 8.0) or 8.0
    dy = _num(getattr(cfg, "dpmm_y", None), 8.0) or 8.0

    def X(mm): return int(round(mm * dx))
    def Y(mm): return int(round(mm * dy))

    L = [
        "^XA",
        f"^PW{X(ancho_mm)}",
        f"^LL{Y(alto_mm)}",
        "^LH0,0",
        # marco del tamano declarado: deberia coincidir con el troquel
        f"^FO0,0^GB{X(ancho_mm)-1},{Y(alto_mm)-1},2^FS",
    ]
    # marcas verticales rotuladas cada 5mm (escala del alto)
    mm = 5.0
    while mm < alto_mm:
        L.append(f"^FO0,{Y(mm)}^GB44,3,3^FS")
        L.append(f'^FO50,{Y(mm)-10}^A0N,20,20^FD{mm:g}mm^FS')
        mm += 5.0
    # marcas horizontales rotuladas cada 10mm (escala del ancho)
    mm = 10.0
    while mm < ancho_mm:
        L.append(f"^FO{X(mm)},0^GB3,26,3^FS")
        L.append(f'^FO{X(mm)+5},4^A0N,18,18^FD{mm:g}^FS')
        mm += 10.0
    L.append("^XZ")
    return "".join(L)
