"""Etiqueta de gondola para la Zebra ZD220 (ZPL nativo).

Calibracion medida contra la impresora real (ver label_printing/calibracion.py):
8 dots/mm en ambos ejes, ancho maximo 832 dots --pedirle mas hace que rechace
el trabajo sin imprimir-- y un offset de 1mm/1mm aplicado con ^LH para caer
sobre el troquel. Todo eso sale de la configuracion, no esta hardcodeado.

Reemplaza al generador anterior, que apilaba texto en posiciones fijas sin
jerarquia y nunca se habia verificado contra papel.
"""

from decimal import Decimal

MAX_ANCHO_DOTS = 832  # cabezal de la ZD220: 104mm a 203dpi

# En la fuente escalable ^A0 el ancho medio por caracter ronda 0.58 del alto.
# Se usa para repartir el texto sin que se pise con el bloque de precio.
RATIO_ANCHO = 0.58


def _num(v, default=0.0) -> float:
    if v is None:
        return default
    return float(v) if not isinstance(v, Decimal) else float(v)


def _esc(t: str) -> str:
    """ZPL usa ^ y ~ como prefijos de comando; hay que neutralizarlos."""
    return (t or "").replace("^", " ").replace("~", " ").replace("\\", " ").strip()


def _fmt_gs(valor) -> str:
    try:
        return f"{int(round(float(valor))):,}".replace(",", ".")
    except (TypeError, ValueError):
        return "0"


def _wrap(texto: str, alto_fuente: int, ancho_disp: int, max_lineas: int) -> list[str]:
    max_chars = max(1, int(ancho_disp / (alto_fuente * RATIO_ANCHO)))
    lineas, actual = [], ""
    for palabra in _esc(texto).split():
        cand = (actual + " " + palabra).strip()
        if len(cand) <= max_chars:
            actual = cand
        else:
            if actual:
                lineas.append(actual)
            actual = palabra[:max_chars]
            if len(lineas) >= max_lineas:
                break
    if actual and len(lineas) < max_lineas:
        lineas.append(actual)
    return lineas[:max_lineas]


def generate_zpl_gondola(items, campos: dict, cfg) -> str:
    """Arma el ZPL de toda la cola de etiquetas de gondola."""
    campos = campos or {}
    dx = _num(getattr(cfg, "dpmm_x", None), 8.0) or 8.0
    dy = _num(getattr(cfg, "dpmm_y", None), 8.0) or 8.0
    off_x = _num(getattr(cfg, "margen_izquierdo_mm", None), 0.0)
    off_y = _num(getattr(cfg, "offset_vertical_mm", None), 0.0)
    ancho_mm = _num(getattr(cfg, "ancho_mm", None), 105.0)
    alto_mm = _num(getattr(cfg, "alto_mm", None), 30.0)
    gap_v = _num(getattr(cfg, "gap_vertical_mm", None), 2.0)

    W = min(int(round(ancho_mm * dx)), MAX_ANCHO_DOTS)
    H = int(round(alto_mm * dy))
    # zona util: descontamos el troquel para que nada quede sobre el corte
    UTIL = int(round((alto_mm - gap_v) * dy))

    # el precio manda: se le reserva la derecha, el resto es para el producto
    ancho_precio = int(W * 0.38)
    x_precio = W - ancho_precio
    ancho_texto = x_precio - 20

    bloques = []
    for item in items:
        cantidad = max(1, int(getattr(item, "cantidad", 1) or 1))
        nombre = getattr(item, "nombre", "") or ""
        codigo = _esc(getattr(item, "codigo_barra", None) or "")
        precio = _fmt_gs(getattr(item, "precio_venta", 0))

        L = [
            "^XA",
            f"^PW{W}",
            f"^LL{H}",
            f"^LH{int(round(off_x * dx))},{int(round(off_y * dy))}",
            "^CI28",  # UTF-8: sin esto los acentos y la N con virgulilla salen mal
        ]

        if campos.get("mostrar_encabezado", True):
            encab = _esc(campos.get("texto_encabezado") or "EXTRA SUPERMERCADO")
            L.append(f"^FO8,6^A0N,22,22^FD{encab}^FS")

        y = 32 if campos.get("mostrar_encabezado", True) else 10
        if campos.get("mostrar_nombre", True):
            alto_nombre = 40
            for linea in _wrap(nombre, alto_nombre, ancho_texto, 2):
                L.append(f"^FO8,{y}^A0N,{alto_nombre},{alto_nombre}^FD{linea}^FS")
                y += alto_nombre + 4

        if campos.get("mostrar_barcode", True) and codigo:
            y_bc = min(y + 4, UTIL - 60)
            L.append(f"^FO8,{y_bc}^BY2,2.5^BCN,44,Y,N,N^FD{codigo}^FS")

        if campos.get("mostrar_precio", True):
            # bloque negro a la derecha con el precio en blanco: es lo que se
            # lee desde lejos en la gondola
            L.append(f"^FO{x_precio},4^GB{ancho_precio - 8},{UTIL - 8},{UTIL - 8}^FS")
            L.append(f"^FO{x_precio + 12},14^A0N,24,24^FR^FDGs.^FS")
            alto_precio = 74 if len(precio) <= 6 else 58
            L.append(f"^FO{x_precio + 12},{14 + 26}^A0N,{alto_precio},{alto_precio}^FR^FD{precio}^FS")

        escalas = getattr(item, "escalas", None) or []
        if campos.get("mostrar_escalas", True) and escalas:
            e = escalas[0]
            texto = f"LLEVANDO {int(e.min_qty)}+: Gs. {_fmt_gs(e.precio_unitario)}"
            L.append(f"^FO8,{UTIL - 26}^A0N,22,22^FD{texto}^FS")

        L.append("^XZ")
        bloques.append("".join(L) * cantidad)

    return "".join(bloques)
