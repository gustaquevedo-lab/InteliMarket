"""Utilidades compartidas por los "Gerente IA" del sistema (ventas, finanzas,
marketing, riesgo) -- el criterio comun entre los 4 es que el chat SIEMPRE
responde consultando datos reales de la base en el momento de la pregunta,
nunca con texto armado a mano ni cifras hardcodeadas. Esto evita que cada
agente reinvente su propio parsing de "ultimos X dias" con logica distinta.
"""


def parse_periodo_dias(msg_upper: str, default: int = 30) -> int:
    if "HOY" in msg_upper:
        return 1
    if "SEMANA" in msg_upper:
        return 7
    if "MES" in msg_upper:
        return 30
    if "TRIMESTRE" in msg_upper:
        return 90
    if "AÑO" in msg_upper or "ANIO" in msg_upper or "ANUAL" in msg_upper:
        return 365
    return default
