"""Generador de etiquetas TSPL para la Pantum PT-D160 (rollo 3 al hilo).

POR QUE TSPL Y NO HTML RASTERIZADO
----------------------------------
El camino anterior (renderizar HTML y mandarlo como imagen via QZ Tray)
nunca pudo calibrarse: el driver Seagull de esta impresora recorta el area
imprimible y QZ escala el diseno para que entre (~95%), asi que cada
milimetro configurado salia multiplicado por ese factor y el error se
acumulaba hacia la derecha. Con TSPL le hablamos a la impresora en su
lenguaje nativo: posiciones en dots, sin escalado intermedio, y el codigo de
barras lo genera el firmware (mucho mas legible que uno rasterizado).

Es el mismo enfoque que ya usa la Zebra en este modulo (ver generate_zpl).

CALIBRACION MEDIDA EN LA IMPRESORA REAL (2026-09-06, COMPRAS2)
--------------------------------------------------------------
- Horizontal: 8.0 dots/mm (203dpi nominal).
- Vertical:   8.889 dots/mm. NO es 8: se midio imprimiendo una regla y
  viendo donde caia cada marca. Declarar SIZE con el alto real (22mm) y
  dibujar a 8.889 da el resultado correcto; compensar el SIZE hacia arriba
  desborda el contenido a la etiqueta siguiente.
- Offset por columna: la 1ra necesita +1mm, las otras dos 0. Se deja
  configurable porque depende del troquelado del rollo, no de la impresora.
- Ancho de caracter REAL = glifo + espaciado (ver FONT_WIDTH). Usar el ancho
  del glifo solo (12 dots en la fuente 2) hace que el texto se parta.
"""

from decimal import Decimal

# Ancho real por caracter en dots (glifo + espaciado), medido en papel.
FONT_WIDTH = {"1": 10, "2": 14, "3": 18, "4": 26}
MARGEN_DOTS = 8  # resguardo lateral para que nada toque el troquelado


def _num(v, default=0.0) -> float:
    if v is None:
        return default
    if isinstance(v, Decimal):
        return float(v)
    return float(v)


def _esc(texto: str) -> str:
    """TSPL delimita cadenas con comillas dobles; hay que neutralizarlas."""
    return (texto or "").replace('"', "'").replace("\r", " ").replace("\n", " ")


def _wrap(texto: str, font: str, ancho_util: int, max_lineas: int) -> list[str]:
    max_chars = max(1, ancho_util // FONT_WIDTH[font])
    lineas: list[str] = []
    actual = ""
    for palabra in (texto or "").split():
        candidata = (actual + " " + palabra).strip()
        if len(candidata) <= max_chars:
            actual = candidata
        else:
            if actual:
                lineas.append(actual)
            actual = palabra[:max_chars]
            if len(lineas) >= max_lineas:
                break
    if actual and len(lineas) < max_lineas:
        lineas.append(actual)
    return lineas[:max_lineas]


def _centrar(texto: str, font: str, ancho_dots: int) -> int:
    return max(MARGEN_DOTS, (ancho_dots - len(texto) * FONT_WIDTH[font]) // 2)


def _fmt_gs(valor) -> str:
    try:
        return f"{int(round(float(valor))):,}".replace(",", ".")
    except (TypeError, ValueError):
        return "0"


def _etiqueta(ox_dots: int, ancho_dots: int, item, campos: dict) -> list[str]:
    """Comandos de UNA etiqueta, desplazada ox_dots desde el origen."""
    cmds: list[str] = []
    ancho_util = ancho_dots - 2 * MARGEN_DOTS

    encabezado = _esc(campos.get("texto_encabezado") or "EXTRA SUPERMERCADO")
    if campos.get("mostrar_encabezado", True) and encabezado:
        cmds.append(f'TEXT {ox_dots + _centrar(encabezado, "1", ancho_dots)},4,"1",0,1,1,"{encabezado}"')

    if campos.get("mostrar_nombre", True):
        nombre = _esc(getattr(item, "nombre", "") or "")
        for i, linea in enumerate(_wrap(nombre, "2", ancho_util, 2)):
            cmds.append(f'TEXT {ox_dots + _centrar(linea, "2", ancho_dots)},{22 + i * 22},"2",0,1,1,"{linea}"')

    codigo = _esc(getattr(item, "codigo_barra", None) or "")
    if campos.get("mostrar_barcode", True) and codigo:
        cmds.append(f'BARCODE {ox_dots + 30},70,"128",36,0,0,2,4,"{codigo}"')
        cmds.append(f'TEXT {ox_dots + _centrar(codigo, "1", ancho_dots)},110,"1",0,1,1,"{codigo}"')

    if campos.get("mostrar_precio", True):
        texto = f"Gs. {_fmt_gs(getattr(item, 'precio_venta', 0))}"
        # si no entra en la fuente grande, baja sola en vez de desbordar
        font = "4" if len(texto) * FONT_WIDTH["4"] <= ancho_util else "3"
        cmds.append(f'TEXT {ox_dots + _centrar(texto, font, ancho_dots)},130,"{font}",0,1,1,"{texto}"')
        # REVERSE invierte la zona: el texto queda blanco sobre negro.
        # OJO: no dibujar un BAR debajo -- el REVERSE lo cancelaria.
        cmds.append(f"REVERSE {ox_dots + 6},126,{ancho_dots - 12},42")

    return cmds


def generate_tspl(items, campos: dict, cfg) -> str:
    """Arma el trabajo TSPL completo para la cola de etiquetas.

    Cada 'PRINT' imprime una fila completa del rollo (N etiquetas al hilo),
    por eso los items se agrupan de a `columnas`.
    """
    campos = campos or {}
    ancho_mm = _num(getattr(cfg, "ancho_mm", None), 33.0)
    alto_mm = _num(getattr(cfg, "alto_mm", None), 22.0)
    columnas = int(getattr(cfg, "columnas", None) or 3)
    gap_h = _num(getattr(cfg, "gap_horizontal_mm", None), 3.0)
    gap_v = _num(getattr(cfg, "gap_vertical_mm", None), 2.0)
    dpmm_x = _num(getattr(cfg, "dpmm_x", None), 8.0) or 8.0
    dpmm_y = _num(getattr(cfg, "dpmm_y", None), 8.889) or 8.889

    # offsets por columna, ej "1,0,0" -- corrigen el troquelado del rollo
    crudo = (getattr(cfg, "offsets_columnas_mm", None) or "").strip()
    try:
        offsets = [float(p) for p in crudo.split(",") if p.strip() != ""]
    except ValueError:
        offsets = []
    while len(offsets) < columnas:
        offsets.append(0.0)

    ancho_dots = int(round(ancho_mm * dpmm_x))
    ancho_total_mm = ancho_mm * columnas + gap_h * (columnas - 1)

    # expandir por cantidad
    celdas = []
    for item in items:
        for _ in range(max(1, int(getattr(item, "cantidad", 1) or 1))):
            celdas.append(item)

    lineas = [
        f"SIZE {ancho_total_mm:g} mm,{alto_mm:g} mm",
        f"GAP {gap_v:g} mm,0",
        "DIRECTION 1",
        "REFERENCE 0,0",
        "DENSITY 8",
        "SPEED 4",
    ]

    for inicio in range(0, len(celdas), columnas):
        fila = celdas[inicio:inicio + columnas]
        lineas.append("CLS")
        for col, item in enumerate(fila):
            ox_mm = col * (ancho_mm + gap_h) + offsets[col]
            lineas.extend(_etiqueta(int(round(ox_mm * dpmm_x)), ancho_dots, item, campos))
        lineas.append("PRINT 1,1")

    return "\r\n".join(lineas) + "\r\n"
