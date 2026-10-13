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

# Ancho maximo del cabezal de la ZD220: 104mm a 203dpi
MAX_ANCHO_DOTS = 832


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
    off_x = _num(getattr(cfg, "margen_izquierdo_mm", None), 0.0)
    off_y = _num(getattr(cfg, "offset_vertical_mm", None), 0.0)

    def X(mm): return int(round(mm * dx))
    def Y(mm): return int(round(mm * dy))

    # El cabezal de la ZD220 imprime hasta 104mm (832 dots a 203dpi). Pedirle
    # mas ancho del que tiene fisicamente hace que rechace el trabajo (la luz
    # parpadea y no sale nada), asi que se recorta al maximo real.
    ancho_dots = min(X(ancho_mm), MAX_ANCHO_DOTS)

    L = [
        "^XA",
        f"^PW{ancho_dots}",
        f"^LL{Y(alto_mm)}",
        # ^LH corre TODO el contenido: asi se centra sobre el troquel
        f"^LH{X(off_x)},{Y(off_y)}",
        # marco del tamano declarado: deberia coincidir con el troquel
        f"^FO0,0^GB{ancho_dots-1},{Y(alto_mm)-1},2^FS",
    ]
    # marcas verticales rotuladas cada 5mm (escala del alto)
    mm = 5.0
    while mm < alto_mm:
        L.append(f"^FO0,{Y(mm)}^GB44,3,3^FS")
        L.append(f'^FO50,{Y(mm)-10}^A0N,20,20^FD{mm:g}mm^FS')
        mm += 5.0
    # marcas horizontales rotuladas cada 10mm (escala del ancho)
    mm = 10.0
    while X(mm) < ancho_dots:
        L.append(f"^FO{X(mm)},0^GB3,26,3^FS")
        L.append(f'^FO{X(mm)+5},4^A0N,18,18^FD{mm:g}^FS')
        mm += 10.0
    L.append("^XZ")
    return "".join(L)


def calibrar_medio(tipo: str) -> str:
    """Le pide a la impresora que aprenda el paso del papel que tiene puesto.

    Hace falta cada vez que se cambia de rollo: sin esto la impresora no
    encuentra el troquel, y algunas (la Zebra) directamente rechazan el
    trabajo -- parpadean y no imprimen.
    """
    if tipo == "zebra_zpl":
        return "~JC"          # calibracion de medio de Zebra
    return "GAPDETECT\r\n"   # equivalente en TSPL para la Pantum


def config_impresora(tipo: str) -> str:
    """Imprime la etiqueta de configuracion de la propia impresora.

    Es la fuente mas confiable para saber su resolucion real, el largo de
    etiqueta que detecto y en que lenguaje esta operando, sin depender de lo
    que nosotros supongamos.
    """
    if tipo == "zebra_zpl":
        return "~WC"
    return "SELFTEST\r\n"


def prueba_minima(tipo: str) -> str:
    """El trabajo mas simple posible que la impresora deberia entender.

    Sirve para separar dos causas cuando "no imprime": si esto SALE, el camino
    (driver, spooler, QZ) esta sano y el problema esta en el contenido que
    generamos; si NO sale, el problema es el camino y no vale la pena tocar el
    diseno.
    """
    if tipo == "zebra_zpl":
        return "^XA^FO40,40^A0N,40,40^FDPRUEBA OK^FS^XZ"
    return 'SIZE 105 mm,22 mm\r\nGAP 2 mm,0\r\nCLS\r\nTEXT 40,40,"3",0,1,1,"PRUEBA OK"\r\nPRINT 1,1\r\n'
